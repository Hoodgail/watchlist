// MediaDetail Component - Shows TV/Movie/Anime details with episode listing
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VideoProviderName, VideoEpisode, VideoSeason, WatchProgress } from '../types';
import * as videoService from '../services/video';
import { VideoMediaInfo } from '../services/video';
import { resolveAndGetMediaInfo, needsResolution, LOW_CONFIDENCE_THRESHOLD } from '../services/videoResolver';
import { useOfflineVideo } from '../context/OfflineVideoContext';
import { useToast } from '../context/ToastContext';
import { getWatchProgressForMedia, WatchProgressData, getAccessToken } from '../services/api';
import { getOfflineEpisodesForMedia, OfflineVideoEpisode } from '../services/offlineVideoStorage';
import ProviderMappingModal from './ProviderMappingModal';

interface MediaDetailProps {
  /** The original reference ID (e.g., "tmdb:95479" or "hianime:abc123") */
  mediaId: string;
  /** The video provider to use for playback */
  provider: VideoProviderName;
  /** Title for search-based resolution when mediaId is from external source */
  title?: string;
  /** Media type hint for better resolution */
  mediaType?: 'movie' | 'tv' | 'anime';
  onClose: () => void;
  onWatchEpisode: (mediaId: string, episodeId: string, episodes: VideoEpisode[], provider: VideoProviderName, mediaTitle: string) => void;
}

