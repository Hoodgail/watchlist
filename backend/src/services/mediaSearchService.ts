import * as tmdbService from './tmdbService.js';
import * as consumetService from './consumetService.js';
import * as mangadexService from './mangadexService.js';

// ============ Types ============

export type MediaSource = 'tmdb' | 'consumet-anilist' | 'mangadex';
export type MediaType = 'TV' | 'MOVIE' | 'ANIME' | 'MANGA';
export type SearchCategory = 'all' | 'tv' | 'movie' | 'anime' | 'manga';

export interface SearchResult {
  id: string;           // Prefixed: "tmdb:123", "consumet-anilist:abc", "mangadex:xyz"
  title: string;
  type: MediaType;
  total: number | null;
  imageUrl?: string;
  year?: number;
  overview?: string;
  source: MediaSource;
}

export interface TrendingCategory {
  title: string;
  items: SearchResult[];
}

export interface SearchOptions {
  year?: string;
  includeAdult?: boolean;
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
 * Convert Consumet anime result to SearchResult
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
  // Try Consumet Anilist first (better anime data)
  const consumetResults = await consumetService.searchAnimeAnilist(query, 1, 10);
  
  if (consumetResults.length > 0) {
    return consumetResults.slice(0, 5).map(consumetAnimeToSearchResult);
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
 * Search manga using MangaDex
 */
async function searchMangaItems(query: string): Promise<SearchResult[]> {
  try {
    const { results } = await mangadexService.searchManga(query, 5, 0);
    return results.map(mangadexToSearchResult);
  } catch (error) {
    console.error('MangaDex search error:', error);
    return [];
  }
}

/**
 * Search all sources using TMDB multi endpoint + MangaDex + Consumet
 */
async function searchAll(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  // Search all sources in parallel
  const [tmdbMultiResults, mangaResults, animeResults] = await Promise.all([
    tmdbService.searchTMDBMulti(query, options),
    searchMangaItems(query),
    consumetService.searchAnimeAnilist(query, 1, 5),
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
  const consumetSearchResults = animeResults.map(consumetAnimeToSearchResult);

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
      return searchMangaItems(query);
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
  const results = await consumetService.getTrendingAnime(1, 20);
  return results.map(consumetAnimeToSearchResult);
}

/**
 * Get popular anime from Consumet Anilist
 */
export async function getPopularAnime(): Promise<SearchResult[]> {
  const results = await consumetService.getPopularAnime(1, 20);
  return results.map(consumetAnimeToSearchResult);
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
  return {
    title: result.title,
    type: result.type,
    current: 0,
    total: result.total,
    status: result.type === 'MANGA' ? 'READING' : 'PLAN_TO_WATCH',
    imageUrl: result.imageUrl,
    refId: result.id,
  };
}
