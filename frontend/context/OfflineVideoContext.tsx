// Offline Video Context - manages offline video downloads, queue, and watch progress
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { VideoProviderName, VideoEpisode, WatchProgress } from '../types';
import {
  OfflineVideoMedia,
  VideoStorageInfo,
  saveMediaOffline,
  getOfflineMedia,
  getAllOfflineMedia,
  deleteOfflineMedia,
  saveEpisodeOffline,
  getOfflineEpisode,
  getOfflineEpisodesForMedia,
  getOfflineVideoUrl,
  deleteOfflineEpisode,
  saveWatchProgress,
  getWatchProgress as getStoredWatchProgress,
  getAllWatchProgress,
  getVideoStorageInfo,
  fetchVideoAsBlob,
  requestPersistentStorage,
  initVideoDatabase,
} from '../services/offlineVideoStorage';

// ============ Types ============

export interface VideoDownloadTask {
  mediaId: string;
  mediaTitle: string;
  episode: VideoEpisode;
  provider: VideoProviderName;
  progress: number; // 0-100
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'cancelled';
  error?: string;
}

interface OfflineVideoContextType {
  // Online status
  isOnline: boolean;
  
  // Downloaded content
  downloadedMedia: OfflineVideoMedia[];
  downloadedEpisodeIds: Set<string>;
  
  // Download queue
  downloadQueue: VideoDownloadTask[];
  activeDownload: VideoDownloadTask | null;
  
  // Watch progress
  watchProgress: Map<string, WatchProgress>;
  
  // Actions
  downloadEpisode: (mediaId: string, mediaTitle: string, episode: VideoEpisode, provider: VideoProviderName) => Promise<void>;
  downloadEpisodes: (mediaId: string, mediaTitle: string, episodes: VideoEpisode[], provider: VideoProviderName) => Promise<void>;
  cancelDownload: (episodeId: string) => void;
  deleteOfflineMedia: (mediaId: string) => Promise<void>;
  deleteOfflineEpisode: (episodeId: string) => Promise<void>;
  
  // Progress
  updateWatchProgress: (mediaId: string, episodeId: string, currentTime: number, duration: number) => Promise<void>;
  getWatchProgress: (mediaId: string, episodeId?: string) => WatchProgress | null;
  
  // Utilities
  isEpisodeDownloaded: (episodeId: string) => boolean;
  isMediaDownloaded: (mediaId: string) => boolean;
  getOfflineVideoUrl: (episodeId: string) => Promise<string | null>;
  getStorageInfo: () => Promise<VideoStorageInfo>;
  
  // Loading state
  isLoading: boolean;
}

const OfflineVideoContext = createContext<OfflineVideoContextType | null>(null);

export function useOfflineVideo() {
  const context = useContext(OfflineVideoContext);
  if (!context) {
    throw new Error('useOfflineVideo must be used within an OfflineVideoProvider');
  }
  return context;
}

