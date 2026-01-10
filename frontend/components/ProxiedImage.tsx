/**
 * ProxiedImage Component
 * 
 * A reusable image component that:
 * - Proxies images through our server to bypass hotlink protection
 * - Shows a loading skeleton while image loads
 * - Displays a fallback placeholder on error
 * - Handles CORS and referer requirements automatically
 */
import React, { useState, useCallback, useEffect } from 'react';

type ImageLoadingState = 'loading' | 'loaded' | 'error';

interface ProxiedImageProps {
  /** The image URL - can be a raw URL that will be proxied, or already-proxied URL */
  src: string | null;
  alt: string;
  /** Width in Tailwind class format, e.g., "w-20" or "w-8" */
  widthClass?: string;
  /** Fixed width in pixels (used for explicit width attribute) */
  width?: number;
  /** Fixed height in pixels (used for explicit height attribute) */
  height?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** Whether to show the progress overlay (for video content with playback progress) */
  progressPercent?: number;
  /** Optional referer to use for the proxy request (required for some providers) */
  referer?: string;
  /** Whether to skip proxying (for blob URLs, data URLs, already-proxied URLs) */
  skipProxy?: boolean;
  /** Custom error callback */
  onError?: () => void;
  /** Custom load callback */
  onLoad?: () => void;
}

/**
 * Get the proxied URL for an image
 * Handles various URL types and adds proper proxy parameters
 */
export function getProxiedImageUrl(
  url: string | null | undefined, 
  referer?: string,
  skipProxy?: boolean
): string | null {
  if (!url) return null;
  
  // Skip proxying if requested
  if (skipProxy) return url;
  
  // Don't proxy blob URLs, data URLs, or already-proxied URLs
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('/api/')) {
    return url;
  }
  
  // Don't proxy TMDB images - they don't need proxying
  if (url.includes('image.tmdb.org')) {
    return url;
  }
  
  let proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
  if (referer) {
    proxyUrl += `&referer=${encodeURIComponent(referer)}`;
  }
  return proxyUrl;
}

/**
 * A poster placeholder SVG that maintains aspect ratio and provides visual feedback
 * for loading/error states. Uses a film/poster icon design.
 */
const PlaceholderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Film/poster icon */}
    <rect x="4" y="8" width="16" height="20" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <circle cx="12" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <path d="M9 22h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 25h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/**
 * Error placeholder with broken image icon
 */
