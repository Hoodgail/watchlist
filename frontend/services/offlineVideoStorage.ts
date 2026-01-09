// IndexedDB Offline Video Storage Service
// Manages offline storage for video media, episodes, and watch progress
// Implements chunked storage to prevent UI freezing on large video files

const DB_NAME = 'watchlist-video';
const DB_VERSION = 2; // Bumped for HLS segment storage

// Chunk size: 5MB to prevent UI freezing during IDB writes
const CHUNK_SIZE = 5 * 1024 * 1024;

// Store names
const STORES = {
  MEDIA: 'media',
  EPISODES: 'episodes',
  BLOBS: 'blobs',
  CHUNKS: 'chunks', // Store for chunked video data (5MB each)
  HLS_SEGMENTS: 'hls_segments', // Store for HLS TS segments
  WATCH_PROGRESS: 'watch_progress',
  SETTINGS: 'settings',
} as const;

// ============ Types ============

export interface OfflineVideoMedia {
  id: string;
  title: string;
  description?: string;
  coverBlob?: Blob;
  releaseYear?: number;
  genres?: string[];
  episodeCount: number;
  downloadedAt: Date;
  lastAccessedAt: Date;
  /** Original external ref ID (e.g., tmdb:12345) for resolving offline when provider ID differs */
  originalRefId?: string;
}

export interface OfflineVideoEpisode {
  id: string;
  mediaId: string;
  episodeNumber: number;
  title?: string;
  duration?: number;
  videoBlobId: string;
  videoChunkCount?: number; // Number of chunks if using chunked storage
  subtitleBlobIds?: Record<string, string>; // lang -> blobId
  downloadedAt: Date;
  fileSize: number;
  // HLS-specific fields
  isHLS?: boolean;
  hlsSegmentCount?: number;
  hlsTotalDuration?: number;
  hlsHasInitSegment?: boolean; // Whether this HLS has an fMP4 init segment
}

// HLS segment stored in IndexedDB
export interface StoredHLSSegment {
  id: string; // Format: {episodeId}-seg-{index}
  episodeId: string;
  segmentIndex: number;
  data: ArrayBuffer;
  duration: number;
  size: number;
}

export interface VideoStorageInfo {
  mediaCount: number;
  episodeCount: number;
  totalBlobSize: number;
  estimatedSize: number;
  quota?: number;
  usage?: number;
  isPersisted?: boolean; // Whether storage is persisted (won't be evicted)
}

interface StoredBlob {
  id: string;
  blob: Blob;
  type: 'video' | 'subtitle' | 'cover';
  size: number;
}

// Chunk for storing large video blobs in smaller pieces
interface StoredChunk {
  id: string; // Format: {blobId}-chunk-{index}
  blobId: string;
  chunkIndex: number;
  data: ArrayBuffer;
  size: number;
}

interface WatchProgressRecord {
  id: string; // mediaId or mediaId-episodeId
  mediaId: string;
  episodeId?: string;
  currentTime: number;
  duration: number;
  percentage: number;
  updatedAt: Date;
}

interface VideoSetting {
  key: string;
  value: unknown;
}

let dbInstance: IDBDatabase | null = null;
let persistenceRequested = false;

// ============ Storage Persistence ============

/**
 * Request persistent storage to prevent browser from evicting data.
 * Should be called on first load of the app.
 * Returns true if persistence was granted, false otherwise.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (persistenceRequested) {
    return checkPersistentStorage();
  }

  persistenceRequested = true;

  if (!('storage' in navigator) || !('persist' in navigator.storage)) {
    console.warn('[OfflineVideo] Storage persistence API not available');
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persist();
    if (isPersisted) {
      console.log('[OfflineVideo] Storage persistence granted');
    } else {
      console.warn('[OfflineVideo] Storage persistence denied - data may be evicted');
    }
    return isPersisted;
  } catch (error) {
    console.error('[OfflineVideo] Failed to request persistent storage:', error);
    return false;
  }
}

/**
 * Check if storage is currently persisted.
 */
