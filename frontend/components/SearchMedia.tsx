import React, { useState, useEffect, useCallback } from 'react';
import { MediaItem, SearchResult, ProviderInfo, ProviderName } from '../types';
import { searchMedia, searchResultToMediaItem, SearchCategory, SearchOptions, getProviders, searchWithProvider } from '../services/mediaSearch';
import { QuickAddModal } from './QuickAddModal';
import { FormatSelectionModal } from './FormatSelectionModal';

// Provider base URLs for referer headers
const PROVIDER_BASE_URLS: Partial<Record<ProviderName, string>> = {
  // Anime providers
  'hianime': 'https://hianime.to',
  'animepahe': 'https://animepahe.com',
  'animekai': 'https://animekai.to',
  'kickassanime': 'https://kickassanime.am',
  // Movie/TV providers
  'flixhq': 'https://flixhq.to',
  'goku': 'https://goku.sx',
  'sflix': 'https://sflix.to',
  'himovies': 'https://himovies.to',
  'dramacool': 'https://dramacool.ee',
  // Manga providers
  'mangadex': 'https://mangadex.org',
  'mangahere': 'https://mangahere.cc',
  'mangapill': 'https://mangapill.com',
  'comick': 'https://comick.io',
  'mangakakalot': 'https://mangakakalot.com',
  'mangareader': 'https://mangareader.to',
  'asurascans': 'https://asuracomic.net',
  // Meta providers
  'anilist': 'https://anilist.co',
  'anilist-manga': 'https://anilist.co',
  'tmdb': 'https://www.themoviedb.org',
  // Other providers
  'libgen': 'https://libgen.is',
  'readlightnovels': 'https://readlightnovels.net',
  'getcomics': 'https://getcomics.info',
};

// Helper to proxy image URLs through our server to bypass hotlink protection
function proxyImageUrl(url: string, referer?: string): string {
  // Don't proxy blob URLs or already-proxied URLs
  if (url.startsWith('blob:') || url.startsWith('/api/')) {
    return url;
  }
  let proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
  if (referer) {
    proxyUrl += `&referer=${encodeURIComponent(referer)}`;
  }
  return proxyUrl;
}

interface SearchMediaProps {
  onAdd: (item: Omit<MediaItem, 'id'>) => Promise<void> | void;
  onOpenMedia?: (mediaId: string, provider: ProviderName, title?: string, mediaType?: 'movie' | 'tv' | 'anime') => void;
}

const CATEGORIES: { value: SearchCategory; label: string }[] = [
  { value: 'all', label: 'ALL' },
  { value: 'tv', label: 'TV' },
  { value: 'movie', label: 'FILM' },
  { value: 'anime', label: 'ANIME' },
  { value: 'manga', label: 'MANGA' },
  { value: 'book', label: 'BOOKS' },
  { value: 'lightnovel', label: 'LIGHT NOVELS' },
  { value: 'comic', label: 'COMICS' },
];

// Map categories to their available providers
const CATEGORY_PROVIDERS: Record<SearchCategory, ProviderName[]> = {
  all: [],
  anime: ['anilist', 'hianime', 'animepahe', 'animekai', 'kickassanime'],
  movie: ['tmdb', 'flixhq', 'goku', 'sflix', 'himovies'],
  tv: ['tmdb', 'flixhq', 'goku', 'sflix', 'himovies', 'dramacool'],
  manga: ['mangadex', 'comick', 'mangapill', 'mangahere', 'mangakakalot', 'mangareader', 'asurascans', 'anilist-manga'],
  book: ['libgen'],
  lightnovel: ['readlightnovels'],
  comic: ['getcomics'],
};

// Display names for providers
const PROVIDER_NAMES: Record<ProviderName, string> = {
  'hianime': 'HiAnime',
  'animepahe': 'AnimePahe',
  'animekai': 'AnimeKai',
  'kickassanime': 'KickAssAnime',
  'flixhq': 'FlixHQ',
  'goku': 'Goku',
  'sflix': 'SFlix',
  'himovies': 'HiMovies',
  'dramacool': 'DramaCool',
  'mangadex': 'MangaDex',
  'comick': 'ComicK',
  'mangapill': 'MangaPill',
  'mangahere': 'MangaHere',
  'mangakakalot': 'MangaKakalot',
  'mangareader': 'MangaReader',
  'asurascans': 'AsuraScans',
  'anilist': 'AniList',
  'anilist-manga': 'AniList',
  'tmdb': 'TMDB',
  'libgen': 'Libgen',
  'readlightnovels': 'ReadLightNovels',
  'getcomics': 'GetComics',
};

