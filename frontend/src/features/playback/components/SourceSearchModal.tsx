import React, { useState, useEffect, useCallback } from 'react';
import { ProviderName, SearchResult } from '@/types';
import { searchWithProvider, searchMedia, SearchCategory } from '@/services/mediaSearch';
import { getProviderDisplayName, getProviderImageUrl } from '@/shared/media';

// All available providers for source switching
const ALL_PROVIDERS: { name: ProviderName; category: 'anime' | 'manga' | 'movie' | 'tv' }[] = [
  // Anime providers
  { name: 'anilist', category: 'anime' },
  { name: 'hianime', category: 'anime' },
  { name: 'animepahe', category: 'anime' },
  { name: 'animekai', category: 'anime' },
  // Movie/TV providers
  { name: 'tmdb', category: 'movie' },
  { name: 'flixhq', category: 'movie' },
  { name: 'goku', category: 'movie' },
  // Manga providers
  { name: 'anilist-manga', category: 'manga' },
  { name: 'mangadex', category: 'manga' },
  { name: 'comick', category: 'manga' },
  { name: 'mangapill', category: 'manga' },
  { name: 'mangahere', category: 'manga' },
  { name: 'mangakakalot', category: 'manga' },
  { name: 'mangareader', category: 'manga' },
  { name: 'asurascans', category: 'manga' },
];

interface SourceSearchModalProps {
  /** Current title for pre-filling search */
  title: string;
  /** Current media type (for filtering providers) */
  mediaType: 'ANIME' | 'MANGA' | 'TV' | 'MOVIE';
  /** Current refId */
  refId: string;
  /** Called when a new source is selected */
  onSourceSelected: (result: SearchResult, provider: ProviderName) => void;
  /** Called to close the modal */
  onClose: () => void;
  /** Mode: 'change' for switching sources, 'link' for adding linked sources */
  mode?: 'change' | 'link';
}

export const SourceSearchModal: React.FC<SourceSearchModalProps> = ({
  title,
  mediaType,
  refId,
  onSourceSelected,
  onClose,
  mode = 'change',
}) => {
  const [searchQuery, setSearchQuery] = useState(title);
  const [selectedProvider, setSelectedProvider] = useState<ProviderName | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter providers based on media type
  const availableProviders = ALL_PROVIDERS.filter(p => {
    if (mediaType === 'ANIME') return p.category === 'anime';
    if (mediaType === 'MANGA') return p.category === 'manga';
    if (mediaType === 'TV' || mediaType === 'MOVIE') return p.category === 'movie' || p.category === 'tv';
    return true;
  });

  // Auto-select first provider if none selected
  useEffect(() => {
    if (!selectedProvider && availableProviders.length > 0) {
      setSelectedProvider(availableProviders[0].name);
    }
  }, [availableProviders, selectedProvider]);

  // Perform search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !selectedProvider) return;

    setIsSearching(true);
    setHasSearched(true);
    setError(null);
    
    try {
      const results = await searchWithProvider(searchQuery, selectedProvider);
      setSearchResults(results.results);
    } catch (err) {
      console.error('[SourceSearchModal] Search failed:', err);
      setError('Search failed. Try another provider.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, selectedProvider]);

  // Search when provider changes (if we have a query)
  useEffect(() => {
    if (selectedProvider && searchQuery.trim() && hasSearched) {
      handleSearch();
    }
  }, [selectedProvider]);

  // Handle selecting a result
  const handleSelectResult = (result: SearchResult) => {
    onSourceSelected(result, selectedProvider!);
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
      <div className="modal-shell max-w-lg max-h-[90vh]">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest">
              {mode === 'link' ? 'LINK ANOTHER SOURCE' : 'CHANGE SOURCE'}
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              {mode === 'link' 
                ? 'Search and add a linked source for this title'
                : 'Search and switch to a different provider for this title'}
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
              value={selectedProvider || ''}
              onChange={(e) => setSelectedProvider(e.target.value as ProviderName)}
              className="inline-select flex-1 text-sm uppercase"
            >
                {availableProviders.map(provider => (
                  <option key={provider.name} value={provider.name} className="bg-black">
                  {getProviderDisplayName(provider.name)}
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
              disabled={isSearching || !searchQuery.trim() || !selectedProvider}
              className="action-btn px-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? '...' : 'SEARCH'}
            </button>
          </div>
        </div>

        {/* Current Source Info */}
        <div className="modal-section bg-neutral-950 py-2">
          <p className="text-xs text-neutral-600">
            <span className="uppercase tracking-wider">Current source:</span>{' '}
            <span className="text-neutral-400 font-mono">{refId}</span>
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-neutral-600 uppercase tracking-wider text-sm animate-pulse">
                Searching...
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-500 uppercase tracking-wider text-sm">
                {error}
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
                  className="option-card rounded-none border-x-0 border-t-0 first:rounded-t-none last:border-b-0 flex gap-4 text-left"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16">
                    {result.imageUrl ? (
                        <img
                         src={getProviderImageUrl(result.imageUrl, selectedProvider ?? undefined) || ''}
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
                        <span className="meta-pill">{result.type}</span>
                      )}
                      {result.year && (
                        <span>{result.year}</span>
                      )}
                      {result.total && (
                        <span>{result.total} {result.type === 'MANGA' ? 'ch' : 'ep'}</span>
                      )}
                    </div>
                    {(result.description || result.overview) && (
                      <p className="text-xs text-neutral-600 mt-2 line-clamp-2">
                        {result.description || result.overview}
                      </p>
                    )}
                    {/* Show refId for debugging/clarity */}
                    <p className="text-xs text-neutral-700 mt-1 font-mono truncate">
                      {result.id}
                    </p>
                  </div>

                  {/* Link indicator */}
                  <div className="flex-shrink-0 self-center flex flex-col items-center gap-1">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-[10px] text-neutral-600 uppercase">Link</span>
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

export default SourceSearchModal;
