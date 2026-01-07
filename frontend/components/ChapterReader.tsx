// ChapterReader Component - Full-screen manga reader with multiple modes
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ChapterInfo, ChapterImages, ReadingMode, ImageQuality } from '../services/mangadexTypes';
import * as mangadex from '../services/mangadex';
import * as mangaplus from '../services/mangaplus';
import { useOffline } from '../context/OfflineContext';
import { useToast } from '../context/ToastContext';

interface ChapterReaderProps {
  mangaId: string;
  chapterId: string;
  chapters: ChapterInfo[];
  onClose: () => void;
  onChapterChange: (chapterId: string) => void;
}

export const ChapterReader: React.FC<ChapterReaderProps> = ({
  mangaId,
  chapterId,
  chapters,
  onClose,
  onChapterChange,
}) => {
  const { showToast } = useToast();
  const {
    isOnline,
    isChapterDownloaded,
    getOfflinePageUrl,
    updateReadingProgress,
    readerSettings,
    updateReaderSettings,
    downloadChapters,
  } = useOffline();

  // State
  const [chapterImages, setChapterImages] = useState<ChapterImages | null>(null);
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [imageLoading, setImageLoading] = useState<Set<number>>(new Set());
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isMangaPlusChapter, setIsMangaPlusChapter] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  // Current chapter info
  const currentChapter = useMemo(() => 
    chapters.find(c => c.id === chapterId), [chapters, chapterId]
  );

  const currentChapterIndex = useMemo(() => 
    chapters.findIndex(c => c.id === chapterId), [chapters, chapterId]
  );

  const prevChapter = currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex < chapters.length - 1 ? chapters[currentChapterIndex + 1] : null;

  // Load chapter images
  useEffect(() => {
    loadChapterImages();
  }, [chapterId, readerSettings.imageQuality]);

  // Cleanup blob URLs on unmount or chapter change
  useEffect(() => {
    return () => {
      // Revoke any blob URLs when component unmounts or chapter changes
      if (blobUrlsRef.current.length > 0) {
        mangaplus.revokeMangaPlusImages(blobUrlsRef.current);
        blobUrlsRef.current = [];
      }
    };
  }, [chapterId]);

  // Save reading progress
  useEffect(() => {
    if (pageUrls.length > 0) {
      updateReadingProgress(mangaId, chapterId, currentPage, pageUrls.length);
    }
  }, [currentPage, pageUrls.length, mangaId, chapterId]);

  // Hide controls after inactivity
  useEffect(() => {
    if (showControls) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, currentPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
          goToPrevPage();
          break;
        case 'ArrowRight':
        case 'd':
        case ' ':
          goToNextPage();
          break;
        case 'ArrowUp':
          if (readerSettings.readingMode === 'longStrip') {
            containerRef.current?.scrollBy(0, -200);
          }
          break;
        case 'ArrowDown':
          if (readerSettings.readingMode === 'longStrip') {
            containerRef.current?.scrollBy(0, 200);
          }
          break;
        case 'Escape':
          onClose();
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, pageUrls.length, readerSettings.readingMode]);

  const loadChapterImages = async () => {
    setLoading(true);
    setLoadingProgress(0);
    setError(null);
    setCurrentPage(0);
    setPageUrls([]);
    setLoadedImages(new Set());
    setIsMangaPlusChapter(false);

    // Clean up previous blob URLs
    if (blobUrlsRef.current.length > 0) {
      mangaplus.revokeMangaPlusImages(blobUrlsRef.current);
      blobUrlsRef.current = [];
    }

    try {
      const isDownloaded = isChapterDownloaded(chapterId);

      if (isDownloaded) {
        // Load from offline storage
        const urls: string[] = [];
        const chapter = currentChapter;
        
        if (chapter) {
          for (let i = 0; i < chapter.pages; i++) {
            const url = await getOfflinePageUrl(chapterId, i);
            if (url) {
              urls.push(url);
            }
          }
        }

        if (urls.length === 0) {
          throw new Error('No offline pages found');
        }

        setPageUrls(urls);
      } else {
        // Load from API
        if (!isOnline) {
          throw new Error('This chapter is not available offline');
        }

        // Check if this is a MangaPlus chapter (has external URL)
        const chapter = currentChapter;
        if (chapter?.externalUrl && mangaplus.isMangaPlusUrl(chapter.externalUrl)) {
          // Load from MangaPlus with progress tracking
          setIsMangaPlusChapter(true);
          const urls = await mangaplus.getMangaPlusChapterImages(
            chapter.externalUrl,
            (progress) => setLoadingProgress(progress)
          );
          blobUrlsRef.current = urls; // Track for cleanup
          setPageUrls(urls);
        } else if (chapter?.externalUrl) {
          // Non-MangaPlus external URL - not supported for in-app reading
          throw new Error('This chapter is only available on an external website');
        } else {
          // Regular MangaDex chapter
          const images = await mangadex.getChapterImages(chapterId);
          setChapterImages(images);

          const quality: ImageQuality = readerSettings.imageQuality;
          const urls = mangadex.buildAllImageUrls(images, quality);
          setPageUrls(urls);
        }
      }
    } catch (err) {
      console.error('Failed to load chapter:', err);
      // Handle MangaPlus errors with specific messages
      if (err instanceof mangaplus.MangaPlusError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load chapter');
      }
    } finally {
      setLoading(false);
    }
  };

  const goToPrevPage = useCallback(() => {
    if (readerSettings.readingMode === 'doublePage') {
      if (currentPage > 1) {
        setCurrentPage(p => p - 2);
      } else if (currentPage > 0) {
        setCurrentPage(0);
      } else if (prevChapter) {
        onChapterChange(prevChapter.id);
      }
    } else {
      if (currentPage > 0) {
        setCurrentPage(p => p - 1);
      } else if (prevChapter) {
        onChapterChange(prevChapter.id);
      }
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setShowControls(true);
  }, [currentPage, prevChapter, readerSettings.readingMode, onChapterChange]);

  const goToNextPage = useCallback(() => {
    const pageIncrement = readerSettings.readingMode === 'doublePage' ? 2 : 1;
    
    if (currentPage < pageUrls.length - pageIncrement) {
      setCurrentPage(p => p + pageIncrement);
    } else if (nextChapter) {
      onChapterChange(nextChapter.id);
    }
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setShowControls(true);
  }, [currentPage, pageUrls.length, nextChapter, readerSettings.readingMode, onChapterChange]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, pageUrls.length - 1)));
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [pageUrls.length]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }, []);

  const handleImageLoad = useCallback((index: number) => {
    setLoadedImages(prev => new Set([...prev, index]));
    setImageLoading(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  const handleImageError = useCallback((index: number) => {
    setImageLoading(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }, []);

  // Preload adjacent pages
  useEffect(() => {
    const preloadCount = 3;
    const indicesToPreload: number[] = [];

    for (let i = 1; i <= preloadCount; i++) {
      if (currentPage + i < pageUrls.length) {
        indicesToPreload.push(currentPage + i);
      }
      if (currentPage - i >= 0) {
        indicesToPreload.push(currentPage - i);
      }
    }

    indicesToPreload.forEach(index => {
      if (!loadedImages.has(index)) {
        const img = new Image();
        img.src = pageUrls[index];
        img.onload = () => handleImageLoad(index);
      }
    });
  }, [currentPage, pageUrls, loadedImages, handleImageLoad]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Swipe detection
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100 && deltaTime < 300) {
      if (deltaX > 0) {
        goToPrevPage();
      } else {
        goToNextPage();
      }
    } else if (Math.abs(deltaX) < 30 && Math.abs(deltaY) < 30 && deltaTime < 200) {
      // Tap detection
      const screenWidth = window.innerWidth;
      if (touch.clientX < screenWidth * 0.3) {
        goToPrevPage();
      } else if (touch.clientX > screenWidth * 0.7) {
        goToNextPage();
      } else {
        setShowControls(prev => !prev);
      }
    }

    touchStartRef.current = null;
  }, [goToPrevPage, goToNextPage]);

  // Click handler for desktop
  const handleClick = useCallback((e: React.MouseEvent) => {
    const screenWidth = window.innerWidth;
    const clickX = e.clientX;

    if (readerSettings.readingMode !== 'longStrip') {
      if (clickX < screenWidth * 0.3) {
        goToPrevPage();
      } else if (clickX > screenWidth * 0.7) {
        goToNextPage();
      } else {
        setShowControls(prev => !prev);
      }
    } else {
      setShowControls(prev => !prev);
    }
  }, [goToPrevPage, goToNextPage, readerSettings.readingMode]);

  const handleDownloadChapter = useCallback(async () => {
    if (!currentChapter) return;

    try {
      await downloadChapters(mangaId, 'Manga', [currentChapter]);
      showToast('Chapter download started', 'success');
    } catch (err) {
      showToast('Failed to download chapter', 'error');
    }
  }, [mangaId, currentChapter, downloadChapters, showToast]);

  // Render loading state
  if (loading) {
    // Check if loading a MangaPlus chapter (based on current chapter info)
    const loadingMangaPlus = currentChapter?.externalUrl && mangaplus.isMangaPlusUrl(currentChapter.externalUrl);
    
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-neutral-800 border-t-orange-500 rounded-full animate-spin" />
        <div className="text-neutral-600 uppercase tracking-wider text-sm">
          {loadingMangaPlus ? 'Loading from MangaPlus...' : 'Loading chapter...'}
        </div>
        {loadingMangaPlus && (
          <>
            {/* Progress bar for MangaPlus loading */}
            <div className="w-48 h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-orange-500 transition-all duration-200"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="text-neutral-700 text-xs">
              {loadingProgress > 0 ? `${loadingProgress}% decrypted` : 'Fetching pages...'}
            </div>
          </>
        )}
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center gap-4">
        <div className="text-red-500 uppercase tracking-wider text-sm">{error}</div>
        <div className="flex gap-3">
          <button
            onClick={loadChapterImages}
            className="px-4 py-2 border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors text-xs uppercase tracking-wider"
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white transition-colors text-xs uppercase tracking-wider"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 bg-black z-50 overflow-hidden ${
        readerSettings.readingMode === 'longStrip' ? 'overflow-y-auto' : ''
      }`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 pointer-events-auto">
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="text-white flex items-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <div className="text-sm font-medium flex items-center justify-center gap-2">
                {currentChapter && mangadex.formatChapterNumber(currentChapter)}
                {isMangaPlusChapter && (
                  <span className="text-xs bg-orange-600 text-white px-1.5 py-0.5 rounded font-bold">
                    M+
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-500">
                {currentPage + 1} / {pageUrls.length}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isChapterDownloaded(chapterId) && isOnline && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownloadChapter(); }}
                  className="p-2 text-white hover:bg-white/20 rounded"
                  title="Download for offline"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              )}
              
              <button
                onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
                className="p-2 text-white hover:bg-white/20 rounded"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="p-2 text-white hover:bg-white/20 rounded"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pointer-events-auto">
          {/* Page Slider */}
          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={pageUrls.length - 1}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Chapter Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); prevChapter && onChapterChange(prevChapter.id); }}
              disabled={!prevChapter}
              className="px-4 py-2 text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
            >
              &larr; Prev Chapter
            </button>

            <div className="flex items-center gap-4">
              <button
                onClick={(e) => { e.stopPropagation(); goToPrevPage(); }}
                className="p-2 hover:bg-white/20 rounded"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <span className="text-sm font-mono">
                {currentPage + 1} / {pageUrls.length}
              </span>
              
              <button
                onClick={(e) => { e.stopPropagation(); goToNextPage(); }}
                className="p-2 hover:bg-white/20 rounded"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); nextChapter && onChapterChange(nextChapter.id); }}
              disabled={!nextChapter}
              className="px-4 py-2 text-xs uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next Chapter &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Image Display */}
      {readerSettings.readingMode === 'longStrip' ? (
        // Long Strip Mode
        <div className="flex flex-col items-center py-16">
          {pageUrls.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={`Page ${index + 1}`}
              className="max-w-full"
              loading={index < 5 ? 'eager' : 'lazy'}
              onLoad={() => handleImageLoad(index)}
              onError={() => handleImageError(index)}
            />
          ))}
        </div>
      ) : readerSettings.readingMode === 'doublePage' ? (
        // Double Page Mode
        <div className="h-full flex items-center justify-center gap-1">
          {[currentPage, currentPage + 1].map((pageIndex) => {
            if (pageIndex >= pageUrls.length) return null;
            return (
              <div key={pageIndex} className="h-full flex items-center">
                <img
                  src={pageUrls[pageIndex]}
                  alt={`Page ${pageIndex + 1}`}
                  className="max-h-full max-w-[49vw] object-contain"
                  onLoad={() => handleImageLoad(pageIndex)}
                  onError={() => handleImageError(pageIndex)}
                />
              </div>
            );
          })}
        </div>
      ) : (
        // Single Page Mode
        <div
          className="h-full flex items-center justify-center"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transition: zoom === 1 ? 'transform 0.2s' : 'none',
          }}
        >
          <img
            src={pageUrls[currentPage]}
            alt={`Page ${currentPage + 1}`}
            className="max-h-full max-w-full object-contain"
            onLoad={() => handleImageLoad(currentPage)}
            onError={() => handleImageError(currentPage)}
          />
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); setShowSettings(false); }}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold uppercase tracking-tight">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-neutral-600 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Reading Mode */}
            <div className="mb-6">
              <label className="text-xs text-neutral-600 uppercase tracking-wider mb-2 block">
                Reading Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['single', 'longStrip', 'doublePage'] as ReadingMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateReaderSettings({ readingMode: mode })}
                    className={`py-2 px-3 text-xs uppercase transition-colors ${
                      readerSettings.readingMode === mode
                        ? 'bg-white text-black'
                        : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white'
                    }`}
                  >
                    {mode === 'single' ? 'Single' : mode === 'longStrip' ? 'Strip' : 'Double'}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Quality */}
            <div className="mb-6">
              <label className="text-xs text-neutral-600 uppercase tracking-wider mb-2 block">
                Image Quality
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['full', 'dataSaver'] as const).map((quality) => (
                  <button
                    key={quality}
                    onClick={() => updateReaderSettings({ imageQuality: quality })}
                    className={`py-2 px-3 text-xs uppercase transition-colors ${
                      readerSettings.imageQuality === quality
                        ? 'bg-white text-black'
                        : 'border border-neutral-800 text-neutral-500 hover:border-neutral-600 hover:text-white'
                    }`}
                  >
                    {quality === 'full' ? 'Full Quality' : 'Data Saver'}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Download */}
            <div>
              <label className="text-xs text-neutral-600 uppercase tracking-wider mb-2 block">
                Auto-download next chapters
              </label>
              <select
                value={readerSettings.autoDownloadNext}
                onChange={(e) => updateReaderSettings({ autoDownloadNext: parseInt(e.target.value) })}
                className="w-full bg-neutral-950 border border-neutral-800 p-2 text-sm transition-colors hover:border-neutral-600"
              >
                <option value={0}>Disabled</option>
                <option value={1}>1 chapter</option>
                <option value={3}>3 chapters</option>
                <option value={5}>5 chapters</option>
                <option value={10}>10 chapters</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator for images */}
      {imageLoading.size > 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
