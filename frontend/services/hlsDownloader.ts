/**
 * HLS Downloader Service
 * Downloads HLS streams for offline playback
 * 
 * Features:
 * - M3U8 playlist parsing (master + media playlists)
 * - Quality selection for master playlists
 * - AES-128 decryption support
 * - Segment-by-segment download with progress tracking
 * - Resumable downloads
 */

import { Parser, Manifest, Segment } from 'm3u8-parser';

// ============ Types ============

export interface QualityOption {
  label: string;
  bandwidth: number;
  width?: number;
  height?: number;
  url: string;
}

export interface AudioTrack {
  groupId: string;
  name: string;
  language: string;
  isDefault: boolean;
  uri?: string; // URL to the audio playlist (may be muxed if no URI)
}

export interface SubtitleTrack {
  groupId: string;
  name: string;
  language: string;
  isDefault: boolean;
  uri: string; // URL to the subtitle playlist
}

export interface HLSDownloadOptions {
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Referer header for proxied requests */
  referer?: string;
  /** Already downloaded segment indices (for resuming) */
  downloadedSegments?: Set<number>;
  /** Whether init segment is already downloaded (for resuming fMP4) */
  initSegmentDownloaded?: boolean;
  /** Callback when a segment is downloaded */
  onSegmentDownloaded?: (
    index: number,
    data: Uint8Array,
    duration: number,
    totalSegments: number
  ) => Promise<void>;
  /** Callback when init segment is downloaded (for fMP4) */
  onInitSegmentDownloaded?: (data: Uint8Array) => Promise<void>;
  /** Callback for progress updates */
  onProgress?: (progress: HLSDownloadProgress) => void;
}

export interface HLSDownloadProgress {
  /** Current segment being downloaded (0-based) */
  currentSegment: number;
  /** Total number of segments */
  totalSegments: number;
  /** Total bytes downloaded so far */
  bytesDownloaded: number;
  /** Estimated total size in bytes (may change as we download) */
  estimatedTotalBytes: number;
  /** Download percentage (0-100) */
  percentage: number;
  /** Total duration of media in seconds */
  totalDuration: number;
  /** Duration downloaded so far in seconds */
  downloadedDuration: number;
  /** Whether this stream has an init segment (fMP4) */
  hasInitSegment?: boolean;
}

export interface ParsedHLSInfo {
  /** Whether this is a master playlist with quality variants */
  isMaster: boolean;
  /** Quality options (only for master playlists) */
  qualities?: QualityOption[];
  /** Segments (only for media playlists) */
  segments?: HLSSegment[];
  /** Total duration in seconds */
  totalDuration?: number;
  /** Encryption key info if encrypted */
  encryptionKey?: EncryptionKeyInfo;
  /** Initialization segment for fMP4 (EXT-X-MAP) */
  initSegment?: InitSegmentInfo;
  /** Audio tracks (only for master playlists with EXT-X-MEDIA TYPE=AUDIO) */
  audioTracks?: AudioTrack[];
  /** Subtitle tracks (only for master playlists with EXT-X-MEDIA TYPE=SUBTITLES) */
  subtitleTracks?: SubtitleTrack[];
}

export interface HLSSegment {
  index: number;
  uri: string;
  duration: number;
  key?: EncryptionKeyInfo;
}

export interface InitSegmentInfo {
  uri: string;
  byteRange?: { offset: number; length: number };
}

export interface EncryptionKeyInfo {
  method: 'AES-128' | 'SAMPLE-AES' | 'NONE';
  uri: string;
  iv?: Uint8Array;
}

// ============ URL Resolution ============

/**
 * Resolve a relative URL against a base URL
 */
function resolveUrl(baseUrl: string, relativeUrl: string): string {
  // If already absolute, return as-is
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  
  // Use URL constructor for proper resolution
  try {
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    // Fallback: manual resolution
    const baseDir = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    
    if (relativeUrl.startsWith('/')) {
      // Absolute path - get origin from base
      const origin = new URL(baseUrl).origin;
      return origin + relativeUrl;
    }
    
    return baseDir + relativeUrl;
  }
}

/**
 * Get proxy URL for fetching HLS content
 * @param url - The original URL to fetch
 * @param referer - Referer header for the request
 * @param isM3U8 - Whether this is an M3U8 playlist
 * @param raw - If true, request raw M3U8 without URL rewriting (for downloads)
 */
