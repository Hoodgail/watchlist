import * as tmdbService from './tmdbService.js';
import * as consumetService from './consumetService.js';
import * as mangadexService from './mangadexService.js';
import { 
  ProviderName, 
  UnifiedSearchResult, 
  UnifiedBookResult,
  PaginatedResults,
  ProviderInfo,
  MediaCategory as ConsumetMediaCategory,
} from './consumet/types.js';
import {
  getProvidersByCategory,
  getAllProviders,
  isValidProvider,
  getProviderInfo,
  ANIME_PROVIDERS,
  MOVIE_PROVIDERS,
  MANGA_PROVIDERS,
} from './consumet/providerRegistry.js';

// ============ Types ============

export type MediaSource = 'tmdb' | 'consumet-anilist' | 'mangadex' | ProviderName;
export type MediaType = 'TV' | 'MOVIE' | 'ANIME' | 'MANGA' | 'BOOK' | 'LIGHT_NOVEL' | 'COMIC';
export type SearchCategory = 'all' | 'tv' | 'movie' | 'anime' | 'manga' | 'book' | 'lightnovel' | 'comic';

export interface SearchResult {
  id: string;           // Prefixed: "tmdb:123", "consumet-anilist:abc", "mangadex:xyz"
  title: string;
  type: MediaType;
  total: number | null;
  imageUrl?: string;
  year?: number;
  overview?: string;
  source: MediaSource;
  provider?: ProviderName; // The specific provider used
}

export interface TrendingCategory {
  title: string;
  items: SearchResult[];
}

export interface SearchOptions {
  year?: string;
  includeAdult?: boolean;
  provider?: ProviderName; // Specific provider to use
  page?: number;
  perPage?: number;
}

// ============ ID Helpers ============

/**
 * Create a prefixed ID for a search result
 */
function createPrefixedId(source: MediaSource, id: string | number): string {
  return `${source}:${id}`;
}

// ============ TMDB Converters ============

/**
 * Convert TMDB movie result to SearchResult
 */
function tmdbMovieToSearchResult(item: tmdbService.TMDBSearchResult): SearchResult {
  return {
    id: createPrefixedId('tmdb', item.id),
    title: item.title || 'Unknown Title',
    type: 'MOVIE',
    total: 1,
    imageUrl: tmdbService.getImageUrl(item.poster_path),
    year: tmdbService.extractYear(item.release_date),
    overview: item.overview,
    source: 'tmdb',
  };
}

/**
 * Convert TMDB TV result to SearchResult (with optional details for episode count)
 */
function tmdbTVToSearchResult(
  item: tmdbService.TMDBSearchResult,
  details?: tmdbService.TMDBTVDetails | null
): SearchResult {
  const isAnime = tmdbService.isAnime(item);
  return {
    id: createPrefixedId('tmdb', item.id),
    title: item.name || 'Unknown Title',
    type: isAnime ? 'ANIME' : 'TV',
    total: details?.number_of_episodes || null,
    imageUrl: tmdbService.getImageUrl(item.poster_path),
    year: tmdbService.extractYear(item.first_air_date),
    overview: item.overview,
    source: 'tmdb',
  };
}

// ============ Consumet Converters ============

/**
 * Convert Consumet unified result to SearchResult
 */
function consumetToSearchResult(item: UnifiedSearchResult, mediaType: MediaType = 'ANIME'): SearchResult {
  return {
    id: createPrefixedId(item.provider, item.id),
    title: consumetService.getPreferredTitle(item.title),
    type: mediaType,
    total: item.totalEpisodes || item.totalChapters || null,
    imageUrl: item.image,
    year: consumetService.extractYear(item.releaseDate),
    overview: item.description?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''),
    source: item.provider,
    provider: item.provider,
  };
}

/**
 * Convert Consumet book result to SearchResult
 */
function consumetBookToSearchResult(item: UnifiedBookResult): SearchResult {
  return {
    id: createPrefixedId(item.provider, item.id),
    title: item.title,
    type: 'BOOK',
    total: null,
    imageUrl: item.image,
    year: item.year ? parseInt(item.year) : undefined,
    overview: item.description,
    source: item.provider,
    provider: item.provider,
  };
}

/**
 * Convert Consumet anime result to SearchResult (legacy)
 */
