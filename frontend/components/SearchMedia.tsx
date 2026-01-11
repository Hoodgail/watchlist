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
  { value: 'game', label: 'GAMES' },
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
  game: ['rawg'],
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
  'rawg': 'RAWG',
};

// Platform icons for games
const PlatformIcons: React.FC<{ platforms: string[] }> = ({ platforms }) => {
  // Map platform names to icon components
  const getPlatformIcon = (platform: string): React.ReactNode => {
    const p = platform.toLowerCase();
    if (p.includes('pc') || p.includes('windows')) {
      return (
        <span title="PC">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
          </svg>
        </span>
      );
    }
    if (p.includes('playstation')) {
      return (
        <span title="PlayStation">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.876c2.441 1.193 4.362-.002 4.362-3.153 0-3.237-1.126-4.675-4.438-5.827-1.307-.448-3.728-1.186-5.393-1.502z"/>
          </svg>
        </span>
      );
    }
    if (p.includes('xbox')) {
      return (
        <span title="Xbox">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.102 21.033C6.211 22.881 8.977 24 12 24c3.026 0 5.789-1.119 7.902-2.967 1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912C23.056 17.036 24 14.62 24 12c0-4.124-2.076-7.766-5.24-9.934-1.667 1.058-2.728 2.927-3.498 4.561zM12 4.063s-1.548-2.315-4.757-4.063C4.08 1.833 2.076 5.474 2.076 9.6c0 2.62.944 5.036 2.518 6.9-.192-2.599 3.576-9.882 7.406-12.437z"/>
          </svg>
        </span>
      );
    }
    if (p.includes('nintendo') || p.includes('switch')) {
      return (
        <span title="Nintendo">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14.176 24h3.674c3.376 0 6.15-2.774 6.15-6.15V6.15C24 2.775 21.226 0 17.85 0h-3.674c-.21 0-.38.17-.38.38v23.24c0 .21.17.38.38.38zm3.623-15.15c1.18 0 2.138.957 2.138 2.137 0 1.18-.957 2.138-2.138 2.138-1.18 0-2.137-.957-2.137-2.138 0-1.18.957-2.137 2.137-2.137zM6.15 0C2.774 0 0 2.775 0 6.15v11.7C0 21.226 2.775 24 6.15 24h3.674c.21 0 .38-.17.38-.38V.38c0-.21-.17-.38-.38-.38z"/>
          </svg>
        </span>
      );
    }
    if (p.includes('ios') || p.includes('iphone') || p.includes('ipad')) {
      return (
        <span title="iOS">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83"/>
          </svg>
        </span>
      );
    }
    if (p.includes('android')) {
      return (
        <span title="Android">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.523 15.341c-.5 0-.91-.41-.91-.91v-5.137c0-.5.41-.91.91-.91s.91.41.91.91v5.137c0 .5-.41.91-.91.91zm-11.046 0c-.5 0-.91-.41-.91-.91v-5.137c0-.5.41-.91.91-.91s.91.41.91.91v5.137c0 .5-.41.91-.91.91zm11.523-7.91c0-.276-.224-.5-.5-.5H6.5c-.276 0-.5.224-.5.5v8.569c0 .276.224.5.5.5h11c.276 0 .5-.224.5-.5V7.431zm-1 8.069H7V7.931h10v7.569zM15.363 3.14l1.068-1.59c.127-.19.076-.447-.114-.574-.19-.127-.447-.076-.574.114l-1.117 1.662C13.789 2.282 12.917 2 12 2s-1.789.282-2.626.752L8.257 1.09c-.127-.19-.384-.241-.574-.114-.19.127-.241.384-.114.574l1.068 1.59C7.03 4.147 6 5.813 6 7.5h12c0-1.687-1.03-3.353-2.637-4.36zM9.5 5.5c-.276 0-.5-.224-.5-.5s.224-.5.5-.5.5.224.5.5-.224.5-.5.5zm5 0c-.276 0-.5-.224-.5-.5s.224-.5.5-.5.5.224.5.5-.224.5-.5.5z"/>
          </svg>
        </span>
      );
    }
    if (p.includes('linux')) {
      return (
        <span title="Linux">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.468v.02c.002.134.017.267.051.399.009.054.027.105.049.154a.952.952 0 01-.218.065c-.083.034-.16.073-.234.11l-.004.002-.004.002a.65.65 0 01-.083.042.953.953 0 01-.213-.335c-.096-.234-.137-.49-.15-.706l-.004.024a.085.085 0 01-.004.021v-.105c0-.02.006-.04.006-.06a1.91 1.91 0 01.166-.724c.108-.2.248-.398.438-.533.187-.136.37-.198.584-.198z"/>
          </svg>
        </span>
      );
    }
    if (p.includes('mac')) {
      return (
        <span title="macOS">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
        </span>
      );
    }
    // Default: return null for unknown platforms
    return null;
  };

  // Get unique platform icons (deduplicate similar platforms)
  const getUniquePlatforms = (platforms: string[]): string[] => {
    const seen = new Set<string>();
    return platforms.filter(p => {
      const key = p.toLowerCase()
        .replace(/playstation \d+/i, 'playstation')
        .replace(/xbox.*/i, 'xbox')
        .replace(/nintendo.*/i, 'nintendo');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const uniquePlatforms = getUniquePlatforms(platforms);
  
  return (
    <span className="flex items-center gap-1 text-neutral-400" title={platforms.join(', ')}>
      {uniquePlatforms.slice(0, 4).map((platform, idx) => (
        <span key={idx}>{getPlatformIcon(platform)}</span>
      ))}
      {uniquePlatforms.length > 4 && <span className="text-[10px]">+{uniquePlatforms.length - 4}</span>}
    </span>
  );
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
        result.type === 'LIGHT_NOVEL' || result.type === 'COMIC' || result.type === 'GAME') {
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
      case 'GAME': return 'GAME';
      default: return type;
    }
  };

  // Get unit label (episodes/chapters/pages/hours)
  const getUnitLabel = (type: string) => {
    switch (type) {
      case 'MANGA':
      case 'LIGHT_NOVEL':
      case 'COMIC':
        return 'CH';
      case 'BOOK':
        return 'PG';
      case 'GAME':
        return 'HR';
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
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-neutral-800 hover:border-white transition-colors group bg-black"
              >
                {/* Image & Info Container */}
                <div className="flex items-center gap-4 flex-grow min-w-0">
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
                      {/* For games, show platforms and genres instead of ONGOING */}
                      {item.type === 'GAME' ? (
                        <>
                          {item.platforms && item.platforms.length > 0 && (
                            <span className="flex items-center gap-1">
                              <PlatformIcons platforms={item.platforms} />
                            </span>
                          )}
                          {item.metacritic && (
                            <span className={`px-1 ${item.metacritic >= 75 ? 'text-green-500' : item.metacritic >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                              {item.metacritic}
                            </span>
                          )}
                          {item.genres && item.genres.length > 0 && (
                            <span className="text-neutral-600">
                              {item.genres.slice(0, 2).join(' · ')}
                            </span>
                          )}
                          {item.playtimeHours && item.playtimeHours > 0 && (
                            <span className="text-neutral-600">
                              ~{item.playtimeHours}H
                            </span>
                          )}
                        </>
                      ) : (
                        <span>
                          {item.total
                            ? `${item.total} ${getUnitLabel(item.type)}`
                            : 'ONGOING'}
                        </span>
                      )}
                      {item.year && <span className="text-neutral-600">{item.year}</span>}
                      {item.provider && (
                        <span className="text-neutral-700 bg-neutral-900/50 px-1">
                          {PROVIDER_NAMES[item.provider] || item.provider}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Add Buttons */}
                {addedItems.has(item.id) ? (
                  <span className="flex-shrink-0 text-sm border border-green-700 text-green-500 px-4 py-2 uppercase rounded-none text-center sm:text-left">
                    Added
                  </span>
                ) : (
                  <div className="flex-shrink-0 flex gap-2 flex-wrap sm:flex-nowrap">
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
                        className="text-sm border border-blue-700 text-blue-400 px-3 py-2 hover:border-blue-500 hover:text-blue-300 transition-all uppercase rounded-none font-bold flex items-center gap-1 flex-1 sm:flex-initial justify-center"
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
                      className="text-sm bg-white text-black px-3 py-2 hover:bg-neutral-200 transition-all uppercase rounded-none disabled:opacity-50 font-bold flex-1 sm:flex-initial"
                    >
                      {checkingFormats.has(item.id) ? '...' : addingItems.has(item.id) ? '...' : '+ Planned'}
                    </button>
                    <button
                      onClick={() => setQuickAddItem(item)}
                      disabled={addingItems.has(item.id)}
                      className="text-sm border border-neutral-700 text-neutral-400 px-3 py-2 hover:border-white hover:text-white transition-all uppercase rounded-none disabled:opacity-50 flex-1 sm:flex-initial"
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
