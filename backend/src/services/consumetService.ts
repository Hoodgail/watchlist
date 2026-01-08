/**
 * Consumet Service - Unified API for all Consumet providers
 * 
 * This service provides a high-level interface to interact with various media providers
 * using the @consumet/extensions SDK.
 */

// Re-export all types
export * from './consumet/types.js';
export * from './consumet/providerRegistry.js';

// Import providers
import * as animeProviders from './consumet/animeProviders.js';
import * as movieProviders from './consumet/movieProviders.js';
import * as mangaProviders from './consumet/mangaProviders.js';
import * as metaProviders from './consumet/metaProviders.js';
import * as bookProviders from './consumet/bookProviders.js';
import * as lightNovelProviders from './consumet/lightNovelProviders.js';
import * as comicProviders from './consumet/comicProviders.js';

import { 
  ProviderName,
  AnimeProviderName,
  MovieProviderName,
  MangaProviderName,
  MetaProviderName,
  BookProviderName,
  LightNovelProviderName,
  ComicProviderName,
  UnifiedSearchResult,
  UnifiedMediaInfo,
  UnifiedSourceResult,
  UnifiedChapterPages,
  UnifiedBookResult,
  UnifiedServer,
  SearchOptions,
  PaginatedResults,
  MediaCategory,
} from './consumet/types.js';

import {
  ANIME_PROVIDERS,
  MOVIE_PROVIDERS,
  MANGA_PROVIDERS,
  getProviderInfo,
  isValidProvider,
} from './consumet/providerRegistry.js';

// ============ Unified Search Functions ============

/**
 * Search across any provider
 */