function consumetAnimeToSearchResult(item: consumetService.ConsumetAnimeResult): SearchResult {
  return {
    id: createPrefixedId('consumet-anilist', item.id),
    title: consumetService.getPreferredTitle(item.title),
    type: 'ANIME',
    total: item.totalEpisodes || null,
    imageUrl: item.image,
    year: consumetService.extractYear(item.releaseDate),
    overview: item.description?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''),
    source: 'consumet-anilist',
    provider: 'anilist',
  };
}

// ============ MangaDex Converters ============

/**
 * Convert MangaDex search result to SearchResult
 */
function mangadexToSearchResult(item: mangadexService.MangaSearchResult): SearchResult {
  return {
    id: createPrefixedId('mangadex', item.id),
    title: item.title,
    type: 'MANGA',
    total: null, // MangaDex search doesn't return chapter count directly
    imageUrl: item.coverUrl,
    year: item.year,
    overview: item.description,
    source: 'mangadex',
    provider: 'mangadex',
  };
}

// ============ Provider API Functions ============

/**
 * Get list of available providers, optionally filtered by category
 */
export function getProviders(category?: SearchCategory): ProviderInfo[] {
  if (!category || category === 'all') {
    return getAllProviders();
  }
  
  // Map our search categories to consumet categories
  const categoryMap: Record<SearchCategory, ConsumetMediaCategory | undefined> = {
    all: undefined,
    anime: 'anime',
    movie: 'movie',
    tv: 'tv',
    manga: 'manga',
    book: 'book',
    lightnovel: 'lightnovel',
    comic: 'comic',
  };
  
  const consumetCategory = categoryMap[category];
  if (!consumetCategory) return getAllProviders();
  
  return getProvidersByCategory(consumetCategory);
}

/**
 * Search using a specific provider
 */
export async function searchWithProvider(
  query: string,
  provider: ProviderName,
  options: SearchOptions = {}
): Promise<PaginatedResults<SearchResult>> {
  if (!isValidProvider(provider)) {
    return { currentPage: 1, hasNextPage: false, results: [] };
  }

  const providerInfo = getProviderInfo(provider);
  if (!providerInfo) {
    return { currentPage: 1, hasNextPage: false, results: [] };
  }

  const consumetResults = await consumetService.search(query, provider, {
    page: options.page,
    perPage: options.perPage,
  });

  // Determine media type based on provider category
  let mediaType: MediaType;
  switch (providerInfo.category) {
    case 'anime':
      mediaType = 'ANIME';
      break;
    case 'movie':
    case 'tv':
      mediaType = 'MOVIE';
      break;
    case 'manga':
      mediaType = 'MANGA';
      break;
    case 'book':
      mediaType = 'BOOK';
      break;
    case 'lightnovel':
      mediaType = 'LIGHT_NOVEL';
      break;
    case 'comic':
      mediaType = 'COMIC';
      break;
    default:
      mediaType = 'ANIME';
  }

  const results = consumetResults.results.map((item) => {
    if ('authors' in item) {
      return consumetBookToSearchResult(item as UnifiedBookResult);
    }
    return consumetToSearchResult(item as UnifiedSearchResult, mediaType);
  });

  return {
    currentPage: consumetResults.currentPage,
    hasNextPage: consumetResults.hasNextPage,
    totalPages: consumetResults.totalPages,
    totalResults: consumetResults.totalResults,
    results,
  };
}

// ============ Search Functions ============

/**
 * Search movies using TMDB
 */
async function searchMovies(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const results = await tmdbService.searchTMDB(query, 'movie', options);
  return results.map(tmdbMovieToSearchResult);
}

/**
 * Search TV shows using TMDB (with episode count details)
 */
async function searchTV(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const results = await tmdbService.searchTMDB(query, 'tv', options);
  
  // Get details for each show to get episode count
  const detailedResults = await Promise.all(
    results.map(async (item) => {
      const details = await tmdbService.getTVDetails(item.id);
      return tmdbTVToSearchResult(item, details);
    })
  );

  return detailedResults;
}

/**
 * Search anime using Consumet Anilist (primary) with TMDB fallback
 */
