import React, { useState, useEffect, useCallback } from 'react';
import { VideoProviderName, SearchResult } from '../types';
import { searchWithProvider, PaginatedSearchResults } from '../services/mediaSearch';
import { saveProviderMapping } from '../services/api';
import { getWorkingProviders, getProviderDisplayName } from '../services/providerConfig';
import { useToast } from '../context/ToastContext';

interface ProviderMappingModalProps {
  /** The reference ID to map (e.g., "tmdb:12345") */
  refId: string;
  /** Title to pre-fill search */
  title: string;
  /** Current provider being used */
  currentProvider: VideoProviderName;
  /** Media type for filtering providers */
  mediaType: 'movie' | 'tv' | 'anime';
  /** Called when mapping is saved */
  onMappingSaved: (providerId: string, providerTitle: string, provider: VideoProviderName) => void;
  /** Called to close the modal */
  onClose: () => void;
}

// Helper to proxy image URLs
function proxyImageUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('/api/')) return url;
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

export const ProviderMappingModal: React.FC<ProviderMappingModalProps> = ({
  refId,
  title,
  currentProvider,
  mediaType,
  onMappingSaved,
  onClose,
}) => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState(title);
  const [selectedProvider, setSelectedProvider] = useState<VideoProviderName>(currentProvider);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const workingProviders = getWorkingProviders(mediaType);

  // Perform search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const results = await searchWithProvider(searchQuery, selectedProvider);
      setSearchResults(results.results);
    } catch (err) {
      console.error('[ProviderMappingModal] Search failed:', err);
      showToast('Search failed', 'error');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, selectedProvider, showToast]);

  // Auto-search on provider change
  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch();
    }
  }, [selectedProvider]);

  // Handle selecting a result
  const handleSelectResult = async (result: SearchResult) => {
    setIsSaving(true);
    try {
      // Extract provider ID from result.id if it has a prefix
      let providerId = result.id;
      const colonIndex = providerId.indexOf(':');
      if (colonIndex !== -1) {
        const prefix = providerId.substring(0, colonIndex);
        // Check if prefix matches current provider
        if (prefix === selectedProvider) {
          providerId = providerId.substring(colonIndex + 1);
        }
      }

      await saveProviderMapping(refId, selectedProvider, providerId, result.title);
      showToast('Source linked successfully', 'success');
      onMappingSaved(providerId, result.title, selectedProvider);
      onClose();
    } catch (err) {
      console.error('[ProviderMappingModal] Failed to save mapping:', err);
      showToast('Failed to link source', 'error');
    } finally {
      setIsSaving(false);
    }
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

  // Handle enter key for search
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

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
              LINK SOURCE
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Search and select the correct match from the provider
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Search controls */}
        <div className="p-4 border-b border-neutral-800 space-y-3 flex-shrink-0">
          {/* Provider selector */}
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

          {/* Search input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search title..."
              className="flex-1 bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-white outline-none"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? 'SEARCHING...' : 'SEARCH'}
            </button>
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
                {hasSearched ? 'No results found' : 'Enter a search term'}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {searchResults.map((result, idx) => (
                <button
                  key={result.id || idx}
                  onClick={() => handleSelectResult(result)}
                  disabled={isSaving}
                  className="w-full p-4 flex gap-4 text-left hover:bg-neutral-900 transition-colors disabled:opacity-50"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16">
                    {result.imageUrl ? (
                      <img
                        src={proxyImageUrl(result.imageUrl) || ''}
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
                    {result.description && (
                      <p className="text-xs text-neutral-600 mt-2 line-clamp-2">
                        {result.description}
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

export default ProviderMappingModal;
