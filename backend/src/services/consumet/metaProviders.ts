/**
 * Meta Providers - Anilist (anime & manga) and TMDB
 * These are "meta" providers that aggregate data from multiple sources
 */

import { META } from '@consumet/extensions';
import type { IAnimeResult, IAnimeInfo, IMangaResult, IMangaInfo, IMovieResult, IMovieInfo, ISource, ISearch } from '@consumet/extensions';
import { 
  MetaProviderName, 
  UnifiedSearchResult, 
  UnifiedMediaInfo, 
  UnifiedEpisode,
  UnifiedChapter,
  UnifiedSeason,
  UnifiedSourceResult,
  SearchOptions,
  PaginatedResults,
} from './types.js';

// ============ Provider Instances ============

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

function getAnilistProvider() {
  return new META.Anilist();
}

function getAnilistMangaProvider() {
  // Note: Anilist.Manga may not exist in all SDK versions
  try {
    return new (META.Anilist as any).Manga();
  } catch {
    // Fallback: return main Anilist provider
    return new META.Anilist();
  }
}

function getTMDBProvider() {
  return new META.TMDB(TMDB_API_KEY);
}

// ============ Helper Functions ============

function extractTitle(title: unknown): string {
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object' && !Array.isArray(title)) {
    const t = title as Record<string, string | undefined>;
    return t.english || t.romaji || t.native || 'Unknown';
  }
  return 'Unknown';
}

function extractAltTitles(title: unknown): string[] | undefined {
  if (title && typeof title === 'object' && !Array.isArray(title)) {
    const t = title as Record<string, string | undefined>;
    return [t.romaji, t.native, t.english].filter((v): v is string => !!v);
  }
  return undefined;
}

function extractDescription(description: unknown): string | undefined {
  if (typeof description === 'string') return description;
  if (description && typeof description === 'object' && !Array.isArray(description)) {
    const d = description as Record<string, string>;
    return d.en || d.english || Object.values(d)[0];
  }
  return undefined;
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function safeStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return undefined;
}

// ============ Anime Result Converters ============

function convertAnilistAnimeResult(result: IAnimeResult): UnifiedSearchResult {
  return {
    id: String(result.id),
    title: extractTitle(result.title),
    altTitles: extractAltTitles(result.title),
    image: result.image,
    cover: result.cover,
    description: extractDescription(result.description),
    type: result.type,
    status: result.status as string | undefined,
    releaseDate: result.releaseDate as string | number | undefined,
    year: typeof result.releaseDate === 'number' ? result.releaseDate : undefined,
    rating: typeof result.rating === 'number' ? result.rating : undefined,
    genres: Array.isArray(result.genres) ? result.genres : undefined,
    totalEpisodes: result.totalEpisodes ?? null,
    duration: result.duration as string | number | undefined,
    subOrDub: result.subOrDub as 'sub' | 'dub' | 'both' | undefined,
    provider: 'anilist',
    url: result.url,
  };
}

function convertAnilistAnimeInfo(info: IAnimeInfo): UnifiedMediaInfo {
  return {
    id: String(info.id),
    title: extractTitle(info.title),
    altTitles: extractAltTitles(info.title),
    image: info.image,
    cover: info.cover,
    description: extractDescription(info.description),
    type: info.type,
    status: info.status as string | undefined,
    releaseDate: info.releaseDate as string | number | undefined,
    year: typeof info.releaseDate === 'number' ? info.releaseDate : undefined,
    rating: typeof info.rating === 'number' ? info.rating : undefined,
    genres: Array.isArray(info.genres) ? info.genres : undefined,
    studios: info.studios,
    totalEpisodes: info.totalEpisodes ?? null,
    duration: info.duration as string | number | undefined,
    subOrDub: info.subOrDub as 'sub' | 'dub' | 'both' | undefined,
    episodes: info.episodes?.map((ep): UnifiedEpisode => ({
      id: String(ep.id),
      number: ep.number ?? 0,
      title: ep.title,
      description: ep.description,
      image: ep.image,
      releaseDate: ep.releaseDate,
      isFiller: ep.isFiller,
      url: ep.url,
    })),
    similar: info.recommendations?.map(r => convertAnilistAnimeResult(r as IAnimeResult)),
    recommendations: info.recommendations?.map(r => convertAnilistAnimeResult(r as IAnimeResult)),
    provider: 'anilist',
    url: info.url,
  };
}