function getProxyUrl(url: string, referer: string | undefined, isM3U8: boolean, raw: boolean = false): string {
  if (!referer) {
    return url;
  }
  const endpoint = isM3U8 ? '/api/video/m3u8' : '/api/video/segment';
  let proxyUrl = `${endpoint}?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
  if (isM3U8 && raw) {
    proxyUrl += '&raw=1';
  }
  return proxyUrl;
}

// ============ M3U8 Parsing ============

/**
 * Parse an M3U8 playlist and determine if it's master or media
 * Uses raw=1 to get unmodified M3U8 content for proper URL resolution
 */
export async function parseM3U8(
  url: string,
  referer?: string
): Promise<ParsedHLSInfo> {
  // Use raw=1 to get unmodified M3U8 content (no URL rewriting by proxy)
  // This allows us to properly resolve relative URLs against the original base URL
  const proxyUrl = getProxyUrl(url, referer, true, true);
  
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch M3U8: ${response.status}`);
  }
  
  const content = await response.text();
  
  const parser = new Parser();
  parser.push(content);
  parser.end();
  
  const manifest: Manifest = parser.manifest;
  
  // Check if this is a master playlist (has playlists array)
  if (manifest.playlists && manifest.playlists.length > 0) {
    const qualities: QualityOption[] = manifest.playlists.map((playlist) => {
      const attrs = playlist.attributes || {};
      const resolution = attrs.RESOLUTION;
      
      return {
        label: resolution 
          ? `${resolution.height}p` 
          : (attrs.BANDWIDTH ? `${Math.round(attrs.BANDWIDTH / 1000)}kbps` : 'Unknown'),
        bandwidth: attrs.BANDWIDTH || 0,
        width: resolution?.width,
        height: resolution?.height,
        url: resolveUrl(url, playlist.uri),
      };
    });
    
    // Sort by bandwidth (highest first)
    qualities.sort((a, b) => b.bandwidth - a.bandwidth);
    
    // Extract audio and subtitle tracks from EXT-X-MEDIA tags
    // The m3u8-parser stores these in manifest.mediaGroups
    const audioTracks: AudioTrack[] = [];
    const subtitleTracks: SubtitleTrack[] = [];
    
    const mediaGroups = manifest.mediaGroups;
    if (mediaGroups) {
      // Parse AUDIO groups
      const audioGroups = mediaGroups.AUDIO;
      if (audioGroups) {
        for (const groupId of Object.keys(audioGroups)) {
          const group = audioGroups[groupId];
          for (const trackName of Object.keys(group)) {
            const track = group[trackName];
            audioTracks.push({
              groupId,
              name: trackName,
              language: track.language || 'und',
              isDefault: track.default || false,
              uri: track.uri ? resolveUrl(url, track.uri) : undefined,
            });
          }
        }
      }
      
      // Parse SUBTITLES groups
      const subtitleGroups = mediaGroups.SUBTITLES;
      if (subtitleGroups) {
        for (const groupId of Object.keys(subtitleGroups)) {
          const group = subtitleGroups[groupId];
          for (const trackName of Object.keys(group)) {
            const track = group[trackName];
            if (track.uri) {
              subtitleTracks.push({
                groupId,
                name: trackName,
                language: track.language || 'und',
                isDefault: track.default || false,
                uri: resolveUrl(url, track.uri),
              });
            }
          }
        }
      }
    }
    
    return {
      isMaster: true,
      qualities,
      audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
      subtitleTracks: subtitleTracks.length > 0 ? subtitleTracks : undefined,
    };
  }
  
  // This is a media playlist with segments
  return parseMediaPlaylist(manifest, url, referer);
}

/**
 * Parse a media playlist (segment list)
 */
function parseMediaPlaylist(
  manifest: Manifest, 
  baseUrl: string,
  referer?: string
): ParsedHLSInfo {
  const segments: HLSSegment[] = [];
  let totalDuration = 0;
  let currentKey: EncryptionKeyInfo | undefined;
  let initSegment: InitSegmentInfo | undefined;
  
  // The parser stores segments in manifest.segments
  const rawSegments: Segment[] = manifest.segments || [];
  
  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    
    // Handle EXT-X-MAP (initialization segment for fMP4)
    // The m3u8-parser stores this in seg.map
    if (seg.map && seg.map.uri && !initSegment) {
      initSegment = {
        uri: resolveUrl(baseUrl, seg.map.uri),
      };
      // Handle byte range if present
      if (seg.map.byterange) {
        initSegment.byteRange = {
          offset: seg.map.byterange.offset || 0,
          length: seg.map.byterange.length,
        };
      }
    }
    
    // Handle encryption key changes
    if (seg.key && seg.key.method !== 'NONE') {
      currentKey = {
        method: seg.key.method as 'AES-128' | 'SAMPLE-AES',
        uri: resolveUrl(baseUrl, seg.key.uri),
        iv: seg.key.iv ? hexToUint8Array(seg.key.iv) : undefined,
      };
    }
    
    const duration = seg.duration || 0;
    
    segments.push({
      index: i,
      uri: resolveUrl(baseUrl, seg.uri),
      duration,
      key: currentKey,
    });
    
    totalDuration += duration;
  }
  
  return {
    isMaster: false,
    segments,
    totalDuration,
    encryptionKey: segments[0]?.key,
    initSegment,
  };
}

