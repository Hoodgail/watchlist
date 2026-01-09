import React, { useState, useEffect, useCallback } from 'react';
import { VideoProviderName, SearchResult } from '../types';
import { searchWithProvider, PaginatedSearchResults } from '../services/mediaSearch';
import { getWorkingProviders, getProviderDisplayName, VIDEO_PROVIDER_BASE_URLS } from '../services/providerConfig';

interface MediaSelectionModalProps {
  /** Title being searched */
  title: string;
  /** Initial search results to display */
  initialResults: SearchResult[];
  /** Current provider being used */
  currentProvider: VideoProviderName;
  /** Media type for filtering providers */
  mediaType: 'movie' | 'tv' | 'anime';
  /** Called when a result is selected */
  onSelect: (result: SearchResult, provider: VideoProviderName) => void;
  /** Called to close the modal */
  onClose: () => void;
}

// Helper to proxy image URLs with provider referer
function proxyImageUrl(url: string | null, providerReferer?: string): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('/api/')) return url;
  let proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
  if (providerReferer) {
    proxyUrl += `&referer=${encodeURIComponent(providerReferer)}`;
  }
  return proxyUrl;
}

export const MediaSelectionModal: React.FC<MediaSelectionModalProps> = ({
  title,
  initialResults,
  currentProvider,
  mediaType,
  onSelect,
  onClose,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<VideoProviderName>(currentProvider);
  const [searchResults, setSearchResults] = useState<SearchResult[]>(initialResults);
  const [isSearching, setIsSearching] = useState(false);

  const workingProviders = getWorkingProviders(mediaType);

  // Search when provider changes
  const handleSearch = useCallback(async (provider: VideoProviderName) => {
    setIsSearching(true);
    try {
      const results = await searchWithProvider(title, provider);
      setSearchResults(results.results);
    } catch (err) {
      console.error('[MediaSelectionModal] Search failed:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [title]);

  // Re-search when provider changes
  useEffect(() => {
    if (selectedProvider !== currentProvider) {
      handleSearch(selectedProvider);
    } else {
      // Reset to initial results when switching back to original provider
      setSearchResults(initialResults);
    }
  }, [selectedProvider, currentProvider, handleSearch, initialResults]);

  // Handle selecting a result
  const handleSelectResult = (result: SearchResult) => {
    onSelect(result, selectedProvider);
  };

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-black border border-neutral-700 w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest">
              SELECT SOURCE
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Multiple matches found for "{title}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Provider selector */}
        <div className="p-4 border-b border-neutral-800 flex-shrink-0">
          <div className="flex gap-2">
            <label className="text-xs text-neutral-600 uppercase tracking-wider self-center w-20">
              PROVIDER
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as VideoProviderName)}
              className="flex-1 bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm uppercase outline-none cursor-pointer hover:border-neutral-600 focus:border-white"
            >
              {workingProviders.map(provider => (
                <option key={provider} value={provider} className="bg-black">
                  {getProviderDisplayName(provider)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-neutral-600 uppercase tracking-wider text-sm animate-pulse">
                Searching...
              </div>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-neutral-600 uppercase tracking-wider text-sm">
                No results found
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {searchResults.map((result, idx) => (
                <button
                  key={result.id || idx}
                  onClick={() => handleSelectResult(result)}
                  className="w-full p-4 flex gap-4 text-left hover:bg-neutral-900 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16">
                    {result.imageUrl ? (
                      <img
                        src={proxyImageUrl(result.imageUrl, VIDEO_PROVIDER_BASE_URLS[selectedProvider]) || ''}
                        alt={result.title}
                        className="w-full aspect-[2/3] object-cover border border-neutral-800 bg-neutral-900"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-700 text-xs">
                        No Image
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white uppercase tracking-tight line-clamp-2">
                      {result.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1 flex-wrap">
                      {result.type && (
                        <span className="uppercase">{result.type}</span>
                      )}
                      {result.year && (
                        <span>{result.year}</span>
                      )}
                      {result.total && (
                        <span>{result.total} {result.type === 'MOVIE' ? 'min' : 'ep'}</span>
                      )}
                    </div>
                    {(result.description || result.overview) && (
                      <p className="text-xs text-neutral-600 mt-2 line-clamp-2">
                        {result.description || result.overview}
                      </p>
                    )}
                  </div>

                  {/* Select indicator */}
                  <div className="flex-shrink-0 self-center">
                    <svg className="w-5 h-5 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex-shrink-0">
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

export default MediaSelectionModal;
