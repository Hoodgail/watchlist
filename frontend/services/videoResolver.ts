/**
 * Video Resolver Service
 * 
 * Resolves external IDs (TMDB, AniList, etc.) to video provider-specific IDs
 * by searching the provider and matching titles.
 * 
 * This is necessary because:
 * - Users add items to their watchlist from TMDB search (refId: "tmdb:12345")
 * - Video providers (hianime, flixhq) have their own ID systems
 * - We need to search the provider by title to find the matching content
 * 
 * Provider Priority (as of 2026-01-09):
 * - Anime: animepahe → animekai (hianime sources broken)
 * - Movie/TV: flixhq → goku (sflix sources broken)
 */

import { VideoProviderName } from '../types';
import { parseRefId, getSource } from '@shared/refId';
import { searchWithProvider, PaginatedSearchResults } from './mediaSearch';
import { VideoMediaInfo, getMediaInfo, getEpisodeSources } from './video';
import {
  getPrimaryProvider,
  getFallbackProviders,
  getWorkingProviders,
  isProviderWorking,
  getProviderDisplayName,
  ALL_VIDEO_PROVIDERS,
} from './providerConfig';
import { getProviderMapping, saveAutoMapping } from './api';

// ============ Constants ============

/** Confidence threshold below which we show "Is this correct?" prompt */
export const LOW_CONFIDENCE_THRESHOLD = 0.9;

/** Minimum similarity score to accept a match */
const MIN_SIMILARITY_THRESHOLD = 0.3;

// ============ Types ============

export interface ResolvedMedia {
  /** The provider-specific ID that can be used with getMediaInfo/getSources */
  providerId: string;
  /** The provider that was used */
  provider: VideoProviderName;
  /** Title from the provider (for verification) */
  title: string;
  /** Original refId that was resolved */
  originalRefId: string;
  /** Media info if already fetched during resolution */
  mediaInfo?: VideoMediaInfo;
  /** Confidence score of the match (1.0 = verified, <0.9 = needs confirmation) */
  confidence: number;
  /** Whether this was from a user-verified database mapping */
  isVerified: boolean;
}

export interface ResolutionOptions {
  /** Title to search for (required for non-native IDs) */
  title?: string;
  /** Media type hint for better matching */
  mediaType?: 'movie' | 'tv' | 'anime';
  /** If true, also fetch and return media info */
  fetchInfo?: boolean;
  /** If true, try fallback providers on failure */
  useFallback?: boolean;
}

/**
 * Convert resolution mediaType to API mediaType (anime maps to undefined since anime providers don't need it)
 */
function toApiMediaType(mediaType?: 'movie' | 'tv' | 'anime'): 'movie' | 'tv' | undefined {
  if (mediaType === 'anime') return undefined;
  return mediaType;
}

// ============ Cache ============

/**
 * In-memory cache for resolved IDs
 * Key: `${originalRefId}:${provider}`
 * Value: Provider-specific ID
 */
const resolutionCache = new Map<string, string>();

function getCacheKey(refId: string, provider: VideoProviderName): string {
  return `${refId}:${provider}`;
}

/**
 * Get cached provider ID if available
 */
export function getCachedProviderId(refId: string, provider: VideoProviderName): string | null {
  return resolutionCache.get(getCacheKey(refId, provider)) || null;
}

/**
 * Cache a resolved provider ID
 */
export function cacheProviderId(refId: string, provider: VideoProviderName, providerId: string): void {
  resolutionCache.set(getCacheKey(refId, provider), providerId);
}

/**
 * Clear the resolution cache
 */
export function clearResolutionCache(): void {
  resolutionCache.clear();
}

// ============ Source Detection ============

/** Sources that are video providers (can be used directly) */
const VIDEO_PROVIDER_SOURCES: VideoProviderName[] = ALL_VIDEO_PROVIDERS;

/** Sources that require resolution to a video provider */
const EXTERNAL_SOURCES = ['tmdb', 'anilist', 'consumet-anilist', 'fallback'];

/**
 * Check if a refId is from a video provider (can be used directly)
 */
export function isVideoProviderSource(refId: string): boolean {
  const source = getSource(refId);
  return source !== null && VIDEO_PROVIDER_SOURCES.includes(source as VideoProviderName);
}

/**
 * Check if a refId needs resolution (external source)
 */
