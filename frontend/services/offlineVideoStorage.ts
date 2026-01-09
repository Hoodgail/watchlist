// IndexedDB Offline Video Storage Service
// Manages offline storage for video media, episodes, and watch progress

const DB_NAME = 'watchlist-video';
const DB_VERSION = 1;

// Store names
const STORES = {
  MEDIA: 'media',
  EPISODES: 'episodes',
  BLOBS: 'blobs',
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
}

export interface OfflineVideoEpisode {
  id: string;
  mediaId: string;
  episodeNumber: number;
  title?: string;
  duration?: number;
  videoBlobId: string;
  subtitleBlobIds?: Record<string, string>; // lang -> blobId
  downloadedAt: Date;
  fileSize: number;
}

export interface VideoStorageInfo {
  mediaCount: number;
  episodeCount: number;
  totalBlobSize: number;
  estimatedSize: number;
  quota?: number;
  usage?: number;
}

interface StoredBlob {
  id: string;
  blob: Blob;
  type: 'video' | 'subtitle' | 'cover';
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

      // Blobs store (for video and subtitle data)
      if (!db.objectStoreNames.contains(STORES.BLOBS)) {
        const blobsStore = db.createObjectStore(STORES.BLOBS, { keyPath: 'id' });
        blobsStore.createIndex('type', 'type', { unique: false });
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

// ============ Media Operations ============

export async function saveMediaOffline(
  media: {
    id: string;
    title: string;
    description?: string;
    releaseYear?: number;
    genres?: string[];
    episodeCount?: number;
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
  // Save video blob
  const videoBlobId = `video-${episode.id}`;
  const videoStoredBlob: StoredBlob = {
    id: videoBlobId,
    blob: videoBlob,
    type: 'video',
    size: videoBlob.size,
  };
  await putToStore(STORES.BLOBS, videoStoredBlob);

  // Save subtitle blobs if provided
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

  const storedBlob = await getFromStore<StoredBlob>(STORES.BLOBS, episode.videoBlobId);
  if (!storedBlob) return null;

  return URL.createObjectURL(storedBlob.blob);
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

  // Delete video blob
  await deleteFromStore(STORES.BLOBS, episode.videoBlobId);

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

  // Calculate total blob size
  let totalBlobSize = 0;
  for (const blob of blobs) {
    totalBlobSize += blob.size;
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

  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      quota = estimate.quota;
      usage = estimate.usage;
    } catch {
      // Storage API not available
    }
  }

  return {
    mediaCount: media.length,
    episodeCount: episodes.length,
    totalBlobSize,
    estimatedSize,
    quota,
    usage,
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

  const transaction = db.transaction(
    [STORES.MEDIA, STORES.EPISODES, STORES.BLOBS, STORES.WATCH_PROGRESS],
    'readwrite'
  );

  await Promise.all([
    new Promise<void>((resolve) => {
      transaction.objectStore(STORES.MEDIA).clear().onsuccess = () => resolve();
    }),
    new Promise<void>((resolve) => {
      transaction.objectStore(STORES.EPISODES).clear().onsuccess = () => resolve();
    }),
    new Promise<void>((resolve) => {
      transaction.objectStore(STORES.BLOBS).clear().onsuccess = () => resolve();
    }),
    new Promise<void>((resolve) => {
      transaction.objectStore(STORES.WATCH_PROGRESS).clear().onsuccess = () => resolve();
    }),
  ]);
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
