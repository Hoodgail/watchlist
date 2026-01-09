// VideoPlayer Component - Full-screen HLS video player with controls, subtitles, and episode navigation
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import { VideoEpisode, StreamingSources, StreamingSubtitle, VideoProviderName } from '../types';
import * as video from '../services/video';
import { useOfflineVideo } from '../context/OfflineVideoContext';

interface VideoPlayerProps {
  mediaId: string;
  episodeId: string;
  episodes: VideoEpisode[];
  onClose: () => void;
  onEpisodeChange: (episodeId: string) => void;
  provider: VideoProviderName;
  mediaTitle: string;
}

// Playback speed options
const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

// ============ Proxy URL Helpers ============

/**
 * Convert a video source URL to proxy URL if referer is provided.
 * When a referer is returned from the backend, it means the source requires
 * special headers that browsers can't send cross-origin, so we proxy it.
 * 
 * @param url - Original video URL
 * @param referer - Referer header value (from sources.headers)
 * @param isM3U8 - Whether this is an M3U8 playlist
 */
function getProxyUrl(url: string, referer: string | undefined, isM3U8: boolean): string {
  if (!referer) {
    return url; // No proxy needed - backend didn't specify headers
  }
  
  const endpoint = isM3U8 ? '/api/video/m3u8' : '/api/video/segment';
  return `${endpoint}?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
}

/**
 * Convert a subtitle URL to proxy URL if referer is provided
 */
function getSubtitleProxyUrl(url: string, referer: string | undefined): string {
  if (!referer) {
    return url;
  }
  return `/api/video/subtitle?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
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

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  mediaId,
  episodeId,
  episodes,
  onClose,
  onEpisodeChange,
  provider,
  mediaTitle,
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
  const [showAutoPlayCountdown, setShowAutoPlayCountdown] = useState(false);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState(10);
  
  // HLS quality levels
  const [hlsLevels, setHlsLevels] = useState<{ height: number; bitrate: number }[]>([]);
  const [currentHlsLevel, setCurrentHlsLevel] = useState(-1); // -1 = auto

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
        updateWatchProgress(mediaId, episodeId, videoRef.current.currentTime, duration, provider);
      }
    };
  }, [mediaId, episodeId, duration, provider]);

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

    try {
      // Check for offline version first
      const isDownloaded = isEpisodeDownloaded(currentEpisodeId);
      
      if (isDownloaded) {
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
      
      // Convert source URLs to proxy URLs if needed
      const proxiedSources: StreamingSources = {
        ...streamingSources,
        sources: streamingSources.sources.map(source => ({
          ...source,
          url: getProxyUrl(source.url, referer, source.isM3U8 ?? source.url.includes('.m3u8')),
        })),
        subtitles: streamingSources.subtitles?.map(sub => ({
          ...sub,
          url: getSubtitleProxyUrl(sub.url, referer),
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

  const initializePlayer = async (url: string, isHLS: boolean, episodeIdForProgress: string, mediaIdForProgress: string) => {
    const videoElement = videoRef.current;
    console.log('[VideoPlayer] initializePlayer called:', { url: url.substring(0, 50), isHLS, hasVideoElement: !!videoElement });
    
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
      console.log('[VideoPlayer] Setting up HLS.js');
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });

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
        if (data.fatal) {
          console.error('[VideoPlayer] HLS error:', data);
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
      const nextSource = sources.sources[nextIndex];
      initializePlayer(nextSource.url, nextSource.isM3U8 || false, episodeId, mediaId);
    } else {
      setError('All video sources failed. Please try again later.');
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
          updateWatchProgress(mediaId, episodeId, videoRef.current.currentTime, duration, provider);
        }
      }, 10000);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, mediaId, episodeId, duration, provider, updateWatchProgress]);

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
            onEpisodeChange(nextEpisode.id);
          }
          break;
        case 'p':
          if (prevEpisode) {
            onEpisodeChange(prevEpisode.id);
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
      updateWatchProgress(mediaId, episodeId, videoRef.current.currentTime, duration, provider);
    }
  }, [mediaId, episodeId, duration, provider, updateWatchProgress]);

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
            onEpisodeChange(nextEpisode.id);
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
  
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <div style={styles.errorText}>{error}</div>
          <div style={styles.errorButtons}>
            <button onClick={() => loadEpisodeSources(episodeId, mediaId, provider)} style={styles.retryButton}>
              Retry
            </button>
            <button onClick={onClose} style={styles.backButton}>
              Go Back
            </button>
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
          <button onClick={() => prevEpisode && onEpisodeChange(prevEpisode.id)} style={styles.episodeButton} disabled={!prevEpisode}>
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

          <button onClick={() => nextEpisode && onEpisodeChange(nextEpisode.id)} style={styles.episodeButton} disabled={!nextEpisode}>
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
                onClick={() => prevEpisode && onEpisodeChange(prevEpisode.id)}
                disabled={!prevEpisode}
                style={{ ...styles.navButton, opacity: prevEpisode ? 1 : 0.3 }}
              >
                Prev
              </button>
              <button
                onClick={() => nextEpisode && onEpisodeChange(nextEpisode.id)}
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
              <button onClick={() => onEpisodeChange(nextEpisode.id)} style={styles.playNowButton}>Play Now</button>
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
