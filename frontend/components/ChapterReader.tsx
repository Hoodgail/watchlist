// ChapterReader Component - Full-screen manga reader with multiple modes
import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { ChapterInfo, ChapterImages, ReadingMode, ImageQuality } from '../services/mangadexTypes';
import * as manga from '../services/manga';
import { MangaProviderName } from '../services/manga';
import { useOffline } from '../context/OfflineContext';
import { useToast } from '../context/ToastContext';

// ============================================================================
// VIRTUALIZED LONG STRIP - Types and Constants
// ============================================================================

interface PageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

interface VirtualizedPageState {
  isVisible: boolean;
  isInBuffer: boolean;
  isLoaded: boolean;
  actualHeight: number | null;
  estimatedHeight: number;
}

// Default aspect ratio for manga pages (typical manga is ~1.4:1 height:width)
const DEFAULT_ASPECT_RATIO = 1.4;
// Buffer zone: number of pages to keep rendered above/below viewport
const BUFFER_SIZE = 3;
// Minimum height for placeholder (prevents layout thrashing)
const MIN_PLACEHOLDER_HEIGHT = 400;
// Intersection observer root margin for early loading
const OBSERVER_ROOT_MARGIN = '200px 0px';

// ============================================================================
// VIRTUALIZED PAGE COMPONENT
// ============================================================================

interface VirtualizedPageProps {
  index: number;
  url: string;
  containerWidth: number;
  isVisible: boolean;
  isInBuffer: boolean;
  actualHeight: number | null;
  estimatedHeight: number;
  onVisibilityChange: (index: number, isVisible: boolean, entry: IntersectionObserverEntry) => void;
  onImageLoad: (index: number, dimensions: PageDimensions) => void;
  onImageError: (index: number) => void;
  observerRef: React.MutableRefObject<IntersectionObserver | null>;
}

