/**
 * Anime Providers - HiAnime, AnimePahe, AnimeKai, KickAssAnime
 */

import { ANIME } from '@consumet/extensions';
import type { IAnimeResult, IAnimeInfo, ISource, IEpisodeServer, ISearch } from '@consumet/extensions';
import { 
  AnimeProviderName, 
  UnifiedSearchResult, 
  UnifiedMediaInfo, 
  UnifiedEpisode,
  UnifiedSourceResult,
  UnifiedServer,
  SearchOptions,
  PaginatedResults,
} from './types.js';

// ============ Provider Instances ============

const providers: Record<AnimeProviderName, () => InstanceType<typeof ANIME.Hianime> | InstanceType<typeof ANIME.AnimePahe> | InstanceType<typeof ANIME.AnimeKai> | InstanceType<typeof ANIME.KickAssAnime>> = {
  hianime: () => new ANIME.Hianime(),
  animepahe: () => new ANIME.AnimePahe(),
  animekai: () => new ANIME.AnimeKai(),
  kickassanime: () => new ANIME.KickAssAnime(),
};

function getProvider(name: AnimeProviderName) {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown anime provider: ${name}`);
  }
  return factory();
}

// ============ Result Converters ============

function convertAnimeResult(result: IAnimeResult, provider: AnimeProviderName): UnifiedSearchResult {
  return {
    id: String(result.id),
    title: typeof result.title === 'string' ? result.title : (result.title?.english || result.title?.romaji || result.title?.native || 'Unknown'),
    altTitles: typeof result.title === 'object' ? [result.title?.romaji, result.title?.native, result.title?.english].filter(Boolean) as string[] : undefined,
    image: result.image,
    cover: result.cover,
    description: result.description,
    type: result.type,
    status: result.status,
    releaseDate: result.releaseDate,
    year: typeof result.releaseDate === 'number' ? result.releaseDate : undefined,
    rating: result.rating,
    genres: result.genres,
    totalEpisodes: result.totalEpisodes ?? null,
    duration: result.duration,
    subOrDub: result.subOrDub as 'sub' | 'dub' | 'both' | undefined,
    provider,
    url: result.url,
  };
}

function convertAnimeInfo(info: IAnimeInfo, provider: AnimeProviderName): UnifiedMediaInfo {
  return {
    id: String(info.id),
    title: typeof info.title === 'string' ? info.title : (info.title?.english || info.title?.romaji || info.title?.native || 'Unknown'),
    altTitles: typeof info.title === 'object' ? [info.title?.romaji, info.title?.native, info.title?.english].filter(Boolean) as string[] : undefined,
    image: info.image,
    cover: info.cover,
    description: info.description,
    type: info.type,
    status: info.status,
    releaseDate: info.releaseDate,
    year: typeof info.releaseDate === 'number' ? info.releaseDate : undefined,
    rating: info.rating,
    genres: info.genres,
    studios: info.studios,
    totalEpisodes: info.totalEpisodes ?? null,
    duration: info.duration,
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
    similar: info.recommendations?.map(r => convertAnimeResult(r as IAnimeResult, provider)),
    recommendations: info.recommendations?.map(r => convertAnimeResult(r as IAnimeResult, provider)),
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
 * Search anime across a specific provider
 */
export async function searchAnime(
  query: string,
  providerName: AnimeProviderName = 'hianime',
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getProvider(providerName);
    const result = await provider.search(query, options.page);
    
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      totalResults: searchResult.totalResults,
      results: searchResult.results?.map(r => convertAnimeResult(r, providerName)) ?? [],
    };
  } catch (error) {
    console.error(`Anime search error (${providerName}):`, error);
    return {
      currentPage: 1,
      hasNextPage: false,
      results: [],
    };
  }
}

/**
 * Get anime info from a specific provider
 */
export async function getAnimeInfo(
  id: string,
  providerName: AnimeProviderName = 'hianime'
): Promise<UnifiedMediaInfo | null> {
  try {
    const provider = getProvider(providerName);
    const info = await provider.fetchAnimeInfo(id);
    return convertAnimeInfo(info, providerName);
  } catch (error) {
    console.error(`Anime info error (${providerName}):`, error);
    return null;
  }
}

/**
 * Get episode streaming sources
 */
export async function getEpisodeSources(
  episodeId: string,
  providerName: AnimeProviderName = 'hianime'
): Promise<UnifiedSourceResult | null> {
  try {
    const provider = getProvider(providerName);
    const sources = await provider.fetchEpisodeSources(episodeId);
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
  providerName: AnimeProviderName = 'hianime'
): Promise<UnifiedServer[]> {
  try {
    const provider = getProvider(providerName);
    const servers = await provider.fetchEpisodeServers(episodeId);
    return convertServers(servers);
  } catch (error) {
    console.error(`Episode servers error (${providerName}):`, error);
    return [];
  }
}

// ============ HiAnime-Specific Functions ============

/**
 * Get top airing anime (HiAnime only)
 */
export async function getTopAiring(page: number = 1): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = new ANIME.Hianime();
    const result = await provider.fetchTopAiring(page);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      results: searchResult.results?.map(r => convertAnimeResult(r, 'hianime')) ?? [],
    };
  } catch (error) {
    console.error('Top airing error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get most popular anime (HiAnime only)
 */
export async function getMostPopular(page: number = 1): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = new ANIME.Hianime();
    const result = await provider.fetchMostPopular(page);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      results: searchResult.results?.map(r => convertAnimeResult(r, 'hianime')) ?? [],
    };
  } catch (error) {
    console.error('Most popular error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get most favorite anime (HiAnime only)
 */
export async function getMostFavorite(page: number = 1): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = new ANIME.Hianime();
    const result = await provider.fetchMostFavorite(page);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      results: searchResult.results?.map(r => convertAnimeResult(r, 'hianime')) ?? [],
    };
  } catch (error) {
    console.error('Most favorite error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get recently updated anime (HiAnime only)
 */
export async function getRecentlyUpdated(page: number = 1): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = new ANIME.Hianime();
    const result = await provider.fetchRecentlyUpdated(page);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      results: searchResult.results?.map(r => convertAnimeResult(r, 'hianime')) ?? [],
    };
  } catch (error) {
    console.error('Recently updated error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get spotlight anime (HiAnime only)
 */
export async function getSpotlight(): Promise<UnifiedSearchResult[]> {
  try {
    const provider = new ANIME.Hianime();
    const result = await provider.fetchSpotlight();
    const searchResult = result as ISearch<IAnimeResult>;
    
    return searchResult.results?.map(r => convertAnimeResult(r, 'hianime')) ?? [];
  } catch (error) {
    console.error('Spotlight error:', error);
    return [];
  }
}

/**
 * Get anime schedule (HiAnime only)
 */
export async function getSchedule(date?: string): Promise<UnifiedSearchResult[]> {
  try {
    const provider = new ANIME.Hianime();
    const result = await provider.fetchSchedule(date);
    const searchResult = result as ISearch<IAnimeResult>;
    
    return searchResult.results?.map(r => convertAnimeResult(r, 'hianime')) ?? [];
  } catch (error) {
    console.error('Schedule error:', error);
    return [];
  }
}