async function searchAnime(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  // If a specific provider is requested, use it
  if (options.provider && ANIME_PROVIDERS.includes(options.provider as any)) {
    const results = await searchWithProvider(query, options.provider, options);
    return results.results;
  }

  // Try Consumet Anilist first (better anime data)
  const consumetResults = await consumetService.searchAnimeAnilist(query, { page: 1, perPage: 10 });
  
  if (consumetResults.results.length > 0) {
    return consumetResults.results.slice(0, 5).map((item) => consumetToSearchResult(item, 'ANIME'));
  }
  
  // Fallback to TMDB anime search
  const tmdbResults = await tmdbService.searchAnime(query, options);
  
  const detailedResults = await Promise.all(
    tmdbResults.map(async (item) => {
      const details = await tmdbService.getTVDetails(item.id);
      return tmdbTVToSearchResult(item, details);
    })
  );

  // Ensure they're marked as ANIME
  return detailedResults.map(r => ({ ...r, type: 'ANIME' as MediaType }));
}

/**
 * Search manga using MangaDex or specified provider
 */
async function searchMangaItems(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  // If a specific provider is requested, use it
  if (options.provider && MANGA_PROVIDERS.includes(options.provider as any)) {
    const results = await searchWithProvider(query, options.provider, options);
    return results.results;
  }

  // Default to MangaDex
  try {
    const { results } = await mangadexService.searchManga(query, 5, 0);
    return results.map(mangadexToSearchResult);
  } catch (error) {
    console.error('MangaDex search error:', error);
    return [];
  }
}

/**
 * Search books using Libgen
 */
async function searchBooks(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const provider = options.provider || 'libgen';
  const results = await searchWithProvider(query, provider, options);
  return results.results;
}

/**
 * Search light novels
 */
async function searchLightNovels(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const provider = options.provider || 'novelupdates';
  const results = await searchWithProvider(query, provider, options);
  return results.results;
}

/**
 * Search comics
 */
async function searchComics(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const provider = options.provider || 'getcomics';
  const results = await searchWithProvider(query, provider, options);
  return results.results;
}

/**
 * Search all sources using TMDB multi endpoint + MangaDex + Consumet
 */
async function searchAll(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  // Search all sources in parallel
  const [tmdbMultiResults, mangaResults, animeResults] = await Promise.all([
    tmdbService.searchTMDBMulti(query, options),
    searchMangaItems(query),
    consumetService.searchAnimeAnilist(query, { page: 1, perPage: 5 }),
  ]);

  // Convert TMDB multi results
  const tmdbSearchResults = await Promise.all(
    tmdbMultiResults.map(async (item) => {
      if (item.media_type === 'movie') {
        return tmdbMovieToSearchResult(item);
      } else {
        const details = await tmdbService.getTVDetails(item.id);
        return tmdbTVToSearchResult(item, details);
      }
    })
  );

  // Convert Consumet anime results
  const consumetSearchResults = animeResults.results.map((item) => consumetToSearchResult(item, 'ANIME'));

  // Combine all results
  const allResults = [...tmdbSearchResults, ...mangaResults, ...consumetSearchResults];

  // Deduplicate by ID
  const seen = new Set<string>();
  const deduplicated = allResults.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });

  return deduplicated;
}

/**
 * Main search function - searches based on category
 */
export async function searchMedia(
  query: string,
  category: SearchCategory = 'all',
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  // If a specific provider is given, use provider search
  if (options.provider && isValidProvider(options.provider)) {
    const results = await searchWithProvider(query, options.provider, options);
    return results.results;
  }

  switch (category) {
    case 'all':
      return searchAll(query, options);
    case 'movie':
      return searchMovies(query, options);
    case 'tv':
      return searchTV(query, options);
    case 'anime':
      return searchAnime(query, options);
    case 'manga':
      return searchMangaItems(query, options);
    case 'book':
      return searchBooks(query, options);
    case 'lightnovel':
      return searchLightNovels(query, options);
    case 'comic':
      return searchComics(query, options);
    default:
      return [];
  }
}

// ============ Trending Functions ============

/**
 * Get trending movies from TMDB
 */
export async function getTrendingMovies(timeWindow: 'day' | 'week' = 'week'): Promise<SearchResult[]> {
  const results = await tmdbService.getTrendingTMDB('movie', timeWindow);
  return results.slice(0, 20).map(tmdbMovieToSearchResult);
}

/**
 * Get trending TV shows from TMDB
 */