// ============ AES-128 Decryption ============

/**
 * Convert hex string to Uint8Array (for IV)
 */
function hexToUint8Array(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Generate IV from segment index (default when no explicit IV)
 */
function generateIVFromIndex(index: number): Uint8Array {
  const iv = new Uint8Array(16);
  // IV is segment index as big-endian 128-bit number
  const view = new DataView(iv.buffer);
  view.setUint32(12, index, false); // Big-endian
  return iv;
}

/**
 * Fetch and cache decryption key
 */
const keyCache = new Map<string, CryptoKey>();

async function getDecryptionKey(
  keyUri: string,
  referer?: string
): Promise<CryptoKey> {
  // Check cache first
  const cached = keyCache.get(keyUri);
  if (cached) return cached;
  
  // Fetch the key
  const proxyUrl = getProxyUrl(keyUri, referer, false);
  const response = await fetch(proxyUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch decryption key: ${response.status}`);
  }
  
  const keyData = await response.arrayBuffer();
  
  // Import key for AES-CBC decryption
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );
  
  // Cache the key
  keyCache.set(keyUri, cryptoKey);
  
  return cryptoKey;
}

/**
 * Decrypt an encrypted segment
 */
async function decryptSegment(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    key,
    encryptedData
  );
}

// ============ Size Estimation ============

// Timeout for HEAD requests during size estimation (5 seconds)
const SIZE_ESTIMATION_TIMEOUT = 5000;

/**
 * Estimate total download size by sampling segments
 * Uses HEAD requests on a few segments to estimate average size
 * Has a timeout to avoid blocking if HEAD requests hang
 */
export async function estimateTotalSize(
  segments: HLSSegment[],
  referer?: string,
  sampleCount: number = 3
): Promise<number> {
  if (segments.length === 0) return 0;
  
  // Sample segments evenly distributed
  const indices: number[] = [];
  if (segments.length <= sampleCount) {
    indices.push(...segments.map((_, i) => i));
  } else {
    const step = Math.floor(segments.length / sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      indices.push(Math.min(i * step, segments.length - 1));
    }
  }
  
  let totalSampleSize = 0;
  let totalSampleDuration = 0;
  
  // Use Promise.allSettled with timeout to avoid hanging
  const samplePromises = indices.map(async (index) => {
    const seg = segments[index];
    const proxyUrl = getProxyUrl(seg.uri, referer, false);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SIZE_ESTIMATION_TIMEOUT);
    
    try {
      const response = await fetch(proxyUrl, { 
        method: 'HEAD',
        signal: controller.signal,
      });
      const contentLength = response.headers.get('content-length');
      
      if (contentLength) {
        return {
          size: parseInt(contentLength, 10),
          duration: seg.duration,
        };
      }
    } catch {
      // Skip failed samples (timeout or network error)
    } finally {
      clearTimeout(timeout);
    }
    return null;
  });
  
  const results = await Promise.allSettled(samplePromises);
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      totalSampleSize += result.value.size;
      totalSampleDuration += result.value.duration;
    }
  }
  
  if (totalSampleDuration === 0) {
    // Fallback: assume 1MB per 10 seconds
    const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
    return totalDuration * 100 * 1024; // 100KB/s average
  }
  
  // Calculate bytes per second and extrapolate
  const bytesPerSecond = totalSampleSize / totalSampleDuration;
  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
  
  return Math.round(bytesPerSecond * totalDuration);
}

// ============ Download Functions ============

// Timeout for individual segment downloads (30 seconds)
const SEGMENT_DOWNLOAD_TIMEOUT = 30000;

/**
 * Download an init segment (for fMP4) with optional byte range
 */
async function downloadInitSegment(
  initSegment: InitSegmentInfo,
  referer?: string,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const proxyUrl = getProxyUrl(initSegment.uri, referer, false);
  
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), SEGMENT_DOWNLOAD_TIMEOUT);
  
  const combinedSignal = signal 
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;
  
  try {
    const headers: HeadersInit = {};
    
    // Add byte range header if specified
    if (initSegment.byteRange) {
      const { offset, length } = initSegment.byteRange;
      headers['Range'] = `bytes=${offset}-${offset + length - 1}`;
    }
    
    const response = await fetch(proxyUrl, { 
      signal: combinedSignal,
      headers,
    });
    
    if (!response.ok && response.status !== 206) { // 206 = Partial Content (for byte range)
      throw new Error(`Failed to download init segment: ${response.status}`);
    }
    
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (timeoutController.signal.aborted && !signal?.aborted) {
      throw new Error(`Init segment download timed out after ${SEGMENT_DOWNLOAD_TIMEOUT / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Download a single HLS segment with timeout
 */
async function downloadSegment(
  segment: HLSSegment,
  referer?: string,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const proxyUrl = getProxyUrl(segment.uri, referer, false);
  
  // Create a timeout abort controller
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), SEGMENT_DOWNLOAD_TIMEOUT);
  
  // Combine with user signal if provided
  const combinedSignal = signal 
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal;
  
  try {
    const response = await fetch(proxyUrl, { signal: combinedSignal });
    
    if (!response.ok) {
      throw new Error(`Failed to download segment ${segment.index}: ${response.status}`);
    }
    
    let data = new Uint8Array(await response.arrayBuffer());
    
    // Decrypt if needed
    if (segment.key && segment.key.method === 'AES-128') {
      const cryptoKey = await getDecryptionKey(segment.key.uri, referer);
      const iv = segment.key.iv || generateIVFromIndex(segment.index);
      
      const decrypted = await decryptSegment(data.buffer, cryptoKey, iv);
      data = new Uint8Array(decrypted);
    }
    
    return data;
  } catch (error) {
    if (timeoutController.signal.aborted && !signal?.aborted) {
      throw new Error(`Segment ${segment.index} download timed out after ${SEGMENT_DOWNLOAD_TIMEOUT / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Download an entire HLS stream
 * 
 * @param mediaPlaylistUrl - URL to the media playlist (not master)
 * @param options - Download options
 * @returns Final download progress
 */
export async function downloadHLSStream(
  mediaPlaylistUrl: string,
  options: HLSDownloadOptions = {}
): Promise<HLSDownloadProgress> {
  const { 
    signal, 
    referer, 
    downloadedSegments = new Set(), 
    initSegmentDownloaded = false,
    onSegmentDownloaded, 
    onInitSegmentDownloaded,
    onProgress 
  } = options;
  
  // Parse the media playlist
  const parsed = await parseM3U8(mediaPlaylistUrl, referer);
  
  if (parsed.isMaster) {
    throw new Error('Cannot download master playlist directly. Select a quality first.');
  }
  
  if (!parsed.segments || parsed.segments.length === 0) {
    throw new Error('No segments found in playlist');
  }
  
  const segments = parsed.segments;
  const totalSegments = segments.length;
  const totalDuration = parsed.totalDuration || 0;
  const hasInitSegment = !!parsed.initSegment;
  
  // Estimate total size
  const estimatedTotalBytes = await estimateTotalSize(segments, referer);
  
  let bytesDownloaded = 0;
  let downloadedDuration = 0;
  
  console.log(`[HLS] Starting download: ${totalSegments} segments, ~${Math.round(estimatedTotalBytes / 1024 / 1024)} MB estimated${hasInitSegment ? ', has init segment (fMP4)' : ''}`);
  
  // Download init segment first if present (required for fMP4)
  if (parsed.initSegment && !initSegmentDownloaded) {
    console.log('[HLS] Downloading init segment...');
    
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }
    
    try {
      const initData = await downloadInitSegment(parsed.initSegment, referer, signal);
      bytesDownloaded += initData.length;
      
      if (onInitSegmentDownloaded) {
        await onInitSegmentDownloaded(initData);
      }
      
      console.log(`[HLS] Init segment downloaded (${initData.length} bytes)`);
    } catch (error) {
      console.error('[HLS] Failed to download init segment:', error);
      throw error;
    }
  }
  
  // Download segments sequentially
  for (let i = 0; i < totalSegments; i++) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }
    
    const segment = segments[i];
    
    // Skip already downloaded segments (for resuming)
    if (downloadedSegments.has(i)) {
      downloadedDuration += segment.duration;
      continue;
    }
    
    // Download the segment
    try {
      const data = await downloadSegment(segment, referer, signal);
      bytesDownloaded += data.length;
      downloadedDuration += segment.duration;
      
      // Store the segment
      if (onSegmentDownloaded) {
        await onSegmentDownloaded(i, data, segment.duration, totalSegments);
      }
      
      // Log progress every 10 segments
      if ((i + 1) % 10 === 0 || i === totalSegments - 1) {
        console.log(`[HLS] Downloaded segment ${i + 1}/${totalSegments} (${Math.round(bytesDownloaded / 1024 / 1024 * 10) / 10} MB)`);
      }
    } catch (error) {
      console.error(`[HLS] Failed to download segment ${i}:`, error);
      throw error;
    }
    
    // Update progress
    const progress: HLSDownloadProgress = {
      currentSegment: i,
      totalSegments,
      bytesDownloaded,
      estimatedTotalBytes: Math.max(estimatedTotalBytes, bytesDownloaded),
      percentage: Math.round(((i + 1) / totalSegments) * 100),
      totalDuration,
      downloadedDuration,
      hasInitSegment,
    };
    
    if (onProgress) {
      onProgress(progress);
    }
  }
  
  return {
    currentSegment: totalSegments - 1,
    totalSegments,
    bytesDownloaded,
    estimatedTotalBytes: bytesDownloaded, // Use actual size now
    percentage: 100,
    totalDuration,
    downloadedDuration: totalDuration,
    hasInitSegment,
  };
}

/**
 * Get available quality options from a master playlist
 */
export async function getQualityOptions(
  m3u8Url: string,
  referer?: string
): Promise<QualityOption[]> {
  const parsed = await parseM3U8(m3u8Url, referer);
  
  if (!parsed.isMaster || !parsed.qualities) {
    // Not a master playlist - return a single option representing the stream
    return [{
      label: 'Default',
      bandwidth: 0,
      url: m3u8Url,
    }];
  }
  
  return parsed.qualities;
}

/**
 * Get available audio tracks from a master playlist
 */
export async function getAudioTracks(
  m3u8Url: string,
  referer?: string
): Promise<AudioTrack[]> {
  const parsed = await parseM3U8(m3u8Url, referer);
  return parsed.audioTracks || [];
}

/**
 * Get available subtitle tracks from a master playlist
 */
export async function getSubtitleTracks(
  m3u8Url: string,
  referer?: string
): Promise<SubtitleTrack[]> {
  const parsed = await parseM3U8(m3u8Url, referer);
  return parsed.subtitleTracks || [];
}

/**
 * Download an audio track's segments
 * Similar to downloadHLSStream but for audio-only content
 */
export async function downloadAudioTrack(
  track: AudioTrack,
  options: HLSDownloadOptions & {
    onAudioSegmentDownloaded?: (
      index: number,
      data: Uint8Array,
      duration: number,
      totalSegments: number,
      language: string
    ) => Promise<void>;
  } = {}
): Promise<{ bytesDownloaded: number; segmentCount: number }> {
  if (!track.uri) {
    // Audio is muxed with video, no separate download needed
    return { bytesDownloaded: 0, segmentCount: 0 };
  }
  
  const { signal, referer, onAudioSegmentDownloaded } = options;
  
  // Parse the audio playlist
  const parsed = await parseM3U8(track.uri, referer);
  
  if (!parsed.segments || parsed.segments.length === 0) {
    return { bytesDownloaded: 0, segmentCount: 0 };
  }
  
  const segments = parsed.segments;
  let bytesDownloaded = 0;
  
  console.log(`[HLS] Downloading audio track "${track.name}" (${track.language}): ${segments.length} segments`);
  
  // Download init segment if present
  if (parsed.initSegment) {
    const initData = await downloadInitSegment(parsed.initSegment, referer, signal);
    bytesDownloaded += initData.length;
    
    if (onAudioSegmentDownloaded) {
      await onAudioSegmentDownloaded(-1, initData, 0, segments.length, track.language);
    }
  }
  
  // Download audio segments
  for (let i = 0; i < segments.length; i++) {
    if (signal?.aborted) {
      throw new Error('Download cancelled');
    }
    
    const segment = segments[i];
    const data = await downloadSegment(segment, referer, signal);
    bytesDownloaded += data.length;
    
    if (onAudioSegmentDownloaded) {
      await onAudioSegmentDownloaded(i, data, segment.duration, segments.length, track.language);
    }
  }
  
  return { bytesDownloaded, segmentCount: segments.length };
}
