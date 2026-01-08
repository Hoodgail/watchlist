// Offline Context - manages offline state, downloads, and sync
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  MangaDetails,
  ChapterInfo,
  OfflineManga,
  DownloadTask,
  DownloadProgress,
  ReadingProgress,
  ReaderSettings,
  MangaProviderName,
} from '../services/mangadexTypes';
import * as manga from '../services/manga';
import * as offlineStorage from '../services/offlineStorage';

interface OfflineContextType {
  // Online status
  isOnline: boolean;
  
  // Downloaded content
  downloadedManga: OfflineManga[];
  downloadedChapterIds: Set<string>;
  
  // Download queue
  downloadQueue: DownloadTask[];
  activeDownload: DownloadTask | null;
  
  // Reading progress
  readingProgress: Map<string, ReadingProgress>;
  
  // Settings
  readerSettings: ReaderSettings;
  
  // Actions
  downloadManga: (manga: MangaDetails, provider?: MangaProviderName) => Promise<void>;
  downloadChapter: (mangaId: string, mangaTitle: string, chapter: ChapterInfo, provider?: MangaProviderName) => Promise<void>;
  downloadChapters: (mangaId: string, mangaTitle: string, chapters: ChapterInfo[], provider?: MangaProviderName) => Promise<void>;
  cancelDownload: (mangaId: string) => void;
  pauseDownload: () => void;
  resumeDownload: () => void;
  deleteOfflineManga: (mangaId: string) => Promise<void>;
  deleteOfflineChapter: (chapterId: string) => Promise<void>;
  
  // Reading progress
  updateReadingProgress: (mangaId: string, chapterId: string, page: number, totalPages: number) => Promise<void>;
  getReadingProgress: (mangaId: string) => ReadingProgress | null;
  syncProgress: () => Promise<void>;
  
  // Settings
  updateReaderSettings: (settings: Partial<ReaderSettings>) => Promise<void>;
  
  // Utilities
  isChapterDownloaded: (chapterId: string) => boolean;
  isMangaDownloaded: (mangaId: string) => boolean;
  getOfflinePageUrl: (chapterId: string, pageNumber: number) => Promise<string | null>;
  getOfflineChapterPageUrls: (chapterId: string) => Promise<string[]>;
  getOfflineChapters: (mangaId: string) => Promise<ChapterInfo[]>;
  getOfflineCoverUrl: (mangaId: string) => Promise<string | null>;
  getStorageInfo: () => Promise<offlineStorage.StorageInfo>;
  refreshDownloadedContent: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Downloaded content
  const [downloadedManga, setDownloadedManga] = useState<OfflineManga[]>([]);
  const [downloadedChapterIds, setDownloadedChapterIds] = useState<Set<string>>(new Set());
  
  // Download queue
  const [downloadQueue, setDownloadQueue] = useState<DownloadTask[]>([]);
  const [activeDownload, setActiveDownload] = useState<DownloadTask | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  // Reading progress
  const [readingProgress, setReadingProgress] = useState<Map<string, ReadingProgress>>(new Map());
  
  // Settings
  const [readerSettings, setReaderSettings] = useState<ReaderSettings>({
    imageQuality: 'full',
    readingMode: 'single',
    autoDownloadNext: 0,
  });
  
  // Refs for download control
  const downloadAbortController = useRef<AbortController | null>(null);
  
  // ============ Initialize ============
  
