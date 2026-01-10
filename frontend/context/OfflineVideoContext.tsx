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
  saveHLSSegment,
  saveHLSEpisodeOffline,
  getDownloadedSegmentIndices,
  formatBytes,
  saveHLSInitSegment,
  hasHLSInitSegment,
  cleanupOrphanedData,
} from '../services/offlineVideoStorage';
import { updateWatchProgress as syncWatchProgressToBackend, getAccessToken } from '../services/api';
import { getStreamingUrl } from '../services/video';
import {
  getQualityOptions,
  downloadHLSStream,
  estimateTotalSize,
  parseM3U8,
  QualityOption,
  HLSDownloadProgress,
} from '../services/hlsDownloader';

// ============ Types ============

export interface VideoDownloadTask {
  mediaId: string;
  mediaTitle: string;
  episode: VideoEpisode;
  provider: VideoProviderName;
  progress: number; // 0-100
  status: 'pending' | 'awaiting_quality' | 'downloading' | 'completed' | 'error' | 'cancelled';
  error?: string;
  // HLS-specific fields
  isHLS?: boolean;
  selectedQuality?: QualityOption;
  availableQualities?: QualityOption[];
  estimatedSize?: number;
  bytesDownloaded?: number;
  segmentsDownloaded?: number;
  totalSegments?: number;
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
  downloadEpisode: (mediaId: string, mediaTitle: string, episode: VideoEpisode, provider: VideoProviderName, originalRefId?: string) => Promise<void>;
  downloadEpisodes: (mediaId: string, mediaTitle: string, episodes: VideoEpisode[], provider: VideoProviderName, originalRefId?: string) => Promise<void>;
  cancelDownload: (episodeId: string) => void;
  retryDownload: (episodeId: string) => void;
  deleteOfflineMedia: (mediaId: string) => Promise<void>;
  deleteOfflineEpisode: (episodeId: string) => Promise<void>;
  selectQuality: (episodeId: string, quality: QualityOption) => void;
  
  // Progress
  updateWatchProgress: (mediaId: string, episodeId: string, currentTime: number, duration: number, provider?: string, episodeNumber?: number, seasonNumber?: number, currentEpisode?: number, totalEpisodes?: number) => Promise<void>;
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
    // Initialize database, request persistent storage, and cleanup orphaned data
    initVideoDatabase().then(async () => {
      console.log('[OfflineVideo] Database initialized with persistence request');
      
      // Run orphaned data cleanup in background (non-blocking)
      try {
        const cleanupResult = await cleanupOrphanedData();
        if (cleanupResult.bytesReclaimed > 0) {
          console.log('[OfflineVideo] Reclaimed', formatBytes(cleanupResult.bytesReclaimed), 'from orphaned data');
        }
      } catch (err) {
        console.warn('[OfflineVideo] Cleanup failed:', err);
      }
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
    provider: VideoProviderName,
    originalRefId?: string
  ) => {
    await downloadEpisodes(mediaId, mediaTitle, [episode], provider, originalRefId);
  }, []);
  