export async function checkPersistentStorage(): Promise<boolean> {
  if (!('storage' in navigator) || !('persisted' in navigator.storage)) {
    return false;
  }

  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

// ============ Database Initialization ============

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open video database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Media store
      if (!db.objectStoreNames.contains(STORES.MEDIA)) {
        const mediaStore = db.createObjectStore(STORES.MEDIA, { keyPath: 'id' });
        mediaStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        mediaStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }

      // Episodes store
      if (!db.objectStoreNames.contains(STORES.EPISODES)) {
        const episodesStore = db.createObjectStore(STORES.EPISODES, { keyPath: 'id' });
        episodesStore.createIndex('mediaId', 'mediaId', { unique: false });
        episodesStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }

      // Blobs store (for small blobs like subtitles and covers)
      if (!db.objectStoreNames.contains(STORES.BLOBS)) {
        const blobsStore = db.createObjectStore(STORES.BLOBS, { keyPath: 'id' });
        blobsStore.createIndex('type', 'type', { unique: false });
      }

      // Chunks store (for large video data stored in 5MB pieces)
      if (!db.objectStoreNames.contains(STORES.CHUNKS)) {
        const chunksStore = db.createObjectStore(STORES.CHUNKS, { keyPath: 'id' });
        chunksStore.createIndex('blobId', 'blobId', { unique: false });
      }

      // HLS segments store (for HLS TS segments)
      if (!db.objectStoreNames.contains(STORES.HLS_SEGMENTS)) {
        const hlsStore = db.createObjectStore(STORES.HLS_SEGMENTS, { keyPath: 'id' });
        hlsStore.createIndex('episodeId', 'episodeId', { unique: false });
      }

      // Watch progress store
      if (!db.objectStoreNames.contains(STORES.WATCH_PROGRESS)) {
        const progressStore = db.createObjectStore(STORES.WATCH_PROGRESS, { keyPath: 'id' });
        progressStore.createIndex('mediaId', 'mediaId', { unique: false });
        progressStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
  });
}

export async function initVideoDatabase(): Promise<void> {
  await openDatabase();
  // Request persistent storage on database init
  await requestPersistentStorage();
}

// ============ Generic Store Operations ============

async function getFromStore<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error(`Failed to get ${key} from ${storeName}`));
  });
}

async function putToStore<T>(storeName: string, data: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to put to ${storeName}`));
  });
}

async function deleteFromStore(storeName: string, key: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to delete ${key} from ${storeName}`));
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(`Failed to get all from ${storeName}`));
  });
}

async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error(`Failed to get by index ${indexName}`));
  });
}

// ============ Chunked Storage Operations ============

/**
 * Store a large blob as multiple 5MB chunks to prevent UI freezing.
 * Uses requestIdleCallback/setTimeout to yield to the main thread between chunks.
 */
async function storeBlobAsChunks(
  blobId: string,
  blob: Blob,
  contentType: string
): Promise<number> {
  const totalSize = blob.size;
  const chunkCount = Math.ceil(totalSize / CHUNK_SIZE);

  // Store metadata about the blob
  const blobMetadata: StoredBlob = {
    id: blobId,
    blob: new Blob([], { type: contentType }), // Empty blob, actual data in chunks
    type: 'video',
    size: totalSize,
  };
  await putToStore(STORES.BLOBS, blobMetadata);

  // Store each chunk with yielding to prevent UI freezing
  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunkBlob = blob.slice(start, end);

    // Convert chunk to ArrayBuffer
    const arrayBuffer = await chunkBlob.arrayBuffer();

    const chunk: StoredChunk = {
      id: `${blobId}-chunk-${i}`,
      blobId,
      chunkIndex: i,
      data: arrayBuffer,
      size: arrayBuffer.byteLength,
    };

    await putToStore(STORES.CHUNKS, chunk);

    // Yield to main thread between chunks to prevent UI freezing
    if (i < chunkCount - 1) {
      await yieldToMainThread();
    }
  }

  return chunkCount;
}

/**
 * Retrieve and reassemble chunks back into a blob.
 */
async function getBlobFromChunks(blobId: string, chunkCount: number): Promise<Blob | null> {
  const chunks = await getByIndex<StoredChunk>(STORES.CHUNKS, 'blobId', blobId);

  if (chunks.length === 0) {
    return null;
  }

  // Sort chunks by index
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

  // Verify we have all chunks
  if (chunks.length !== chunkCount) {
    console.warn(`[OfflineVideo] Expected ${chunkCount} chunks but found ${chunks.length}`);
  }

  // Get content type from blob metadata
  const blobMeta = await getFromStore<StoredBlob>(STORES.BLOBS, blobId);
  const contentType = blobMeta?.blob?.type || 'video/mp4';

  // Reassemble chunks into a single blob
  const blobParts: ArrayBuffer[] = chunks.map((c) => c.data);
  return new Blob(blobParts, { type: contentType });
}