  useEffect(() => {
    // Load downloaded content from IndexedDB
    refreshDownloadedContent();
    
    // Load settings
    offlineStorage.getReaderSettings().then(setReaderSettings);
    
    // Setup online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Listen for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      }
    };
  }, []);
  
  // Process download queue
  useEffect(() => {
    if (!isPaused && downloadQueue.length > 0 && !activeDownload) {
      processNextDownload();
    }
  }, [downloadQueue, activeDownload, isPaused]);
  
  // Sync progress when coming back online
  useEffect(() => {
    if (isOnline) {
      syncProgress();
    }
  }, [isOnline]);
  
  // ============ Service Worker Message Handler ============
  
  const handleSwMessage = useCallback((event: MessageEvent) => {
    if (event.data.type === 'SYNC_READING_PROGRESS') {
      syncProgress();
    }
  }, []);
  
  // ============ Content Management ============
  
  const refreshDownloadedContent = useCallback(async () => {
    try {
      const manga = await offlineStorage.getAllOfflineManga();
      setDownloadedManga(manga);
      
      // Build set of downloaded chapter IDs by checking actual page count
      const chapterIds = new Set<string>();
      for (const m of manga) {
        const chapters = await offlineStorage.getOfflineChaptersForManga(m.id);
        for (const chapter of chapters) {
          // Check if pages exist for this chapter
          const pageCount = await offlineStorage.getDownloadedPageCount(chapter.id);
          if (pageCount > 0) {
            chapterIds.add(chapter.id);
          }
        }
      }
      setDownloadedChapterIds(chapterIds);
      console.log('[Offline] Refreshed:', manga.length, 'manga,', chapterIds.size, 'chapters with pages');
    } catch (error) {
      console.error('[Offline] Failed to refresh:', error);
    }
  }, []);
  
  // ============ Download Functions ============
  
  const downloadManga = useCallback(async (mangaData: MangaDetails, provider: MangaProviderName = 'mangadex') => {
    try {
      // Download cover image
      let coverBlob: Blob | undefined;
      const coverUrl = mangaData.coverUrl || mangaData.coverUrlSmall;
      if (coverUrl) {
        try {
          coverBlob = await manga.fetchImageAsBlob(coverUrl);
        } catch (error) {
          console.warn('Failed to download cover:', error);
        }
      }
      
      // Add provider to manga data
      const mangaWithProvider = { ...mangaData, provider };
      
      // Save manga to IndexedDB
      await offlineStorage.saveMangaOffline(mangaWithProvider, coverBlob);
      await refreshDownloadedContent();
    } catch (error) {
      console.error('Failed to download manga:', error);
      throw error;
    }
  }, [refreshDownloadedContent]);
  
  const downloadChapter = useCallback(async (
    mangaId: string,
    mangaTitle: string,
    chapter: ChapterInfo,
    provider: MangaProviderName = 'mangadex'
  ) => {
    await downloadChapters(mangaId, mangaTitle, [chapter], provider);
  }, []);
  
  const downloadChapters = useCallback(async (
    mangaId: string,
    mangaTitle: string,
    chapters: ChapterInfo[],
    provider: MangaProviderName = 'mangadex'
  ) => {
    console.log('[Download] Queueing download:', { mangaId, mangaTitle, chapterCount: chapters.length, provider });
    
    const task: DownloadTask = {
      mangaId,
      mangaTitle,
      chapterIds: chapters.map(c => c.id),
      progress: chapters.map(c => ({
        mangaId,
        chapterId: c.id,
        currentPage: 0,
        totalPages: c.pages,
        status: 'pending' as const,
      })),
      status: 'pending',
      createdAt: new Date(),
      provider,
    };
    
    // Save chapter info to IndexedDB
    for (const chapter of chapters) {
      await offlineStorage.saveChapterOffline(mangaId, chapter);
    }
    
    setDownloadQueue(prev => [...prev, task]);
  }, []);
  
  const processNextDownload = useCallback(async () => {
    if (downloadQueue.length === 0) return;
    
    const task = downloadQueue[0];
    const provider = task.provider || 'mangadex';
    console.log('[Download] Starting:', task.mangaTitle, task.chapterIds.length, 'chapters');
    setActiveDownload({ ...task, status: 'downloading' });
    
    downloadAbortController.current = new AbortController();
    
    try {
      for (let i = 0; i < task.chapterIds.length; i++) {
        if (downloadAbortController.current.signal.aborted) break;
        
        const chapterId = task.chapterIds[i];
        console.log(`[Download] Chapter ${i + 1}/${task.chapterIds.length}:`, chapterId);
        
        // Update progress to downloading
        setActiveDownload(prev => {
          if (!prev) return null;
          const newProgress = [...prev.progress];
          newProgress[i] = { ...newProgress[i], status: 'downloading' };
          return { ...prev, progress: newProgress };
        });
        
        try {
          // Use the unified helper to get chapter page URLs
          const result = await manga.getChapterPageUrls(chapterId, provider);
          
          if (result.isExternal) {
            throw new Error(result.externalMessage || 'External chapters cannot be downloaded');
          }
          
          const urls = result.urls;
          const headers = result.headers;
          
          console.log(`[Download] ${result.isMangaPlus ? 'MangaPlus' : provider} chapter with ${urls.length} pages`);
          
          if (urls.length === 0) {
            throw new Error('No pages found for this chapter');
          }
          
          // Update the chapter's page count now that we know the actual value
          await offlineStorage.updateChapterPageCount(chapterId, urls.length);
          
          // Download each page
          for (let pageNum = 0; pageNum < urls.length; pageNum++) {
            if (downloadAbortController.current.signal.aborted) break;
            
            const imageBlob = await manga.fetchImageAsBlob(urls[pageNum], headers[pageNum]);
            await offlineStorage.savePageOffline(task.mangaId, chapterId, pageNum, imageBlob);
            
            // Update progress
            setActiveDownload(prev => {
              if (!prev) return null;
              const newProgress = [...prev.progress];
              newProgress[i] = { 
                ...newProgress[i], 
                currentPage: pageNum + 1,
                totalPages: urls.length,
              };
              return { ...prev, progress: newProgress };
            });
          }
          
          console.log(`[Download] Chapter ${chapterId} done, ${urls.length} pages saved`);
          
          // Mark chapter as completed
          setActiveDownload(prev => {
            if (!prev) return null;
            const newProgress = [...prev.progress];
            newProgress[i] = { ...newProgress[i], status: 'completed' };
            return { ...prev, progress: newProgress };
          });
          
          // Update manga chapter count after each successful chapter download
          await offlineStorage.updateMangaChapterCount(task.mangaId);
          
          setDownloadedChapterIds(prev => new Set([...prev, chapterId]));
          
        } catch (error) {
          console.error(`[Download] Failed chapter ${chapterId}:`, error);
          setActiveDownload(prev => {
            if (!prev) return null;
            const newProgress = [...prev.progress];
            newProgress[i] = { 
              ...newProgress[i], 
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            };
            return { ...prev, progress: newProgress };
          });
        }
      }
      
      // Task completed
      console.log('[Download] Task completed for:', task.mangaTitle);
      setDownloadQueue(prev => prev.slice(1));
      setActiveDownload(null);
      await refreshDownloadedContent();
      
    } catch (error) {
      console.error('[Download] Task failed:', error);
      setActiveDownload(prev => prev ? { ...prev, status: 'error' } : null);
    }
  }, [downloadQueue, refreshDownloadedContent]);
  
  const cancelDownload = useCallback((mangaId: string) => {
    if (activeDownload?.mangaId === mangaId) {
      downloadAbortController.current?.abort();
      setActiveDownload(null);
    }
    setDownloadQueue(prev => prev.filter(t => t.mangaId !== mangaId));
  }, [activeDownload]);
  
  const pauseDownload = useCallback(() => {
    setIsPaused(true);
    downloadAbortController.current?.abort();
  }, []);
  
  const resumeDownload = useCallback(() => {
    setIsPaused(false);
  }, []);
  
  const deleteOfflineMangaHandler = useCallback(async (mangaId: string) => {
    await offlineStorage.deleteOfflineManga(mangaId);
    await refreshDownloadedContent();
  }, [refreshDownloadedContent]);
  
  const deleteOfflineChapterHandler = useCallback(async (chapterId: string) => {
    await offlineStorage.deleteOfflineChapter(chapterId);
    setDownloadedChapterIds(prev => {
      const next = new Set(prev);
      next.delete(chapterId);
      return next;
    });
    await refreshDownloadedContent();
  }, [refreshDownloadedContent]);
  
  // ============ Reading Progress ============
  
  const updateReadingProgress = useCallback(async (
    mangaId: string,
    chapterId: string,
    page: number,
    totalPages: number
  ) => {
    await offlineStorage.saveReadingProgress(mangaId, chapterId, page, totalPages);
    
    setReadingProgress(prev => {
      const next = new Map(prev);
      next.set(mangaId, {
        mangaId,
        chapterId,
        page,
        totalPages,
        updatedAt: new Date(),
        synced: false,
      });
      return next;
    });
  }, []);
  
  const getReadingProgressHandler = useCallback((mangaId: string): ReadingProgress | null => {
    return readingProgress.get(mangaId) || null;
  }, [readingProgress]);
  
  const syncProgress = useCallback(async () => {
    if (!isOnline) return;
    
    try {
      const unsynced = await offlineStorage.getUnsyncedProgress();
      
      for (const progress of unsynced) {
        // TODO: Sync to backend when API is available
        // For now, just mark as synced
        await offlineStorage.markProgressSynced(progress.mangaId);
      }
    } catch (error) {
      console.error('Failed to sync reading progress:', error);
    }
  }, [isOnline]);
  
  // ============ Settings ============
  
  const updateReaderSettings = useCallback(async (settings: Partial<ReaderSettings>) => {
    await offlineStorage.saveReaderSettings(settings);
    setReaderSettings(prev => ({ ...prev, ...settings }));
  }, []);
  
  // ============ Utilities ============
  
  const isChapterDownloaded = useCallback((chapterId: string): boolean => {
    return downloadedChapterIds.has(chapterId);
  }, [downloadedChapterIds]);
  
  const isMangaDownloaded = useCallback((mangaId: string): boolean => {
    return downloadedManga.some(m => m.id === mangaId);
  }, [downloadedManga]);
  
  const getOfflinePageUrl = useCallback(async (
    chapterId: string,
    pageNumber: number
  ): Promise<string | null> => {
    return offlineStorage.getOfflinePageUrl(chapterId, pageNumber);
  }, []);
  
  const getOfflineChapterPageUrls = useCallback(async (
    chapterId: string
  ): Promise<string[]> => {
    const pages = await offlineStorage.getOfflinePagesForChapter(chapterId);
    return pages.map(page => URL.createObjectURL(page.imageBlob));
  }, []);
  
  const getOfflineChapters = useCallback(async (mangaId: string): Promise<ChapterInfo[]> => {
    const offlineChapters = await offlineStorage.getOfflineChaptersForManga(mangaId);
    // Return chapters that have pages downloaded, sorted by chapter number
    const chaptersWithPages: ChapterInfo[] = [];
    for (const oc of offlineChapters) {
      const pageCount = await offlineStorage.getDownloadedPageCount(oc.id);
      if (pageCount > 0) {
        chaptersWithPages.push(oc.data);
      }
    }
    // Sort by chapter number (ascending)
    return chaptersWithPages.sort((a, b) => {
      const aNum = parseFloat(a.chapter || '0') || 0;
      const bNum = parseFloat(b.chapter || '0') || 0;
      return aNum - bNum;
    });
  }, []);
  
  const getOfflineCoverUrl = useCallback(async (mangaId: string): Promise<string | null> => {
    const offlineManga = await offlineStorage.getOfflineManga(mangaId);
    if (offlineManga?.coverBlob) {
      return URL.createObjectURL(offlineManga.coverBlob);
    }
    return null;
  }, []);
  
  const getStorageInfo = useCallback(async () => {
    return offlineStorage.getStorageInfo();
  }, []);
  
  const value: OfflineContextType = {
    isOnline,
    downloadedManga,
    downloadedChapterIds,
    downloadQueue,
    activeDownload,
    readingProgress,
    readerSettings,
    downloadManga,
    downloadChapter,
    downloadChapters,
    cancelDownload,
    pauseDownload,
    resumeDownload,
    deleteOfflineManga: deleteOfflineMangaHandler,
    deleteOfflineChapter: deleteOfflineChapterHandler,
    updateReadingProgress,
    getReadingProgress: getReadingProgressHandler,
    syncProgress,
    updateReaderSettings,
    isChapterDownloaded,
    isMangaDownloaded,
    getOfflinePageUrl,
    getOfflineChapterPageUrls,
    getOfflineChapters,
    getOfflineCoverUrl,
    getStorageInfo,
    refreshDownloadedContent,
  };
  
  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};