const ErrorPlaceholder: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Broken image icon */}
    <path
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 8h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * ProxiedImage component that handles CLS (Cumulative Layout Shift) issues
 * by maintaining consistent dimensions across loading, loaded, and error states.
 * 
 * Features:
 * - Automatic URL proxying with referer support
 * - Skeleton placeholder with exact same dimensions as final image
 * - Smooth fade-in transition when image loads
 * - Fallback placeholder on error (same dimensions, doesn't collapse)
 * - Uses aspect-ratio: 2/3 for poster images
 * - Supports optional playback progress overlay
 */
export const ProxiedImage: React.FC<ProxiedImageProps> = ({
  src,
  alt,
  widthClass = 'w-20',
  width,
  height,
  className = '',
  progressPercent,
  referer,
  skipProxy = false,
  onError,
  onLoad,
}) => {
  const [loadingState, setLoadingState] = useState<ImageLoadingState>(src ? 'loading' : 'error');
  const [retryCount, setRetryCount] = useState(0);
  
  // Get the proxied URL
  const finalUrl = getProxiedImageUrl(src, referer, skipProxy);

  const handleLoad = useCallback(() => {
    setLoadingState('loaded');
    setRetryCount(0);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    // If we haven't retried yet and the image was proxied, try once more
    // This handles transient proxy failures
    if (retryCount === 0 && finalUrl && finalUrl.startsWith('/api/')) {
      setRetryCount(1);
      setLoadingState('loading');
      // Force reload by updating the URL with a cache-buster
      return;
    }
    
    setLoadingState('error');
    onError?.();
  }, [retryCount, finalUrl, onError]);

  // Reset loading state when src changes
  useEffect(() => {
    if (src) {
      setLoadingState('loading');
      setRetryCount(0);
    } else {
      setLoadingState('error');
    }
  }, [src]);

  // Container classes that ensure consistent sizing
  // Uses aspect-ratio: 2/3 (standard poster ratio) to maintain layout
  const containerClasses = `
    relative flex-shrink-0 ${widthClass}
    aspect-[2/3]
    bg-neutral-900 border border-neutral-800
    overflow-hidden
    ${className}
  `.trim().replace(/\s+/g, ' ');

  // Add cache buster for retry
  const imageUrl = retryCount > 0 && finalUrl 
    ? `${finalUrl}${finalUrl.includes('?') ? '&' : '?'}_retry=${retryCount}` 
    : finalUrl;

  return (
    <div 
      className={containerClasses}
      style={{
        // Fallback for browsers without aspect-ratio support
        minHeight: height || undefined,
        minWidth: width || undefined,
      }}
    >
      {/* Skeleton/Loading state */}
      {loadingState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-neutral-900">
          <PlaceholderIcon className="w-8 h-12 text-neutral-700" />
        </div>
      )}

      {/* Error/Fallback state */}
      {loadingState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <ErrorPlaceholder className="w-8 h-8 text-neutral-700" />
        </div>
      )}

      {/* Actual image - always rendered to trigger load/error events */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt={alt}
          width={width}
          height={height}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          className={`
            absolute inset-0 w-full h-full
            object-cover object-center
            transition-opacity duration-300 ease-in-out
            ${loadingState === 'loaded' ? 'opacity-100' : 'opacity-0'}
          `.trim().replace(/\s+/g, ' ')}
        />
      )}

      {/* Playback progress bar overlay */}
      {progressPercent !== undefined && progressPercent > 0 && loadingState !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800/80">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Compact version of ProxiedImage for use in compact list views.
 * Has smaller default dimensions (w-8 h-12).
 */
export const ProxiedImageCompact: React.FC<Omit<ProxiedImageProps, 'widthClass'>> = (props) => (
  <ProxiedImage {...props} widthClass="w-8" />
);

/**
 * Thumbnail version of ProxiedImage for episode thumbnails.
 * Uses 16:9 aspect ratio instead of poster ratio.
 */
export const ProxiedThumbnail: React.FC<Omit<ProxiedImageProps, 'widthClass'> & { widthClass?: string }> = ({
  className = '',
  widthClass = 'w-20',
  ...props
}) => {
  const [loadingState, setLoadingState] = useState<ImageLoadingState>(props.src ? 'loading' : 'error');
  
  const finalUrl = getProxiedImageUrl(props.src, props.referer, props.skipProxy);

  const handleLoad = useCallback(() => {
    setLoadingState('loaded');
    props.onLoad?.();
  }, [props.onLoad]);

  const handleError = useCallback(() => {
    setLoadingState('error');
    props.onError?.();
  }, [props.onError]);

  useEffect(() => {
    if (props.src) {
      setLoadingState('loading');
    } else {
      setLoadingState('error');
    }
  }, [props.src]);

  const containerClasses = `
    relative flex-shrink-0 ${widthClass}
    aspect-video
    bg-neutral-900 border border-neutral-800
    overflow-hidden
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className={containerClasses}>
      {loadingState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-neutral-900">
          <PlaceholderIcon className="w-6 h-8 text-neutral-700" />
        </div>
      )}

      {loadingState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
          <ErrorPlaceholder className="w-6 h-6 text-neutral-700" />
        </div>
      )}

      {finalUrl && (
        <img
          src={finalUrl}
          alt={props.alt}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
          className={`
            absolute inset-0 w-full h-full
            object-cover object-center
            transition-opacity duration-300 ease-in-out
            ${loadingState === 'loaded' ? 'opacity-100' : 'opacity-0'}
          `.trim().replace(/\s+/g, ' ')}
        />
      )}

      {/* Progress bar for thumbnails */}
      {props.progressPercent !== undefined && props.progressPercent > 0 && loadingState !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800/80">
          <div
            className="h-full bg-red-500 transition-all duration-300"
            style={{ width: `${props.progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default ProxiedImage;
