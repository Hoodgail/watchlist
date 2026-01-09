/**
 * Video Streaming API Service
 * Utility functions and types for video streaming, built on top of mediaSearch.ts
 * 
 * NOTE: API calls are delegated to mediaSearch.ts to avoid duplication.
 * This service provides video-specific types, utilities, and re-exports.
 */

import { createRefId, parseRefId } from '@shared/refId';
import {
  VideoProviderName,
  VideoEpisode,
  VideoSeason,
  VideoServer,
  StreamingSources,
} from '../types';
import {
  getMediaInfo as getMediaInfoBase,
  getEpisodeSources as getEpisodeSourcesBase,
  getEpisodeServers as getEpisodeServersBase,
} from './mediaSearch';

// ============ Types ============

/**
 * Media info returned from video providers
 */
export interface VideoMediaInfo {
  id: string;
  title: string;
  url?: string;
  image?: string;
  cover?: string;
  description?: string;
  type?: 'Movie' | 'TV Series' | 'OVA' | 'ONA' | 'Special' | 'Music';
  releaseDate?: string;
  genres?: string[];
  status?: string;
  totalEpisodes?: number;
  rating?: number;
  duration?: string;
  production?: string;
  casts?: string[];
  country?: string;
  episodes?: VideoEpisode[];
  seasons?: VideoSeason[];
  recommendations?: VideoMediaInfo[];
  similar?: VideoMediaInfo[];
}

/**
 * Response from sources endpoint
 */
export interface VideoSourceResult {
  sources: StreamingSources;
  episodeId: string;
  server?: string;
}

// ============ API Functions ============
// Re-export with consistent parameter order (provider, id) matching mediaSearch.ts

/**
 * Get media info from a specific video provider
 * 
 * @param provider - The video provider to use
 * @param mediaId - The media ID from the provider
 * @param mediaType - Optional media type for TMDB-based providers
 * @returns Media details including episodes/seasons
 */
export async function getMediaInfo(
  provider: VideoProviderName,
  mediaId: string,
  mediaType?: 'movie' | 'tv'
): Promise<VideoMediaInfo> {
  const result = await getMediaInfoBase(provider, mediaId, mediaType);
  if (!result) {
    throw new Error(`Failed to fetch media info for ${provider}:${mediaId}`);
  }
  return result as VideoMediaInfo;
}

/**
 * Get streaming sources for an episode
 * 
 * @param provider - The video provider to use
 * @param episodeId - The episode ID from the provider
 * @param mediaId - Optional media ID (required by some providers)
 * @returns Streaming sources with URLs, subtitles, and metadata
 */
export async function getEpisodeSources(
  provider: VideoProviderName,
  episodeId: string,
  mediaId?: string
): Promise<StreamingSources> {
  const result = await getEpisodeSourcesBase(provider, episodeId, mediaId);
  if (!result) {
    throw new Error(`Failed to fetch episode sources for ${provider}:${episodeId}`);
  }
  return result;
}

/**
 * Get available servers for an episode
 * 
 * @param provider - The video provider to use
 * @param episodeId - The episode ID from the provider
 * @param mediaId - Optional media ID (required by some providers)
 * @returns List of available servers
 */
export async function getEpisodeServers(
  provider: VideoProviderName,
  episodeId: string,
  mediaId?: string
): Promise<VideoServer[]> {
  return getEpisodeServersBase(provider, episodeId, mediaId);
}

// ============ Utility Functions ============

/**
 * Get human-readable display name for a video provider
 */
export function getProviderDisplayName(provider: VideoProviderName): string {
  const names: Record<VideoProviderName, string> = {
    // Anime providers
    hianime: 'HiAnime',
    animepahe: 'AnimePahe',
    animekai: 'AnimeKai',
    kickassanime: 'KickAssAnime',
    // Movie/TV providers
    flixhq: 'FlixHQ',
    goku: 'Goku',
    sflix: 'SFlix',
    himovies: 'HiMovies',
    dramacool: 'DramaCool',
  };
  return names[provider] || provider;
}