export const SearchMedia: React.FC<SearchMediaProps> = ({ onAdd, onOpenMedia }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [provider, setProvider] = useState<ProviderName | ''>('');
  const [year, setYear] = useState('');
  const [includeAdult, setIncludeAdult] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());
  const [quickAddItem, setQuickAddItem] = useState<SearchResult | null>(null);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  
  // Multi-format selection state
  const [formatSelectionItem, setFormatSelectionItem] = useState<SearchResult | null>(null);
  const [animeVariant, setAnimeVariant] = useState<SearchResult | null>(null);
  const [mangaVariant, setMangaVariant] = useState<SearchResult | null>(null);
  const [checkingFormats, setCheckingFormats] = useState<Set<string>>(new Set());

  // Get available providers for current category
  const availableProviders = CATEGORY_PROVIDERS[category] || [];

  // Reset provider when category changes if it's not valid for new category
  useEffect(() => {
    if (provider && !availableProviders.includes(provider)) {
      setProvider('');
    }
  }, [category, provider, availableProviders]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      const options: SearchOptions = {
        includeAdult,
        year: year.trim() || undefined,
        provider: provider || undefined,
      };
      const items = await searchMedia(query, category, options);
      setResults(items);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (result: SearchResult) => {
    if (addedItems.has(result.id) || addingItems.has(result.id)) return;
    
    setAddingItems(prev => new Set(prev).add(result.id));
    
    try {
      const mediaItem = searchResultToMediaItem(result);
      await onAdd(mediaItem);
      setAddedItems(prev => new Set(prev).add(result.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  };

  // Quick add to planned
  const handleQuickAdd = async (result: SearchResult) => {
    if (addedItems.has(result.id) || addingItems.has(result.id)) return;
    
    setAddingItems(prev => new Set(prev).add(result.id));
    
    try {
      const mediaItem = searchResultToMediaItem(result);
      await onAdd({ ...mediaItem, status: 'PLAN_TO_WATCH', current: 0 });
      setAddedItems(prev => new Set(prev).add(result.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  };
  
  // Check if a title exists in both anime and manga formats
  const checkMultiFormat = useCallback(async (result: SearchResult): Promise<{ hasAnime: boolean; hasManga: boolean; animeResult: SearchResult | null; mangaResult: SearchResult | null }> => {
    const normalizedTitle = result.title.toLowerCase().trim();
    
    // Skip check for titles that are clearly one format
    // or if we already know the type from the result
    if (result.type === 'TV' || result.type === 'MOVIE' || result.type === 'BOOK' || 
        result.type === 'LIGHT_NOVEL' || result.type === 'COMIC') {
      return { hasAnime: false, hasManga: false, animeResult: null, mangaResult: null };
    }
    
    try {
      // Search in parallel for anime and manga versions
      const [animeResults, mangaResults] = await Promise.all([
        result.type === 'ANIME' 
          ? Promise.resolve({ results: [result] })
          : searchWithProvider(result.title, 'anilist'),
        result.type === 'MANGA'
          ? Promise.resolve({ results: [result] })
          : searchWithProvider(result.title, 'anilist-manga'),
      ]);
      
      // Find close title matches
      const findMatch = (searchResults: SearchResult[]): SearchResult | null => {
        for (const r of searchResults) {
          const rTitle = r.title.toLowerCase().trim();
          // Exact match or very close match
          if (rTitle === normalizedTitle || 
              rTitle.includes(normalizedTitle) || 
              normalizedTitle.includes(rTitle)) {
            return r;
          }
        }
        return null;
      };
      
      const animeMatch = result.type === 'ANIME' ? result : findMatch(animeResults.results);
      const mangaMatch = result.type === 'MANGA' ? result : findMatch(mangaResults.results);
      
      return {
        hasAnime: animeMatch !== null,
        hasManga: mangaMatch !== null,
        animeResult: animeMatch,
        mangaResult: mangaMatch,
      };
    } catch (error) {
      console.error('[checkMultiFormat] Error checking formats:', error);
      return { hasAnime: false, hasManga: false, animeResult: null, mangaResult: null };
    }
  }, []);
  
  // Handle add with multi-format check
  const handleAddWithFormatCheck = useCallback(async (result: SearchResult) => {
    if (addedItems.has(result.id) || addingItems.has(result.id) || checkingFormats.has(result.id)) return;
    
    // Only check for multi-format if this is an anime or manga result and we're in "all" category
    const shouldCheckFormats = (result.type === 'ANIME' || result.type === 'MANGA') && category === 'all';
    
    if (!shouldCheckFormats) {
      // Direct add without format check
      handleQuickAdd(result);
      return;
    }
    
    // Check for multi-format availability
    setCheckingFormats(prev => new Set(prev).add(result.id));
    
    try {
      const { hasAnime, hasManga, animeResult, mangaResult } = await checkMultiFormat(result);
      
      // If both formats exist and they're different results, show selection modal
      if (hasAnime && hasManga && animeResult && mangaResult) {
        setFormatSelectionItem(result);
        setAnimeVariant(animeResult);
        setMangaVariant(mangaResult);
      } else {
        // Only one format exists, add directly
        handleQuickAdd(result);
      }
    } finally {
      setCheckingFormats(prev => {
        const next = new Set(prev);
        next.delete(result.id);
        return next;
      });
    }
  }, [addedItems, addingItems, checkingFormats, category, checkMultiFormat, handleQuickAdd]);
  
  // Handle format selection from modal
  const handleFormatSelection = useCallback(async (selectedResult: SearchResult) => {
    setFormatSelectionItem(null);
    setAnimeVariant(null);
    setMangaVariant(null);
    
    // Add the selected format
    if (addedItems.has(selectedResult.id) || addingItems.has(selectedResult.id)) return;
    
    setAddingItems(prev => new Set(prev).add(selectedResult.id));
    
    try {
      const mediaItem = searchResultToMediaItem(selectedResult);
      await onAdd({ ...mediaItem, status: 'PLAN_TO_WATCH', current: 0 });
      setAddedItems(prev => new Set(prev).add(selectedResult.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        next.delete(selectedResult.id);
        return next;
      });
    }
  }, [addedItems, addingItems, onAdd]);

  // Handle add from modal
  const handleModalAdd = async (mediaItem: Omit<MediaItem, 'id'>) => {
    if (!quickAddItem) return;
    
    setAddingItems(prev => new Set(prev).add(quickAddItem.id));
    try {
      await onAdd(mediaItem);
      setAddedItems(prev => new Set(prev).add(quickAddItem.id));
    } finally {
      setAddingItems(prev => {
        const next = new Set(prev);
        if (quickAddItem) next.delete(quickAddItem.id);
        return next;
      });
    }
  };

  // Get type label for display
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'LIGHT_NOVEL': return 'LN';
      case 'COMIC': return 'COMIC';
      case 'BOOK': return 'BOOK';
      default: return type;
    }
  };

  // Get unit label (episodes/chapters/pages)
  const getUnitLabel = (type: string) => {
    switch (type) {
      case 'MANGA':
      case 'LIGHT_NOVEL':
      case 'COMIC':
        return 'CH';
      case 'BOOK':
        return 'PG';
      default:
        return 'EP';
    }
  };

  // Check if media type is video content (can be watched)
  const isVideoType = (type: string) => {
    return type === 'TV' || type === 'MOVIE' || type === 'ANIME';
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-2">
          ADD CONTENT
        </h2>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-3 py-1 text-xs uppercase tracking-wider border transition-colors ${
                category === cat.value
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-neutral-500 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Provider Selection (only show if category has providers) */}
        {availableProviders.length > 0 && (
          <div className="relative">
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500 uppercase tracking-wider">
                Source
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                  className="bg-black border border-neutral-700 px-3 py-1 text-xs uppercase tracking-wider text-white hover:border-neutral-500 focus:border-white outline-none flex items-center gap-2"
                >
                  {provider ? PROVIDER_NAMES[provider] : 'Auto'}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showProviderDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-black border border-neutral-700 z-10 min-w-[150px]">
                    <button
                      type="button"
                      onClick={() => {
                        setProvider('');
                        setShowProviderDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs uppercase tracking-wider hover:bg-neutral-900 ${
                        !provider ? 'text-white bg-neutral-800' : 'text-neutral-400'
                      }`}
                    >
                      Auto (Default)
                    </button>
                    {availableProviders.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setProvider(p);
                          setShowProviderDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs uppercase tracking-wider hover:bg-neutral-900 ${
                          provider === p ? 'text-white bg-neutral-800' : 'text-neutral-400'
                        }`}
                      >
                        {PROVIDER_NAMES[p]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Options */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="year" className="text-xs text-neutral-500 uppercase tracking-wider">
              Year
            </label>
            <input
              id="year"
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="e.g. 2024"
              className="w-20 bg-black border border-neutral-700 px-2 py-1 text-white placeholder-neutral-700 text-xs focus:border-white outline-none font-mono rounded-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAdult}
              onChange={(e) => setIncludeAdult(e.target.checked)}
              className="w-4 h-4 bg-black border border-neutral-700 rounded-none accent-white cursor-pointer"
            />
            <span className="text-xs text-neutral-500 uppercase tracking-wider">
              Include Adult
            </span>
          </label>
        </div>

        <form onSubmit={handleSearch} className="flex gap-0">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="TYPE TITLE (e.g. 'AKIRA')"
            className="flex-grow bg-black border border-neutral-700 p-4 text-white placeholder-neutral-700 uppercase focus:border-white outline-none font-mono rounded-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black font-bold uppercase px-6 py-4 hover:bg-neutral-300 disabled:opacity-50 rounded-none border-l-0"
          >
            {loading ? '...' : 'FIND'}
          </button>
        </form>
      </div>

      {hasSearched && (
        <div className="space-y-4 animate-fade-in">
          <h3 className="text-xs text-neutral-600 uppercase tracking-widest">
            {loading ? 'SEARCHING...' : `RESULTS FOR "${query}"`}
          </h3>

          {!loading && results.length === 0 && (
            <div className="p-4 border border-red-900/50 text-red-700 uppercase text-sm">
              No results found. Try a different query.
            </div>
          )}

          <div className="flex flex-col gap-4 overflow-hidden">
            {results.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 border border-neutral-800 hover:border-white transition-colors group bg-black"
              >
                {/* Image */}
                {item.imageUrl && (
                  <div className="flex-shrink-0 w-12 h-16 bg-neutral-900 overflow-hidden">
                    <img
                      src={proxyImageUrl(item.imageUrl, item.provider ? PROVIDER_BASE_URLS[item.provider] : undefined)}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Info */}
                <div className="flex-grow min-w-0">
                  <h4 className="font-bold text-lg uppercase tracking-tight truncate">
                    {item.title}
                  </h4>
                  <div className="flex gap-2 text-xs text-neutral-500 mt-1 uppercase flex-wrap">
                    <span className="bg-neutral-900 px-1 border border-neutral-800">
                      {getTypeLabel(item.type)}
                    </span>
                    <span>
                      {item.total
                        ? `${item.total} ${getUnitLabel(item.type)}`
                        : 'ONGOING'}
                    </span>
                    {item.year && <span className="text-neutral-600">{item.year}</span>}
                    {item.provider && (
                      <span className="text-neutral-700 bg-neutral-900/50 px-1">
                        {PROVIDER_NAMES[item.provider] || item.provider}
                      </span>
                    )}
                  </div>
                </div>

                {/* Add Buttons */}
                {addedItems.has(item.id) ? (
                  <span className="flex-shrink-0 text-sm border border-green-700 text-green-500 px-4 py-2 uppercase rounded-none">
                    Added
                  </span>
                ) : (
                  <div className="flex-shrink-0 flex gap-2">
                    {onOpenMedia && isVideoType(item.type) && item.provider && (
                      <button
                        onClick={() => {
                          // Determine media type for resolution
                          const mediaType: 'movie' | 'tv' | 'anime' | undefined = 
                            item.type === 'ANIME' ? 'anime' : 
                            item.type === 'MOVIE' ? 'movie' : 
                            item.type === 'TV' ? 'tv' : undefined;
                          onOpenMedia(item.id, item.provider!, item.title, mediaType);
                        }}
                        className="text-sm border border-blue-700 text-blue-400 px-3 py-2 hover:border-blue-500 hover:text-blue-300 transition-all uppercase rounded-none font-bold flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Watch
                      </button>
                    )}
                    <button
                      onClick={() => handleAddWithFormatCheck(item)}
                      disabled={addingItems.has(item.id) || checkingFormats.has(item.id)}
                      className="text-sm bg-white text-black px-3 py-2 hover:bg-neutral-200 transition-all uppercase rounded-none disabled:opacity-50 font-bold"
                    >
                      {checkingFormats.has(item.id) ? '...' : addingItems.has(item.id) ? '...' : '+ Planned'}
                    </button>
                    <button
                      onClick={() => setQuickAddItem(item)}
                      disabled={addingItems.has(item.id)}
                      className="text-sm border border-neutral-700 text-neutral-400 px-3 py-2 hover:border-white hover:text-white transition-all uppercase rounded-none disabled:opacity-50"
                    >
                      + Details
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual filler for empty state */}
      {!hasSearched && (
        <div className="text-neutral-800 text-center py-20 select-none">
          <div className="text-6xl mb-4 opacity-20">Type</div>
          <div className="text-6xl mb-4 opacity-10">To</div>
          <div className="text-6xl opacity-5">Search</div>
        </div>
      )}

      {/* Quick Add Modal */}
      {quickAddItem && (
        <QuickAddModal
          item={quickAddItem}
          onAdd={handleModalAdd}
          onClose={() => setQuickAddItem(null)}
        />
      )}
      
      {/* Format Selection Modal */}
      {formatSelectionItem && (animeVariant || mangaVariant) && (
        <FormatSelectionModal
          result={formatSelectionItem}
          animeResult={animeVariant}
          mangaResult={mangaVariant}
          onSelect={handleFormatSelection}
          onClose={() => {
            setFormatSelectionItem(null);
            setAnimeVariant(null);
            setMangaVariant(null);
          }}
        />
      )}
    </div>
  );
};
