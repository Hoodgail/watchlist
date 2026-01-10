// VideoPlayer Component - Full-screen HLS video player with controls, subtitles, and episode navigation
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import { VideoEpisode, StreamingSources, StreamingSubtitle, VideoProviderName } from '../types';
import * as video from '../services/video';
import { getProxyUrl } from '../services/video';
import { useOfflineVideo } from '../context/OfflineVideoContext';
import { getOfflineEpisode } from '../services/offlineVideoStorage';
import { 
  getOfflineM3U8Url, 
  createOfflineHLSConfig, 
  isHLSEpisodeOffline 
} from '../services/hlsOfflineLoader';
import {
  getWorkingProviders,
  getProviderDisplayName,
  isProviderWorking,
} from '../services/providerConfig';

interface VideoPlayerProps {
  mediaId: string;
  episodeId: string;
  episodes: VideoEpisode[];
  onClose: () => void;
  onEpisodeChange: (episodeId: string, episodeNumber?: number, seasonNumber?: number) => void;
  provider: VideoProviderName;
  mediaTitle: string;
  episodeNumber?: number;
  seasonNumber?: number;
  /** Callback when user wants to switch providers */
  onProviderChange?: (provider: VideoProviderName) => void;
  /** Media type for determining available providers */
  mediaType?: 'anime' | 'movie' | 'tv';
}

// Error types for better error messages
type StreamErrorType = 'network' | 'source' | 'provider' | 'offline' | 'unknown';

// Playback speed options
const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

// Subtitle offset range and step
const SUBTITLE_OFFSET_MIN = -10;
const SUBTITLE_OFFSET_MAX = 10;
const SUBTITLE_OFFSET_STEP = 0.5;

// Character encoding options
const ENCODING_OPTIONS = ['UTF-8', 'Windows-1252', 'ISO-8859-1'] as const;
type EncodingOption = typeof ENCODING_OPTIONS[number];

// ============ Proxy URL Helpers ============

/**
 * Convert a subtitle URL to proxy URL if referer is provided
 */