export const OfflineVideoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  
  // Downloaded content
  const [downloadedMedia, setDownloadedMedia] = useState<OfflineVideoMedia[]>([]);
  const [downloadedEpisodeIds, setDownloadedEpisodeIds] = useState<Set<string>>(new Set());
  
  // Download queue
  const [downloadQueue, setDownloadQueue] = useState<VideoDownloadTask[]>([]);
  const [activeDownload, setActiveDownload] = useState<VideoDownloadTask | null>(null);
  
  // Watch progress
  const [watchProgress, setWatchProgress] = useState<Map<string, WatchProgress>>(new Map());
  
  // Refs for download control
  const downloadAbortController = useRef<AbortController | null>(null);
  
  // Throttle ref for watch progress updates
  const lastProgressUpdate = useRef<Map<string, number>>(new Map());
  const PROGRESS_UPDATE_THROTTLE_MS = 10000; // 10 seconds
  
  // ============ Initialize ============
  
  useEffect(() => {
    // Initialize database and request persistent storage
    initVideoDatabase().then(() => {
      console.log('[OfflineVideo] Database initialized with persistence request');
    });
    
    // Load downloaded content from IndexedDB
    refreshDownloadedContent();
    
    // Load watch progress
    loadWatchProgress();
    
    // Setup online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Process download queue
  useEffect(() => {
    if (downloadQueue.length > 0 && !activeDownload) {
      processNextDownload();
    }
  }, [downloadQueue, activeDownload]);
  
  // ============ Content Management ============
  
  const refreshDownloadedContent = useCallback(async () => {
    try {
      setIsLoading(true);
      const media = await getAllOfflineMedia();
      setDownloadedMedia(media);
      
      // Build set of downloaded episode IDs
      const episodeIds = new Set<string>();
      for (const m of media) {
        const episodes = await getOfflineEpisodesForMedia(m.id);
        for (const episode of episodes) {
          episodeIds.add(episode.id);
        }
      }
      setDownloadedEpisodeIds(episodeIds);
      console.log('[OfflineVideo] Refreshed:', media.length, 'media,', episodeIds.size, 'episodes');
    } catch (error) {
      console.error('[OfflineVideo] Failed to refresh:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const loadWatchProgress = useCallback(async () => {
    try {
      const allProgress = await getAllWatchProgress();
      const progressMap = new Map<string, WatchProgress>();
      
      for (const record of allProgress) {
        const key = record.episodeId ? `${record.mediaId}-${record.episodeId}` : record.mediaId;
        progressMap.set(key, {
          mediaId: record.mediaId,
          episodeId: record.episodeId || '',
          currentTime: record.currentTime,
          duration: record.duration,
          completed: record.percentage >= 90, // Consider 90%+ as completed
          updatedAt: record.updatedAt.toISOString(),
        });
      }
      
      setWatchProgress(progressMap);
    } catch (error) {
      console.error('[OfflineVideo] Failed to load watch progress:', error);
    }
  }, []);
  
  // ============ Download Functions ============
  
  const downloadEpisode = useCallback(async (
    mediaId: string,
    mediaTitle: string,
    episode: VideoEpisode,
    provider: VideoProviderName
  ) => {
    await downloadEpisodes(mediaId, mediaTitle, [episode], provider);
  }, []);
  
  const downloadEpisodes = useCallback(async (
    mediaId: string,
    mediaTitle: string,
    episodes: VideoEpisode[],
    provider: VideoProviderName
  ) => {
    console.log('[OfflineVideo] Queueing download:', { mediaId, mediaTitle, episodeCount: episodes.length, provider });
    
    // Ensure media is saved first
    const existingMedia = await getOfflineMedia(mediaId);
    if (!existingMedia) {
      await saveMediaOffline({
        id: mediaId,
        title: mediaTitle,
        episodeCount: 0,
      });
    }
    
    // Create download tasks for each episode
    const tasks: VideoDownloadTask[] = episodes.map(episode => ({
      mediaId,
      mediaTitle,
      episode,
      provider,
      progress: 0,
      status: 'pending' as const,
    }));
    
    setDownloadQueue(prev => [...prev, ...tasks]);
  }, []);
  
  const processNextDownload = useCallback(async () => {
    if (downloadQueue.length === 0) return;
    
    const task = downloadQueue[0];
    console.log('[OfflineVideo] Starting download:', task.mediaTitle, 'Episode', task.episode.number);
    
    const updatedTask: VideoDownloadTask = { ...task, status: 'downloading' };
    setActiveDownload(updatedTask);
    
    downloadAbortController.current = new AbortController();
    
    try {
      // Get episode streaming source URL
      // Note: In a real implementation, you would call your video API to get the streaming URL
      // For now, we'll use the episode's url if available
      const videoUrl = task.episode.url;
      
      if (!videoUrl) {
        throw new Error('No video URL available for this episode');
      }
      
      // Download video with progress tracking
      const videoBlob = await fetchVideoAsBlob(
        videoUrl,
        undefined,
        (loaded, total) => {
          const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
          setActiveDownload(prev => prev ? { ...prev, progress } : null);
        }
      );
      
      // Check if download was cancelled
      if (downloadAbortController.current.signal.aborted) {
        console.log('[OfflineVideo] Download cancelled:', task.episode.id);
        return;
      }
      
      // Save episode offline
      await saveEpisodeOffline(
        task.mediaId,
        {
          id: task.episode.id,
          episodeNumber: task.episode.number,
          title: task.episode.title,
        },
        videoBlob
      );
      
      console.log('[OfflineVideo] Episode downloaded:', task.episode.id);
      
      // Update downloaded episode IDs
      setDownloadedEpisodeIds(prev => new Set([...prev, task.episode.id]));
      
      // Move to next task
      setDownloadQueue(prev => prev.slice(1));
      setActiveDownload(null);
      
      // Refresh content after successful download
      await refreshDownloadedContent();
      
    } catch (error) {
      if (downloadAbortController.current?.signal.aborted) {
        console.log('[OfflineVideo] Download cancelled:', task.episode.id);
        setDownloadQueue(prev => prev.slice(1));
        setActiveDownload(null);
        return;
      }
      
      console.error('[OfflineVideo] Download failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setActiveDownload(prev => prev ? { 
        ...prev, 
        status: 'error',
        error: errorMessage,
      } : null);
      
      // Remove failed task after a delay
      setTimeout(() => {
        setDownloadQueue(prev => prev.slice(1));
        setActiveDownload(null);
      }, 3000);
    }
  }, [downloadQueue, refreshDownloadedContent]);
  
  const cancelDownload = useCallback((episodeId: string) => {
    // Cancel active download if it matches
    if (activeDownload?.episode.id === episodeId) {
      downloadAbortController.current?.abort();
      setActiveDownload(null);
      setDownloadQueue(prev => prev.slice(1));
    } else {
      // Remove from queue
      setDownloadQueue(prev => prev.filter(t => t.episode.id !== episodeId));
    }
  }, [activeDownload]);
  
  const deleteOfflineMediaHandler = useCallback(async (mediaId: string) => {
    await deleteOfflineMedia(mediaId);
    await refreshDownloadedContent();
  }, [refreshDownloadedContent]);
  
  const deleteOfflineEpisodeHandler = useCallback(async (episodeId: string) => {
    await deleteOfflineEpisode(episodeId);
    setDownloadedEpisodeIds(prev => {
      const next = new Set(prev);
      next.delete(episodeId);
      return next;
    });
    await refreshDownloadedContent();
  }, [refreshDownloadedContent]);
  
  // ============ Watch Progress ============
  
  const updateWatchProgressHandler = useCallback(async (
    mediaId: string,
    episodeId: string,
    currentTime: number,
    duration: number
  ) => {
    const key = `${mediaId}-${episodeId}`;
    const now = Date.now();
    const lastUpdate = lastProgressUpdate.current.get(key) || 0;
    
    // Throttle updates to every 10 seconds
    if (now - lastUpdate < PROGRESS_UPDATE_THROTTLE_MS) {
      return;
    }
    
    lastProgressUpdate.current.set(key, now);
    
    // Save to IndexedDB
    await saveWatchProgress(mediaId, episodeId, currentTime, duration);
    
    // Update local state
    const completed = duration > 0 && (currentTime / duration) >= 0.9;
    
    setWatchProgress(prev => {
      const next = new Map(prev);
      next.set(key, {
        mediaId,
        episodeId,
        currentTime,
        duration,
        completed,
        updatedAt: new Date().toISOString(),
      });
      return next;
    });
  }, []);
  
  const getWatchProgressHandler = useCallback((mediaId: string, episodeId?: string): WatchProgress | null => {
    const key = episodeId ? `${mediaId}-${episodeId}` : mediaId;
    return watchProgress.get(key) || null;
  }, [watchProgress]);
  
  // ============ Utilities ============
  
  const isEpisodeDownloaded = useCallback((episodeId: string): boolean => {
    return downloadedEpisodeIds.has(episodeId);
  }, [downloadedEpisodeIds]);
  
  const isMediaDownloaded = useCallback((mediaId: string): boolean => {
    return downloadedMedia.some(m => m.id === mediaId);
  }, [downloadedMedia]);
  
  const getOfflineVideoUrlHandler = useCallback(async (episodeId: string): Promise<string | null> => {
    return getOfflineVideoUrl(episodeId);
  }, []);
  
  const getStorageInfoHandler = useCallback(async (): Promise<VideoStorageInfo> => {
    return getVideoStorageInfo();
  }, []);
  
  // ============ Context Value ============
  
  const value: OfflineVideoContextType = {
    isOnline,
    downloadedMedia,
    downloadedEpisodeIds,
    downloadQueue,
    activeDownload,
    watchProgress,
    downloadEpisode,
    downloadEpisodes,
    cancelDownload,
    deleteOfflineMedia: deleteOfflineMediaHandler,
    deleteOfflineEpisode: deleteOfflineEpisodeHandler,
    updateWatchProgress: updateWatchProgressHandler,
    getWatchProgress: getWatchProgressHandler,
    isEpisodeDownloaded,
    isMediaDownloaded,
    getOfflineVideoUrl: getOfflineVideoUrlHandler,
    getStorageInfo: getStorageInfoHandler,
    isLoading,
  };
  
  return (
    <OfflineVideoContext.Provider value={value}>
      {children}
    </OfflineVideoContext.Provider>
  );
};

export { OfflineVideoContext };