const VirtualizedPage = memo(function VirtualizedPage({
  index,
  url,
  containerWidth,
  isVisible,
  isInBuffer,
  actualHeight,
  estimatedHeight,
  onVisibilityChange,
  onImageLoad,
  onImageError,
  observerRef,
}: VirtualizedPageProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  // Track visibility using Intersection Observer
  useEffect(() => {
    const element = elementRef.current;
    const observer = observerRef.current;
    
    if (!element || !observer) return;
    
    observer.observe(element);
    
    return () => {
      observer.unobserve(element);
    };
  }, [observerRef]);
  
  // Store element reference for observer callback
  useEffect(() => {
    const element = elementRef.current;
    if (element) {
      (element as any).__pageIndex = index;
      (element as any).__onVisibilityChange = onVisibilityChange;
    }
  }, [index, onVisibilityChange]);
  
  // Handle image load
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const dimensions: PageDimensions = {
      width: img.naturalWidth,
      height: img.naturalHeight,
      aspectRatio: img.naturalHeight / img.naturalWidth,
    };
    setIsImageLoaded(true);
    onImageLoad(index, dimensions);
  }, [index, onImageLoad]);
  
  // Handle image error
  const handleImageError = useCallback(() => {
    onImageError(index);
  }, [index, onImageError]);
  
  // Unload image when leaving buffer zone for memory management
  useEffect(() => {
    if (!isInBuffer && imgRef.current) {
      // Clear the image source to release memory
      imgRef.current.src = '';
      imgRef.current = null;
      setIsImageLoaded(false);
    }
  }, [isInBuffer]);
  
  const height = actualHeight ?? estimatedHeight;
  const shouldRenderImage = isInBuffer;
  
  return (
    <div
      ref={elementRef}
      className="relative w-full flex items-center justify-center"
      style={{
        height: shouldRenderImage && isImageLoaded ? 'auto' : height,
        minHeight: shouldRenderImage && isImageLoaded ? undefined : height,
        contain: shouldRenderImage ? 'layout style' : 'strict',
        willChange: isVisible ? 'auto' : undefined,
      }}
      data-page-index={index}
    >
      {shouldRenderImage ? (
        <img
          ref={(el) => { imgRef.current = el; }}
          src={url}
          alt={`Page ${index + 1}`}
          className="max-w-full"
          style={{
            opacity: isImageLoaded ? 1 : 0,
            transition: 'opacity 0.15s ease-in-out',
          }}
          loading={index < 3 ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      ) : null}
      
      {/* Placeholder shown when image is not rendered or not yet loaded */}
      {(!shouldRenderImage || !isImageLoaded) && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-neutral-900/50"
          style={{ contain: 'strict' }}
        >
          <div className="flex flex-col items-center gap-2 text-neutral-600">
            {shouldRenderImage ? (
              // Loading spinner for images being loaded
              <div className="w-6 h-6 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
            ) : (
              // Placeholder icon for unloaded pages
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            <span className="text-xs uppercase tracking-wider">Page {index + 1}</span>
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// VIRTUALIZED LONG STRIP CONTAINER
// ============================================================================

interface VirtualizedLongStripProps {
  pageUrls: string[];
  containerRef: React.RefObject<HTMLDivElement>;
  onCurrentPageChange: (page: number) => void;
  onImageLoad: (index: number) => void;
  onImageError: (index: number) => void;
}

function VirtualizedLongStrip({
  pageUrls,
  containerRef,
  onCurrentPageChange,
  onImageLoad,
  onImageError,
}: VirtualizedLongStripProps) {
  // Track page states
  const [pageStates, setPageStates] = useState<Map<number, VirtualizedPageState>>(() => new Map());
  const [pageDimensions, setPageDimensions] = useState<Map<number, PageDimensions>>(() => new Map());
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  
  // Refs for scroll position management
  const scrollPositionRef = useRef<{ page: number; offset: number } | null>(null);
  const isRestoringScrollRef = useRef(false);
  const visiblePagesRef = useRef<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  // Calculate estimated height based on container width and aspect ratio
  const getEstimatedHeight = useCallback((index: number): number => {
    const dimensions = pageDimensions.get(index);
    const aspectRatio = dimensions?.aspectRatio ?? DEFAULT_ASPECT_RATIO;
    const height = containerWidth * aspectRatio;
    return Math.max(height, MIN_PLACEHOLDER_HEIGHT);
  }, [containerWidth, pageDimensions]);
  
  // Initialize Intersection Observer
  useEffect(() => {
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      const newVisiblePages = new Set(visiblePagesRef.current);
      
      entries.forEach((entry) => {
        const element = entry.target as HTMLElement;
        const pageIndex = (element as any).__pageIndex as number | undefined;
        const callback = (element as any).__onVisibilityChange as VirtualizedPageProps['onVisibilityChange'] | undefined;
        
        if (pageIndex !== undefined && callback) {
          if (entry.isIntersecting) {
            newVisiblePages.add(pageIndex);
          } else {
            newVisiblePages.delete(pageIndex);
          }
          callback(pageIndex, entry.isIntersecting, entry);
        }
      });
      
      visiblePagesRef.current = newVisiblePages;
      
      // Update current page based on topmost visible page
      if (newVisiblePages.size > 0) {
        const sortedVisible = Array.from(newVisiblePages).sort((a, b) => a - b);
        onCurrentPageChange(sortedVisible[0]);
      }
    };
    
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: containerRef.current,
      rootMargin: OBSERVER_ROOT_MARGIN,
      threshold: [0, 0.1, 0.5, 1],
    });
    
    return () => {
      observerRef.current?.disconnect();
    };
  }, [containerRef, onCurrentPageChange]);
  
  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      setContainerWidth(window.innerWidth);
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    window.addEventListener('resize', handleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef]);
  
  // Handle visibility change for a page
  const handleVisibilityChange = useCallback((
    index: number,
    isVisible: boolean,
    _entry: IntersectionObserverEntry
  ) => {
    setPageStates((prev) => {
      const newStates = new Map(prev);
      const currentState = prev.get(index) || {
        isVisible: false,
        isInBuffer: false,
        isLoaded: false,
        actualHeight: null,
        estimatedHeight: getEstimatedHeight(index),
      };
      
      newStates.set(index, { ...currentState, isVisible });
      
      // Update buffer zone for all pages
      const visibleIndices = Array.from(newStates.entries())
        .filter(([_, state]) => state.isVisible)
        .map(([idx]) => idx);
      
      if (visibleIndices.length > 0) {
        const minVisible = Math.min(...visibleIndices);
        const maxVisible = Math.max(...visibleIndices);
        const bufferStart = Math.max(0, minVisible - BUFFER_SIZE);
        const bufferEnd = Math.min(pageUrls.length - 1, maxVisible + BUFFER_SIZE);
        
        for (let i = 0; i < pageUrls.length; i++) {
          const state = newStates.get(i) || {
            isVisible: false,
            isInBuffer: false,
            isLoaded: false,
            actualHeight: null,
            estimatedHeight: getEstimatedHeight(i),
          };
          const shouldBeInBuffer = i >= bufferStart && i <= bufferEnd;
          
          if (state.isInBuffer !== shouldBeInBuffer) {
            newStates.set(i, { ...state, isInBuffer: shouldBeInBuffer });
          }
        }
      }
      
      return newStates;
    });
  }, [pageUrls.length, getEstimatedHeight]);
  
  // Handle image load with dimensions
  const handleImageLoadWithDimensions = useCallback((index: number, dimensions: PageDimensions) => {
    // Store actual dimensions
    setPageDimensions((prev) => {
      const newDimensions = new Map(prev);
      newDimensions.set(index, dimensions);
      return newDimensions;
    });
    
    // Update page state
    setPageStates((prev) => {
      const newStates = new Map(prev);
      const currentState = prev.get(index);
      if (currentState) {
        const actualHeight = containerWidth * dimensions.aspectRatio;
        newStates.set(index, {
          ...currentState,
          isLoaded: true,
          actualHeight,
        });
      }
      return newStates;
    });
    
    // Call parent handler
    onImageLoad(index);
  }, [containerWidth, onImageLoad]);
  
  // Handle image error
  const handleImageErrorWithIndex = useCallback((index: number) => {
    setPageStates((prev) => {
      const newStates = new Map(prev);
      const currentState = prev.get(index);
      if (currentState) {
        newStates.set(index, { ...currentState, isLoaded: false });
      }
      return newStates;
    });
    onImageError(index);
  }, [onImageError]);
  
  // Scroll to specific page
  const scrollToPage = useCallback((pageIndex: number) => {
    const container = containerRef.current;
    if (!container) return;
    
    // Calculate scroll position by summing heights of previous pages
    let scrollTop = 64; // Account for top padding
    for (let i = 0; i < pageIndex; i++) {
      const state = pageStates.get(i);
      scrollTop += state?.actualHeight ?? getEstimatedHeight(i);
    }
    
    container.scrollTo({
      top: scrollTop,
      behavior: 'smooth',
    });
  }, [containerRef, pageStates, getEstimatedHeight]);
  
  // Expose scrollToPage via ref
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any).__scrollToPage = scrollToPage;
    }
  }, [containerRef, scrollToPage]);
  
  // Initialize page states
  useEffect(() => {
    const initialStates = new Map<number, VirtualizedPageState>();
    pageUrls.forEach((_, index) => {
      initialStates.set(index, {
        isVisible: index < 5, // Initially assume first 5 pages might be visible
        isInBuffer: index < BUFFER_SIZE + 3,
        isLoaded: false,
        actualHeight: null,
        estimatedHeight: getEstimatedHeight(index),
      });
    });
    setPageStates(initialStates);
  }, [pageUrls.length, getEstimatedHeight]);
  
  return (
    <div className="flex flex-col items-center py-16">
      {pageUrls.map((url, index) => {
        const state = pageStates.get(index) || {
          isVisible: false,
          isInBuffer: index < BUFFER_SIZE,
          isLoaded: false,
          actualHeight: null,
          estimatedHeight: getEstimatedHeight(index),
        };
        
        return (
          <VirtualizedPage
            key={index}
            index={index}
            url={url}
            containerWidth={containerWidth}
            isVisible={state.isVisible}
            isInBuffer={state.isInBuffer}
            actualHeight={state.actualHeight}
            estimatedHeight={state.estimatedHeight}
            onVisibilityChange={handleVisibilityChange}
            onImageLoad={handleImageLoadWithDimensions}
            onImageError={handleImageErrorWithIndex}
            observerRef={observerRef}
          />
        );
      })}
    </div>
  );
}