/**
 * Delete all chunks associated with a blob.
 */
async function deleteChunks(blobId: string): Promise<void> {
  const chunks = await getByIndex<StoredChunk>(STORES.CHUNKS, 'blobId', blobId);

  for (const chunk of chunks) {
    await deleteFromStore(STORES.CHUNKS, chunk.id);
  }
}

/**
 * Yield to the main thread to prevent UI freezing during long operations.
 */
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

// ============ Media Operations ============

export async function saveMediaOffline(
  media: {
    id: string;
    title: string;
    description?: string;
    releaseYear?: number;
    genres?: string[];
    episodeCount?: number;
    originalRefId?: string;
  },
  coverBlob?: Blob
): Promise<void> {
  const offlineMedia: OfflineVideoMedia = {
    id: media.id,
    title: media.title,
    description: media.description,
    coverBlob,
    releaseYear: media.releaseYear,
    genres: media.genres,
    episodeCount: media.episodeCount || 0,
    downloadedAt: new Date(),
    lastAccessedAt: new Date(),
    originalRefId: media.originalRefId,
  };

  await putToStore(STORES.MEDIA, offlineMedia);
}

export async function getOfflineMedia(mediaId: string): Promise<OfflineVideoMedia | null> {
  const media = await getFromStore<OfflineVideoMedia>(STORES.MEDIA, mediaId);
  if (media) {
    // Update last accessed time
    media.lastAccessedAt = new Date();
    await putToStore(STORES.MEDIA, media);
  }
  return media;
}

export async function getAllOfflineMedia(): Promise<OfflineVideoMedia[]> {
  return getAllFromStore<OfflineVideoMedia>(STORES.MEDIA);
}

/**
 * Get offline media by original ref ID (e.g., tmdb:12345)
 * This is useful when the UI is querying by external ID but offline storage uses provider IDs
 */
export async function getOfflineMediaByRefId(refId: string): Promise<OfflineVideoMedia | null> {
  // First, try direct lookup (in case the id IS the refId)
  const direct = await getFromStore<OfflineVideoMedia>(STORES.MEDIA, refId);
  if (direct) {
    direct.lastAccessedAt = new Date();
    await putToStore(STORES.MEDIA, direct);
    return direct;
  }
  
  // Search all media for matching originalRefId
  const allMedia = await getAllFromStore<OfflineVideoMedia>(STORES.MEDIA);
  const match = allMedia.find(m => m.originalRefId === refId);
  
  if (match) {
    match.lastAccessedAt = new Date();
    await putToStore(STORES.MEDIA, match);
    return match;
  }
  
  return null;
}

export async function deleteOfflineMedia(mediaId: string): Promise<void> {
  // Get all episodes for this media
  const episodes = await getByIndex<OfflineVideoEpisode>(STORES.EPISODES, 'mediaId', mediaId);

  // Delete all episodes and their blobs
  for (const episode of episodes) {
    await deleteOfflineEpisode(episode.id);
  }

  // Delete the media
  await deleteFromStore(STORES.MEDIA, mediaId);

  // Delete any watch progress for this media
  const allProgress = await getByIndex<WatchProgressRecord>(STORES.WATCH_PROGRESS, 'mediaId', mediaId);
  for (const progress of allProgress) {
    await deleteFromStore(STORES.WATCH_PROGRESS, progress.id);
  }
}

// ============ Episode Operations ============