export async function search(
  query: string,
  provider: ProviderName,
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult | UnifiedBookResult>> {
  // Anime providers
  if (ANIME_PROVIDERS.includes(provider as AnimeProviderName)) {
    return animeProviders.searchAnime(query, provider as AnimeProviderName, options);
  }
  
  // Movie providers
  if (MOVIE_PROVIDERS.includes(provider as MovieProviderName)) {
    return movieProviders.searchMovies(query, provider as MovieProviderName, options);
  }
  
  // Manga providers
  if (MANGA_PROVIDERS.includes(provider as MangaProviderName)) {
    return mangaProviders.searchManga(query, provider as MangaProviderName, options);
  }
  
  // Meta providers
  if (['anilist', 'anilist-manga', 'tmdb'].includes(provider)) {
    return metaProviders.searchMeta(query, provider as MetaProviderName, options);
  }
  
  // Book providers
  if (provider === 'libgen') {
    return bookProviders.searchBooks(query, provider as BookProviderName, options);
  }
  
  // Light novel providers
  if (provider === 'novelupdates') {
    return lightNovelProviders.searchLightNovels(query, provider as LightNovelProviderName, options);
  }
  
  // Comic providers
  if (provider === 'getcomics') {
    return comicProviders.searchComics(query, provider as ComicProviderName, options);
  }
  
  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Search by category (uses default provider for category)
 */
export async function searchByCategory(
  query: string,
  category: MediaCategory,
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult | UnifiedBookResult>> {
  switch (category) {
    case 'anime':
      return metaProviders.searchAnilistAnime(query, options);
    case 'movie':
    case 'tv':
      return movieProviders.searchMovies(query, 'flixhq', options);
    case 'manga':
      return mangaProviders.searchManga(query, 'mangadex', options);
    case 'book':
      return bookProviders.searchBooks(query, 'libgen', options);
    case 'lightnovel':
      return lightNovelProviders.searchLightNovels(query, 'novelupdates', options);
    case 'comic':
      return comicProviders.searchComics(query, 'getcomics', options);
    default:
      return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

// ============ Unified Info Functions ============

/**
 * Get media info from any provider
 */
export async function getInfo(
  id: string,
  provider: ProviderName,
  mediaType?: 'movie' | 'tv'
): Promise<UnifiedMediaInfo | null> {
  // Anime providers
  if (ANIME_PROVIDERS.includes(provider as AnimeProviderName)) {
    return animeProviders.getAnimeInfo(id, provider as AnimeProviderName);
  }
  
  // Movie providers
  if (MOVIE_PROVIDERS.includes(provider as MovieProviderName)) {
    return movieProviders.getMovieInfo(id, provider as MovieProviderName);
  }
  
  // Manga providers
  if (MANGA_PROVIDERS.includes(provider as MangaProviderName)) {
    return mangaProviders.getMangaInfo(id, provider as MangaProviderName);
  }
  
  // Meta providers
  if (['anilist', 'anilist-manga', 'tmdb'].includes(provider)) {
    return metaProviders.getMetaInfo(id, provider as MetaProviderName, mediaType);
  }
  
  // Light novel providers
  if (provider === 'novelupdates') {
    return lightNovelProviders.getLightNovelInfo(id, provider as LightNovelProviderName);
  }
  
  return null;
}

// ============ Unified Source Functions ============

/**
 * Get streaming sources for an episode
 */
export async function getEpisodeSources(
  episodeId: string,
  provider: ProviderName,
  mediaId?: string
): Promise<UnifiedSourceResult | null> {
  // Anime providers
  if (ANIME_PROVIDERS.includes(provider as AnimeProviderName)) {
    return animeProviders.getEpisodeSources(episodeId, provider as AnimeProviderName);
  }
  
  // Movie providers (require mediaId)
  if (MOVIE_PROVIDERS.includes(provider as MovieProviderName)) {
    if (!mediaId) throw new Error('mediaId is required for movie providers');
    return movieProviders.getEpisodeSources(episodeId, mediaId, provider as MovieProviderName);
  }
  
  // Meta providers
  if (provider === 'anilist') {
    return metaProviders.getAnilistEpisodeSources(episodeId);
  }
  
  if (provider === 'tmdb') {
    if (!mediaId) throw new Error('mediaId is required for TMDB');
    return metaProviders.getTMDBEpisodeSources(episodeId, mediaId);
  }
  
  return null;
}

/**
 * Get episode servers
 */
export async function getEpisodeServers(
  episodeId: string,
  provider: ProviderName,
  mediaId?: string
): Promise<UnifiedServer[]> {
  // Anime providers
  if (ANIME_PROVIDERS.includes(provider as AnimeProviderName)) {
    return animeProviders.getEpisodeServers(episodeId, provider as AnimeProviderName);
  }
  
  // Movie providers
  if (MOVIE_PROVIDERS.includes(provider as MovieProviderName)) {
    if (!mediaId) throw new Error('mediaId is required for movie providers');
    return movieProviders.getEpisodeServers(episodeId, mediaId, provider as MovieProviderName);
  }
  
  return [];
}

/**
 * Get chapter pages for manga
 * Note: Meta providers like 'anilist-manga' don't provide chapter pages directly
 */
export async function getChapterPages(
  chapterId: string,
  provider: MangaProviderName | 'anilist-manga'
): Promise<UnifiedChapterPages | null> {
  // Meta providers don't provide chapter pages - they only aggregate metadata
  if (provider === 'anilist-manga') {
    console.warn('anilist-manga provider does not support chapter pages. Use a direct manga provider like mangadex.');
    return null;
  }
  return mangaProviders.getChapterPages(chapterId, provider);
}

// ============ Trending/Discovery Functions ============

/**
 * Get trending anime
 */
export async function getTrendingAnime(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  return metaProviders.getTrendingAnime(page, perPage);
}

/**
 * Get popular anime
 */
export async function getPopularAnime(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  return metaProviders.getPopularAnime(page, perPage);
}

/**
 * Get trending movies
 */
export async function getTrendingMovies(): Promise<UnifiedSearchResult[]> {
  return movieProviders.getTrendingMovies();
}

/**
 * Get trending TV shows
 */
export async function getTrendingTVShows(): Promise<UnifiedSearchResult[]> {
  return movieProviders.getTrendingTVShows();
}

/**
 * Get popular manga
 */
export async function getPopularManga(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  return mangaProviders.getPopularManga(page, perPage);
}

/**
 * Get latest updated manga
 */
export async function getLatestManga(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  return mangaProviders.getLatestUpdatedManga(page, perPage);
}

/**
 * Get anime airing schedule
 */
export async function getAiringSchedule(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  return metaProviders.getAiringSchedule(page, perPage);
}

// ============ Helper Functions ============

/**
 * Get preferred title from anime/manga result
 */
export function getPreferredTitle(title: UnifiedSearchResult['title'] | { romaji?: string; english?: string; native?: string; userPreferred?: string }): string {
  if (typeof title === 'string') return title;
  return title.english || title.romaji || title.native || title.userPreferred || 'Unknown';
}

/**
 * Extract year from release date
 */
export function extractYear(releaseDate?: string | number): number | undefined {
  if (typeof releaseDate === 'number') return releaseDate;
  if (typeof releaseDate === 'string') {
    const year = parseInt(releaseDate);
    return isNaN(year) ? undefined : year;
  }
  return undefined;
}

// ============ Legacy Exports (for backwards compatibility) ============

// Re-export types that might be used elsewhere
export type { 
  UnifiedSearchResult as ConsumetAnimeResult,
  AnimeProviderName,
  MovieProviderName,
  MangaProviderName,
  MetaProviderName,
};

// Legacy function aliases
export const searchAnimeAnilist = metaProviders.searchAnilistAnime;
export const getAnimeInfo = metaProviders.getAnilistAnimeInfo;

// Export provider registries
export { 
  ANIME_PROVIDERS, 
  MOVIE_PROVIDERS, 
  MANGA_PROVIDERS,
  getProviderInfo,
  isValidProvider,
};
