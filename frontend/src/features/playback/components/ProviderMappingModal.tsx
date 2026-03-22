import React, { useState, useEffect, useCallback } from 'react';
import { saveProviderMapping } from '@/features/profile/api';
import { VideoProviderName, SearchResult } from '@/types';
import { searchWithProvider, PaginatedSearchResults } from '@/services/mediaSearch';
import { getWorkingProviders, getProviderDisplayName, VIDEO_PROVIDER_BASE_URLS } from '@/services/providerConfig';
import { useToast } from '@/context/ToastContext';
import { getProxiedImageUrl } from '@/shared/media';

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
      className="modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="modal-shell max-w-lg">
        {/* Header */}
        <div className="modal-header">
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
        <div className="modal-section space-y-3">
          {/* Provider selector */}
          <div className="flex gap-2">
            <label className="text-xs text-neutral-600 uppercase tracking-wider self-center w-20">
              PROVIDER
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as VideoProviderName)}
              className="inline-select flex-1 text-sm uppercase"
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
              className="search-field flex-1 text-sm"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="action-btn px-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="option-card rounded-none border-x-0 border-t-0 first:rounded-t-none last:border-b-0 flex gap-4 text-left disabled:opacity-50"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16">
                    {result.imageUrl ? (
                      <img
                        src={getProxiedImageUrl(result.imageUrl, VIDEO_PROVIDER_BASE_URLS[selectedProvider]) || ''}
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
        <div className="modal-footer">
          <button
            onClick={onClose}
            className="action-btn-ghost w-full"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProviderMappingModal;
