// IndexedDB Offline Storage Service
// Manages offline storage for manga, chapters, and pages

import {
  MangaDetails,
  ChapterInfo,
  OfflineManga,
  OfflineChapter,
  OfflinePage,
  ReadingProgress,
  DownloadProgress,
  ReaderSettings,
} from './mangadexTypes';

const DB_NAME = 'watchlist-manga';
const DB_VERSION = 1;

// Store names
const STORES = {
  MANGA: 'manga',
  CHAPTERS: 'chapters',
  PAGES: 'pages',
  READING_PROGRESS: 'reading_progress',
  SETTINGS: 'settings',
} as const;

let dbInstance: IDBDatabase | null = null;

// ============ Database Initialization ============

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Manga store
      if (!db.objectStoreNames.contains(STORES.MANGA)) {
        const mangaStore = db.createObjectStore(STORES.MANGA, { keyPath: 'id' });
        mangaStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }

      // Chapters store
      if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
        const chaptersStore = db.createObjectStore(STORES.CHAPTERS, { keyPath: 'id' });
        chaptersStore.createIndex('mangaId', 'mangaId', { unique: false });
        chaptersStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
      }

      // Pages store
      if (!db.objectStoreNames.contains(STORES.PAGES)) {
        const pagesStore = db.createObjectStore(STORES.PAGES, { keyPath: 'id' });
        pagesStore.createIndex('chapterId', 'chapterId', { unique: false });
        pagesStore.createIndex('mangaId', 'mangaId', { unique: false });
      }

      // Reading progress store
      if (!db.objectStoreNames.contains(STORES.READING_PROGRESS)) {
        const progressStore = db.createObjectStore(STORES.READING_PROGRESS, { keyPath: 'mangaId' });
        progressStore.createIndex('synced', 'synced', { unique: false });
        progressStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
  });
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

async function countByIndex(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.count(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`Failed to count by index ${indexName}`));
  });
}

// ============ Manga Operations ============

export async function saveMangaOffline(manga: MangaDetails, coverBlob?: Blob): Promise<void> {
  const offlineManga: OfflineManga = {
    id: manga.id,
    data: manga,
    coverBlob,
    downloadedAt: new Date(),
    chaptersDownloaded: 0,
  };

  await putToStore(STORES.MANGA, offlineManga);
}

export async function getOfflineManga(mangaId: string): Promise<OfflineManga | null> {
  return getFromStore<OfflineManga>(STORES.MANGA, mangaId);
}

export async function getAllOfflineManga(): Promise<OfflineManga[]> {
  return getAllFromStore<OfflineManga>(STORES.MANGA);
}

export async function deleteOfflineManga(mangaId: string): Promise<void> {
  // Delete all pages for this manga
  const pages = await getByIndex<OfflinePage>(STORES.PAGES, 'mangaId', mangaId);
  for (const page of pages) {
    await deleteFromStore(STORES.PAGES, page.id);
  }

  // Delete all chapters for this manga
  const chapters = await getByIndex<OfflineChapter>(STORES.CHAPTERS, 'mangaId', mangaId);
  for (const chapter of chapters) {
    await deleteFromStore(STORES.CHAPTERS, chapter.id);
  }

  // Delete the manga
  await deleteFromStore(STORES.MANGA, mangaId);
}

export async function updateMangaChapterCount(mangaId: string): Promise<void> {
  const manga = await getOfflineManga(mangaId);
  if (!manga) return;

  // Count chapters that actually have downloaded pages
  const chapters = await getByIndex<OfflineChapter>(STORES.CHAPTERS, 'mangaId', mangaId);
  let downloadedCount = 0;
  
  for (const chapter of chapters) {
    const pageCount = await countByIndex(STORES.PAGES, 'chapterId', chapter.id);
    if (pageCount > 0) {
      downloadedCount++;
    }
  }
  
  manga.chaptersDownloaded = downloadedCount;
  await putToStore(STORES.MANGA, manga);
}

// ============ Chapter Operations ============

export async function saveChapterOffline(
  mangaId: string,
  chapter: ChapterInfo
): Promise<void> {
  const offlineChapter: OfflineChapter = {
    id: chapter.id,
    mangaId,
    data: chapter,
    downloadedAt: new Date(),
  };

  await putToStore(STORES.CHAPTERS, offlineChapter);
  await updateMangaChapterCount(mangaId);
}

export async function updateChapterPageCount(
  chapterId: string,
  pageCount: number
): Promise<void> {
  const chapter = await getOfflineChapter(chapterId);
  if (chapter) {
    chapter.data.pages = pageCount;
    await putToStore(STORES.CHAPTERS, chapter);
  }
}

export async function getOfflineChapter(chapterId: string): Promise<OfflineChapter | null> {
  return getFromStore<OfflineChapter>(STORES.CHAPTERS, chapterId);
}

export async function getOfflineChaptersForManga(mangaId: string): Promise<OfflineChapter[]> {
  return getByIndex<OfflineChapter>(STORES.CHAPTERS, 'mangaId', mangaId);
}

export async function deleteOfflineChapter(chapterId: string): Promise<void> {
  // Delete all pages for this chapter
  const pages = await getByIndex<OfflinePage>(STORES.PAGES, 'chapterId', chapterId);
  for (const page of pages) {
    await deleteFromStore(STORES.PAGES, page.id);
  }

  // Get manga ID before deleting chapter
  const chapter = await getOfflineChapter(chapterId);
  const mangaId = chapter?.mangaId;

  // Delete the chapter
  await deleteFromStore(STORES.CHAPTERS, chapterId);

  // Update manga chapter count
  if (mangaId) {
    await updateMangaChapterCount(mangaId);
  }
}