  const downloadEpisodes = useCallback(async (
    mediaId: string,
    mediaTitle: string,
    episodes: VideoEpisode[],
    provider: VideoProviderName,
    originalRefId?: string
  ) => {
    console.log('[OfflineVideo] Queueing download:', { mediaId, mediaTitle, episodeCount: episodes.length, provider, originalRefId });
    
    // Ensure media is saved first (with originalRefId for offline lookup by external ID)
    const existingMedia = await getOfflineMedia(mediaId);
    if (!existingMedia) {
      await saveMediaOffline({
        id: mediaId,
        title: mediaTitle,
        episodeCount: 0,
        originalRefId: originalRefId !== mediaId ? originalRefId : undefined,
      });
    } else if (originalRefId && originalRefId !== mediaId && !existingMedia.originalRefId) {
      // Update existing media with originalRefId if it wasn't set before
      await saveMediaOffline({
        ...existingMedia,
        originalRefId,
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
    
    // If task is awaiting quality selection, don't start yet
    if (task.status === 'awaiting_quality') {
      setActiveDownload(task);
      return;
    }
    
    console.log('[OfflineVideo] Starting download:', task.mediaTitle, 'Episode', task.episode.number);
    
    const updatedTask: VideoDownloadTask = { ...task, status: 'downloading' };
    setActiveDownload(updatedTask);
    
    downloadAbortController.current = new AbortController();
    const signal = downloadAbortController.current.signal;
    
    try {
      // Fetch streaming sources using the same helper as VideoPlayer
      console.log('[OfflineVideo] Fetching streaming sources for episode:', task.episode.id);
      const streamingResult = await getStreamingUrl(task.provider, task.episode.id, task.mediaId);
      
      console.log('[OfflineVideo] Got streaming URL:', {
        url: streamingResult.url.substring(0, 80) + '...',
        isM3U8: streamingResult.isM3U8,
        quality: streamingResult.quality,
      });
      
      // Check if download was cancelled while fetching sources
      if (signal.aborted) {
        console.log('[OfflineVideo] Download cancelled during source fetch:', task.episode.id);
        return;
      }
      
      // For HLS streams, use the HLS downloader
      // IMPORTANT: Pass the ORIGINAL source URL, not the proxied URL
      // The HLS downloader applies its own proxying internally
      if (streamingResult.isM3U8) {
        const originalM3U8Url = streamingResult.sources.sources[0].url;
        await processHLSDownload(task, originalM3U8Url, streamingResult.sources.headers?.Referer, signal);
        return;
      }
      
      // For direct video files, download as blob
      const videoBlob = await fetchVideoAsBlob(
        streamingResult.url,
        undefined,
        (loaded, total) => {
          const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
          setActiveDownload(prev => prev ? { ...prev, progress } : null);
        }
      );
      
      // Check if download was cancelled
      if (signal.aborted) {
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
      if (signal.aborted) {
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
  
  /**
   * Process HLS download - handles quality selection and segment downloading
   */
  const processHLSDownload = async (
    task: VideoDownloadTask,
    m3u8Url: string,
    referer: string | undefined,
    signal: AbortSignal
  ) => {
    console.log('[OfflineVideo] Processing HLS download for:', task.episode.id, 'URL:', m3u8Url.substring(0, 60));
    
    // If we already have a selected quality, use it directly
    let playlistUrl = m3u8Url;
    
    if (!task.selectedQuality) {
      // Fetch quality options
      console.log('[OfflineVideo] Fetching quality options...');
      const qualities = await getQualityOptions(m3u8Url, referer);
      console.log('[OfflineVideo] Got qualities:', qualities.length);
      
      if (signal.aborted) return;
      
      if (qualities.length > 1) {
        // Multiple qualities - pause for user selection
        console.log('[OfflineVideo] HLS has multiple qualities:', qualities.map(q => q.label));
        
        // Parse to estimate sizes for each quality (with timeout protection)
        console.log('[OfflineVideo] Estimating sizes for each quality...');
        const qualitiesWithSize = await Promise.all(
          qualities.map(async (q) => {
            try {
              const parsed = await parseM3U8(q.url, referer);
              if (parsed.segments && parsed.segments.length > 0) {
                const size = await estimateTotalSize(parsed.segments, referer, 2);
                console.log(`[OfflineVideo] Quality ${q.label}: ~${Math.round(size / 1024 / 1024)} MB`);
                return { ...q, estimatedSize: size };
              }
            } catch (err) {
              console.warn(`[OfflineVideo] Failed to estimate size for ${q.label}:`, err);
            }
            return q;
          })
        );
        console.log('[OfflineVideo] Size estimation complete');
        
        if (signal.aborted) return;
        
        setDownloadQueue(prev => {
          const updated = [...prev];
          updated[0] = {
            ...task,
            status: 'awaiting_quality',
            isHLS: true,
            availableQualities: qualitiesWithSize as (QualityOption & { estimatedSize?: number })[],
          };
          return updated;
        });
        
        setActiveDownload(prev => prev ? {
          ...prev,
          status: 'awaiting_quality',
          isHLS: true,
          availableQualities: qualitiesWithSize as (QualityOption & { estimatedSize?: number })[],
        } : null);
        
        return; // Wait for user to select quality
      }
      
      // Only one quality - use it directly
      playlistUrl = qualities[0].url;
    } else {
      playlistUrl = task.selectedQuality.url;
    }
    
    // Parse the media playlist
    const parsed = await parseM3U8(playlistUrl, referer);
    
    if (!parsed.segments || parsed.segments.length === 0) {
      throw new Error('No segments found in HLS playlist');
    }
    
    if (signal.aborted) return;
    
    const totalSegments = parsed.segments.length;
    const totalDuration = parsed.totalDuration || 0;
    
    // Estimate total size
    const estimatedSize = await estimateTotalSize(parsed.segments, referer);
    
    // Check for size warning (> 500MB)
    const SIZE_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500MB
    if (estimatedSize > SIZE_WARNING_THRESHOLD && !task.selectedQuality) {
      console.log(`[OfflineVideo] Large download warning: ${formatBytes(estimatedSize)}`);
      // For now, continue anyway - the UI can show a confirmation dialog
    }
    
    // Check for previously downloaded segments (resumable)
    const downloadedIndices = await getDownloadedSegmentIndices(task.episode.id);
    const initSegmentDownloaded = await hasHLSInitSegment(task.episode.id);
    
    console.log('[OfflineVideo] Starting HLS segment download:', {
      totalSegments,
      alreadyDownloaded: downloadedIndices.size,
      estimatedSize: formatBytes(estimatedSize),
      hasInitSegment: !!parsed.initSegment,
      initSegmentDownloaded,
    });
    
    // Update state to show HLS-specific progress
    setActiveDownload(prev => prev ? {
      ...prev,
      isHLS: true,
      estimatedSize,
      totalSegments,
      segmentsDownloaded: downloadedIndices.size,
      bytesDownloaded: 0,
    } : null);
    
    let bytesDownloaded = 0;
    let hasInitSegment = false;
    
    // Download segments
    await downloadHLSStream(playlistUrl, {
      signal,
      referer,
      downloadedSegments: downloadedIndices,
      initSegmentDownloaded,
      onInitSegmentDownloaded: async (data) => {
        // Save init segment for fMP4
        await saveHLSInitSegment(task.episode.id, data);
        hasInitSegment = true;
        bytesDownloaded += data.length;
        console.log('[OfflineVideo] Init segment saved:', data.length, 'bytes');
      },
      onSegmentDownloaded: async (index, data, duration, _totalSegments) => {
        // Save segment to storage
        await saveHLSSegment(task.episode.id, index, data, duration);
        bytesDownloaded += data.length;
      },
      onProgress: (progress: HLSDownloadProgress) => {
        hasInitSegment = progress.hasInitSegment || hasInitSegment;
        setActiveDownload(prev => prev ? {
          ...prev,
          progress: progress.percentage,
          bytesDownloaded: progress.bytesDownloaded,
          segmentsDownloaded: progress.currentSegment + 1,
          totalSegments: progress.totalSegments,
          estimatedSize: progress.estimatedTotalBytes,
        } : null);
      },
    });
    
    if (signal.aborted) {
      console.log('[OfflineVideo] HLS download cancelled:', task.episode.id);
      return;
    }
    
    // Save HLS episode metadata
    await saveHLSEpisodeOffline(
      task.mediaId,
      {
        id: task.episode.id,
        episodeNumber: task.episode.number,
        title: task.episode.title,
      },
      totalSegments,
      totalDuration,
      bytesDownloaded,
      undefined, // subtitleBlobs
      hasInitSegment
    );
    
    console.log('[OfflineVideo] HLS Episode downloaded:', task.episode.id, formatBytes(bytesDownloaded));
    
    // Update downloaded episode IDs
    setDownloadedEpisodeIds(prev => new Set([...prev, task.episode.id]));
    
    // Move to next task
    setDownloadQueue(prev => prev.slice(1));
    setActiveDownload(null);
    
    // Refresh content after successful download
    await refreshDownloadedContent();
  };
  
  /**
   * User selected a quality for HLS download
   */
  const selectQuality = useCallback((episodeId: string, quality: QualityOption) => {
    setDownloadQueue(prev => {
      const updated = [...prev];
      const taskIndex = updated.findIndex(t => t.episode.id === episodeId);
      
      if (taskIndex >= 0) {
        updated[taskIndex] = {
          ...updated[taskIndex],
          status: 'pending',
          selectedQuality: quality,
        };
      }
      
      return updated;
    });
    
    // Trigger reprocessing
    setActiveDownload(null);
  }, []);
  
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
  
  const retryDownload = useCallback((episodeId: string) => {
    // If it's the active download that failed, reset it to pending and reprocess
    if (activeDownload?.episode.id === episodeId && activeDownload.status === 'error') {
      const retryTask: VideoDownloadTask = {
        ...activeDownload,
        status: 'pending',
        progress: 0,
        error: undefined,
        // Keep selectedQuality if it was set, so user doesn't have to pick again
      };
      
      setActiveDownload(null);
      setDownloadQueue(prev => [retryTask, ...prev.slice(1)]);
    } else {
      // Find in queue and reset
      setDownloadQueue(prev => {
        const taskIndex = prev.findIndex(t => t.episode.id === episodeId);
        if (taskIndex >= 0 && prev[taskIndex].status === 'error') {
          const updated = [...prev];
          updated[taskIndex] = {
            ...updated[taskIndex],
            status: 'pending',
            progress: 0,
            error: undefined,
          };
          return updated;
        }
        return prev;
      });
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
    duration: number,
    provider?: string,
    episodeNumber?: number,
    seasonNumber?: number,
    currentEpisode?: number,
    totalEpisodes?: number
  ) => {
    const key = `${mediaId}-${episodeId}`;
    const now = Date.now();
    const lastUpdate = lastProgressUpdate.current.get(key) || 0;
    
    // Throttle updates to every 10 seconds
    if (now - lastUpdate < PROGRESS_UPDATE_THROTTLE_MS) {
      return;
    }
    
    lastProgressUpdate.current.set(key, now);
    
    // Save to IndexedDB (always, for offline support)
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
    
    // Sync to backend if online and authenticated
    if (isOnline && provider && getAccessToken()) {
      try {
        await syncWatchProgressToBackend({
          mediaId,
          episodeId: episodeId || undefined,
          episodeNumber,
          seasonNumber,
          currentTime,
          duration,
          provider,
          currentEpisode,
          totalEpisodes,
        });
      } catch (error) {
        // Non-critical: log but don't throw - local storage is the fallback
        console.error('[OfflineVideo] Failed to sync progress to backend:', error);
      }
    }
  }, [isOnline]);
  
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
    retryDownload,
    deleteOfflineMedia: deleteOfflineMediaHandler,
    deleteOfflineEpisode: deleteOfflineEpisodeHandler,
    selectQuality,
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