export async function saveEpisodeOffline(
  mediaId: string,
  episode: {
    id: string;
    episodeNumber: number;
    title?: string;
    duration?: number;
  },
  videoBlob: Blob,
  subtitleBlobs?: Record<string, Blob>
): Promise<void> {
  const videoBlobId = `video-${episode.id}`;
  let videoChunkCount: number | undefined;

  // Use chunked storage for large videos (> CHUNK_SIZE) to prevent UI freezing
  if (videoBlob.size > CHUNK_SIZE) {
    console.log(`[OfflineVideo] Using chunked storage for ${formatBytes(videoBlob.size)} video`);
    videoChunkCount = await storeBlobAsChunks(videoBlobId, videoBlob, videoBlob.type || 'video/mp4');
  } else {
    // Small video, store directly
    const videoStoredBlob: StoredBlob = {
      id: videoBlobId,
      blob: videoBlob,
      type: 'video',
      size: videoBlob.size,
    };
    await putToStore(STORES.BLOBS, videoStoredBlob);
  }

  // Save subtitle blobs if provided (typically small, no chunking needed)
  const subtitleBlobIds: Record<string, string> = {};
  if (subtitleBlobs) {
    for (const [lang, subtitleBlob] of Object.entries(subtitleBlobs)) {
      const subtitleBlobId = `subtitle-${episode.id}-${lang}`;
      const subtitleStoredBlob: StoredBlob = {
        id: subtitleBlobId,
        blob: subtitleBlob,
        type: 'subtitle',
        size: subtitleBlob.size,
      };
      await putToStore(STORES.BLOBS, subtitleStoredBlob);
      subtitleBlobIds[lang] = subtitleBlobId;
    }
  }

  // Save episode metadata
  const offlineEpisode: OfflineVideoEpisode = {
    id: episode.id,
    mediaId,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    duration: episode.duration,
    videoBlobId,
    videoChunkCount,
    subtitleBlobIds: Object.keys(subtitleBlobIds).length > 0 ? subtitleBlobIds : undefined,
    downloadedAt: new Date(),
    fileSize: videoBlob.size,
  };

  await putToStore(STORES.EPISODES, offlineEpisode);

  // Update media episode count
  const media = await getFromStore<OfflineVideoMedia>(STORES.MEDIA, mediaId);
  if (media) {
    const downloadedEpisodes = await getByIndex<OfflineVideoEpisode>(STORES.EPISODES, 'mediaId', mediaId);
    media.episodeCount = downloadedEpisodes.length;
    await putToStore(STORES.MEDIA, media);
  }
}

export async function getOfflineEpisode(episodeId: string): Promise<OfflineVideoEpisode | null> {
  return getFromStore<OfflineVideoEpisode>(STORES.EPISODES, episodeId);
}

export async function getOfflineEpisodesForMedia(mediaId: string): Promise<OfflineVideoEpisode[]> {
  const episodes = await getByIndex<OfflineVideoEpisode>(STORES.EPISODES, 'mediaId', mediaId);
  return episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
}

export async function getOfflineVideoUrl(episodeId: string): Promise<string | null> {
  const episode = await getOfflineEpisode(episodeId);
  if (!episode) return null;

  let blob: Blob | null = null;

  // Check if video was stored in chunks
  if (episode.videoChunkCount && episode.videoChunkCount > 0) {
    blob = await getBlobFromChunks(episode.videoBlobId, episode.videoChunkCount);
  } else {
    const storedBlob = await getFromStore<StoredBlob>(STORES.BLOBS, episode.videoBlobId);
    blob = storedBlob?.blob || null;
  }

  if (!blob) return null;

  return URL.createObjectURL(blob);
}

export async function getOfflineSubtitleUrl(episodeId: string, lang: string): Promise<string | null> {
  const episode = await getOfflineEpisode(episodeId);
  if (!episode || !episode.subtitleBlobIds) return null;

  const subtitleBlobId = episode.subtitleBlobIds[lang];
  if (!subtitleBlobId) return null;

  const storedBlob = await getFromStore<StoredBlob>(STORES.BLOBS, subtitleBlobId);
  if (!storedBlob) return null;

  return URL.createObjectURL(storedBlob.blob);
}

export async function deleteOfflineEpisode(episodeId: string): Promise<void> {
  const episode = await getOfflineEpisode(episodeId);
  if (!episode) return;

  const mediaId = episode.mediaId;

  // Delete HLS segments if this is an HLS episode
  if (episode.isHLS) {
    await deleteHLSSegments(episodeId);
  }

  // Delete video chunks if using chunked storage
  if (episode.videoChunkCount && episode.videoChunkCount > 0) {
    await deleteChunks(episode.videoBlobId);
  }

  // Delete video blob metadata (if not HLS)
  if (episode.videoBlobId) {
    await deleteFromStore(STORES.BLOBS, episode.videoBlobId);
  }

  // Delete subtitle blobs
  if (episode.subtitleBlobIds) {
    for (const subtitleBlobId of Object.values(episode.subtitleBlobIds)) {
      await deleteFromStore(STORES.BLOBS, subtitleBlobId);
    }
  }

  // Delete episode
  await deleteFromStore(STORES.EPISODES, episodeId);

  // Update media episode count
  const media = await getFromStore<OfflineVideoMedia>(STORES.MEDIA, mediaId);
  if (media) {
    const remainingEpisodes = await getByIndex<OfflineVideoEpisode>(STORES.EPISODES, 'mediaId', mediaId);
    media.episodeCount = remainingEpisodes.length;
    await putToStore(STORES.MEDIA, media);
  }
}