// Helper to proxy image URLs through our server to bypass hotlink protection
function proxyImageUrl(url: string | null): string | null {
  if (!url) return null;
  // Don't proxy blob URLs or already-proxied URLs
  if (url.startsWith('blob:') || url.startsWith('/api/')) {
    return url;
  }
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

export const MediaDetail: React.FC<MediaDetailProps> = ({
  mediaId,
  provider,
  title: initialTitle,
  mediaType,
  onClose,
  onWatchEpisode,
}) => {
  const { showToast } = useToast();
  const {
    isOnline,
    downloadEpisode,
    downloadEpisodes,
    isEpisodeDownloaded,
    isMediaDownloaded,
    deleteOfflineMedia,
    deleteOfflineEpisode,
    getWatchProgress,
    downloadedMedia,
    activeDownload,
    downloadQueue,
    selectQuality,
  } = useOfflineVideo();

  const [mediaInfo, setMediaInfo] = useState<VideoMediaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set());
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  
  // Backend watch progress (synced across devices)
  const [backendProgress, setBackendProgress] = useState<Map<string, WatchProgressData>>(new Map());
  
  // Resolved provider ID - may differ from mediaId if resolution was needed
  const [resolvedProviderId, setResolvedProviderId] = useState<string>(mediaId);
  const [resolvedProvider, setResolvedProvider] = useState<VideoProviderName>(provider);
  
  // Resolution confidence tracking
  const [confidence, setConfidence] = useState<number>(1.0);
  const [isVerified, setIsVerified] = useState<boolean>(true);
  const [showLinkSourceModal, setShowLinkSourceModal] = useState(false);
  const [showConfidenceWarning, setShowConfidenceWarning] = useState(false);

  // Track if we've loaded for this mediaId to prevent duplicate loads
  const loadedForRef = useRef<string | null>(null);

  // Load media details
  useEffect(() => {
    // Avoid duplicate loads for the same mediaId
    if (loadedForRef.current === `${mediaId}:${provider}`) return;
    loadedForRef.current = `${mediaId}:${provider}`;
    // Reset resolved IDs when mediaId changes
    setResolvedProviderId(mediaId);
    setResolvedProvider(provider);
    loadMediaDetails();
  }, [mediaId, provider]);

  // Fetch watch progress from backend when online, authenticated, and resolved ID is available
  useEffect(() => {
    const fetchBackendProgress = async () => {
      if (!isOnline || !getAccessToken() || !resolvedProviderId) return;
      
      try {
        const progressData = await getWatchProgressForMedia(resolvedProviderId);
        const progressMap = new Map<string, WatchProgressData>();
        for (const p of progressData) {
          // Key by episodeId for easy lookup
          progressMap.set(p.episodeId, p);
        }
        setBackendProgress(progressMap);
      } catch (err) {
        // Non-critical - local progress still works
        console.error('[MediaDetail] Failed to fetch backend progress:', err);
      }
    };
    
    fetchBackendProgress();
  }, [resolvedProviderId, isOnline]);

  const loadMediaDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to load from offline storage first
      // Check both by ID and originalRefId (for cases where we store provider ID but query with external ID)
      const offlineMedia = downloadedMedia.find(m => 
        m.id === mediaId || m.originalRefId === mediaId
      );
      
      if (offlineMedia) {
        // We have offline metadata but need full info
        // If online, fetch fresh data; otherwise show limited info with offline episodes
        if (!isOnline) {
          // Load episodes from IndexedDB for offline playback
          const offlineEpisodes = await getOfflineEpisodesForMedia(offlineMedia.id);
          
          // Convert offline episodes to VideoEpisode format
          const episodes: VideoEpisode[] = offlineEpisodes.map(ep => ({
            id: ep.id,
            number: ep.episodeNumber,
            title: ep.title || `Episode ${ep.episodeNumber}`,
          }));
          
          // Create media info from offline data with episodes
          setMediaInfo({
            id: offlineMedia.id,
            title: offlineMedia.title,
            description: offlineMedia.description,
            totalEpisodes: offlineMedia.episodeCount,
            episodes: episodes.length > 0 ? episodes : undefined,
          });
          
          // Expand "season 1" by default if we have episodes
          if (episodes.length > 0) {
            setExpandedSeasons(new Set([1]));
          }
          
          setLoading(false);
          return;
        }
      }

      // If online, fetch fresh data
      if (isOnline) {
        // Check if the mediaId needs resolution (e.g., tmdb:12345 -> hianime ID)
        if (needsResolution(mediaId) && initialTitle) {
          console.log(`[MediaDetail] Resolving ${mediaId} via title search: "${initialTitle}"`);
          
          const resolved = await resolveAndGetMediaInfo(
            mediaId,
            provider,
            initialTitle,
            mediaType
          );
          
          if (resolved) {
            setResolvedProviderId(resolved.providerId);
            setResolvedProvider(resolved.provider);
            setMediaInfo(resolved.mediaInfo);
            setConfidence(resolved.confidence);
            setIsVerified(resolved.isVerified);
            
            // Show confidence warning if match quality is low
            if (resolved.confidence < LOW_CONFIDENCE_THRESHOLD && !resolved.isVerified) {
              setShowConfidenceWarning(true);
            }
            
            // Expand first season by default
            if (resolved.mediaInfo.seasons && resolved.mediaInfo.seasons.length > 0) {
              setExpandedSeasons(new Set([resolved.mediaInfo.seasons[0].season]));
            } else if (resolved.mediaInfo.episodes && resolved.mediaInfo.episodes.length > 0) {
              setExpandedSeasons(new Set([1]));
            }
          } else {
            setError(`Could not find "${initialTitle}" on ${provider}. Try a different provider.`);
          }
        } else {
          // Direct fetch - mediaId is already a provider-specific ID
          try {
            const info = await videoService.getMediaInfo(provider, mediaId);
            setResolvedProviderId(mediaId);
            setResolvedProvider(provider);
            setMediaInfo(info);
            
            // Expand first season by default
            if (info.seasons && info.seasons.length > 0) {
              setExpandedSeasons(new Set([info.seasons[0].season]));
            } else if (info.episodes && info.episodes.length > 0) {
              setExpandedSeasons(new Set([1]));
            }
          } catch (directErr) {
            // Direct fetch failed - try resolution if we have a title
            if (initialTitle) {
              console.log(`[MediaDetail] Direct fetch failed, trying title search: "${initialTitle}"`);
              const resolved = await resolveAndGetMediaInfo(
                `fallback:${mediaId}`,
                provider,
                initialTitle,
                mediaType
              );
              
              if (resolved) {
                setResolvedProviderId(resolved.providerId);
                setResolvedProvider(resolved.provider);
                setMediaInfo(resolved.mediaInfo);
                setConfidence(resolved.confidence);
                setIsVerified(resolved.isVerified);
                
                // Show confidence warning if match quality is low
                if (resolved.confidence < LOW_CONFIDENCE_THRESHOLD && !resolved.isVerified) {
                  setShowConfidenceWarning(true);
                }
                
                if (resolved.mediaInfo.seasons && resolved.mediaInfo.seasons.length > 0) {
                  setExpandedSeasons(new Set([resolved.mediaInfo.seasons[0].season]));
                } else if (resolved.mediaInfo.episodes && resolved.mediaInfo.episodes.length > 0) {
                  setExpandedSeasons(new Set([1]));
                }
              } else {
                throw directErr; // Re-throw if resolution also failed
              }
            } else {
              throw directErr;
            }
          }
        }
      } else if (!offlineMedia) {
        setError('This media is not available offline');
      }
    } catch (err) {
      console.error('Failed to load media:', err);
      setError('Failed to load media details');
    } finally {
      setLoading(false);
    }
  };

  const getAllEpisodes = useCallback((): VideoEpisode[] => {
    if (!mediaInfo) return [];
    return videoService.getAllEpisodes(mediaInfo);
  }, [mediaInfo]);

  const getSeasons = useCallback((): VideoSeason[] => {
    if (!mediaInfo) return [];
    
    // If seasons are provided, use them
    if (mediaInfo.seasons && mediaInfo.seasons.length > 0) {
      return mediaInfo.seasons;
    }
    
    // If only episodes are provided, group them into a single "season"
    if (mediaInfo.episodes && mediaInfo.episodes.length > 0) {
      return [{
        season: 1,
        episodes: mediaInfo.episodes,
      }];
    }
    
    return [];
  }, [mediaInfo]);

  const toggleSeason = (season: number) => {
    setExpandedSeasons(prev => {
      const next = new Set(prev);
      if (next.has(season)) {
        next.delete(season);
      } else {
        next.add(season);
      }
      return next;
    });
  };

  const toggleEpisodeSelection = (episodeId: string) => {
    setSelectedEpisodes(prev => {
      const next = new Set(prev);
      if (next.has(episodeId)) {
        next.delete(episodeId);
      } else {
        next.add(episodeId);
      }
      return next;
    });
  };

  const selectAllInSeason = (season: VideoSeason) => {
    setSelectedEpisodes(prev => {
      const next = new Set(prev);
      season.episodes.forEach(ep => next.add(ep.id));
      return next;
    });
  };

  const deselectAllInSeason = (season: VideoSeason) => {
    setSelectedEpisodes(prev => {
      const next = new Set(prev);
      season.episodes.forEach(ep => next.delete(ep.id));
      return next;
    });
  };

  const handleDownloadEpisode = async (episode: VideoEpisode) => {
    if (!mediaInfo) return;

    try {
      // Use resolved provider ID for downloads, but pass original mediaId as refId for offline lookup
      await downloadEpisode(resolvedProviderId, mediaInfo.title, episode, resolvedProvider, mediaId);
      showToast('Episode queued for download', 'success');
    } catch (err) {
      showToast('Failed to start download', 'error');
    }
  };

  const handleDownloadSelected = async () => {
    if (!mediaInfo || selectedEpisodes.size === 0) return;

    const allEpisodes = getAllEpisodes();
    const episodesToDownload = allEpisodes.filter(ep => selectedEpisodes.has(ep.id));
    
    try {
      // Use resolved provider ID for downloads, but pass original mediaId as refId for offline lookup
      await downloadEpisodes(resolvedProviderId, mediaInfo.title, episodesToDownload, resolvedProvider, mediaId);
      showToast(`Downloading ${episodesToDownload.length} episodes...`, 'success');
      setSelectedEpisodes(new Set());
      setIsSelectionMode(false);
    } catch (err) {
      showToast('Failed to start download', 'error');
    }
  };

  const handleDownloadSeason = async (season: VideoSeason) => {
    if (!mediaInfo) return;

    try {
      // Use resolved provider ID for downloads, but pass original mediaId as refId for offline lookup
      await downloadEpisodes(resolvedProviderId, mediaInfo.title, season.episodes, resolvedProvider, mediaId);
      showToast(`Downloading ${season.episodes.length} episodes...`, 'success');
    } catch (err) {
      showToast('Failed to start download', 'error');
    }
  };

  const handleDownloadAll = async () => {
    if (!mediaInfo) return;

    const allEpisodes = getAllEpisodes();
    if (allEpisodes.length === 0) return;

    setDownloadingAll(true);
    try {
      // Use resolved provider ID for downloads, but pass original mediaId as refId for offline lookup
      await downloadEpisodes(resolvedProviderId, mediaInfo.title, allEpisodes, resolvedProvider, mediaId);
      showToast(`Downloading all ${allEpisodes.length} episodes...`, 'success');
    } catch (err) {
      showToast('Failed to start download', 'error');
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (!confirm('Delete this media and all downloaded episodes?')) return;

    try {
      await deleteOfflineMedia(mediaId);
      showToast('Media deleted from offline storage', 'success');
    } catch (err) {
      showToast('Failed to delete media', 'error');
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    try {
      await deleteOfflineEpisode(episodeId);
      showToast('Episode deleted', 'success');
    } catch (err) {
      showToast('Failed to delete episode', 'error');
    }
  };

  // Get merged progress from local (IndexedDB) and backend sources
  // Prefers the most recent update between the two
  const getMergedProgress = useCallback((episodeId: string): { currentTime: number; duration: number; completed: boolean } | null => {
    const localProgress = getWatchProgress(mediaId, episodeId);
    const backendProgressItem = backendProgress.get(episodeId);
    
    if (!localProgress && !backendProgressItem) return null;
    
    // If only one source exists, use it
    if (!localProgress && backendProgressItem) {
      return {
        currentTime: backendProgressItem.currentTime,
        duration: backendProgressItem.duration,
        completed: backendProgressItem.completed,
      };
    }
    if (localProgress && !backendProgressItem) {
      return {
        currentTime: localProgress.currentTime,
        duration: localProgress.duration,
        completed: localProgress.completed,
      };
    }
    
    // Both exist - use the one with more progress (higher currentTime)
    // This handles the case where local might be ahead of backend sync
    if (localProgress && backendProgressItem) {
      if (localProgress.currentTime >= backendProgressItem.currentTime) {
        return {
          currentTime: localProgress.currentTime,
          duration: localProgress.duration,
          completed: localProgress.completed,
        };
      }
      return {
        currentTime: backendProgressItem.currentTime,
        duration: backendProgressItem.duration,
        completed: backendProgressItem.completed,
      };
    }
    
    return null;
  }, [mediaId, getWatchProgress, backendProgress]);

  const getEpisodeProgress = useCallback((episodeId: string): number | null => {
    const progress = getMergedProgress(episodeId);
    if (!progress || progress.duration === 0) return null;
    return (progress.currentTime / progress.duration) * 100;
  }, [getMergedProgress]);

  const isEpisodeCompleted = useCallback((episodeId: string): boolean => {
    const progress = getMergedProgress(episodeId);
    return progress?.completed === true;
  }, [getMergedProgress]);

  // Get season progress stats
  const getSeasonProgress = useCallback((season: VideoSeason): { watched: number; inProgress: number; total: number } => {
    let watched = 0;
    let inProgress = 0;
    
    for (const episode of season.episodes) {
      if (isEpisodeCompleted(episode.id)) {
        watched++;
      } else {
        const progress = getEpisodeProgress(episode.id);
        if (progress !== null && progress > 0) {
          inProgress++;
        }
      }
    }
    
    return { watched, inProgress, total: season.episodes.length };
  }, [isEpisodeCompleted, getEpisodeProgress]);

  // Get overall media progress stats
  const getOverallProgress = useMemo(() => {
    const allEps = getAllEpisodes();
    let watched = 0;
    let inProgress = 0;
    
    for (const episode of allEps) {
      if (isEpisodeCompleted(episode.id)) {
        watched++;
      } else {
        const progress = getEpisodeProgress(episode.id);
        if (progress !== null && progress > 0) {
          inProgress++;
        }
      }
    }
    
    return { watched, inProgress, total: allEps.length };
  }, [getAllEpisodes, isEpisodeCompleted, getEpisodeProgress]);

  const isEpisodeInQueue = (episodeId: string): boolean => {
    return downloadQueue.some(task => task.episode.id === episodeId);
  };

  const isEpisodeDownloading = (episodeId: string): boolean => {
    return activeDownload?.episode.id === episodeId;
  };

  const getDownloadProgress = (episodeId: string): number => {
    if (activeDownload?.episode.id === episodeId) {
      return activeDownload.progress;
    }
    return 0;
  };

  // Handle when user manually links a source
  const handleMappingSaved = useCallback((providerId: string, providerTitle: string) => {
    // Update resolved state with the new mapping
    setResolvedProviderId(providerId);
    
    // Clear confidence warning since this is now verified
    setShowConfidenceWarning(false);
    setConfidence(1.0);
    setIsVerified(true);
    
    // Reset loaded ref to force reload with new mapping
    loadedForRef.current = null;
    
    // Show success toast
    showToast(`Linked to "${providerTitle}"`, 'success');
    
    // Reload media details with the new mapping
    loadMediaDetails();
  }, [showToast]);

  // Check if this is a movie (single content without episodes)
  const isMovie = mediaInfo?.type === 'Movie' || 
    (getAllEpisodes().length === 0 && !mediaInfo?.seasons?.length);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="text-neutral-600 uppercase tracking-wider text-sm animate-pulse">
          Loading media...
        </div>
      </div>
    );
  }

  if (error || !mediaInfo) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center gap-4">
        <div className="text-red-500 uppercase tracking-wider text-sm">{error || 'Media not found'}</div>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors text-xs uppercase tracking-wider"
        >
          Go Back
        </button>
      </div>
    );
  }

  const allEpisodes = getAllEpisodes();
  const seasons = getSeasons();

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-sm border-b border-neutral-800 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-xs uppercase tracking-wider">Back</span>
          </button>
          
          {!isOnline && (
            <div className="flex items-center gap-2 text-red-500 text-xs uppercase tracking-wider">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              Offline
            </div>
          )}
        </div>
      </div>

      {/* Confidence Warning Banner */}
      {showConfidenceWarning && (
        <div className="mx-4 mt-4 bg-yellow-900/20 border border-yellow-700 p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-yellow-200 font-medium">
                Low confidence match ({Math.round(confidence * 100)}%)
              </p>
              <p className="text-xs text-yellow-400/80 mt-1">
                This title was matched automatically and may not be correct. 
                If this is the wrong content, use "Link Source" below to manually select the correct one.
              </p>
            </div>
            <button
              onClick={() => setShowConfidenceWarning(false)}
              className="text-yellow-500 hover:text-yellow-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Media Info */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex gap-4">
          {/* Cover/Poster */}
          <div className="flex-shrink-0 w-32">
            {mediaInfo.image || mediaInfo.cover ? (
              <img
                src={proxyImageUrl(mediaInfo.image || mediaInfo.cover || null) || ''}
                alt={mediaInfo.title}
                className="w-full aspect-[2/3] object-cover bg-neutral-900 border border-neutral-800"
              />
            ) : (
              <div className="w-full aspect-[2/3] bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-700 text-xs uppercase">
                No Cover
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold uppercase tracking-tight text-white mb-2 line-clamp-2">
              {mediaInfo.title}
            </h1>

            {mediaInfo.production && (
              <p className="text-sm text-neutral-500 mb-1">
                By <span className="text-neutral-300">{mediaInfo.production}</span>
              </p>
            )}

            <div className="flex flex-wrap gap-2 mt-2">
              {mediaInfo.type && (
                <span className="px-2 py-0.5 text-xs uppercase border border-neutral-700 text-neutral-400">
                  {mediaInfo.type}
                </span>
              )}
              
              {mediaInfo.status && (
                <span className={`px-2 py-0.5 text-xs uppercase border ${
                  mediaInfo.status.toLowerCase() === 'completed' || mediaInfo.status.toLowerCase() === 'ended' 
                    ? 'border-green-700 text-green-500' :
                  mediaInfo.status.toLowerCase() === 'ongoing' || mediaInfo.status.toLowerCase() === 'returning series'
                    ? 'border-blue-700 text-blue-400' :
                  'border-neutral-800 text-neutral-500'
                }`}>
                  {mediaInfo.status}
                </span>
              )}
              
              {mediaInfo.releaseDate && (
                <span className="px-2 py-0.5 text-xs border border-neutral-800 text-neutral-500">
                  {mediaInfo.releaseDate}
                </span>
              )}
              
              {mediaInfo.duration && (
                <span className="px-2 py-0.5 text-xs border border-neutral-800 text-neutral-500">
                  {mediaInfo.duration}
                </span>
              )}
              
              <span className="px-2 py-0.5 text-xs border border-neutral-700 text-neutral-400 uppercase">
                {videoService.getProviderDisplayName(provider)}
              </span>
            </div>

            {/* Rating */}
            {mediaInfo.rating && (
              <div className="flex gap-4 mt-3 text-sm">
                <div className="flex items-center gap-1 text-neutral-300">
                  <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>{mediaInfo.rating.toFixed(1)}</span>
                </div>
                {mediaInfo.totalEpisodes && (
                  <div className="flex items-center gap-1 text-neutral-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                    <span>{mediaInfo.totalEpisodes} episodes</span>
                  </div>
                )}
              </div>
            )}

            {/* Country */}
            {mediaInfo.country && (
              <div className="mt-2 text-xs text-neutral-600 uppercase">
                {mediaInfo.country}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {mediaInfo.description && (
          <div className="mt-4">
            <p className="text-sm text-neutral-500 line-clamp-4">{mediaInfo.description}</p>
          </div>
        )}

        {/* Genres */}
        {mediaInfo.genres && mediaInfo.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-4">
            {mediaInfo.genres.slice(0, 10).map((genre, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 text-xs bg-neutral-950 text-neutral-600 border border-neutral-800"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Cast */}
        {mediaInfo.casts && mediaInfo.casts.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-neutral-600 uppercase tracking-wider mb-1">Cast</p>
            <p className="text-sm text-neutral-500 line-clamp-2">
              {mediaInfo.casts.slice(0, 5).join(', ')}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          {isMediaDownloaded(mediaId) ? (
            <button
              onClick={handleDeleteMedia}
              className="px-4 py-2 text-xs uppercase tracking-wider border border-red-900 text-red-500 hover:bg-red-900/20 transition-colors"
            >
              Delete Offline
            </button>
          ) : null}
          
          {isMovie ? (
            // Movie: Single watch button
            <button
              onClick={() => {
                // For movies, create a single "episode" to watch using resolved provider ID
                const movieEpisode: VideoEpisode = {
                  id: resolvedProviderId,
                  number: 1,
                  title: mediaInfo.title,
                };
                onWatchEpisode(resolvedProviderId, resolvedProviderId, [movieEpisode], resolvedProvider, mediaInfo.title);
              }}
              className="px-4 py-2 text-xs uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors"
            >
              Watch Now
            </button>
          ) : (
            <>
              {isOnline && allEpisodes.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="px-4 py-2 text-xs uppercase tracking-wider bg-white text-black hover:bg-neutral-200 disabled:opacity-50 transition-colors"
                >
                  {downloadingAll ? 'Starting...' : `Download All (${allEpisodes.length})`}
                </button>
              )}
            </>
          )}
          
          {/* Link Source button - allows manual mapping override */}
          {isOnline && needsResolution(mediaId) && (
            <button
              onClick={() => setShowLinkSourceModal(true)}
              className="px-4 py-2 text-xs uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
            >
              Link Source
            </button>
          )}
        </div>
      </div>

      {/* Download Progress */}
      {activeDownload && activeDownload.mediaId === resolvedProviderId && (
        <div className="mx-4 mb-4 bg-neutral-950 border border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-neutral-500">
              {activeDownload.status === 'awaiting_quality' 
                ? `Select Quality - Episode ${activeDownload.episode.number}`
                : `Downloading Episode ${activeDownload.episode.number}`
              }
            </span>
            {activeDownload.status !== 'awaiting_quality' && (
              <span className="text-xs text-neutral-400">
                {activeDownload.progress}%
              </span>
            )}
          </div>
          
          {/* Quality Selection for HLS */}
          {activeDownload.status === 'awaiting_quality' && activeDownload.availableQualities && (
            <div className="space-y-2">
              {activeDownload.availableQualities.map((quality, index) => (
                <button
                  key={index}
                  onClick={() => selectQuality(activeDownload.episode.id, quality)}
                  className="w-full flex items-center justify-between p-3 border border-neutral-700 hover:border-white transition-colors text-left"
                >
                  <span className="font-medium">{quality.label}</span>
                  <div className="text-xs text-neutral-500">
                    {quality.bandwidth > 0 && (
                      <span>{Math.round(quality.bandwidth / 1000)} kbps</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* Progress bar (when downloading) */}
          {activeDownload.status !== 'awaiting_quality' && (
            <div className="w-full h-2 bg-neutral-800">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${activeDownload.progress}%` }}
              />
            </div>
          )}
          
          {activeDownload.status === 'error' && (
            <p className="text-xs text-red-500 mt-2">{activeDownload.error}</p>
          )}
        </div>
      )}

      {/* Episodes/Seasons */}
      {!isMovie && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4 border-b border-neutral-900 pb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest">
                Episodes {allEpisodes.length > 0 && `(${allEpisodes.length})`}
              </h2>
              {/* Overall progress summary */}
              {getOverallProgress.total > 0 && (getOverallProgress.watched > 0 || getOverallProgress.inProgress > 0) && (
                <span className="text-xs text-neutral-600">
                  {getOverallProgress.watched}/{getOverallProgress.total} watched
                  {getOverallProgress.inProgress > 0 && `, ${getOverallProgress.inProgress} in progress`}
                </span>
              )}
            </div>
            
            {allEpisodes.length > 0 && (
              <button
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  if (isSelectionMode) setSelectedEpisodes(new Set());
                }}
                className="text-xs uppercase tracking-wider text-neutral-500 hover:text-white transition-colors"
              >
                {isSelectionMode ? 'Cancel' : 'Select'}
              </button>
            )}
          </div>

          {isSelectionMode && selectedEpisodes.size > 0 && (
            <div className="sticky top-16 z-30 bg-neutral-950 border border-neutral-800 p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-neutral-400">{selectedEpisodes.size} selected</span>
              <button
                onClick={handleDownloadSelected}
                className="px-4 py-1 text-xs uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors"
              >
                Download Selected
              </button>
            </div>
          )}

          {seasons.length === 0 ? (
            <div className="text-neutral-600 text-center py-8 text-sm uppercase tracking-wider">
              No episodes available
            </div>
          ) : (
            <div className="space-y-2">
              {seasons.map(season => {
                const isExpanded = expandedSeasons.has(season.season);
                const allDownloaded = season.episodes.every(ep => isEpisodeDownloaded(ep.id));
                const someDownloaded = season.episodes.some(ep => isEpisodeDownloaded(ep.id));
                const seasonProgress = getSeasonProgress(season);
                
                return (
                  <div key={season.season} className="border border-neutral-800">
                    {/* Season Header */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleSeason(season.season)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleSeason(season.season);
                        }
                      }}
                      className="w-full px-4 py-3 flex flex-col gap-2 bg-neutral-950 hover:bg-neutral-900 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-bold uppercase tracking-tight text-white">
                            {seasons.length === 1 && !mediaInfo.seasons?.length
                              ? 'Episodes'
                              : `Season ${season.season}`}
                          </span>
                          <span className="text-sm text-neutral-600">
                            {season.episodes.length} episodes
                          </span>
                          {allDownloaded && (
                            <span className="text-xs text-green-500 uppercase">All Offline</span>
                          )}
                          {someDownloaded && !allDownloaded && (
                            <span className="text-xs text-yellow-600 uppercase">Partial</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Season watch progress */}
                          {seasonProgress.watched > 0 && (
                            <span className={`text-xs ${seasonProgress.watched === seasonProgress.total ? 'text-green-500' : 'text-neutral-500'}`}>
                              {seasonProgress.watched}/{seasonProgress.total}
                            </span>
                          )}
                          {isOnline && !isSelectionMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadSeason(season);
                              }}
                              className="p-1 text-neutral-600 hover:text-white transition-colors"
                              title="Download season"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        )}
                        <svg
                          className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        </div>
                      </div>
                      {/* Season progress bar */}
                      {seasonProgress.total > 0 && (seasonProgress.watched > 0 || seasonProgress.inProgress > 0) && (
                        <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-600 transition-all"
                            style={{ width: `${(seasonProgress.watched / seasonProgress.total) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Episode List */}
                    {isExpanded && (
                      <div className="divide-y divide-neutral-800">
                        {isSelectionMode && (
                          <div className="px-4 py-2 bg-black flex gap-4">
                            <button
                              onClick={() => selectAllInSeason(season)}
                              className="text-xs text-neutral-500 hover:text-white transition-colors"
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => deselectAllInSeason(season)}
                              className="text-xs text-neutral-500 hover:text-white transition-colors"
                            >
                              Deselect All
                            </button>
                          </div>
                        )}
                        
                        {season.episodes.map(episode => {
                          const downloaded = isEpisodeDownloaded(episode.id);
                          const isSelected = selectedEpisodes.has(episode.id);
                          const progress = getEpisodeProgress(episode.id);
                          const completed = isEpisodeCompleted(episode.id);
                          const inQueue = isEpisodeInQueue(episode.id);
                          const downloading = isEpisodeDownloading(episode.id);
                          const downloadProgress = getDownloadProgress(episode.id);
                          
                          return (
                            <div
                              key={episode.id}
                              className={`px-4 py-3 flex items-center justify-between transition-colors ${
                                isSelected ? 'bg-neutral-900' : 'bg-black hover:bg-neutral-900'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {isSelectionMode && (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleEpisodeSelection(episode.id)}
                                    className="w-4 h-4 bg-neutral-800 border-neutral-700"
                                  />
                                )}
                                
                                {/* Watched indicator (eye icon) */}
                                {!isSelectionMode && (
                                  <div className="flex-shrink-0 w-5">
                                    {completed ? (
                                      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : progress !== null && progress > 0 ? (
                                      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path strokeWidth="1.5" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4 text-neutral-700" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                                        <path strokeWidth="1.5" d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                        <path strokeWidth="1.5" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                                
                                {/* Episode thumbnail */}
                                {episode.image && (
                                  <div className="flex-shrink-0 w-20 h-12 bg-neutral-900 border border-neutral-800 overflow-hidden relative">
                                    <img
                                      src={proxyImageUrl(episode.image) || ''}
                                      alt={`Episode ${episode.number}`}
                                      className="w-full h-full object-cover"
                                    />
                                    {/* Progress bar overlay on thumbnail */}
                                    {progress !== null && progress > 0 && !completed && (
                                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800/80">
                                        <div
                                          className="h-full bg-red-500"
                                          style={{ width: `${Math.min(progress, 100)}%` }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                <button
                                  onClick={() => {
                                    if (isSelectionMode) {
                                      toggleEpisodeSelection(episode.id);
                                    } else {
                                      // Use resolved provider ID and provider for watching
                                      onWatchEpisode(resolvedProviderId, episode.id, allEpisodes, resolvedProvider, mediaInfo.title);
                                    }
                                  }}
                                  className="flex-1 text-left min-w-0"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-white">
                                      E{episode.number}
                                    </span>
                                    {episode.title && (
                                      <span className="text-neutral-500 truncate">
                                        - {episode.title}
                                      </span>
                                    )}
                                    {episode.isFiller && (
                                      <span className="text-xs text-orange-500 uppercase">Filler</span>
                                    )}
                                  </div>
                                  {episode.releaseDate && (
                                    <div className="text-xs text-neutral-600 mt-1">
                                      {episode.releaseDate}
                                    </div>
                                  )}
                                  
                                  {/* Watch progress bar */}
                                  {progress !== null && progress > 0 && !completed && (
                                    <div className="w-full h-1 bg-neutral-800 mt-2">
                                      <div
                                        className="h-full bg-red-500"
                                        style={{ width: `${Math.min(progress, 100)}%` }}
                                      />
                                    </div>
                                  )}
                                  {completed && (
                                    <div className="text-xs text-green-500 mt-1 uppercase">Watched</div>
                                  )}
                                </button>
                              </div>

                              <div className="flex items-center gap-2">
                                {downloaded && !downloading && (
                                  <span className="text-xs text-green-500 uppercase">Offline</span>
                                )}
                                {downloading && (
                                  <div className="flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="text-xs text-blue-400">{downloadProgress}%</span>
                                  </div>
                                )}
                                {inQueue && !downloading && (
                                  <span className="text-xs text-neutral-500 uppercase">Queued</span>
                                )}
                                
                                {!isSelectionMode && (
                                  downloaded && !downloading ? (
                                    <button
                                      onClick={() => handleDeleteEpisode(episode.id)}
                                      className="p-1 text-neutral-600 hover:text-red-500 transition-colors"
                                      title="Delete offline"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  ) : isOnline && !inQueue && !downloading && (
                                    <button
                                      onClick={() => handleDownloadEpisode(episode)}
                                      className="p-1 text-neutral-600 hover:text-white transition-colors"
                                      title="Download"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Provider Mapping Modal */}
      {showLinkSourceModal && (
        <ProviderMappingModal
          refId={mediaId}
          title={initialTitle || mediaInfo?.title || ''}
          mediaType={mediaType}
          currentProvider={provider}
          onClose={() => setShowLinkSourceModal(false)}
          onMappingSaved={handleMappingSaved}
        />
      )}
    </div>
  );
};

export default MediaDetail;
