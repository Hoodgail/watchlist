/**
 * Provider Configuration
 * 
 * Defines provider rankings and fallback order based on reliability testing.
 * Update this file when provider availability changes.
 * 
 * Last tested: 2026-01-09
 */

import type { AnimeProviderName, MovieProviderName } from './types.js';

// Combined type for all video providers
export type VideoProviderName = AnimeProviderName | MovieProviderName;

// ============ Provider Status ============

export type ProviderStatus = 'working' | 'partial' | 'broken';

export interface ProviderInfo {
  name: VideoProviderName;
  displayName: string;
  status: ProviderStatus;
  /** Search functionality works */
  searchWorks: boolean;
  /** Info/episodes functionality works */
  infoWorks: boolean;
  /** Video sources work */
  sourcesWork: boolean;
  /** Has M3U8 streams */
  hasM3U8: boolean;
  /** Reliability score 0-100 */
  score: number;
  /** Notes about the provider */
  notes?: string;
}

// ============ Anime Providers ============

export const ANIME_PROVIDERS: ProviderInfo[] = [
  {
    name: 'hianime',
    displayName: 'HiAnime',
    status: 'working',
    searchWorks: true,
    infoWorks: true,
    sourcesWork: true,
    hasM3U8: true,
    score: 100,
    notes: 'Primary anime provider. Uses custom MegaCloud extractor for sources.',
  },
  {
    name: 'animepahe',
    displayName: 'AnimePahe',
    status: 'working',
    searchWorks: true,
    infoWorks: true,
    sourcesWork: true,
    hasM3U8: true,
    score: 95,
    notes: 'Reliable sources, multiple quality options.',
  },
  {
    name: 'animekai',
    displayName: 'AnimeKai',
    status: 'working',
    searchWorks: true,
    infoWorks: true,
    sourcesWork: true,
    hasM3U8: true,
    score: 95,
    notes: 'Fast and reliable. Good subtitle support.',
  },
  {
    name: 'kickassanime',
    displayName: 'KickAssAnime',
    status: 'broken',
    searchWorks: false,
    infoWorks: false,
    sourcesWork: false,
    hasM3U8: false,
    score: 6,
    notes: 'Currently returning 404 errors on all requests.',
  },
];

// ============ Movie/TV Providers ============

export const MOVIE_PROVIDERS: ProviderInfo[] = [
  {
    name: 'flixhq',
    displayName: 'FlixHQ',
    status: 'working',
    searchWorks: true,
    infoWorks: true,
    sourcesWork: true,
    hasM3U8: true,
    score: 100,
    notes: 'Primary movie/TV provider. Wide content library.',
  },
  {
    name: 'goku',
    displayName: 'Goku',
    status: 'working',
    searchWorks: true,
    infoWorks: true,
    sourcesWork: true,
    hasM3U8: true,
    score: 100,
    notes: 'Good backup for FlixHQ. Similar content library.',
  },
  {
    name: 'sflix',
    displayName: 'SFlix',
    status: 'partial',
    searchWorks: true,
    infoWorks: true,
    sourcesWork: false,
    hasM3U8: false,
    score: 56,
    notes: 'Search and info work but sources return 502 errors.',
  },
  {
    name: 'himovies',
    displayName: 'HiMovies',
    status: 'partial',
    searchWorks: true,
    infoWorks: true,
    sourcesWork: false,
    hasM3U8: false,
    score: 50,
    notes: 'Uses FlixHQ backend. May have similar issues.',
  },
  {
    name: 'dramacool',
    displayName: 'DramaCool',
    status: 'broken',
    searchWorks: false,
    infoWorks: false,
    sourcesWork: false,
    hasM3U8: false,
    score: 6,
    notes: 'For Asian dramas only. Not returning results for general searches.',
  },
];

// ============ Provider Rankings ============

/**
 * Get ranked list of anime providers (working providers first)
 */
export function getAnimeProviderRanking(): AnimeProviderName[] {
  return ANIME_PROVIDERS
    .filter(p => p.sourcesWork)
    .sort((a, b) => b.score - a.score)
    .map(p => p.name as AnimeProviderName);
}

/**
 * Get ranked list of movie/TV providers (working providers first)
 */
export function getMovieProviderRanking(): MovieProviderName[] {
  return MOVIE_PROVIDERS
    .filter(p => p.sourcesWork)
    .sort((a, b) => b.score - a.score)
    .map(p => p.name as MovieProviderName);
}

/**
 * Get the primary (best) provider for a media type
 */
export function getPrimaryProvider(mediaType: 'anime' | 'movie' | 'tv'): VideoProviderName {
  if (mediaType === 'anime') {
    const ranking = getAnimeProviderRanking();
    return ranking[0] || 'animepahe';
  }
  const ranking = getMovieProviderRanking();
  return ranking[0] || 'flixhq';
}

/**
 * Get fallback providers for a media type (excludes primary)
 */
export function getFallbackProviders(mediaType: 'anime' | 'movie' | 'tv'): VideoProviderName[] {
  if (mediaType === 'anime') {
    const ranking = getAnimeProviderRanking();
    return ranking.slice(1);
  }
  const ranking = getMovieProviderRanking();
  return ranking.slice(1);
}

/**
 * Get all working providers for a media type
 */
export function getWorkingProviders(mediaType: 'anime' | 'movie' | 'tv'): VideoProviderName[] {
  if (mediaType === 'anime') {
    return getAnimeProviderRanking();
  }
  return getMovieProviderRanking();
}

/**
 * Get provider info by name
 */
export function getProviderInfo(name: VideoProviderName): ProviderInfo | undefined {
  return [...ANIME_PROVIDERS, ...MOVIE_PROVIDERS].find(p => p.name === name);
}

/**
 * Check if a provider is working (has functional sources)
 */
export function isProviderWorking(name: VideoProviderName): boolean {
  const info = getProviderInfo(name);
  return info?.sourcesWork ?? false;
}

/**
 * Get display name for a provider
 */
export function getProviderDisplayName(name: VideoProviderName): string {
  const info = getProviderInfo(name);
  return info?.displayName ?? name;
}

// ============ Default Exports ============

/**
 * Default provider order (used when mediaType is unknown)
 */
export const DEFAULT_ANIME_PROVIDERS: AnimeProviderName[] = ['animepahe', 'animekai'];
export const DEFAULT_MOVIE_PROVIDERS: MovieProviderName[] = ['flixhq', 'goku'];

/**
 * All video provider names (for validation)
 */
export const ALL_VIDEO_PROVIDERS: VideoProviderName[] = [
  ...ANIME_PROVIDERS.map(p => p.name),
  ...MOVIE_PROVIDERS.map(p => p.name),
];