export function needsResolution(refId: string): boolean {
  const source = getSource(refId);
  if (source === null) return false;
  // Needs resolution if it's an external source OR if it's not a known video provider
  return EXTERNAL_SOURCES.includes(source) || !VIDEO_PROVIDER_SOURCES.includes(source as VideoProviderName);
}

// ============ Title Matching ============

/**
 * Normalize a title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity between two titles (0-1)
 */
function titleSimilarity(a: string, b: string): number {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  
  // Exact match
  if (normA === normB) return 1;
  
  // One contains the other
  if (normA.includes(normB) || normB.includes(normA)) {
    const longerLen = Math.max(normA.length, normB.length);
    const shorterLen = Math.min(normA.length, normB.length);
    return shorterLen / longerLen;
  }
  
  // Word-based comparison
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 1));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 1));
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  let matchCount = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) matchCount++;
  }
  
  return matchCount / Math.max(wordsA.size, wordsB.size);
}

/**
 * Find the best matching result from search results
 */
function findBestMatch(
  searchTitle: string,
  results: PaginatedSearchResults,
  mediaType?: 'movie' | 'tv' | 'anime'
): { id: string; title: string; score: number } | null {
  if (results.results.length === 0) return null;
  
  let bestMatch: { id: string; title: string; score: number } | null = null;
  
  for (const result of results.results) {
    // Type filtering - if mediaType specified, prefer matching types
    let typeBonus = 0;
    if (mediaType) {
      const resultType = result.type?.toLowerCase();
      if (mediaType === 'anime' && resultType === 'anime') typeBonus = 0.1;
      else if (mediaType === 'movie' && resultType === 'movie') typeBonus = 0.1;
      else if (mediaType === 'tv' && (resultType === 'tv' || resultType === 'tv series')) typeBonus = 0.1;
    }
    
    const similarity = titleSimilarity(searchTitle, result.title) + typeBonus;
    
    if (!bestMatch || similarity > bestMatch.score) {
      // Extract just the ID portion if it's in refId format (provider:id)
      let id = result.id;
      const colonIndex = id.indexOf(':');
      if (colonIndex !== -1) {
        // Check if the prefix is a known video provider
        const prefix = id.substring(0, colonIndex);
        if (VIDEO_PROVIDER_SOURCES.includes(prefix as VideoProviderName)) {
          id = id.substring(colonIndex + 1);
        }
      }
      
      bestMatch = {
        id,
        title: result.title,
        score: similarity,
      };
    }
  }
  
  // Require at least some similarity
  if (bestMatch && bestMatch.score >= 0.3) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Find all results that have a high similarity match to the search title
 * Used to detect when multiple sources have the same/similar name
 */
function findMatchingResults(
  searchTitle: string,
  results: PaginatedSearchResults,
  mediaType?: 'movie' | 'tv' | 'anime'
): { id: string; title: string; score: number; year?: number; type?: string; imageUrl?: string; description?: string }[] {
  if (results.results.length === 0) return [];
  
  const normalizedSearchTitle = normalizeTitle(searchTitle);
  const matches: { id: string; title: string; score: number; year?: number; type?: string; imageUrl?: string; description?: string }[] = [];
  
  for (const result of results.results) {
    const normalizedResultTitle = normalizeTitle(result.title);
    
    // Check for exact or near-exact title match (after normalization)
    const similarity = titleSimilarity(searchTitle, result.title);
    
    // Only include results with high similarity (exact or near-exact matches)
    if (similarity >= 0.9 || normalizedSearchTitle === normalizedResultTitle) {
      // Extract just the ID portion if it's in refId format (provider:id)
      let id = result.id;
      const colonIndex = id.indexOf(':');
      if (colonIndex !== -1) {
        const prefix = id.substring(0, colonIndex);
        if (VIDEO_PROVIDER_SOURCES.includes(prefix as VideoProviderName)) {
          id = id.substring(colonIndex + 1);
        }
      }
      
      matches.push({
        id,
        title: result.title,
        score: similarity,
        year: result.year,
        type: result.type,
        imageUrl: result.imageUrl,
        description: result.description,
      });
    }
  }
  
  return matches;
}

/**
 * Check if there are multiple sources with the same or very similar title
 * Returns the matching results if multiple found, null otherwise
 */
export async function checkForMultipleMatches(
  title: string,
  provider: VideoProviderName,
  mediaType?: 'movie' | 'tv' | 'anime'
): Promise<{ results: PaginatedSearchResults; multipleMatches: boolean; matches: ReturnType<typeof findMatchingResults> }> {
  const searchResults = await searchWithProvider(title, provider);
  const matches = findMatchingResults(title, searchResults, mediaType);
  
  return {
    results: searchResults,
    multipleMatches: matches.length > 1,
    matches,
  };
}

// ============ Resolution Functions ============

/**
 * Resolve a refId to a provider-specific ID
 * 
 * Resolution priority:
 * 1. If refId is already a video provider ID, use directly
 * 2. Check database for verified/cached mapping
 * 3. Check in-memory cache
 * 4. Search provider by title (fuzzy match)
 * 
 * @param refId - The reference ID to resolve (e.g., "tmdb:95479" or "hianime:abc123")
 * @param provider - The video provider to resolve to
 * @param options - Resolution options including title for search
 * @returns Resolved media info, or null if resolution failed
 */
export async function resolveToProvider(
  refId: string,
  provider: VideoProviderName,
  options: ResolutionOptions = {}
): Promise<ResolvedMedia | null> {
  const parsed = parseRefId(refId);
  if (!parsed) {
    console.error('[videoResolver] Invalid refId format:', refId);
    return null;
  }
  
  const source = parsed.source;
  
  // Case 1: Already a video provider ID - use directly
  if (VIDEO_PROVIDER_SOURCES.includes(source as VideoProviderName)) {
    // If source matches requested provider, use directly
    if (source === provider) {
      const result: ResolvedMedia = {
        providerId: parsed.id,
        provider,
        title: options.title || '',
        originalRefId: refId,
        confidence: 1.0,
        isVerified: true,
      };
      
      // Optionally fetch media info
      if (options.fetchInfo) {
        try {
          result.mediaInfo = await getMediaInfo(provider, parsed.id, toApiMediaType(options.mediaType));
          result.title = result.mediaInfo.title;
        } catch (err) {
          // Media info fetch failed, but we still have the ID
          console.warn('[videoResolver] Failed to fetch media info:', err);
        }
      }
      
      return result;
    }
    
    // Different provider requested - need to search by title
    if (!options.title) {
      console.error('[videoResolver] Cannot resolve to different provider without title');
      return null;
    }
  }
  
  // Case 2: External source (TMDB, AniList, etc.) - need to search by title
  if (!options.title) {
    console.error('[videoResolver] Title required to resolve external refId:', refId);
    return null;
  }
  
  // Check database for existing mapping first (highest priority)
  try {
    const dbMapping = await getProviderMapping(refId, provider);
    if (dbMapping) {
      console.log(`[videoResolver] Found database mapping for ${refId} → ${provider}: ${dbMapping.providerId} (confidence: ${dbMapping.confidence})`);
      
      const result: ResolvedMedia = {
        providerId: dbMapping.providerId,
        provider,
        title: dbMapping.providerTitle,
        originalRefId: refId,
        confidence: dbMapping.confidence,
        isVerified: dbMapping.verifiedBy !== null,
      };
      
      // Also cache in memory for faster subsequent lookups
      cacheProviderId(refId, provider, dbMapping.providerId);
      
      if (options.fetchInfo) {
        try {
          result.mediaInfo = await getMediaInfo(provider, dbMapping.providerId, toApiMediaType(options.mediaType));
          result.title = result.mediaInfo.title;
        } catch (err) {
          console.warn('[videoResolver] Failed to fetch media info from database mapping:', err);
        }
      }
      
      return result;
    }
  } catch (err) {
    console.warn('[videoResolver] Failed to check database mapping:', err);
  }
  
  // Check in-memory cache
  const cachedId = getCachedProviderId(refId, provider);
  if (cachedId) {
    const result: ResolvedMedia = {
      providerId: cachedId,
      provider,
      title: options.title,
      originalRefId: refId,
      confidence: 1.0, // Cache entries are assumed high confidence
      isVerified: false,
    };
    
    if (options.fetchInfo) {
      try {
        result.mediaInfo = await getMediaInfo(provider, cachedId, toApiMediaType(options.mediaType));
        result.title = result.mediaInfo.title;
      } catch (err) {
        console.warn('[videoResolver] Failed to fetch cached media info:', err);
      }
    }
    
    return result;
  }
  
  // Search the provider by title
  console.log(`[videoResolver] Searching ${provider} for "${options.title}"`);
  
  try {
    const searchResults = await searchWithProvider(options.title, provider);
    const match = findBestMatch(options.title, searchResults, options.mediaType);
    
    if (!match) {
      console.warn(`[videoResolver] No match found in ${provider} for "${options.title}"`);
      return null;
    }
    
    console.log(`[videoResolver] Found match: "${match.title}" (${match.id}) with score ${match.score.toFixed(2)}`);
    
    // Cache the resolution in memory
    cacheProviderId(refId, provider, match.id);
    
    // Save auto-mapping to database (non-blocking)
    saveAutoMapping(refId, provider, match.id, match.title, match.score).catch(err => {
      console.warn('[videoResolver] Failed to save auto-mapping:', err);
    });
    
    const result: ResolvedMedia = {
      providerId: match.id,
      provider,
      title: match.title,
      originalRefId: refId,
      confidence: match.score,
      isVerified: false,
    };
    
    // Optionally fetch media info
    if (options.fetchInfo) {
      try {
        result.mediaInfo = await getMediaInfo(provider, match.id, toApiMediaType(options.mediaType));
      } catch (err) {
        console.warn('[videoResolver] Failed to fetch media info after resolution:', err);
      }
    }
    
    return result;
  } catch (err) {
    console.error('[videoResolver] Search failed:', err);
    return null;
  }
}

/**
 * Resolve and get media info in one call
 * 
 * This is the main function to use when opening media for playback.
 * It handles ID resolution and media info fetching.
 * 
 * @param refId - The reference ID from the watchlist item
 * @param provider - The video provider to use
 * @param title - The title for search fallback
 * @param mediaType - Optional type hint
 * @returns Media info with resolved provider ID, or null if failed
 */
export async function resolveAndGetMediaInfo(
  refId: string,
  provider: VideoProviderName,
  title: string,
  mediaType?: 'movie' | 'tv' | 'anime'
): Promise<{ 
  mediaInfo: VideoMediaInfo; 
  providerId: string; 
  provider: VideoProviderName;
  confidence: number;
  isVerified: boolean;
} | null> {
  const parsed = parseRefId(refId);
  if (!parsed) {
    console.error('[videoResolver] Invalid refId:', refId);
    return null;
  }
  
  // If it's already a video provider ID, try directly first
  if (VIDEO_PROVIDER_SOURCES.includes(parsed.source as VideoProviderName)) {
    if (parsed.source === provider) {
      try {
        const mediaInfo = await getMediaInfo(provider, parsed.id, toApiMediaType(mediaType));
        return { mediaInfo, providerId: parsed.id, provider, confidence: 1.0, isVerified: true };
      } catch (err) {
        // Direct fetch failed - fall through to search
        console.warn('[videoResolver] Direct fetch failed, trying search:', err);
      }
    }
  }
  
  // Resolve to provider
  const resolved = await resolveToProvider(refId, provider, {
    title,
    mediaType,
    fetchInfo: true,
  });
  
  if (!resolved || !resolved.mediaInfo) {
    return null;
  }
  
  return {
    mediaInfo: resolved.mediaInfo,
    providerId: resolved.providerId,
    provider: resolved.provider,
    confidence: resolved.confidence,
    isVerified: resolved.isVerified,
  };
}

/**
 * Get the default video provider for a media type
 * Uses the provider ranking from providerConfig
 */
export function getDefaultProvider(mediaType: 'anime' | 'movie' | 'tv'): VideoProviderName {
  return getPrimaryProvider(mediaType);
}

// ============ Fallback Resolution ============

/**
 * Result from resolving with fallback
 */
export interface FallbackResolutionResult {
  mediaInfo: VideoMediaInfo;
  providerId: string;
  provider: VideoProviderName;
  /** List of providers that were tried before success */
  triedProviders: VideoProviderName[];
  /** Whether fallback was used (not the primary provider) */
  usedFallback: boolean;
  /** Confidence score of the match */
  confidence: number;
  /** Whether this was from a user-verified mapping */
  isVerified: boolean;
}

/**
 * Resolve and get media info with automatic fallback to other providers
 * 
 * This tries the primary provider first, then falls back to alternatives if it fails.
 * Use this when you want reliable media resolution across providers.
 * 
 * @param refId - The reference ID from the watchlist item
 * @param title - The title for search fallback
 * @param mediaType - Type of media (determines which providers to try)
 * @returns Media info with resolved provider ID, or null if all providers failed
 */
export async function resolveWithFallback(
  refId: string,
  title: string,
  mediaType: 'anime' | 'movie' | 'tv'
): Promise<FallbackResolutionResult | null> {
  const providers = getWorkingProviders(mediaType);
  const triedProviders: VideoProviderName[] = [];
  
  if (providers.length === 0) {
    console.error('[videoResolver] No working providers for', mediaType);
    return null;
  }
  
  console.log(`[videoResolver] Attempting resolution with fallback. Providers: ${providers.join(' → ')}`);
  
  for (const provider of providers) {
    triedProviders.push(provider);
    console.log(`[videoResolver] Trying provider: ${getProviderDisplayName(provider)}`);
    
    try {
      const result = await resolveAndGetMediaInfo(refId, provider, title, mediaType);
      
      if (result && result.mediaInfo) {
        console.log(`[videoResolver] Success with ${provider}`);
        return {
          mediaInfo: result.mediaInfo,
          providerId: result.providerId,
          provider: result.provider,
          triedProviders,
          usedFallback: triedProviders.length > 1,
          confidence: result.confidence,
          isVerified: result.isVerified,
        };
      }
    } catch (err) {
      console.warn(`[videoResolver] Provider ${provider} failed:`, err);
    }
  }
  
  console.error('[videoResolver] All providers failed');
  return null;
}

/**
 * Get episode sources with automatic fallback
 * 
 * Tries to get video sources from the primary provider, falls back if needed.
 * This is useful when sources fail for a provider that worked for info.
 * 
 * @param episodeId - The episode ID
 * @param mediaId - The media ID
 * @param title - Title for re-resolution if needed
 * @param mediaType - Media type for provider selection
 * @param preferredProvider - Provider to try first (if different from primary)
 * @returns Sources with provider info, or null if failed
 */
export async function getSourcesWithFallback(
  episodeId: string,
  mediaId: string,
  title: string,
  mediaType: 'anime' | 'movie' | 'tv',
  preferredProvider?: VideoProviderName
): Promise<{
  sources: Awaited<ReturnType<typeof getEpisodeSources>>;
  provider: VideoProviderName;
  triedProviders: VideoProviderName[];
} | null> {
  const providers = getWorkingProviders(mediaType);
  const triedProviders: VideoProviderName[] = [];
  
  // If preferred provider is specified and working, try it first
  if (preferredProvider && isProviderWorking(preferredProvider)) {
    const idx = providers.indexOf(preferredProvider);
    if (idx > 0) {
      providers.splice(idx, 1);
      providers.unshift(preferredProvider);
    }
  }
  
  for (const provider of providers) {
    triedProviders.push(provider);
    console.log(`[videoResolver] Trying sources from ${provider}`);
    
    try {
      // For the preferred/original provider, use the existing IDs
      if (provider === preferredProvider) {
        const sources = await getEpisodeSources(provider, episodeId, mediaId);
        if (sources && sources.sources && sources.sources.length > 0) {
          console.log(`[videoResolver] Got ${sources.sources.length} sources from ${provider}`);
          return { sources, provider, triedProviders };
        }
      } else {
        // For fallback providers, we need to resolve the media first
        const resolved = await resolveAndGetMediaInfo(`fallback:${mediaId}`, provider, title, mediaType);
        if (resolved && resolved.mediaInfo.episodes && resolved.mediaInfo.episodes.length > 0) {
          // Find the matching episode by number
          // Extract episode number from episodeId if possible
          const episode = resolved.mediaInfo.episodes[0]; // Fallback to first episode
          const sources = await getEpisodeSources(provider, episode.id, resolved.providerId);
          if (sources && sources.sources && sources.sources.length > 0) {
            console.log(`[videoResolver] Got ${sources.sources.length} sources from fallback ${provider}`);
            return { sources, provider, triedProviders };
          }
        }
      }
    } catch (err) {
      console.warn(`[videoResolver] Sources from ${provider} failed:`, err);
    }
  }
  
  console.error('[videoResolver] All providers failed to provide sources');
  return null;
}

// Re-export provider config functions for convenience
export { 
  getPrimaryProvider, 
  getFallbackProviders, 
  getWorkingProviders,
  isProviderWorking,
  getProviderDisplayName,
};

// Re-export search function for components that need direct access
export { searchWithProvider } from './mediaSearch';
