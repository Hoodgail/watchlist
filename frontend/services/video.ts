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
  StreamingSubtitle,
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

// ============ Streaming URL Helpers ============

/**
 * Convert a video source URL to a proxy URL if referer is provided.
 * When a referer is returned from the backend, the source requires special headers
 * that browsers can't send cross-origin, so we proxy the request.
 * 
 * @param url - Original video URL
 * @param referer - Referer header value (from sources.headers)
 * @param isM3U8 - Whether this is an M3U8 playlist
 */
export function getProxyUrl(url: string, referer: string | undefined, isM3U8: boolean): string {
  if (!referer) {
    return url; // No proxy needed - backend didn't specify headers
  }
  
  const endpoint = isM3U8 ? '/api/video/m3u8' : '/api/video/segment';
  return `${endpoint}?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
}

/**
 * Result from getStreamingUrl containing the URL and metadata needed for streaming/downloading
 */
export interface StreamingUrlResult {
  /** The proxied URL that can be fetched directly */
  url: string;
  /** Whether the source is an HLS stream */
  isM3U8: boolean;
  /** Quality label if available */
  quality?: string;
  /** Subtitles from the source */
  subtitles: StreamingSubtitle[];
  /** Full sources object for advanced use cases */
  sources: StreamingSources;
}

/**
 * Get a streaming URL that can be used for playback or download.
 * This handles:
 * - Fetching sources from the video provider API
 * - Applying proxy URLs when referer headers are required
 * - Selecting the best available source
 * 
 * @param provider - The video provider
 * @param episodeId - The episode ID
 * @param mediaId - Optional media ID (required by some providers)
 * @returns StreamingUrlResult with the proxied URL and metadata
 */
export async function getStreamingUrl(
  provider: VideoProviderName,
  episodeId: string,
  mediaId?: string
): Promise<StreamingUrlResult> {
  // Fetch streaming sources from the API
  const streamingSources = await getEpisodeSources(provider, episodeId, mediaId);
  
  if (!streamingSources.sources || streamingSources.sources.length === 0) {
    throw new Error('No streaming sources found');
  }

  // Get referer header for proxy (if sources need it)
  const referer = streamingSources.headers?.Referer;
  
  // Get the first/best source
  const source = streamingSources.sources[0];
  const isM3U8 = source.isM3U8 ?? source.url.includes('.m3u8');
  
  // Convert source URL to proxy URL if needed
  const proxiedUrl = getProxyUrl(source.url, referer, isM3U8);
  
  return {
    url: proxiedUrl,
    isM3U8,
    quality: source.quality,
    subtitles: streamingSources.subtitles || [],
    sources: streamingSources,
  };
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