// ============ Manga Result Converters ============

function convertAnilistMangaResult(result: IMangaResult): UnifiedSearchResult {
  return {
    id: String(result.id),
    title: extractTitle(result.title),
    altTitles: extractAltTitles(result.title),
    image: result.image,
    cover: safeString(result.cover),
    description: extractDescription(result.description),
    status: safeString(result.status),
    releaseDate: safeString(result.releaseDate as unknown) ?? safeNumber(result.releaseDate),
    year: typeof result.releaseDate === 'number' ? result.releaseDate : undefined,
    rating: safeNumber(result.rating),
    genres: safeStringArray(result.genres),
    totalChapters: null,
    provider: 'anilist-manga',
    url: safeString(result.url),
  };
}

function convertAnilistMangaInfo(info: IMangaInfo): UnifiedMediaInfo {
  return {
    id: String(info.id),
    title: extractTitle(info.title),
    altTitles: extractAltTitles(info.title),
    image: info.image,
    cover: safeString(info.cover),
    description: extractDescription(info.description),
    status: safeString(info.status),
    releaseDate: safeString(info.releaseDate as unknown) ?? safeNumber(info.releaseDate),
    year: typeof info.releaseDate === 'number' ? info.releaseDate : undefined,
    rating: safeNumber(info.rating),
    genres: safeStringArray(info.genres),
    totalChapters: info.chapters?.length ?? null,
    chapters: info.chapters?.map((ch): UnifiedChapter => ({
      id: String(ch.id),
      number: (ch as any).chapterNumber ?? (ch as any).number ?? 0,
      title: ch.title,
      releaseDate: safeString((ch as any).releasedDate) ?? safeString((ch as any).releaseDate),
      pages: ch.pages,
      url: safeString(ch.url),
      volume: safeString((ch as any).volumeNumber) ?? safeString((ch as any).volume),
    })),
    similar: info.recommendations?.map(r => convertAnilistMangaResult(r as IMangaResult)),
    recommendations: info.recommendations?.map(r => convertAnilistMangaResult(r as IMangaResult)),
    provider: 'anilist-manga',
    url: safeString(info.url),
  };
}

// ============ TMDB Result Converters ============

function convertTMDBResult(result: IMovieResult): UnifiedSearchResult {
  return {
    id: String(result.id),
    title: extractTitle(result.title),
    image: result.image,
    cover: safeString(result.cover),
    type: result.type,
    releaseDate: result.releaseDate,
    year: typeof result.releaseDate === 'string' ? parseInt(result.releaseDate) : result.releaseDate,
    rating: safeNumber(result.rating),
    provider: 'tmdb',
    url: result.url,
  };
}

function convertTMDBInfo(info: IMovieInfo): UnifiedMediaInfo {
  // Handle episodes based on structure
  let episodes: UnifiedEpisode[] | undefined;
  let seasons: UnifiedSeason[] | undefined;

  if (info.episodes && Array.isArray(info.episodes)) {
    const hasSeasons = info.episodes.some((ep: any) => ep.season !== undefined);
    
    if (hasSeasons) {
      const seasonMap = new Map<number, UnifiedEpisode[]>();
      for (const ep of info.episodes) {
        const seasonNum = (ep as any).season ?? 1;
        if (!seasonMap.has(seasonNum)) {
          seasonMap.set(seasonNum, []);
        }
        seasonMap.get(seasonNum)!.push({
          id: String(ep.id),
          number: ep.number ?? 0,
          title: ep.title,
          description: ep.description,
          image: ep.image,
          releaseDate: ep.releaseDate,
          url: ep.url,
          season: seasonNum,
        });
      }
      
      seasons = Array.from(seasonMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([season, eps]) => ({
          season,
          episodes: eps.sort((a, b) => a.number - b.number),
        }));
    } else {
      episodes = info.episodes.map((ep): UnifiedEpisode => ({
        id: String(ep.id),
        number: ep.number ?? 0,
        title: ep.title,
        description: ep.description,
        image: ep.image,
        releaseDate: ep.releaseDate,
        url: ep.url,
      }));
    }
  }

  return {
    id: String(info.id),
    title: extractTitle(info.title),
    image: info.image,
    cover: safeString(info.cover),
    description: safeString(info.description),
    type: info.type,
    status: info.status,
    releaseDate: info.releaseDate,
    year: typeof info.releaseDate === 'string' ? parseInt(info.releaseDate) : info.releaseDate,
    rating: safeNumber(info.rating),
    genres: safeStringArray(info.genres),
    directors: safeStringArray(info.directors),
    writers: safeStringArray(info.writers),
    actors: safeStringArray(info.actors),
    duration: info.duration,
    totalEpisodes: info.totalEpisodes ?? null,
    totalSeasons: safeNumber(info.totalSeasons),
    episodes,
    seasons,
    similar: Array.isArray(info.similar) ? info.similar.map((r: any) => convertTMDBResult(r as IMovieResult)) : undefined,
    recommendations: Array.isArray(info.recommendations) ? info.recommendations.map((r: any) => convertTMDBResult(r as IMovieResult)) : undefined,
    provider: 'tmdb',
    url: info.url,
  };
}

