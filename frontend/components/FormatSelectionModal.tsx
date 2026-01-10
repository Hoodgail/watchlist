import React, { useEffect } from 'react';
import { SearchResult, MediaType } from '../types';

interface FormatSelectionModalProps {
  /** The original search result */
  result: SearchResult;
  /** Anime variant if available */
  animeResult: SearchResult | null;
  /** Manga variant if available */
  mangaResult: SearchResult | null;
  /** Called when user selects a format */
  onSelect: (result: SearchResult) => void;
  /** Called to close the modal */
  onClose: () => void;
}

// Helper to get image URL
function getImageUrl(imageUrl?: string): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) return `https://image.tmdb.org/t/p/w200${imageUrl}`;
  return imageUrl;
}

export const FormatSelectionModal: React.FC<FormatSelectionModalProps> = ({
  result,
  animeResult,
  mangaResult,
  onSelect,
  onClose,
}) => {
  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const imageUrl = getImageUrl(result.imageUrl || animeResult?.imageUrl || mangaResult?.imageUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border border-neutral-700 w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest">
              SELECT FORMAT
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              This title is available as both Anime and Manga
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Title Preview */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex gap-4">
            {imageUrl && (
              <div className="flex-shrink-0 w-16">
                <img
                  src={imageUrl}
                  alt={result.title}
                  className="w-full aspect-[2/3] object-cover border border-neutral-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white uppercase tracking-tight line-clamp-2">
                {result.title}
              </h4>
              {result.year && (
                <span className="text-xs text-neutral-500 mt-1">{result.year}</span>
              )}
            </div>
          </div>
        </div>

        {/* Format Options */}
        <div className="p-4 space-y-3">
          <p className="text-xs text-neutral-600 uppercase tracking-wider mb-4">
            Which would you like to add?
          </p>

          {/* Anime Option */}
          {animeResult && (
            <button
              onClick={() => onSelect(animeResult)}
              className="w-full p-4 border border-neutral-700 hover:border-blue-500 hover:bg-blue-950/20 transition-all flex items-center gap-4 group"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-blue-900/30 border border-blue-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h5 className="font-bold text-white uppercase tracking-wide text-sm">
                  Anime (Watch)
                </h5>
                <p className="text-xs text-neutral-500 mt-1">
                  {animeResult.total ? `${animeResult.total} episodes` : 'Ongoing series'}
                  {animeResult.provider && ` via ${animeResult.provider}`}
                </p>
              </div>
              <svg className="w-5 h-5 text-neutral-600 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Manga Option */}
          {mangaResult && (
            <button
              onClick={() => onSelect(mangaResult)}
              className="w-full p-4 border border-neutral-700 hover:border-purple-500 hover:bg-purple-950/20 transition-all flex items-center gap-4 group"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-purple-900/30 border border-purple-700 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h5 className="font-bold text-white uppercase tracking-wide text-sm">
                  Manga (Read)
                </h5>
                <p className="text-xs text-neutral-500 mt-1">
                  {mangaResult.total ? `${mangaResult.total} chapters` : 'Ongoing series'}
                  {mangaResult.provider && ` via ${mangaResult.provider}`}
                </p>
              </div>
              <svg className="w-5 h-5 text-neutral-600 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="w-full py-3 text-xs font-bold uppercase tracking-wider border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormatSelectionModal;
