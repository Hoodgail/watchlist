/**
 * HLS Offline Loader
 * Custom hls.js fragment loader for playing back HLS content from IndexedDB
 * 
 * This module provides:
 * 1. A custom fragment loader that serves segments from IndexedDB
 * 2. A virtual M3U8 playlist generator from stored segment metadata
 */

import Hls, { 
  LoaderContext, 
  LoaderConfiguration, 
  LoaderCallbacks,
  FragmentLoaderContext,
  Loader,
  LoaderStats,
  HlsConfig,
} from 'hls.js';
import { 
  getHLSSegment, 
  getHLSSegmentMetadata, 
  getOfflineEpisode,
  getHLSInitSegment,
} from './offlineVideoStorage';

// ============ Types ============

interface OfflineLoaderConfig {
  episodeId: string;
}

// ============ Virtual M3U8 Generation ============

/**
 * Generate a virtual M3U8 playlist from stored segment metadata
 * This allows hls.js to understand the segment structure
 */
export async function generateOfflineM3U8(episodeId: string): Promise<string> {
  const metadata = await getHLSSegmentMetadata(episodeId);
  const episode = await getOfflineEpisode(episodeId);
  
  if (metadata.length === 0) {
    throw new Error(`No segments found for episode ${episodeId}`);
  }
  
  // Calculate target duration (max segment duration, rounded up)
  const maxDuration = Math.max(...metadata.map(m => m.duration));
  const targetDuration = Math.ceil(maxDuration);
  
  // Determine if we need version 6+ for fMP4 (EXT-X-MAP)
  const hasInitSegment = episode?.hlsHasInitSegment;
  const version = hasInitSegment ? 6 : 3;
  
  // Build M3U8 content
  const lines: string[] = [
    '#EXTM3U',
    `#EXT-X-VERSION:${version}`,
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
  ];
  
  // Add init segment for fMP4 if present
  if (hasInitSegment) {
    lines.push(`#EXT-X-MAP:URI="offline://${episodeId}/init.mp4"`);
  }
  
  // Add segments
  for (const seg of metadata) {
    lines.push(`#EXTINF:${seg.duration.toFixed(3)},`);
    // Use a virtual URL scheme that our loader will intercept
    // Use .m4s extension for fMP4 segments, .ts for MPEG-TS
    const extension = hasInitSegment ? 'm4s' : 'ts';
    lines.push(`offline://${episodeId}/segment/${seg.index}.${extension}`);
  }
  
  // End marker
  lines.push('#EXT-X-ENDLIST');
  
  return lines.join('\n');
}

/**
 * Create a blob URL for the virtual M3U8 playlist
 */
export async function getOfflineM3U8Url(episodeId: string): Promise<string> {
  const m3u8Content = await generateOfflineM3U8(episodeId);
  const blob = new Blob([m3u8Content], { type: 'application/vnd.apple.mpegurl' });
  return URL.createObjectURL(blob);
}

// ============ Custom Fragment Loader ============

/**
 * Check if a URL is an offline segment URL
 */
function isOfflineUrl(url: string): boolean {
  return url.startsWith('offline://');
}

/**
 * Parse an offline segment URL to get episodeId and segment index
 * Returns null if not a valid offline URL
 */
function parseOfflineUrl(url: string): { episodeId: string; segmentIndex: number; isInit: boolean } | null {
  // Format for init segment: offline://{episodeId}/init.mp4
  const initMatch = url.match(/^offline:\/\/([^/]+)\/init\.mp4$/);
  if (initMatch) {
    return {
      episodeId: initMatch[1],
      segmentIndex: -1, // -1 indicates init segment
      isInit: true,
    };
  }
  
  // Format for regular segment: offline://{episodeId}/segment/{index}.(ts|m4s)
  const segMatch = url.match(/^offline:\/\/([^/]+)\/segment\/(\d+)\.(ts|m4s)$/);
  if (segMatch) {
    return {
      episodeId: segMatch[1],
      segmentIndex: parseInt(segMatch[2], 10),
      isInit: false,
    };
  }
  
  return null;
}

/**
 * Custom fragment loader that serves segments from IndexedDB
 * Falls back to network loader for non-offline URLs
 */