// ============ Watch Progress Operations ============

export async function saveWatchProgress(
  mediaId: string,
  episodeId: string | undefined,
  currentTime: number,
  duration: number
): Promise<void> {
  const id = episodeId ? `${mediaId}-${episodeId}` : mediaId;
  const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const progress: WatchProgressRecord = {
    id,
    mediaId,
    episodeId,
    currentTime,
    duration,
    percentage,
    updatedAt: new Date(),
  };

  await putToStore(STORES.WATCH_PROGRESS, progress);
}

export async function getWatchProgress(
  mediaId: string,
  episodeId?: string
): Promise<WatchProgressRecord | null> {
  const id = episodeId ? `${mediaId}-${episodeId}` : mediaId;
  return getFromStore<WatchProgressRecord>(STORES.WATCH_PROGRESS, id);
}

export async function getAllWatchProgress(): Promise<WatchProgressRecord[]> {
  return getAllFromStore<WatchProgressRecord>(STORES.WATCH_PROGRESS);
}

// ============ Storage Utilities ============

export async function getVideoStorageInfo(): Promise<VideoStorageInfo> {
  const media = await getAllFromStore<OfflineVideoMedia>(STORES.MEDIA);
  const episodes = await getAllFromStore<OfflineVideoEpisode>(STORES.EPISODES);
  const blobs = await getAllFromStore<StoredBlob>(STORES.BLOBS);
  const chunks = await getAllFromStore<StoredChunk>(STORES.CHUNKS);
  const hlsSegments = await getAllFromStore<StoredHLSSegment>(STORES.HLS_SEGMENTS);

  // Calculate total blob size (non-chunked)
  let totalBlobSize = 0;
  for (const blob of blobs) {
    totalBlobSize += blob.size;
  }

  // Add chunk sizes
  for (const chunk of chunks) {
    totalBlobSize += chunk.size;
  }

  // Add HLS segment sizes
  for (const seg of hlsSegments) {
    totalBlobSize += seg.size;
  }

  // Add cover blobs from media
  let estimatedSize = totalBlobSize;
  for (const m of media) {
    if (m.coverBlob) {
      estimatedSize += m.coverBlob.size;
    }
  }

  // Get storage quota if available
  let quota: number | undefined;
  let usage: number | undefined;
  let isPersisted: boolean | undefined;

  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      quota = estimate.quota;
      usage = estimate.usage;
    } catch {
      // Storage API not available
    }
  }

  // Check persistence status
  isPersisted = await checkPersistentStorage();

  return {
    mediaCount: media.length,
    episodeCount: episodes.length,
    totalBlobSize,
    estimatedSize,
    quota,
    usage,
    isPersisted,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ Clear All Data ============

export async function clearAllVideoData(): Promise<void> {
  const db = await openDatabase();

  const storeNames = [STORES.MEDIA, STORES.EPISODES, STORES.BLOBS, STORES.CHUNKS, STORES.HLS_SEGMENTS, STORES.WATCH_PROGRESS];
  const transaction = db.transaction(storeNames, 'readwrite');

  await Promise.all(
    storeNames.map(
      (storeName) =>
        new Promise<void>((resolve) => {
          transaction.objectStore(storeName).clear().onsuccess = () => resolve();
        })
    )
  );
}

// ============ Video Download Utilities ============

export async function fetchVideoAsBlob(
  url: string,
  headers?: Record<string, string>,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  const response = await fetch(url, {
    headers: headers || {},
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    // Fallback for browsers without ReadableStream support
    const blob = await response.blob();
    if (onProgress) {
      onProgress(blob.size, blob.size);
    }
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    loaded += value.length;

    if (onProgress) {
      onProgress(loaded, total);
    }
  }

  const contentType = response.headers.get('content-type') || 'video/mp4';
  return new Blob(chunks, { type: contentType });
}

export async function fetchSubtitleAsBlob(url: string): Promise<Blob> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch subtitle: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}

// ============ HLS Segment Storage ============

/**
 * Save an HLS segment to storage
 */
export async function saveHLSSegment(
  episodeId: string,
  segmentIndex: number,
  data: Uint8Array,
  duration: number
): Promise<void> {
  const segment: StoredHLSSegment = {
    id: `${episodeId}-seg-${segmentIndex}`,
    episodeId,
    segmentIndex,
    data: data.buffer as ArrayBuffer,
    duration,
    size: data.length,
  };

  await putToStore(STORES.HLS_SEGMENTS, segment);
}

/**
 * Get a single HLS segment by index
 */
export async function getHLSSegment(
  episodeId: string,
  segmentIndex: number
): Promise<Uint8Array | null> {
  const id = `${episodeId}-seg-${segmentIndex}`;
  const segment = await getFromStore<StoredHLSSegment>(STORES.HLS_SEGMENTS, id);
  
  if (!segment) return null;
  
  return new Uint8Array(segment.data);
}

/**
 * Get all HLS segment metadata for an episode (without the data)
 */
export async function getHLSSegmentMetadata(
  episodeId: string
): Promise<Array<{ index: number; duration: number; size: number }>> {
  const segments = await getByIndex<StoredHLSSegment>(STORES.HLS_SEGMENTS, 'episodeId', episodeId);
  
  return segments
    .map((seg) => ({
      index: seg.segmentIndex,
      duration: seg.duration,
      size: seg.size,
    }))
    .sort((a, b) => a.index - b.index);
}

/**
 * Get all downloaded segment indices for an episode
 */
export async function getDownloadedSegmentIndices(episodeId: string): Promise<Set<number>> {
  const metadata = await getHLSSegmentMetadata(episodeId);
  return new Set(metadata.map((m) => m.index));
}

/**
 * Delete all HLS segments for an episode
 */
export async function deleteHLSSegments(episodeId: string): Promise<void> {
  const segments = await getByIndex<StoredHLSSegment>(STORES.HLS_SEGMENTS, 'episodeId', episodeId);
  
  for (const segment of segments) {
    await deleteFromStore(STORES.HLS_SEGMENTS, segment.id);
  }
}

/**
 * Save an HLS episode with metadata
 */
export async function saveHLSEpisodeOffline(
  mediaId: string,
  episode: {
    id: string;
    episodeNumber: number;
    title?: string;
  },
  segmentCount: number,
  totalDuration: number,
  totalSize: number,
  subtitleBlobs?: Record<string, Blob>,
  hasInitSegment?: boolean
): Promise<void> {
  // Save subtitle blobs if provided
  const subtitleBlobIds: Record<string, string> = {};
  if (subtitleBlobs) {
    for (const [lang, subtitleBlob] of Object.entries(subtitleBlobs)) {
      const subtitleBlobId = `subtitle-${episode.id}-${lang}`;
      const subtitleStoredBlob: StoredBlob = {
        id: subtitleBlobId,
        blob: subtitleBlob,
        type: 'subtitle' as const,
        size: subtitleBlob.size,
      };
      await putToStore(STORES.BLOBS, subtitleStoredBlob);
      subtitleBlobIds[lang] = subtitleBlobId;
    }
  }

  // Save episode metadata
  const offlineEpisode: OfflineVideoEpisode = {
    id: episode.id,
    mediaId,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    duration: totalDuration,
    videoBlobId: '', // Not used for HLS
    isHLS: true,
    hlsSegmentCount: segmentCount,
    hlsTotalDuration: totalDuration,
    hlsHasInitSegment: hasInitSegment,
    subtitleBlobIds: Object.keys(subtitleBlobIds).length > 0 ? subtitleBlobIds : undefined,
    downloadedAt: new Date(),
    fileSize: totalSize,
  };

  await putToStore(STORES.EPISODES, offlineEpisode);

  // Update media episode count
  const media = await getFromStore<OfflineVideoMedia>(STORES.MEDIA, mediaId);
  if (media) {
    const downloadedEpisodes = await getByIndex<OfflineVideoEpisode>(STORES.EPISODES, 'mediaId', mediaId);
    media.episodeCount = downloadedEpisodes.length;
    await putToStore(STORES.MEDIA, media);
  }
}

/**
 * Save an HLS init segment (for fMP4)
 */
export async function saveHLSInitSegment(
  episodeId: string,
  data: Uint8Array
): Promise<void> {
  const segment: StoredHLSSegment = {
    id: `${episodeId}-init`,
    episodeId,
    segmentIndex: -1, // Use -1 to indicate init segment
    data: data.buffer as ArrayBuffer,
    duration: 0, // Init segment has no duration
    size: data.length,
  };

  await putToStore(STORES.HLS_SEGMENTS, segment);
}

/**
 * Get an HLS init segment (for fMP4)
 */
export async function getHLSInitSegment(
  episodeId: string
): Promise<Uint8Array | null> {
  const id = `${episodeId}-init`;
  const segment = await getFromStore<StoredHLSSegment>(STORES.HLS_SEGMENTS, id);
  
  if (!segment) return null;
  
  return new Uint8Array(segment.data);
}

/**
 * Check if an HLS init segment exists for an episode
 */
export async function hasHLSInitSegment(episodeId: string): Promise<boolean> {
  const id = `${episodeId}-init`;
  const segment = await getFromStore<StoredHLSSegment>(STORES.HLS_SEGMENTS, id);
  return !!segment;
}

// ============ Orphaned Data Cleanup ============

export interface CleanupResult {
  orphanedChunks: number;
  orphanedSegments: number;
  bytesReclaimed: number;
}

/**
 * Clean up orphaned data from IndexedDB.
 * This removes chunks and HLS segments that don't belong to any valid episode record.
 * Should be called on app startup to reclaim storage from interrupted/failed downloads.
 */
export async function cleanupOrphanedData(): Promise<CleanupResult> {
  console.log('[OfflineVideo] Starting orphaned data cleanup...');
  
  const result: CleanupResult = {
    orphanedChunks: 0,
    orphanedSegments: 0,
    bytesReclaimed: 0,
  };
  
  try {
    // Get all valid episode IDs and blob IDs
    const episodes = await getAllFromStore<OfflineVideoEpisode>(STORES.EPISODES);
    const validEpisodeIds = new Set(episodes.map(e => e.id));
    const validBlobIds = new Set(episodes.map(e => e.videoBlobId).filter(Boolean));
    
    // Clean up orphaned chunks (video data stored in 5MB pieces)
    const allChunks = await getAllFromStore<StoredChunk>(STORES.CHUNKS);
    for (const chunk of allChunks) {
      if (!validBlobIds.has(chunk.blobId)) {
        result.orphanedChunks++;
        result.bytesReclaimed += chunk.size;
        await deleteFromStore(STORES.CHUNKS, chunk.id);
      }
    }
    
    // Clean up orphaned HLS segments
    const allSegments = await getAllFromStore<StoredHLSSegment>(STORES.HLS_SEGMENTS);
    for (const segment of allSegments) {
      if (!validEpisodeIds.has(segment.episodeId)) {
        result.orphanedSegments++;
        result.bytesReclaimed += segment.size;
        await deleteFromStore(STORES.HLS_SEGMENTS, segment.id);
      }
    }
    
    // Clean up orphaned blob metadata
    const allBlobs = await getAllFromStore<StoredBlob>(STORES.BLOBS);
    for (const blob of allBlobs) {
      // Check if this blob belongs to any valid episode
      const isValidVideo = validBlobIds.has(blob.id);
      const isValidSubtitle = blob.type === 'subtitle' && episodes.some(e => 
        e.subtitleBlobIds && Object.values(e.subtitleBlobIds).includes(blob.id)
      );
      
      if (!isValidVideo && !isValidSubtitle && blob.type !== 'cover') {
        result.bytesReclaimed += blob.size;
        await deleteFromStore(STORES.BLOBS, blob.id);
      }
    }
    
    if (result.orphanedChunks > 0 || result.orphanedSegments > 0) {
      console.log('[OfflineVideo] Cleanup complete:', {
        orphanedChunks: result.orphanedChunks,
        orphanedSegments: result.orphanedSegments,
        bytesReclaimed: formatBytes(result.bytesReclaimed),
      });
    } else {
      console.log('[OfflineVideo] No orphaned data found');
    }
    
    return result;
  } catch (error) {
    console.error('[OfflineVideo] Cleanup failed:', error);
    return result;
  }
}