function convertSources(source: ISource): UnifiedSourceResult {
  return {
    headers: source.headers,
    sources: source.sources?.map(s => ({
      url: s.url,
      quality: s.quality,
      isM3U8: s.isM3U8,
    })) ?? [],
    subtitles: source.subtitles?.map(s => ({
      url: s.url,
      lang: s.lang,
    })),
    intro: source.intro,
    outro: source.outro,
    download: typeof source.download === 'string' ? source.download : undefined,
  };
}

// ============ Anilist Anime Functions ============

/**
 * Search anime using Anilist
 */
export async function searchAnilistAnime(
  query: string,
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getAnilistProvider();
    const result = await provider.search(query, options.page, options.perPage);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      totalResults: searchResult.totalResults,
      results: searchResult.results?.map(r => convertAnilistAnimeResult(r)) ?? [],
    };
  } catch (error) {
    console.error('Anilist anime search error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get anime info from Anilist
 */
export async function getAnilistAnimeInfo(
  id: string,
  dub: boolean = false
): Promise<UnifiedMediaInfo | null> {
  try {
    const provider = getAnilistProvider();
    const info = await provider.fetchAnimeInfo(id, dub);
    return convertAnilistAnimeInfo(info);
  } catch (error) {
    console.error('Anilist anime info error:', error);
    return null;
  }
}

/**
 * Get episode sources from Anilist
 */
export async function getAnilistEpisodeSources(
  episodeId: string
): Promise<UnifiedSourceResult | null> {
  try {
    const provider = getAnilistProvider();
    const sources = await provider.fetchEpisodeSources(episodeId);
    return convertSources(sources);
  } catch (error) {
    console.error('Anilist episode sources error:', error);
    return null;
  }
}

/**
 * Get trending anime from Anilist
 */
export async function getTrendingAnime(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getAnilistProvider();
    const result = await provider.fetchTrendingAnime(page, perPage);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      results: searchResult.results?.map(r => convertAnilistAnimeResult(r)) ?? [],
    };
  } catch (error) {
    console.error('Trending anime error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get popular anime from Anilist
 */
export async function getPopularAnime(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getAnilistProvider();
    const result = await provider.fetchPopularAnime(page, perPage);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      results: searchResult.results?.map(r => convertAnilistAnimeResult(r)) ?? [],
    };
  } catch (error) {
    console.error('Popular anime error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get anime by genres from Anilist
 */
export async function getAnimeByGenres(
  genres: string[],
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getAnilistProvider();
    const result = await provider.fetchAnimeGenres(genres, page, perPage);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      results: searchResult.results?.map(r => convertAnilistAnimeResult(r)) ?? [],
    };
  } catch (error) {
    console.error('Anime by genres error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get airing schedule from Anilist
 */
export async function getAiringSchedule(
  page: number = 1,
  perPage: number = 20,
  weekStart?: number,
  weekEnd?: number
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getAnilistProvider();
    const result = await provider.fetchAiringSchedule(page, perPage, weekStart, weekEnd);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      results: searchResult.results?.map(r => convertAnilistAnimeResult(r)) ?? [],
    };
  } catch (error) {
    console.error('Airing schedule error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

// ============ Anilist Manga Functions ============

/**
 * Search manga using Anilist
 */
export async function searchAnilistManga(
  query: string,
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getAnilistMangaProvider();
    const result = await provider.search(query, options.page, options.perPage);
    const searchResult = result as ISearch<IMangaResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      totalResults: searchResult.totalResults,
      results: searchResult.results?.map(r => convertAnilistMangaResult(r)) ?? [],
    };
  } catch (error) {
    console.error('Anilist manga search error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get manga info from Anilist
 */
export async function getAnilistMangaInfo(
  id: string
): Promise<UnifiedMediaInfo | null> {
  try {
    const provider = getAnilistMangaProvider();
    const info = await (provider as any).fetchMangaInfo(id);
    return convertAnilistMangaInfo(info);
  } catch (error) {
    console.error('Anilist manga info error:', error);
    return null;
  }
}

// ============ TMDB Functions ============

/**
 * Search movies/TV using TMDB
 */
export async function searchTMDB(
  query: string,
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    if (!TMDB_API_KEY) {
      console.warn('TMDB API key not configured');
      return { currentPage: 1, hasNextPage: false, results: [] };
    }
    
    const provider = getTMDBProvider();
    const result = await provider.search(query, options.page);
    const searchResult = result as ISearch<IMovieResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      totalResults: searchResult.totalResults,
      results: searchResult.results?.map(r => convertTMDBResult(r)) ?? [],
    };
  } catch (error) {
    console.error('TMDB search error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get movie/TV info from TMDB
 */
export async function getTMDBInfo(
  id: string,
  type: 'movie' | 'tv'
): Promise<UnifiedMediaInfo | null> {
  try {
    if (!TMDB_API_KEY) {
      console.warn('TMDB API key not configured');
      return null;
    }
    
    const provider = getTMDBProvider();
    const info = await provider.fetchMediaInfo(id, type);
    return convertTMDBInfo(info as IMovieInfo);
  } catch (error) {
    console.error('TMDB info error:', error);
    return null;
  }
}

/**
 * Get episode sources from TMDB
 */
export async function getTMDBEpisodeSources(
  episodeId: string,
  mediaId: string
): Promise<UnifiedSourceResult | null> {
  try {
    if (!TMDB_API_KEY) {
      console.warn('TMDB API key not configured');
      return null;
    }
    
    const provider = getTMDBProvider();
    const sources = await provider.fetchEpisodeSources(episodeId, mediaId);
    return convertSources(sources);
  } catch (error) {
    console.error('TMDB episode sources error:', error);
    return null;
  }
}

/**
 * Get trending from TMDB
 */
export async function getTMDBTrending(
  type: 'movie' | 'tv' | 'people' | 'all' = 'all',
  timePeriod: 'day' | 'week' = 'week',
  page: number = 1
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    if (!TMDB_API_KEY) {
      console.warn('TMDB API key not configured');
      return { currentPage: 1, hasNextPage: false, results: [] };
    }
    
    const provider = getTMDBProvider();
    const result = await provider.fetchTrending(type, timePeriod, page);
    const searchResult = result as ISearch<IMovieResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      results: searchResult.results?.map(r => convertTMDBResult(r)) ?? [],
    };
  } catch (error) {
    console.error('TMDB trending error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

// ============ Unified Meta Search ============

/**
 * Search across meta provider based on type
 */
export async function searchMeta(
  query: string,
  providerName: MetaProviderName,
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult>> {
  switch (providerName) {
    case 'anilist':
      return searchAnilistAnime(query, options);
    case 'anilist-manga':
      return searchAnilistManga(query, options);
    case 'tmdb':
      return searchTMDB(query, options);
    default:
      return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get media info from meta provider
 */
export async function getMetaInfo(
  id: string,
  providerName: MetaProviderName,
  mediaType?: 'movie' | 'tv'
): Promise<UnifiedMediaInfo | null> {
  switch (providerName) {
    case 'anilist':
      return getAnilistAnimeInfo(id);
    case 'anilist-manga':
      return getAnilistMangaInfo(id);
    case 'tmdb':
      return getTMDBInfo(id, mediaType ?? 'movie');
    default:
      return null;
  }
}