function getSubtitleProxyUrl(url: string, referer: string | undefined, encoding?: string): string {
  if (!referer) {
    return url;
  }
  let proxyUrl = `/api/video/subtitle?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
  if (encoding && encoding !== 'UTF-8') {
    proxyUrl += `&encoding=${encodeURIComponent(encoding)}`;
  }
  return proxyUrl;
}

// localStorage keys for subtitle preferences
function getSubtitleOffsetKey(mediaId: string, episodeId: string): string {
  return `subtitle_offset_${mediaId}_${episodeId}`;
}

function getSubtitleEncodingKey(mediaId: string, episodeId: string): string {
  return `subtitle_encoding_${mediaId}_${episodeId}`;
}

function loadSubtitleOffset(mediaId: string, episodeId: string): number {
  try {
    const stored = localStorage.getItem(getSubtitleOffsetKey(mediaId, episodeId));
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= SUBTITLE_OFFSET_MIN && parsed <= SUBTITLE_OFFSET_MAX) {
        return parsed;
      }
    }
  } catch {}
  return 0;
}

function saveSubtitleOffset(mediaId: string, episodeId: string, offset: number): void {
  try {
    localStorage.setItem(getSubtitleOffsetKey(mediaId, episodeId), String(offset));
  } catch {}
}

function loadSubtitleEncoding(mediaId: string, episodeId: string): EncodingOption {
  try {
    const stored = localStorage.getItem(getSubtitleEncodingKey(mediaId, episodeId));
    if (stored && ENCODING_OPTIONS.includes(stored as EncodingOption)) {
      return stored as EncodingOption;
    }
  } catch {}
  return 'UTF-8';
}

function saveSubtitleEncoding(mediaId: string, episodeId: string, encoding: EncodingOption): void {
  try {
    localStorage.setItem(getSubtitleEncodingKey(mediaId, episodeId), encoding);
  } catch {}
}

// Format subtitle offset for display
function formatOffset(offset: number): string {
  if (offset === 0) return '0s';
  const sign = offset > 0 ? '+' : '';
  return `${sign}${offset.toFixed(1)}s`;
}

// Format time as "H:MM:SS" or "MM:SS"
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Calculate the absolute episode position (current/total) from season and episode numbers.
 * 
 * For example, if House has 8 seasons with episode counts [22, 24, 24, 16, 24, 21, 23, 22]
 * and we're watching S2E20, the absolute position would be:
 * - current: 22 (S1) + 20 (S2) = 42
 * - total: sum of all episodes = 176
 * 
 * @param episodes - The full episodes array from VideoPlayer props
 * @param seasonNumber - Current season number (1-indexed)
 * @param episodeNumber - Current episode number within the season (1-indexed)
 * @returns Object with current (absolute position) and total episodes
 */
function calculateAbsoluteEpisode(
  episodes: VideoEpisode[],
  seasonNumber: number | undefined,
  episodeNumber: number | undefined
): { current: number; total: number } {
  const total = episodes.length;
  
  // If no episode number provided, return defaults
  if (!episodeNumber) {
    return { current: 1, total };
  }
  
  // If no season info, the episodes array is likely flat (single-season or no seasons)
  // In this case, episodeNumber directly represents the absolute position
  if (!seasonNumber) {
    // Find the episode index by number for validation
    const idx = episodes.findIndex(e => e.number === episodeNumber);
    return { current: idx >= 0 ? idx + 1 : episodeNumber, total };
  }
  
  // Group episodes by season to count episodes per season
  const episodesBySeason = new Map<number, VideoEpisode[]>();
  for (const ep of episodes) {
    const s = ep.season ?? 1;
    if (!episodesBySeason.has(s)) episodesBySeason.set(s, []);
    episodesBySeason.get(s)!.push(ep);
  }
  
  // Sort seasons to ensure correct order
  const sortedSeasons = Array.from(episodesBySeason.keys()).sort((a, b) => a - b);
  
  // Count episodes in all prior seasons
  let current = 0;
  for (const s of sortedSeasons) {
    if (s < seasonNumber) {
      current += episodesBySeason.get(s)!.length;
    }
  }
  
  // Add the current episode number within the season
  current += episodeNumber;
  
  return { current, total };
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  mediaId,
  episodeId,
  episodes,
  onClose,
  onEpisodeChange,
  provider,
  mediaTitle,
  episodeNumber: initialEpisodeNumber,
  seasonNumber: initialSeasonNumber,
  onProviderChange,
  mediaType = 'anime',
}) => {
  const {
    isOnline,
    isEpisodeDownloaded,
    getOfflineVideoUrl,
    updateWatchProgress,
    getWatchProgress,
  } = useOfflineVideo();

  // ============ State ============
  const [sources, setSources] = useState<StreamingSources | null>(null);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [subtitles, setSubtitles] = useState<StreamingSubtitle[]>([]);
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(-1); // -1 = off
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAutoPlayCountdown, setShowAutoPlayCountdown] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState(10);
  
  // Subtitle settings
  const [subtitleOffset, setSubtitleOffset] = useState(() => loadSubtitleOffset(mediaId, episodeId));
  const [subtitleEncoding, setSubtitleEncoding] = useState<EncodingOption>(() => loadSubtitleEncoding(mediaId, episodeId));
  
  // Store original subtitle URLs for re-fetching with different encoding
  const [originalSubtitleUrls, setOriginalSubtitleUrls] = useState<{ url: string; lang: string }[]>([]);
  const [subtitleReferer, setSubtitleReferer] = useState<string | undefined>(undefined);
  
  // HLS quality levels
  const [hlsLevels, setHlsLevels] = useState<{ height: number; bitrate: number }[]>([]);
  const [currentHlsLevel, setCurrentHlsLevel] = useState(-1); // -1 = auto

  // Error tracking for provider switching
  const [errorType, setErrorType] = useState<StreamErrorType>('unknown');
  const [failedSegments, setFailedSegments] = useState(0);
  const [showProviderMenu, setShowProviderMenu] = useState(false);

  // Available alternative providers (computed from mediaType)
  const availableProviders = useMemo(() => {
    const working = getWorkingProviders(mediaType);
    // Filter out current provider
    return working.filter(p => p !== provider);
  }, [mediaType, provider]);

  // ============ Refs ============
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ x: number; time: number } | null>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);

  // ============ Derived State ============
  const currentEpisode = useMemo(() => 
    episodes.find(e => e.id === episodeId), [episodes, episodeId]
  );

  // Episode/season number for progress tracking - use prop if provided, else derive from episode
  const currentEpisodeNumber = useMemo(() => 
    initialEpisodeNumber ?? currentEpisode?.number, [initialEpisodeNumber, currentEpisode]
  );
  const currentSeasonNumber = useMemo(() => 
    initialSeasonNumber ?? currentEpisode?.season, [initialSeasonNumber, currentEpisode]
  );

  // Calculate absolute episode position for backend progress tracking
  const { current: absoluteEpisodeNumber, total: totalEpisodes } = useMemo(() => 
    calculateAbsoluteEpisode(episodes, currentSeasonNumber, currentEpisodeNumber), 
    [episodes, currentSeasonNumber, currentEpisodeNumber]
  );

  const currentEpisodeIndex = useMemo(() => 
    episodes.findIndex(e => e.id === episodeId), [episodes, episodeId]
  );

  const prevEpisode = useMemo(() => 
    video.getPreviousEpisode(episodes, episodeId), [episodes, episodeId]
  );

  const nextEpisode = useMemo(() => 
    video.getNextEpisode(episodes, episodeId), [episodes, episodeId]
  );

  // ============ Load Sources ============
  useEffect(() => {
    // Pass current props to avoid stale closure issues
    loadEpisodeSources(episodeId, mediaId, provider);
    
    return () => {
      // Cleanup HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      
      // Clear intervals
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (autoPlayTimeoutRef.current) {
        clearTimeout(autoPlayTimeoutRef.current);
      }
    };
  }, [episodeId, provider, mediaId]);

  // Save progress on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && duration > 0) {
        updateWatchProgress(mediaId, episodeId, videoRef.current.currentTime, duration, provider, currentEpisodeNumber, currentSeasonNumber, absoluteEpisodeNumber, totalEpisodes);
      }
    };
  }, [mediaId, episodeId, duration, provider, currentEpisodeNumber, currentSeasonNumber, absoluteEpisodeNumber, totalEpisodes]);

  const loadEpisodeSources = async (currentEpisodeId: string, currentMediaId: string, currentProvider: VideoProviderName) => {
    // Destroy existing HLS instance first before resetting state
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    // Reset video element source to stop any pending loads
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    
    setLoading(true);
    setError(null);
    setSources(null);
    setCurrentSourceIndex(0);
    setHlsLevels([]);
    setCurrentHlsLevel(-1);
    
    // Reset playback state for new episode
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setIsPlaying(false);
    setShowAutoPlayCountdown(false);
    
    // Load saved subtitle preferences for this episode
    setSubtitleOffset(loadSubtitleOffset(currentMediaId, currentEpisodeId));
    setSubtitleEncoding(loadSubtitleEncoding(currentMediaId, currentEpisodeId));

    try {
      // Check for offline version first
      const isDownloaded = isEpisodeDownloaded(currentEpisodeId);
      
      if (isDownloaded) {
        // Check if this is an HLS download
        const offlineEpisode = await getOfflineEpisode(currentEpisodeId);
        
        if (offlineEpisode?.isHLS) {
          // Check if HLS segments are available
          const hlsReady = await isHLSEpisodeOffline(currentEpisodeId);
          
          if (hlsReady) {
            console.log('[VideoPlayer] Playing offline HLS content');
            
            // Get virtual M3U8 URL pointing to offline segments
            const offlineM3U8Url = await getOfflineM3U8Url(currentEpisodeId);
            
            // Create sources object for HLS playback
            const offlineSources: StreamingSources = {
              sources: [{ url: offlineM3U8Url, quality: 'offline', isM3U8: true }],
              subtitles: [],
            };
            setSources(offlineSources);
            setSubtitles([]);
            
            // Initialize player with HLS using custom offline loader
            await initializePlayer(offlineM3U8Url, true, currentEpisodeId, currentMediaId, true);
            setLoading(false);
            return;
          }
        } else {
          // Regular blob-based offline playback
          const offlineUrl = await getOfflineVideoUrl(currentEpisodeId);
          if (offlineUrl) {
            // Create a simple sources object for offline playback
            const offlineSources: StreamingSources = {
              sources: [{ url: offlineUrl, quality: 'offline' }],
              subtitles: [],
            };
            setSources(offlineSources);
            setSubtitles([]);
            await initializePlayer(offlineUrl, false, currentEpisodeId, currentMediaId);
            setLoading(false);
            return;
          }
        }
      }

      // Fetch from API if online
      if (!isOnline) {
        throw new Error('This episode is not available offline');
      }

      const streamingSources = await video.getEpisodeSources(currentProvider, currentEpisodeId, currentMediaId);
      
      if (!streamingSources.sources || streamingSources.sources.length === 0) {
        throw new Error('No streaming sources found');
      }

      // Get referer header for proxy (if sources need it)
      const referer = streamingSources.headers?.Referer;
      
      // Store original subtitle URLs and referer for encoding changes
      if (streamingSources.subtitles && streamingSources.subtitles.length > 0) {
        setOriginalSubtitleUrls(streamingSources.subtitles.map(sub => ({ url: sub.url, lang: sub.lang })));
        setSubtitleReferer(referer);
      } else {
        setOriginalSubtitleUrls([]);
        setSubtitleReferer(undefined);
      }
      
      // Load saved encoding for this episode
      const savedEncoding = loadSubtitleEncoding(currentMediaId, currentEpisodeId);
      
      // Convert source URLs to proxy URLs if needed
      const proxiedSources: StreamingSources = {
        ...streamingSources,
        sources: streamingSources.sources.map(source => ({
          ...source,
          url: getProxyUrl(source.url, referer, source.isM3U8 ?? source.url.includes('.m3u8')),
        })),
        subtitles: streamingSources.subtitles?.map(sub => ({
          ...sub,
          url: getSubtitleProxyUrl(sub.url, referer, savedEncoding),
        })),
      };
      
      if (referer) {
        console.log('[VideoPlayer] Using proxy with referer:', referer);
      }

      setSources(proxiedSources);
      setSubtitles(proxiedSources.subtitles || []);

      // Initialize player with first source
      const firstSource = proxiedSources.sources[0];
      await initializePlayer(firstSource.url, firstSource.isM3U8 || false, currentEpisodeId, currentMediaId);
      
    } catch (err) {
      console.error('[VideoPlayer] Failed to load sources:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const initializePlayer = async (url: string, isHLS: boolean, episodeIdForProgress: string, mediaIdForProgress: string, isOfflineHLS: boolean = false) => {
    const videoElement = videoRef.current;
    console.log('[VideoPlayer] initializePlayer called:', { url: url.substring(0, 50), isHLS, isOfflineHLS, hasVideoElement: !!videoElement });
    
    if (!videoElement) {
      console.error('[VideoPlayer] Video element not found!');
      return;
    }

    // Destroy existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Helper to restore playback position after video is ready
    const restorePosition = () => {
      const progress = getWatchProgress(mediaIdForProgress, episodeIdForProgress);
      if (progress && progress.currentTime > 0 && videoElement) {
        // Don't restore if near the end (within last 60 seconds)
        if (progress.duration - progress.currentTime > 60) {
          videoElement.currentTime = progress.currentTime;
        }
      }
    };

    if (isHLS && Hls.isSupported()) {
      console.log('[VideoPlayer] Setting up HLS.js', isOfflineHLS ? '(offline mode)' : '');
      
      // Use custom offline config if playing offline HLS content
      const hlsConfig = isOfflineHLS 
        ? { ...createOfflineHLSConfig(), enableWorker: true, lowLatencyMode: false }
        : { enableWorker: true, lowLatencyMode: false };
      
      const hls = new Hls(hlsConfig);

      hls.loadSource(url);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[VideoPlayer] HLS manifest parsed, starting playback');
        // Extract quality levels
        const levels = hls.levels.map(level => ({
          height: level.height,
          bitrate: level.bitrate,
        }));
        setHlsLevels(levels);
        // Restore position then start playback
        restorePosition();
        videoElement.play().catch(err => {
          console.log('[VideoPlayer] Autoplay prevented:', err);
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentHlsLevel(data.level);
        if (data.level >= 0 && hls.levels[data.level]) {
          setCurrentQuality(`${hls.levels[data.level].height}p`);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.log('[VideoPlayer] HLS error:', data.type, data.details, data.fatal);
        
        // Categorize error type
        let detectedErrorType: StreamErrorType = 'unknown';
        
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          // Check if we're offline
          if (!navigator.onLine) {
            detectedErrorType = 'offline';
          } else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
                     data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT) {
            // Segment loading failed - track failures
            setFailedSegments(prev => {
              const newCount = prev + 1;
              console.log('[VideoPlayer] Segment failure count:', newCount);
              // After 3 consecutive segment failures, show error
              if (newCount >= 3) {
                detectedErrorType = 'source';
                setErrorType(detectedErrorType);
                setError('Video segments failed to load. The source may be unavailable.');
              }
              return newCount;
            });
            // Don't immediately fail - HLS.js will retry
            if (!data.fatal) return;
            detectedErrorType = 'source';
          } else if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                     data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
            detectedErrorType = 'provider';
          } else {
            detectedErrorType = 'network';
          }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          detectedErrorType = 'source';
        }
        
        if (data.fatal) {
          console.error('[VideoPlayer] Fatal HLS error:', data);
          setErrorType(detectedErrorType);
          handleSourceError();
        }
      });

      hlsRef.current = hls;
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      videoElement.src = url;
      restorePosition();
      videoElement.play().catch(err => {
        console.log('[VideoPlayer] Autoplay prevented:', err);
      });
    } else {
      // Direct video source
      videoElement.src = url;
      restorePosition();
      videoElement.play().catch(err => {
        console.log('[VideoPlayer] Autoplay prevented:', err);
      });
    }
  };

  const handleSourceError = useCallback(() => {
    if (!sources) return;
    
    const nextIndex = currentSourceIndex + 1;
    if (nextIndex < sources.sources.length) {
      console.log('[VideoPlayer] Trying next source:', nextIndex);
      setCurrentSourceIndex(nextIndex);
      setFailedSegments(0); // Reset segment failures for new source
      const nextSource = sources.sources[nextIndex];
      initializePlayer(nextSource.url, nextSource.isM3U8 || false, episodeId, mediaId);
    } else {
      // All sources failed - set appropriate error type
      if (!navigator.onLine) {
        setErrorType('offline');
        setError('You are offline. This episode is not available offline.');
      } else {
        setErrorType('provider');
        setError('All video sources failed. Try switching to a different provider.');
      }
    }
  }, [sources, currentSourceIndex, episodeId, mediaId]);

  // ============ Controls Auto-hide ============
  useEffect(() => {
    if (showControls && isPlaying) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowQualityMenu(false);
        setShowSubtitleMenu(false);
        setShowSpeedMenu(false);
        setShowSettingsMenu(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isPlaying]);

  // ============ Progress Tracking ============
  useEffect(() => {
    // Save progress every 10 seconds while playing
    if (isPlaying) {
      progressIntervalRef.current = setInterval(() => {
        if (videoRef.current && duration > 0) {
          updateWatchProgress(mediaId, episodeId, videoRef.current.currentTime, duration, provider, currentEpisodeNumber, currentSeasonNumber, absoluteEpisodeNumber, totalEpisodes);
        }
      }, 10000);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, mediaId, episodeId, duration, provider, updateWatchProgress, currentEpisodeNumber, currentSeasonNumber, absoluteEpisodeNumber, totalEpisodes]);

  // ============ Keyboard Shortcuts ============
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'arrowleft':
          seek(-10);
          break;
        case 'arrowright':
          seek(10);
          break;
        case 'arrowup':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'arrowdown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case 'n':
          if (nextEpisode) {
            onEpisodeChange(nextEpisode.id, nextEpisode.number, nextEpisode.season);
          }
          break;
        case 'p':
          if (prevEpisode) {
            onEpisodeChange(prevEpisode.id, prevEpisode.number, prevEpisode.season);
          }
          break;
        case 'escape':
          if (isFullscreen) {
            document.exitFullscreen();
          } else {
            onClose();
          }
          break;
      }
      setShowControls(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextEpisode, prevEpisode, isFullscreen]);

  // ============ Fullscreen Handler ============
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ============ Video Event Handlers ============
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Update buffered
      const bufferedRanges = videoRef.current.buffered;
      if (bufferedRanges.length > 0) {
        const bufferedEnd = bufferedRanges.end(bufferedRanges.length - 1);
        const bufferedPercent = (bufferedEnd / videoRef.current.duration) * 100;
        setBuffered(bufferedPercent);
      }
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setShowAutoPlayCountdown(false);
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
    }
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    // Save progress on pause
    if (videoRef.current && duration > 0) {
      updateWatchProgress(mediaId, episodeId, videoRef.current.currentTime, duration, provider, currentEpisodeNumber, currentSeasonNumber, absoluteEpisodeNumber, totalEpisodes);
    }
  }, [mediaId, episodeId, duration, provider, updateWatchProgress, currentEpisodeNumber, currentSeasonNumber, absoluteEpisodeNumber, totalEpisodes]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    
    // Auto-play next episode
    if (nextEpisode) {
      setShowAutoPlayCountdown(true);
      setAutoPlayCountdown(10);
      
      const countdownInterval = setInterval(() => {
        setAutoPlayCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            onEpisodeChange(nextEpisode.id, nextEpisode.number, nextEpisode.season);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      autoPlayTimeoutRef.current = countdownInterval as unknown as NodeJS.Timeout;
    }
  }, [nextEpisode, onEpisodeChange]);

  const handleVideoError = useCallback(() => {
    // Ignore errors during loading/reset phase - sources will be null
    if (!sources || loading) {
      return;
    }
    
    handleSourceError();
  }, [handleSourceError, sources, loading]);

  // ============ Player Controls ============
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, []);

  const seek = useCallback((delta: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(
        videoRef.current.currentTime + delta,
        videoRef.current.duration
      ));
      setShowControls(true);
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    if (videoRef.current) {
      const newVolume = Math.max(0, Math.min(1, volume + delta));
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  }, [volume, isMuted]);

  const setVolumeValue = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }, []);

  const changePlaybackSpeed = useCallback((speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      setShowSpeedMenu(false);
    }
  }, []);

  const changeQuality = useCallback((levelIndex: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentHlsLevel(levelIndex);
      if (levelIndex === -1) {
        setCurrentQuality('auto');
      } else if (hlsRef.current.levels[levelIndex]) {
        setCurrentQuality(`${hlsRef.current.levels[levelIndex].height}p`);
      }
    }
    setShowQualityMenu(false);
  }, []);

  const changeSubtitle = useCallback((index: number) => {
    setCurrentSubtitleIndex(index);
    setShowSubtitleMenu(false);
    
    // Handle subtitle tracks on video element
    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = i === index ? 'showing' : 'hidden';
      }
    }
  }, []);

  const cancelAutoPlay = useCallback(() => {
    setShowAutoPlayCountdown(false);
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
    }
  }, []);

  // ============ Subtitle Settings Handlers ============
  const handleSubtitleOffsetChange = useCallback((newOffset: number) => {
    // Clamp to valid range
    const clampedOffset = Math.max(SUBTITLE_OFFSET_MIN, Math.min(SUBTITLE_OFFSET_MAX, newOffset));
    // Round to nearest step
    const roundedOffset = Math.round(clampedOffset / SUBTITLE_OFFSET_STEP) * SUBTITLE_OFFSET_STEP;
    
    setSubtitleOffset(roundedOffset);
    saveSubtitleOffset(mediaId, episodeId, roundedOffset);
    
    // Apply offset to all text tracks in real-time
    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.cues) {
          // Note: VTTCue timing cannot be modified directly after creation
          // We need to shift cue timing by adjusting when cues appear
          // This is done via the cue's startTime and endTime properties
          for (let j = 0; j < track.cues.length; j++) {
            const cue = track.cues[j] as VTTCue;
            // Store original times on first adjustment
            if ((cue as any)._originalStartTime === undefined) {
              (cue as any)._originalStartTime = cue.startTime;
              (cue as any)._originalEndTime = cue.endTime;
            }
            // Apply offset (negative offset = subtitles appear earlier)
            cue.startTime = (cue as any)._originalStartTime + roundedOffset;
            cue.endTime = (cue as any)._originalEndTime + roundedOffset;
          }
        }
      }
    }
  }, [mediaId, episodeId]);

  const handleEncodingChange = useCallback((newEncoding: EncodingOption) => {
    if (newEncoding === subtitleEncoding) return;
    
    setSubtitleEncoding(newEncoding);
    saveSubtitleEncoding(mediaId, episodeId, newEncoding);
    
    // Re-fetch subtitles with new encoding
    if (originalSubtitleUrls.length > 0 && subtitleReferer) {
      const newSubtitles = originalSubtitleUrls.map(sub => ({
        ...sub,
        url: getSubtitleProxyUrl(sub.url, subtitleReferer, newEncoding),
      }));
      setSubtitles(newSubtitles);
      
      // Force video to reload subtitle tracks
      // The track elements will be re-rendered with new URLs
      // We need to preserve the current subtitle selection
      const currentIndex = currentSubtitleIndex;
      setCurrentSubtitleIndex(-1);
      
      // Use setTimeout to allow React to update the DOM
      setTimeout(() => {
        if (currentIndex >= 0 && currentIndex < newSubtitles.length) {
          setCurrentSubtitleIndex(currentIndex);
          // Re-apply offset to new tracks
          if (subtitleOffset !== 0) {
            setTimeout(() => handleSubtitleOffsetChange(subtitleOffset), 100);
          }
        }
      }, 50);
    }
  }, [subtitleEncoding, mediaId, episodeId, originalSubtitleUrls, subtitleReferer, currentSubtitleIndex, subtitleOffset, handleSubtitleOffsetChange]);

  const closeAllMenus = useCallback(() => {
    setShowQualityMenu(false);
    setShowSubtitleMenu(false);
    setShowSpeedMenu(false);
    setShowSettingsMenu(false);
    setShowProviderMenu(false);
  }, []);

  // Handle switching to a different provider
  const handleProviderChange = useCallback((newProvider: VideoProviderName) => {
    if (onProviderChange) {
      // Clear error state
      setError(null);
      setErrorType('unknown');
      setFailedSegments(0);
      setShowProviderMenu(false);
      // Call parent callback to switch provider
      onProviderChange(newProvider);
    }
  }, [onProviderChange]);

  // ============ Touch Handlers ============
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Don't toggle controls if clicking on control elements
    if ((e.target as HTMLElement).closest('.player-controls')) {
      return;
    }
    setShowControls(prev => !prev);
  }, []);

  const handleDoubleTap = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const now = Date.now();
    
    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      // Double tap detected
      const screenWidth = window.innerWidth;
      const tapX = touch.clientX;
      
      if (tapX < screenWidth * 0.4) {
        // Left side - rewind
        seek(-10);
      } else if (tapX > screenWidth * 0.6) {
        // Right side - forward
        seek(10);
      }
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { x: touch.clientX, time: now };
    }
  }, [seek]);

  // ============ Seek Bar Handlers ============
  const handleSeekBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekBarRef.current || !duration) return;
    
    const rect = seekBarRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * duration);
  }, [duration, seekTo]);

  // ============ Render ============
  // Always render video element so ref is available, show overlays for loading/error states
  
  // Helper to get error icon based on error type
  const getErrorIcon = () => {
    switch (errorType) {
      case 'offline':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
          </svg>
        );
      case 'network':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'source':
      case 'provider':
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        );
      default:
        return (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        );
    }
  };

  // Helper to get error title based on error type
  const getErrorTitle = () => {
    switch (errorType) {
      case 'offline':
        return 'You\'re Offline';
      case 'network':
        return 'Network Error';
      case 'source':
        return 'Source Unavailable';
      case 'provider':
        return 'Provider Error';
      default:
        return 'Playback Error';
    }
  };

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorOverlay}>
          {/* Close button */}
          <button onClick={onClose} style={styles.errorCloseButton}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Error Content */}
          <div style={styles.errorContent}>
            {/* Error Icon */}
            <div style={styles.errorIcon}>
              {getErrorIcon()}
            </div>

            {/* Error Title */}
            <div style={styles.errorTitle}>{getErrorTitle()}</div>

            {/* Error Message */}
            <div style={styles.errorMessage}>{error}</div>

            {/* Provider Switching Section - only show if we have alternatives */}
            {availableProviders.length > 0 && errorType !== 'offline' && onProviderChange && (
              <div style={styles.providerSection}>
                <div style={styles.providerLabel}>Try a different provider:</div>
                
                {/* Quick provider buttons */}
                <div style={styles.providerButtons}>
                  {availableProviders.slice(0, 3).map((p) => (
                    <button
                      key={p}
                      onClick={() => handleProviderChange(p)}
                      style={styles.providerButton}
                    >
                      {getProviderDisplayName(p)}
                    </button>
                  ))}
                </div>

                {/* Show more providers dropdown if more than 3 */}
                {availableProviders.length > 3 && (
                  <div style={styles.moreProvidersContainer}>
                    <button
                      onClick={() => setShowProviderMenu(!showProviderMenu)}
                      style={styles.moreProvidersButton}
                    >
                      More providers
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                        <path d={showProviderMenu ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                      </svg>
                    </button>
                    {showProviderMenu && (
                      <div style={styles.providerDropdown}>
                        {availableProviders.slice(3).map((p) => (
                          <button
                            key={p}
                            onClick={() => handleProviderChange(p)}
                            style={styles.providerDropdownItem}
                          >
                            {getProviderDisplayName(p)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={styles.errorActions}>
              <button 
                onClick={() => {
                  setError(null);
                  setErrorType('unknown');
                  setFailedSegments(0);
                  loadEpisodeSources(episodeId, mediaId, provider);
                }} 
                style={styles.retryButtonLarge}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Retry
              </button>
              <button onClick={onClose} style={styles.backButtonLarge}>
                Go Back
              </button>
            </div>

            {/* Current provider info */}
            <div style={styles.currentProvider}>
              Current: {getProviderDisplayName(provider)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={styles.container}
      onClick={handleContainerClick}
      onTouchEnd={handleDoubleTap}
      onMouseMove={() => setShowControls(true)}
    >
      {/* Video Element - always rendered so ref is available */}
      <video
        ref={videoRef}
        style={styles.video}
        autoPlay
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleVideoError}
      >
        {/* Subtitle tracks */}
        {subtitles.map((sub, index) => (
          <track
            key={index}
            kind="subtitles"
            src={sub.url}
            srcLang={sub.lang}
            label={sub.lang}
            default={index === currentSubtitleIndex}
          />
        ))}
      </video>

      {/* Loading Overlay */}
      {loading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
          <div style={styles.loadingText}>Loading video...</div>
        </div>
      )}

      {/* Controls Overlay - only show when not loading */}
      {!loading && (
        <div
          className="player-controls"
          style={{
            ...styles.controlsOverlay,
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Top Bar */}
        <div style={styles.topBar}>
          <button onClick={onClose} style={styles.iconButton}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div style={styles.titleContainer}>
            <div style={styles.mediaTitle}>{mediaTitle}</div>
            <div style={styles.episodeTitle}>
              {currentEpisode && video.formatEpisodeNumber(currentEpisode)}
            </div>
          </div>

          <div style={styles.topRightButtons}>
            {/* Speed Menu */}
            <div style={styles.menuContainer}>
              <button
                onClick={() => {
                  setShowSpeedMenu(!showSpeedMenu);
                  setShowQualityMenu(false);
                  setShowSubtitleMenu(false);
                  setShowSettingsMenu(false);
                }}
                style={styles.iconButton}
              >
                <span style={styles.speedLabel}>{playbackSpeed}x</span>
              </button>
              {showSpeedMenu && (
                <div style={styles.dropdownMenu}>
                  {PLAYBACK_SPEEDS.map(speed => (
                    <button
                      key={speed}
                      onClick={() => changePlaybackSpeed(speed)}
                      style={{
                        ...styles.menuItem,
                        backgroundColor: playbackSpeed === speed ? 'rgba(255,255,255,0.2)' : 'transparent',
                      }}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Menu */}
            {hlsLevels.length > 0 && (
              <div style={styles.menuContainer}>
                <button
                  onClick={() => {
                    setShowQualityMenu(!showQualityMenu);
                    setShowSubtitleMenu(false);
                    setShowSpeedMenu(false);
                    setShowSettingsMenu(false);
                  }}
                  style={styles.iconButton}
                >
                  <span style={styles.qualityLabel}>{currentQuality}</span>
                </button>
                {showQualityMenu && (
                  <div style={styles.dropdownMenu}>
                    <button
                      onClick={() => changeQuality(-1)}
                      style={{
                        ...styles.menuItem,
                        backgroundColor: currentHlsLevel === -1 ? 'rgba(255,255,255,0.2)' : 'transparent',
                      }}
                    >
                      Auto
                    </button>
                    {hlsLevels.map((level, index) => (
                      <button
                        key={index}
                        onClick={() => changeQuality(index)}
                        style={{
                          ...styles.menuItem,
                          backgroundColor: currentHlsLevel === index ? 'rgba(255,255,255,0.2)' : 'transparent',
                        }}
                      >
                        {level.height}p
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subtitle Menu */}
            {subtitles.length > 0 && (
              <div style={styles.menuContainer}>
                <button
                  onClick={() => {
                    setShowSubtitleMenu(!showSubtitleMenu);
                    setShowQualityMenu(false);
                    setShowSpeedMenu(false);
                    setShowSettingsMenu(false);
                  }}
                  style={styles.iconButton}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M6 12h4M14 12h4M6 16h8" />
                  </svg>
                </button>
                {showSubtitleMenu && (
                  <div style={styles.dropdownMenu}>
                    <button
                      onClick={() => changeSubtitle(-1)}
                      style={{
                        ...styles.menuItem,
                        backgroundColor: currentSubtitleIndex === -1 ? 'rgba(255,255,255,0.2)' : 'transparent',
                      }}
                    >
                      Off
                    </button>
                    {subtitles.map((sub, index) => (
                      <button
                        key={index}
                        onClick={() => changeSubtitle(index)}
                        style={{
                          ...styles.menuItem,
                          backgroundColor: currentSubtitleIndex === index ? 'rgba(255,255,255,0.2)' : 'transparent',
                        }}
                      >
                        {sub.lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Settings Menu (Gear Icon) - Subtitle Offset & Encoding */}
            {subtitles.length > 0 && (
              <div style={styles.menuContainer}>
                <button
                  onClick={() => {
                    setShowSettingsMenu(!showSettingsMenu);
                    setShowQualityMenu(false);
                    setShowSubtitleMenu(false);
                    setShowSpeedMenu(false);
                  }}
                  style={styles.iconButton}
                  title="Subtitle Settings"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
                {showSettingsMenu && (
                  <div style={styles.settingsMenu}>
                    <div style={styles.settingsTitle}>Subtitle Settings</div>
                    
                    {/* Subtitle Offset */}
                    <div style={styles.settingsSection}>
                      <div style={styles.settingsLabel}>Timing Offset</div>
                      <div style={styles.offsetControls}>
                        <button
                          onClick={() => handleSubtitleOffsetChange(subtitleOffset - SUBTITLE_OFFSET_STEP)}
                          style={styles.offsetButton}
                          disabled={subtitleOffset <= SUBTITLE_OFFSET_MIN}
                        >
                          -
                        </button>
                        <span style={styles.offsetValue}>{formatOffset(subtitleOffset)}</span>
                        <button
                          onClick={() => handleSubtitleOffsetChange(subtitleOffset + SUBTITLE_OFFSET_STEP)}
                          style={styles.offsetButton}
                          disabled={subtitleOffset >= SUBTITLE_OFFSET_MAX}
                        >
                          +
                        </button>
                      </div>
                      <input
                        type="range"
                        min={SUBTITLE_OFFSET_MIN}
                        max={SUBTITLE_OFFSET_MAX}
                        step={SUBTITLE_OFFSET_STEP}
                        value={subtitleOffset}
                        onChange={(e) => handleSubtitleOffsetChange(parseFloat(e.target.value))}
                        style={styles.offsetSlider}
                      />
                      <div style={styles.offsetHint}>
                        {subtitleOffset < 0 ? 'Earlier' : subtitleOffset > 0 ? 'Later' : 'Synced'}
                      </div>
                    </div>
                    
                    {/* Character Encoding */}
                    <div style={styles.settingsSection}>
                      <div style={styles.settingsLabel}>Character Encoding</div>
                      <div style={styles.encodingOptions}>
                        {ENCODING_OPTIONS.map(enc => (
                          <button
                            key={enc}
                            onClick={() => handleEncodingChange(enc)}
                            style={{
                              ...styles.encodingButton,
                              backgroundColor: subtitleEncoding === enc ? '#f97316' : 'rgba(255,255,255,0.1)',
                              color: subtitleEncoding === enc ? '#fff' : '#a3a3a3',
                            }}
                          >
                            {enc}
                          </button>
                        ))}
                      </div>
                      <div style={styles.encodingHint}>
                        Try different encodings if text appears garbled
                      </div>
                    </div>
                    
                    {/* Reset Button */}
                    <button
                      onClick={() => {
                        handleSubtitleOffsetChange(0);
                        handleEncodingChange('UTF-8');
                      }}
                      style={styles.resetButton}
                    >
                      Reset to Defaults
                    </button>
                  </div>
                )}
              </div>
            )}

            <button onClick={toggleFullscreen} style={styles.iconButton}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                ) : (
                  <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Center Play/Pause Button */}
        <div style={styles.centerControls}>
          <button onClick={() => prevEpisode && onEpisodeChange(prevEpisode.id, prevEpisode.number, prevEpisode.season)} style={styles.episodeButton} disabled={!prevEpisode}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: prevEpisode ? 1 : 0.3 }}>
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button onClick={() => seek(-10)} style={styles.seekButton}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5V1L7 6l5 5V7a6 6 0 11-6 6" />
              {/* <text x="11" y="15" fontSize="6" fill="currentColor" textAnchor="middle">10</text> */}
            </svg>
          </button>

          <button onClick={togglePlayPause} style={styles.playButton}>
            {isPlaying ? (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button onClick={() => seek(10)} style={styles.seekButton}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5V1l5 5-5 5V7a6 6 0 106 6" />
              {/* <text x="12" y="15" fontSize="6" fill="currentColor" textAnchor="middle">10</text> */}
            </svg>
          </button>

          <button onClick={() => nextEpisode && onEpisodeChange(nextEpisode.id, nextEpisode.number, nextEpisode.season)} style={styles.episodeButton} disabled={!nextEpisode}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: nextEpisode ? 1 : 0.3 }}>
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Bottom Bar */}
        <div style={styles.bottomBar}>
          {/* Seek Bar */}
          <div
            ref={seekBarRef}
            style={styles.seekBarContainer}
            onClick={handleSeekBarClick}
          >
            {/* Buffered Progress */}
            <div style={{ ...styles.seekBarBuffered, width: `${buffered}%` }} />
            {/* Current Progress */}
            <div style={{ ...styles.seekBarProgress, width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }} />
            {/* Seek Handle */}
            <div style={{ ...styles.seekBarHandle, left: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }} />
          </div>

          {/* Bottom Controls */}
          <div style={styles.bottomControls}>
            {/* Left: Time Display */}
            <div style={styles.timeDisplay}>
              <span>{formatTime(currentTime)}</span>
              <span style={styles.timeSeparator}>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Center: Volume Control */}
            <div style={styles.volumeContainer}>
              <button onClick={toggleMute} style={styles.iconButton}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {isMuted || volume === 0 ? (
                    <>
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M23 9l-6 6M17 9l6 6" />
                    </>
                  ) : volume < 0.5 ? (
                    <>
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M15.54 8.46a5 5 0 010 7.07" />
                    </>
                  ) : (
                    <>
                      <path d="M11 5L6 9H2v6h4l5 4V5z" />
                      <path d="M15.54 8.46a5 5 0 010 7.07" />
                      <path d="M19.07 4.93a10 10 0 010 14.14" />
                    </>
                  )}
                </svg>
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolumeValue(parseFloat(e.target.value))}
                style={styles.volumeSlider}
              />
            </div>

            {/* Right: Episode Navigation */}
            <div style={styles.episodeNav}>
              <button
                onClick={() => prevEpisode && onEpisodeChange(prevEpisode.id, prevEpisode.number, prevEpisode.season)}
                disabled={!prevEpisode}
                style={{ ...styles.navButton, opacity: prevEpisode ? 1 : 0.3 }}
              >
                Prev
              </button>
              <button
                onClick={() => nextEpisode && onEpisodeChange(nextEpisode.id, nextEpisode.number, nextEpisode.season)}
                disabled={!nextEpisode}
                style={{ ...styles.navButton, opacity: nextEpisode ? 1 : 0.3 }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Auto-play Next Episode Countdown */}
      {showAutoPlayCountdown && nextEpisode && (
        <div style={styles.autoPlayOverlay} onClick={(e) => e.stopPropagation()}>
          <div style={styles.autoPlayContent}>
            <div style={styles.autoPlayTitle}>Next Episode</div>
            <div style={styles.autoPlayEpisode}>{video.formatEpisodeNumber(nextEpisode)}</div>
            <div style={styles.autoPlayCountdown}>Playing in {autoPlayCountdown}s</div>
            <div style={styles.autoPlayButtons}>
              <button onClick={cancelAutoPlay} style={styles.cancelButton}>Cancel</button>
              <button onClick={() => onEpisodeChange(nextEpisode.id, nextEpisode.number, nextEpisode.season)} style={styles.playNowButton}>Play Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Spinner Overlay */}
      {!isPlaying && currentTime === 0 && !error && !loading && (
        <div style={styles.loadingOverlaySmall}>
          <div style={styles.spinner} />
        </div>
      )}
    </div>
  );
};

// ============ Styles ============
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '2px solid #262626',
    borderTopColor: '#f97316',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: '#525252',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontSize: '14px',
  },
  loadingOverlaySmall: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 10,
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  errorText: {
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontSize: '14px',
  },
  errorButtons: {
    display: 'flex',
    gap: '12px',
  },
  retryButton: {
    padding: '8px 16px',
    border: '1px solid #262626',
    backgroundColor: 'transparent',
    color: '#a3a3a3',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  backButton: {
    padding: '8px 16px',
    border: '1px solid #262626',
    backgroundColor: 'transparent',
    color: '#a3a3a3',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },
  // Enhanced error overlay styles
  errorOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 50,
  },
  errorCloseButton: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
  },
  errorContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '400px',
    padding: '24px',
    textAlign: 'center',
  },
  errorIcon: {
    color: '#ef4444',
    marginBottom: '16px',
  },
  errorTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '8px',
  },
  errorMessage: {
    fontSize: '14px',
    color: '#a3a3a3',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  providerSection: {
    width: '100%',
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    border: '1px solid #262626',
  },
  providerLabel: {
    fontSize: '12px',
    color: '#737373',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  providerButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
  },
  providerButton: {
    padding: '10px 16px',
    backgroundColor: '#f97316',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  moreProvidersContainer: {
    marginTop: '8px',
    position: 'relative',
  },
  moreProvidersButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #404040',
    borderRadius: '4px',
    color: '#a3a3a3',
    fontSize: '12px',
    cursor: 'pointer',
    width: '100%',
  },
  providerDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: 'rgba(23, 23, 23, 0.98)',
    border: '1px solid #262626',
    borderRadius: '6px',
    overflow: 'hidden',
    zIndex: 10,
  },
  providerDropdownItem: {
    display: 'block',
    width: '100%',
    padding: '10px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  errorActions: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  retryButtonLarge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 24px',
    backgroundColor: '#262626',
    border: '1px solid #404040',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  backButtonLarge: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: '1px solid #404040',
    borderRadius: '6px',
    color: '#a3a3a3',
    fontSize: '14px',
    cursor: 'pointer',
  },
  currentProvider: {
    fontSize: '11px',
    color: '#525252',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  controlsOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'opacity 0.3s',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
  },
  titleContainer: {
    textAlign: 'center',
    flex: 1,
  },
  mediaTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
  },
  episodeTitle: {
    fontSize: '12px',
    color: '#737373',
  },
  topRightButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  iconButton: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedLabel: {
    fontSize: '12px',
    fontWeight: 500,
  },
  qualityLabel: {
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'uppercase',
  },
  menuContainer: {
    position: 'relative',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: 'rgba(23,23,23,0.95)',
    border: '1px solid #262626',
    borderRadius: '4px',
    minWidth: '100px',
    zIndex: 10,
    overflow: 'hidden',
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fff',
    textAlign: 'left',
    fontSize: '12px',
    cursor: 'pointer',
  },
  settingsMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: 'rgba(23,23,23,0.98)',
    border: '1px solid #262626',
    borderRadius: '8px',
    minWidth: '220px',
    zIndex: 10,
    padding: '12px',
  },
  settingsTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #262626',
  },
  settingsSection: {
    marginBottom: '16px',
  },
  settingsLabel: {
    fontSize: '12px',
    color: '#a3a3a3',
    marginBottom: '8px',
  },
  offsetControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  offsetButton: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: '1px solid #404040',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  offsetValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f97316',
    minWidth: '50px',
    textAlign: 'center',
  },
  offsetSlider: {
    width: '100%',
    accentColor: '#f97316',
    cursor: 'pointer',
  },
  offsetHint: {
    fontSize: '10px',
    color: '#525252',
    textAlign: 'center',
    marginTop: '4px',
  },
  encodingOptions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  encodingButton: {
    padding: '6px 10px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  encodingHint: {
    fontSize: '10px',
    color: '#525252',
    marginTop: '8px',
  },
  resetButton: {
    width: '100%',
    padding: '8px',
    backgroundColor: 'transparent',
    border: '1px solid #404040',
    borderRadius: '4px',
    color: '#a3a3a3',
    fontSize: '11px',
    cursor: 'pointer',
    marginTop: '4px',
  },
  centerControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    flex: 1,
  },
  playButton: {
    padding: '16px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '50%',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekButton: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeButton: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    padding: '16px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
  },
  seekBarContainer: {
    position: 'relative',
    height: '4px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '2px',
    marginBottom: '12px',
    cursor: 'pointer',
  },
  seekBarBuffered: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: '2px',
  },
  seekBarProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: '2px',
  },
  seekBarHandle: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '12px',
    height: '12px',
    backgroundColor: '#fff',
    borderRadius: '50%',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  bottomControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeDisplay: {
    fontSize: '12px',
    color: '#fff',
    fontFamily: 'monospace',
  },
  timeSeparator: {
    margin: '0 4px',
    color: '#737373',
  },
  volumeContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  volumeSlider: {
    width: '80px',
    accentColor: '#f97316',
  },
  episodeNav: {
    display: 'flex',
    gap: '8px',
  },
  navButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #404040',
    color: '#fff',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    cursor: 'pointer',
    borderRadius: '4px',
  },
  autoPlayOverlay: {
    position: 'absolute',
    bottom: '100px',
    right: '20px',
    backgroundColor: 'rgba(23,23,23,0.95)',
    border: '1px solid #262626',
    borderRadius: '8px',
    padding: '16px',
    zIndex: 20,
  },
  autoPlayContent: {
    textAlign: 'center',
  },
  autoPlayTitle: {
    fontSize: '12px',
    color: '#737373',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '4px',
  },
  autoPlayEpisode: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#fff',
    marginBottom: '8px',
  },
  autoPlayCountdown: {
    fontSize: '12px',
    color: '#f97316',
    marginBottom: '12px',
  },
  autoPlayButtons: {
    display: 'flex',
    gap: '8px',
  },
  cancelButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: '1px solid #404040',
    color: '#a3a3a3',
    fontSize: '12px',
    cursor: 'pointer',
    borderRadius: '4px',
  },
  playNowButton: {
    padding: '6px 12px',
    backgroundColor: '#f97316',
    border: 'none',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
    borderRadius: '4px',
  },
};

// Add keyframe animation for spinner
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default VideoPlayer;
