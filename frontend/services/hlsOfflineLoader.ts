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
} from 'hls.js';
import { 
  getHLSSegment, 
  getHLSSegmentMetadata, 
  getOfflineEpisode 
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
  
  if (metadata.length === 0) {
    throw new Error(`No segments found for episode ${episodeId}`);
  }
  
  // Calculate target duration (max segment duration, rounded up)
  const maxDuration = Math.max(...metadata.map(m => m.duration));
  const targetDuration = Math.ceil(maxDuration);
  
  // Build M3U8 content
  const lines: string[] = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
  ];
  
  // Add segments
  for (const seg of metadata) {
    lines.push(`#EXTINF:${seg.duration.toFixed(3)},`);
    // Use a virtual URL scheme that our loader will intercept
    lines.push(`offline://${episodeId}/segment/${seg.index}.ts`);
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
 */
function parseOfflineUrl(url: string): { episodeId: string; segmentIndex: number } | null {
  // Format: offline://{episodeId}/segment/{index}.ts
  const match = url.match(/^offline:\/\/([^/]+)\/segment\/(\d+)\.ts$/);
  
  if (!match) return null;
  
  return {
    episodeId: match[1],
    segmentIndex: parseInt(match[2], 10),
  };
}

/**
 * Custom fragment loader that serves segments from IndexedDB
 * Falls back to network loader for non-offline URLs
 */
export class OfflineFragmentLoader implements Hls.LoaderInterface<LoaderContext> {
  private defaultLoader: Hls.LoaderInterface<LoaderContext>;
  private context: LoaderContext | null = null;
  private callbacks: LoaderCallbacks<LoaderContext> | null = null;
  
  constructor(config: LoaderConfiguration) {
    // Keep a reference to the default loader for fallback
    this.defaultLoader = new Hls.DefaultConfig.loader(config) as Hls.LoaderInterface<LoaderContext>;
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
    
    const { episodeId, segmentIndex } = parsed;
    
    // Fetch segment from IndexedDB
    const segmentData = await getHLSSegment(episodeId, segmentIndex);
    
    if (!segmentData) {
      throw new Error(`Segment ${segmentIndex} not found for episode ${episodeId}`);
    }
    
    // Create response
    const stats = {
      loaded: segmentData.length,
      total: segmentData.length,
      aborted: false,
      trequest: performance.now(),
      tfirst: performance.now(),
      tload: performance.now(),
      retry: 0,
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
  
  /**
   * Get loader stats
   */
  get stats() {
    return this.defaultLoader.stats;
  }
}

/**
 * Create an HLS configuration for offline playback
 */
export function createOfflineHLSConfig(): Partial<Hls.HlsConfig> {
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