export class OfflineFragmentLoader implements Loader<LoaderContext> {
  private defaultLoader: Loader<LoaderContext>;
  public context: LoaderContext | null = null;
  private callbacks: LoaderCallbacks<LoaderContext> | null = null;
  public stats: LoaderStats;
  
  constructor(config: HlsConfig) {
    // Keep a reference to the default loader for fallback
    const DefaultLoaderClass = Hls.DefaultConfig.loader;
    this.defaultLoader = new DefaultLoaderClass(config);
    this.stats = this.defaultLoader.stats;
  }
  
  /**
   * Load a segment - either from IndexedDB or via network
   */
  async load(
    context: LoaderContext,
    config: LoaderConfiguration,
    callbacks: LoaderCallbacks<LoaderContext>
  ): Promise<void> {
    this.context = context;
    this.callbacks = callbacks;
    
    const url = context.url;
    
    // Check if this is an offline URL
    if (isOfflineUrl(url)) {
      try {
        await this.loadFromIndexedDB(context, callbacks);
      } catch (error) {
        callbacks.onError(
          { code: 0, text: error instanceof Error ? error.message : 'Unknown error' },
          context,
          null,
          null
        );
      }
      return;
    }
    
    // Fall back to default network loader
    return this.defaultLoader.load(context, config, callbacks);
  }
  
  /**
   * Load segment data from IndexedDB
   */
  private async loadFromIndexedDB(
    context: LoaderContext,
    callbacks: LoaderCallbacks<LoaderContext>
  ): Promise<void> {
    const parsed = parseOfflineUrl(context.url);
    
    if (!parsed) {
      throw new Error(`Invalid offline URL: ${context.url}`);
    }
    
    const { episodeId, segmentIndex, isInit } = parsed;
    
    // Fetch segment from IndexedDB
    let segmentData: Uint8Array | null;
    
    if (isInit) {
      // Load init segment (for fMP4)
      segmentData = await getHLSInitSegment(episodeId);
      if (!segmentData) {
        throw new Error(`Init segment not found for episode ${episodeId}`);
      }
    } else {
      // Load regular segment
      segmentData = await getHLSSegment(episodeId, segmentIndex);
      if (!segmentData) {
        throw new Error(`Segment ${segmentIndex} not found for episode ${episodeId}`);
      }
    }
    
    // Create response stats
    const now = performance.now();
    const stats: LoaderStats = {
      loaded: segmentData.length,
      total: segmentData.length,
      aborted: false,
      retry: 0,
      chunkCount: 1,
      bwEstimate: 0,
      loading: { start: now, first: now, end: now },
      parsing: { start: now, end: now },
      buffering: { start: now, first: now, end: now },
    };
    
    // Call success callback with the data
    callbacks.onSuccess(
      {
        url: context.url,
        data: segmentData.buffer,
      },
      stats,
      context,
      null
    );
  }
  
  /**
   * Abort the current load
   */
  abort(): void {
    this.defaultLoader.abort();
  }
  
  /**
   * Destroy the loader
   */
  destroy(): void {
    this.defaultLoader.destroy();
    this.context = null;
    this.callbacks = null;
  }
}

/**
 * Create an HLS configuration for offline playback
 */
export function createOfflineHLSConfig(): Partial<HlsConfig> {
  return {
    // Use our custom loader for fragments
    fLoader: OfflineFragmentLoader as unknown as typeof Hls.DefaultConfig.fLoader,
    // Disable level loading since we're using a pre-generated playlist
    enableWorker: false,
    // Lower buffer settings for offline playback
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
  };
}

/**
 * Check if an episode is available for offline HLS playback
 */
export async function isHLSEpisodeOffline(episodeId: string): Promise<boolean> {
  const episode = await getOfflineEpisode(episodeId);
  
  if (!episode) return false;
  if (!episode.isHLS) return false;
  
  // Check if we have all segments
  const metadata = await getHLSSegmentMetadata(episodeId);
  
  return metadata.length === episode.hlsSegmentCount;
}

/**
 * Get total duration of offline HLS content
 */
export async function getOfflineHLSDuration(episodeId: string): Promise<number> {
  const metadata = await getHLSSegmentMetadata(episodeId);
  return metadata.reduce((sum, seg) => sum + seg.duration, 0);
}
