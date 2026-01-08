/**
 * Movie/TV Providers - FlixHQ, Goku, SFlix, HiMovies, DramaCool
 */

import { MOVIES } from '@consumet/extensions';
import type { IMovieResult, IMovieInfo, ISource, IEpisodeServer, ISearch } from '@consumet/extensions';
import { 
  MovieProviderName, 
  UnifiedSearchResult, 
  UnifiedMediaInfo, 
  UnifiedEpisode,
  UnifiedSeason,
  UnifiedSourceResult,
  UnifiedServer,
  SearchOptions,
  PaginatedResults,
} from './types.js';

// ============ Provider Instances ============

type MovieProvider = InstanceType<typeof MOVIES.FlixHQ> | InstanceType<typeof MOVIES.Goku> | InstanceType<typeof MOVIES.SFlix> | InstanceType<typeof MOVIES.DramaCool>;

const providers: Record<MovieProviderName, () => MovieProvider> = {
  flixhq: () => new MOVIES.FlixHQ(),
  goku: () => new MOVIES.Goku(),
  sflix: () => new MOVIES.SFlix(),
  himovies: () => new MOVIES.FlixHQ(), // HiMovies uses same interface as FlixHQ
  dramacool: () => new MOVIES.DramaCool(),
};

function getProvider(name: MovieProviderName): MovieProvider {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown movie provider: ${name}`);
  }
  return factory();
}

// ============ Helper Functions ============

function extractTitle(title: unknown): string {
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object') {
    const t = title as Record<string, string | undefined>;
    return t.english || t.romaji || t.native || 'Unknown';
  }
  return 'Unknown';
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

// ============ Result Converters ============

function convertMovieResult(result: IMovieResult, provider: MovieProviderName): UnifiedSearchResult {
  return {
    id: String(result.id),
    title: extractTitle(result.title),
    image: result.image,
    cover: safeString(result.cover),
    type: result.type,
    releaseDate: result.releaseDate,
    year: typeof result.releaseDate === 'string' ? parseInt(result.releaseDate) : result.releaseDate,
    rating: safeNumber(result.rating),
    provider,
    url: result.url,
  };
}

function convertMovieInfo(info: IMovieInfo, provider: MovieProviderName): UnifiedMediaInfo {
  // Handle episodes based on structure
  let episodes: UnifiedEpisode[] | undefined;
  let seasons: UnifiedSeason[] | undefined;

  if (info.episodes && Array.isArray(info.episodes)) {
    // Check if episodes have season info
    const hasSeasons = info.episodes.some((ep: { season?: number }) => ep.season !== undefined);
    
    if (hasSeasons) {
      // Group by season
      const seasonMap = new Map<number, UnifiedEpisode[]>();
      for (const ep of info.episodes) {
        const seasonNum = (ep as { season?: number }).season ?? 1;
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
    similar: Array.isArray(info.similar) ? info.similar.map((r: any) => convertMovieResult(r as IMovieResult, provider)) : undefined,
    recommendations: Array.isArray(info.recommendations) ? info.recommendations.map((r: any) => convertMovieResult(r as IMovieResult, provider)) : undefined,
    provider,
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

function convertServers(servers: IEpisodeServer[]): UnifiedServer[] {
  return servers.map(s => ({
    name: s.name,
    url: s.url,
  }));
}

// ============ API Functions ============

/**
 * Search movies/TV across a specific provider
 */
export async function searchMovies(
  query: string,
  providerName: MovieProviderName = 'flixhq',
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getProvider(providerName);
    const result = await provider.search(query, options.page);
    
    const searchResult = result as ISearch<IMovieResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      totalResults: searchResult.totalResults,
      results: searchResult.results?.map(r => convertMovieResult(r, providerName)) ?? [],
    };
  } catch (error) {
    console.error(`Movie search error (${providerName}):`, error);
    return {
      currentPage: 1,
      hasNextPage: false,
      results: [],
    };
  }
}

/**
 * Get movie/TV info from a specific provider
 */
export async function getMovieInfo(
  id: string,
  providerName: MovieProviderName = 'flixhq'
): Promise<UnifiedMediaInfo | null> {
  try {
    const provider = getProvider(providerName);
    const info = await provider.fetchMediaInfo(id);
    return convertMovieInfo(info, providerName);
  } catch (error) {
    console.error(`Movie info error (${providerName}):`, error);
    return null;
  }
}

/**
 * Get episode streaming sources
 */
export async function getEpisodeSources(
  episodeId: string,
  mediaId: string,
  providerName: MovieProviderName = 'flixhq'
): Promise<UnifiedSourceResult | null> {
  try {
    const provider = getProvider(providerName);
    const sources = await (provider as any).fetchEpisodeSources(episodeId, mediaId);
    return convertSources(sources);
  } catch (error) {
    console.error(`Episode sources error (${providerName}):`, error);
    return null;
  }
}

/**
 * Get episode servers (available streaming servers)
 */
export async function getEpisodeServers(
  episodeId: string,
  mediaId: string,
  providerName: MovieProviderName = 'flixhq'
): Promise<UnifiedServer[]> {
  try {
    const provider = getProvider(providerName);
    const servers = await (provider as any).fetchEpisodeServers(episodeId, mediaId);
    return convertServers(servers);
  } catch (error) {
    console.error(`Episode servers error (${providerName}):`, error);
    return [];
  }
}

// ============ FlixHQ-Specific Functions ============

/**
 * Get recent movies (FlixHQ only)
 */
export async function getRecentMovies(): Promise<UnifiedSearchResult[]> {
  try {
    const provider = new MOVIES.FlixHQ();
    const results = await provider.fetchRecentMovies();
    return (results as IMovieResult[]).map(r => convertMovieResult(r, 'flixhq'));
  } catch (error) {
    console.error('Recent movies error:', error);
    return [];
  }
}

/**
 * Get recent TV shows (FlixHQ only)
 */
export async function getRecentTVShows(): Promise<UnifiedSearchResult[]> {
  try {
    const provider = new MOVIES.FlixHQ();
    const results = await provider.fetchRecentTvShows();
    return (results as IMovieResult[]).map(r => convertMovieResult(r, 'flixhq'));
  } catch (error) {
    console.error('Recent TV shows error:', error);
    return [];
  }
}

/**
 * Get trending movies (FlixHQ only)
 */
export async function getTrendingMovies(): Promise<UnifiedSearchResult[]> {
  try {
    const provider = new MOVIES.FlixHQ();
    const results = await provider.fetchTrendingMovies();
    return (results as IMovieResult[]).map(r => convertMovieResult(r, 'flixhq'));
  } catch (error) {
    console.error('Trending movies error:', error);
    return [];
  }
}

/**
 * Get trending TV shows (FlixHQ only)
 */
export async function getTrendingTVShows(): Promise<UnifiedSearchResult[]> {
  try {
    const provider = new MOVIES.FlixHQ();
    const results = await provider.fetchTrendingTvShows();
    return (results as IMovieResult[]).map(r => convertMovieResult(r, 'flixhq'));
  } catch (error) {
    console.error('Trending TV shows error:', error);
    return [];
  }
}

/**
 * Get spotlight (FlixHQ only)
 */
export async function getSpotlight(): Promise<UnifiedSearchResult[]> {
  try {
    const provider = new MOVIES.FlixHQ();
    const result = await provider.fetchSpotlight();
    const searchResult = result as ISearch<IMovieResult>;
    return searchResult.results?.map(r => convertMovieResult(r, 'flixhq')) ?? [];
  } catch (error) {
    console.error('Spotlight error:', error);
    return [];
  }
}

/**
 * Get movies/TV by genre (FlixHQ only)
 */
export async function getByGenre(
  genre: string,
  page: number = 1
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = new MOVIES.FlixHQ();
    const result = await provider.fetchByGenre(genre, page);
    const searchResult = result as ISearch<IMovieResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      results: searchResult.results?.map(r => convertMovieResult(r, 'flixhq')) ?? [],
    };
  } catch (error) {
    console.error('By genre error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get movies/TV by country (FlixHQ only)
 */
export async function getByCountry(
  country: string,
  page: number = 1
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = new MOVIES.FlixHQ();
    const result = await provider.fetchByCountry(country, page);
    const searchResult = result as ISearch<IMovieResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      results: searchResult.results?.map(r => convertMovieResult(r, 'flixhq')) ?? [],
    };
  } catch (error) {
    console.error('By country error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}