export async function isChapterDownloaded(chapterId: string): Promise<boolean> {
  const chapter = await getOfflineChapter(chapterId);
  if (!chapter) return false;

  // Check if pages are downloaded - we consider it downloaded if we have at least 1 page
  // and either we have the expected count OR the expected count was unknown (0)
  const pages = await getByIndex<OfflinePage>(STORES.PAGES, 'chapterId', chapterId);
  if (pages.length === 0) return false;
  
  // If we have pages and either no expected count or matches expected count
  const expectedPages = chapter.data.pages || 0;
  return expectedPages === 0 || pages.length >= expectedPages;
}

export async function getDownloadedPageCount(chapterId: string): Promise<number> {
  const pages = await getByIndex<OfflinePage>(STORES.PAGES, 'chapterId', chapterId);
  return pages.length;
}

// ============ Page Operations ============

export async function savePageOffline(
  mangaId: string,
  chapterId: string,
  pageNumber: number,
  imageBlob: Blob
): Promise<void> {
  const offlinePage: OfflinePage = {
    id: `${chapterId}-${pageNumber}`,
    chapterId,
    mangaId,
    pageNumber,
    imageBlob,
  };

  await putToStore(STORES.PAGES, offlinePage);
  if (pageNumber === 0) {
    console.log('[Storage] Saving pages for chapter:', chapterId, 'blob size:', imageBlob.size);
  }
}

export async function getOfflinePage(
  chapterId: string,
  pageNumber: number
): Promise<OfflinePage | null> {
  return getFromStore<OfflinePage>(STORES.PAGES, `${chapterId}-${pageNumber}`);
}

export async function getOfflinePagesForChapter(chapterId: string): Promise<OfflinePage[]> {
  const pages = await getByIndex<OfflinePage>(STORES.PAGES, 'chapterId', chapterId);
  console.log('[Storage] getOfflinePagesForChapter:', chapterId, 'found:', pages.length);
  return pages.sort((a, b) => a.pageNumber - b.pageNumber);
}

export async function getOfflinePageUrl(
  chapterId: string,
  pageNumber: number
): Promise<string | null> {
  const page = await getOfflinePage(chapterId, pageNumber);
  if (!page) return null;

  return URL.createObjectURL(page.imageBlob);
}

// ============ Reading Progress Operations ============

export async function saveReadingProgress(
  mangaId: string,
  chapterId: string,
  page: number,
  totalPages: number
): Promise<void> {
  const progress: ReadingProgress = {
    mangaId,
    chapterId,
    page,
    totalPages,
    updatedAt: new Date(),
    synced: false,
  };

  await putToStore(STORES.READING_PROGRESS, progress);
}

export async function getReadingProgress(mangaId: string): Promise<ReadingProgress | null> {
  return getFromStore<ReadingProgress>(STORES.READING_PROGRESS, mangaId);
}

export async function getUnsyncedProgress(): Promise<ReadingProgress[]> {
  return getByIndex<ReadingProgress>(STORES.READING_PROGRESS, 'synced', 0);
}

export async function markProgressSynced(mangaId: string): Promise<void> {
  const progress = await getReadingProgress(mangaId);
  if (progress) {
    progress.synced = true;
    await putToStore(STORES.READING_PROGRESS, progress);
  }
}

// ============ Settings Operations ============

const DEFAULT_SETTINGS: ReaderSettings = {
  imageQuality: 'full',
  readingMode: 'single',
  autoDownloadNext: 0,
};

export async function getReaderSettings(): Promise<ReaderSettings> {
  const saved = await getFromStore<{ key: string; value: ReaderSettings }>(
    STORES.SETTINGS,
    'reader'
  );
  return saved?.value || DEFAULT_SETTINGS;
}

export async function saveReaderSettings(settings: Partial<ReaderSettings>): Promise<void> {
  const current = await getReaderSettings();
  const updated = { ...current, ...settings };
  await putToStore(STORES.SETTINGS, { key: 'reader', value: updated });
}

// ============ Storage Utilities ============

export interface StorageInfo {
  mangaCount: number;
  chapterCount: number;
  pageCount: number;
  estimatedSize: number;
  quota?: number;
  usage?: number;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const manga = await getAllFromStore<OfflineManga>(STORES.MANGA);
  const chapters = await getAllFromStore<OfflineChapter>(STORES.CHAPTERS);
  const pages = await getAllFromStore<OfflinePage>(STORES.PAGES);

  // Estimate size from page blobs
  let estimatedSize = 0;
  for (const page of pages) {
    estimatedSize += page.imageBlob.size;
  }

  // Add cover blobs
  for (const m of manga) {
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
    mangaCount: manga.length,
    chapterCount: chapters.length,
    pageCount: pages.length,
    estimatedSize,
    quota,
    usage,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ Clear All Data ============

export async function clearAllOfflineData(): Promise<void> {
  const db = await openDatabase();

  const transaction = db.transaction(
    [STORES.MANGA, STORES.CHAPTERS, STORES.PAGES, STORES.READING_PROGRESS],
    'readwrite'
  );

  await Promise.all([
    new Promise<void>((resolve) => {
      transaction.objectStore(STORES.MANGA).clear().onsuccess = () => resolve();
    }),
    new Promise<void>((resolve) => {
      transaction.objectStore(STORES.CHAPTERS).clear().onsuccess = () => resolve();
    }),
    new Promise<void>((resolve) => {
      transaction.objectStore(STORES.PAGES).clear().onsuccess = () => resolve();
    }),
    new Promise<void>((resolve) => {
      transaction.objectStore(STORES.READING_PROGRESS).clear().onsuccess = () => resolve();
    }),
  ]);
}