/**
 * Create a reference ID for storing video media in watchlist
 * Format: provider:mediaId
 * 
 * @param mediaId - The media ID from the provider
 * @param provider - The video provider
 * @returns Formatted refId (e.g., "hianime:abc123")
 */
export function createVideoRefId(mediaId: string, provider: VideoProviderName): string {
  return createRefId(provider, mediaId);
}

/**
 * Parse a reference ID to get provider and media ID
 * 
 * @param refId - The refId to parse (e.g., "hianime:abc123")
 * @returns Parsed object with mediaId and provider, or null if invalid
 */
export function parseVideoRefId(refId: string): { mediaId: string; provider: VideoProviderName } | null {
  const parsed = parseRefId(refId);
  if (!parsed) return null;
  
  // Validate that the source is a valid video provider
  const validProviders: VideoProviderName[] = [
    'hianime', 'animepahe', 'animekai', 'kickassanime',
    'flixhq', 'goku', 'sflix', 'himovies', 'dramacool',
  ];
  
  if (!validProviders.includes(parsed.source as VideoProviderName)) {
    return null;
  }
  
  return {
    provider: parsed.source as VideoProviderName,
    mediaId: parsed.id,
  };
}

/**
 * Check if a refId is for a video provider
 */
export function isVideoProviderRefId(refId: string): boolean {
  return parseVideoRefId(refId) !== null;
}

/**
 * Get the next episode in a list
 */
export function getNextEpisode(
  episodes: VideoEpisode[],
  currentEpisodeId: string
): VideoEpisode | null {
  const currentIndex = episodes.findIndex((e) => e.id === currentEpisodeId);
  if (currentIndex === -1 || currentIndex >= episodes.length - 1) return null;
  return episodes[currentIndex + 1];
}

/**
 * Get the previous episode in a list
 */
export function getPreviousEpisode(
  episodes: VideoEpisode[],
  currentEpisodeId: string
): VideoEpisode | null {
  const currentIndex = episodes.findIndex((e) => e.id === currentEpisodeId);
  if (currentIndex <= 0) return null;
  return episodes[currentIndex - 1];
}

/**
 * Sort episodes by episode number (ascending)
 */
export function sortEpisodesAsc(episodes: VideoEpisode[]): VideoEpisode[] {
  return [...episodes].sort((a, b) => a.number - b.number);
}

/**
 * Sort episodes by episode number (descending)
 */
export function sortEpisodesDesc(episodes: VideoEpisode[]): VideoEpisode[] {
  return [...episodes].sort((a, b) => b.number - a.number);
}

/**
 * Format episode number for display
 */
export function formatEpisodeNumber(episode: VideoEpisode): string {
  const parts: string[] = [];
  if (episode.season !== undefined) {
    parts.push(`S${episode.season}`);
  }
  parts.push(`E${episode.number}`);
  if (episode.title) {
    parts.push(`- ${episode.title}`);
  }
  return parts.join(' ');
}

/**
 * Get all episodes from media info (flattens seasons if present)
 */
export function getAllEpisodes(mediaInfo: VideoMediaInfo): VideoEpisode[] {
  if (mediaInfo.episodes && mediaInfo.episodes.length > 0) {
    return mediaInfo.episodes;
  }
  
  if (mediaInfo.seasons && mediaInfo.seasons.length > 0) {
    return mediaInfo.seasons.flatMap(season => 
      season.episodes.map(ep => ({
        ...ep,
        season: season.season,
      }))
    );
  }
  
  return [];
}

/**
 * Find episode by number (and optionally season)
 */
export function findEpisodeByNumber(
  episodes: VideoEpisode[],
  episodeNumber: number,
  seasonNumber?: number
): VideoEpisode | null {
  return episodes.find(ep => {
    if (seasonNumber !== undefined && ep.season !== seasonNumber) {
      return false;
    }
    return ep.number === episodeNumber;
  }) || null;
}

// ============ Constants ============

/**
 * Default video provider for anime
 */
export const DEFAULT_ANIME_PROVIDER: VideoProviderName = 'hianime';

/**
 * Default video provider for movies/TV
 */
export const DEFAULT_MOVIE_PROVIDER: VideoProviderName = 'flixhq';