interface ChapterReaderProps {
  mangaId: string;
  chapterId: string;
  chapters: ChapterInfo[];
  onClose: () => void;
  onChapterChange: (chapterId: string) => void;
  provider?: MangaProviderName;
}

// Helper to check if URL is a MangaPlus URL
function isMangaPlusUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes('mangaplus.shueisha.co.jp');
}

export const ChapterReader: React.FC<ChapterReaderProps> = ({
  mangaId,
  chapterId,
  chapters,
  onClose,
  onChapterChange,
  provider = 'mangadex',
}) => {
  const { showToast } = useToast();
  const {
    isOnline,
    isChapterDownloaded,
    getOfflinePageUrl,
    getOfflineChapterPageUrls,
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
  }, [chapterId, readerSettings.imageQuality, provider]);

  // Cleanup blob URLs on unmount or chapter change
  useEffect(() => {
    return () => {
      // Revoke any blob URLs when component unmounts or chapter changes
      if (blobUrlsRef.current.length > 0) {
        blobUrlsRef.current.forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
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
      blobUrlsRef.current.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      blobUrlsRef.current = [];
    }

    try {
      const isDownloaded = isChapterDownloaded(chapterId);
      console.log('[Reader] Loading chapter:', chapterId, 'isDownloaded:', isDownloaded);

      if (isDownloaded) {
        // Load from offline storage - get all pages directly from IndexedDB
        const urls = await getOfflineChapterPageUrls(chapterId);
        console.log('[Reader] Loaded from offline:', urls.length, 'pages');
        blobUrlsRef.current = urls; // Track for cleanup
        
        if (urls.length === 0) {
          throw new Error('No offline pages found');
        }

        setPageUrls(urls);
      } else {
        // Load from API
        if (!isOnline) {
          throw new Error('This chapter is not available offline');
        }

        // Use the unified helper to get chapter page URLs
        const result = await manga.getChapterPageUrls(chapterId, provider);
        
        if (result.isExternal) {
          throw new Error(result.externalMessage || 'This chapter is only available on an external website');
        }
        
        if (result.urls.length === 0) {
          throw new Error('No pages found for this chapter');
        }
        
        setIsMangaPlusChapter(result.isMangaPlus);
        setPageUrls(result.urls);
      }
    } catch (err) {
      console.error('Failed to load chapter:', err);
      setError(err instanceof Error ? err.message : 'Failed to load chapter');
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
    const targetPage = Math.max(0, Math.min(page, pageUrls.length - 1));
    setCurrentPage(targetPage);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    
    // In Long Strip mode, scroll to the page using the virtualized container's method
    if (readerSettings.readingMode === 'longStrip' && containerRef.current) {
      const scrollToPage = (containerRef.current as any).__scrollToPage;
      if (scrollToPage) {
        scrollToPage(targetPage);
      }
    }
  }, [pageUrls.length, readerSettings.readingMode]);

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
      await downloadChapters(mangaId, 'Manga', [currentChapter], provider);
      showToast('Chapter download started', 'success');
    } catch (err) {
      showToast('Failed to download chapter', 'error');
    }
  }, [mangaId, currentChapter, downloadChapters, showToast, provider]);

  // Render loading state
  if (loading) {
    // Check if loading a MangaPlus chapter (based on current chapter info)
    const loadingMangaPlus = currentChapter?.externalUrl && isMangaPlusUrl(currentChapter.externalUrl);
    
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
                {currentChapter && manga.formatChapterInfo(currentChapter)}
                {isMangaPlusChapter && (
                  <span className="text-xs bg-orange-600 text-white px-1.5 py-0.5 rounded font-bold">
                    M+
                  </span>
                )}
                {!isMangaPlusChapter && provider !== 'mangadex' && (
                  <span className="text-xs bg-neutral-700 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                    {manga.getProviderDisplayName(provider)}
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
        // Virtualized Long Strip Mode
        <VirtualizedLongStrip
          pageUrls={pageUrls}
          containerRef={containerRef as React.RefObject<HTMLDivElement>}
          onCurrentPageChange={setCurrentPage}
          onImageLoad={handleImageLoad}
          onImageError={handleImageError}
        />
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