export async function getTrendingTV(timeWindow: 'day' | 'week' = 'week'): Promise<SearchResult[]> {
  const results = await tmdbService.getTrendingTMDB('tv', timeWindow);
  
  return results.slice(0, 20).map(item => {
    const isAnime = tmdbService.isAnime(item);
    return {
      id: createPrefixedId('tmdb', item.id),
      title: item.name || 'Unknown Title',
      type: isAnime ? 'ANIME' as MediaType : 'TV' as MediaType,
      total: null,
      imageUrl: tmdbService.getImageUrl(item.poster_path),
      year: tmdbService.extractYear(item.first_air_date),
      overview: item.overview,
      source: 'tmdb' as MediaSource,
    };
  });
}

/**
 * Get trending anime from Consumet Anilist
 */
export async function getTrendingAnime(): Promise<SearchResult[]> {
  const paginatedResults = await consumetService.getTrendingAnime(1, 20);
  return paginatedResults.results.map((item) => consumetToSearchResult(item, 'ANIME'));
}

/**
 * Get popular anime from Consumet Anilist
 */
export async function getPopularAnime(): Promise<SearchResult[]> {
  const paginatedResults = await consumetService.getPopularAnime(1, 20);
  return paginatedResults.results.map((item) => consumetToSearchResult(item, 'ANIME'));
}

/**
 * Get popular manga from MangaDex
 */
export async function getPopularManga(): Promise<SearchResult[]> {
  const paginatedResults = await consumetService.getPopularManga(1, 20);
  return paginatedResults.results.map((item) => consumetToSearchResult(item, 'MANGA'));
}

/**
 * Get all trending content organized by category
 */
export async function getAllTrending(): Promise<TrendingCategory[]> {
  // Fetch all trending data in parallel
  const [trendingAll, trendingMovies, trendingTV, trendingAnime] = await Promise.all([
    tmdbService.getTrendingTMDB('all', 'day'),
    getTrendingMovies('week'),
    getTrendingTV('week'),
    getTrendingAnime(),
  ]);

  // Convert trending all to search results
  const trendingAllResults: SearchResult[] = await Promise.all(
    trendingAll
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 20)
      .map(async (item) => {
        if (item.media_type === 'movie') {
          return tmdbMovieToSearchResult(item);
        } else {
          return {
            id: createPrefixedId('tmdb', item.id),
            title: item.name || 'Unknown Title',
            type: tmdbService.isAnime(item) ? 'ANIME' as MediaType : 'TV' as MediaType,
            total: null,
            imageUrl: tmdbService.getImageUrl(item.poster_path),
            year: tmdbService.extractYear(item.first_air_date),
            overview: item.overview,
            source: 'tmdb' as MediaSource,
          };
        }
      })
  );

  // Filter TV-only from trendingTV (exclude anime)
  const trendingTVOnly = trendingTV.filter(item => item.type === 'TV');

  // Build categories (only include non-empty)
  const categories: TrendingCategory[] = [];

  if (trendingAllResults.length > 0) {
    categories.push({ title: 'Trending Today', items: trendingAllResults });
  }

  if (trendingMovies.length > 0) {
    categories.push({ title: 'Popular Movies', items: trendingMovies });
  }

  if (trendingTVOnly.length > 0) {
    categories.push({ title: 'Popular TV Shows', items: trendingTVOnly });
  }

  if (trendingAnime.length > 0) {
    categories.push({ title: 'Popular Anime', items: trendingAnime });
  }

  return categories;
}

// ============ Conversion Helper ============

/**
 * Convert a SearchResult to a media item format suitable for adding to a list
 */
export function searchResultToMediaItem(result: SearchResult): {
  title: string;
  type: MediaType;
  current: number;
  total: number | null;
  status: 'WATCHING' | 'READING' | 'PLAN_TO_WATCH';
  imageUrl?: string;
  refId: string;
} {
  const isReadable = result.type === 'MANGA' || result.type === 'BOOK' || result.type === 'LIGHT_NOVEL' || result.type === 'COMIC';
  return {
    title: result.title,
    type: result.type,
    current: 0,
    total: result.total,
    status: isReadable ? 'READING' : 'PLAN_TO_WATCH',
    imageUrl: result.imageUrl,
    refId: result.id,
  };
}

// ============ Re-exports for Controller ============

export { isValidProvider, getProviderInfo };
