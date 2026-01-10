import type { MediaType } from '@prisma/client';
import * as commentService from './commentService.js';
import * as cheerio from 'cheerio';
import {
  calculateSimilarity,
  findBestMatch,
  normalizeTitle,
  type MatchableItem,
  type SimilarityResult,
} from '@shared/matching.js';
import {
  searchAnilistAnime,
  searchAnilistManga,
  searchMAL,
  searchTMDB,
} from './consumet/metaProviders.js';
import type { UnifiedSearchResult } from './consumet/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for fetching comments from external sources
 */
export interface FetchCommentsParams {
  title: string;
  mediaType: 'TV' | 'MOVIE' | 'ANIME' | 'MANGA';
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  chapterNumber?: number;
  volumeNumber?: number;
  limit?: number;
  /** Provider-specific IDs (e.g., hianimeEpisodeId for HiAnime) */
  providerIds?: {
    hianimeEpisodeId?: string;
    [key: string]: string | undefined;
  };
}

/**
 * External comment structure returned by providers
 */
export interface ExternalComment {
  externalSource: string;
  externalId: string;
  externalAuthor: string;
  externalAuthorAvatar?: string;
  externalUrl: string;
  content: string;
  createdAt: Date;
  score?: number; // upvotes, likes, etc.
}

/**
 * Interface for external comment providers.
 * Each provider (Reddit, MAL, AniList, etc.) implements this interface.
 */
export interface ExternalCommentProvider {
  /** Unique identifier for the provider */
  name: string;

  /** Human-readable display name */
  displayName: string;

  /** Media types this provider supports */
  supportedMediaTypes: Array<'TV' | 'MOVIE' | 'ANIME' | 'MANGA'>;

  /**
   * Fetch comments from the external source
   * @param params - Search parameters including title, media type, etc.
   * @returns Array of external comments
   */
  fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]>;

  /**
   * Check if this provider is configured and ready to use
   * (e.g., has required API keys)
   */
  isConfigured(): boolean;
}

/**
 * Result of a fetch and import operation
 */
export interface ImportResult {
  imported: number;
  providers: string[];
  errors: Array<{ provider: string; error: string }>;
}

/**
 * Parameters for smart comment fetching with resolution
 */
export interface CommentFetchWithResolutionParams {
  title: string;
  mediaType: 'ANIME' | 'MOVIE' | 'TV' | 'MANGA';
  year?: number;
  /** Reference ID - may be from a provider we don't support for comments */
  refId?: string;
  /** Season number for episode-level comments */
  seasonNumber?: number;
  /** Episode number for episode-level comments */
  episodeNumber?: number;
  /** Provider-specific IDs */
  providerIds?: {
    hianimeEpisodeId?: string;
    [key: string]: string | undefined;
  };
  limit?: number;
}

/**
 * A resolved provider match from title search
 */
export interface ResolvedProviderMatch {
  provider: string;
  providerId: string;
  title: string;
  matchScore: number;
  alternativeTitles?: string[];
  year?: number;
}

/**
 * Result of comment fetching with resolution
 */
export interface AggregatedComments {
  comments: ExternalComment[];
  resolvedMatches: ResolvedProviderMatch[];
  errors: Array<{ provider: string; error: string }>;
  /** Overall confidence in the resolution (0-1) */
  confidence: number;
  /** Whether any ID-based direct fetch was used */
  usedDirectFetch: boolean;
}

/**
 * Result of a resolution preview (without fetching comments)
 */
export interface ResolutionPreviewResult {
  resolvedMatches: ResolvedProviderMatch[];
  titleBasedProviders: string[];
  confidence: number;
}

// ============================================================================
// Provider Registry
// ============================================================================

/** Registry of all registered providers */
const providerRegistry: Map<string, ExternalCommentProvider> = new Map();

/**
 * Register a new external comment provider.
 * This allows for extensibility - new providers can be added at runtime.
 */
export function registerProvider(provider: ExternalCommentProvider): void {
  if (providerRegistry.has(provider.name)) {
    console.warn(`[ExternalComments] Provider "${provider.name}" already registered, overwriting`);
  }
  providerRegistry.set(provider.name, provider);
  console.log(`[ExternalComments] Registered provider: ${provider.name}`);
}

/**
 * Unregister a provider by name
 */
export function unregisterProvider(name: string): boolean {
  return providerRegistry.delete(name);
}

/**
 * Get a specific provider by name
 */
export function getProvider(name: string): ExternalCommentProvider | undefined {
  return providerRegistry.get(name);
}

/**
 * Get all registered providers
 */
export function getAllProviders(): ExternalCommentProvider[] {
  return Array.from(providerRegistry.values());
}

/**
 * Get providers that support a specific media type
 */
export function getProvidersForMediaType(
  mediaType: 'TV' | 'MOVIE' | 'ANIME' | 'MANGA'
): ExternalCommentProvider[] {
  return getAllProviders().filter(
    (provider) =>
      provider.supportedMediaTypes.includes(mediaType) && provider.isConfigured()
  );
}

// ============================================================================
// Provider Implementations (Stubs)
// ============================================================================

/**
 * Reddit Comment Provider
 * Searches subreddits like r/television, r/movies, r/anime, r/manga
 */
export class RedditCommentProvider implements ExternalCommentProvider {
  name = 'reddit';
  displayName = 'Reddit';
  supportedMediaTypes: Array<'TV' | 'MOVIE' | 'ANIME' | 'MANGA'> = [
    'TV',
    'MOVIE',
    'ANIME',
    'MANGA',
  ];

  private readonly subredditMap: Record<string, string[]> = {
    TV: ['television', 'TrueFilm', 'NetflixBestOf'],
    MOVIE: ['movies', 'TrueFilm', 'MovieDetails'],
    ANIME: ['anime', 'AnimeSuggest', 'AnimeDiscussion'],
    MANGA: ['manga', 'MangaCollectors'],
  };

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    // TODO: Implement Reddit API integration
    // Would use Reddit's search API to find discussion posts
    // Example: https://oauth.reddit.com/r/{subreddit}/search?q={title}
    // Then fetch comments from those posts

    const subreddits = this.subredditMap[params.mediaType] || [];
    console.log(
      `[Reddit] Would fetch comments for: "${params.title}" from subreddits: ${subreddits.join(', ')}`
    );

    if (params.seasonNumber !== undefined) {
      console.log(`[Reddit] Season ${params.seasonNumber}, Episode ${params.episodeNumber ?? 'all'}`);
    }

    // Return empty array - actual implementation would call Reddit API
    return [];
  }

  isConfigured(): boolean {
    // TODO: Check for Reddit API credentials
    // return !!process.env.REDDIT_CLIENT_ID && !!process.env.REDDIT_CLIENT_SECRET;
    return true; // Stub always returns true for testing
  }
}

/**
 * MyAnimeList Comment Provider
 * Only supports ANIME and MANGA media types
 */
export class MALCommentProvider implements ExternalCommentProvider {
  name = 'mal';
  displayName = 'MyAnimeList';
  supportedMediaTypes: Array<'TV' | 'MOVIE' | 'ANIME' | 'MANGA'> = ['ANIME', 'MANGA'];

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    // TODO: Implement MAL API integration
    // Would use MAL's API to search for the anime/manga, then fetch reviews/discussions
    // Example: https://api.myanimelist.net/v2/anime?q={title}

    console.log(`[MAL] Would fetch comments for: "${params.title}" (${params.mediaType})`);

    if (params.mediaType !== 'ANIME' && params.mediaType !== 'MANGA') {
      console.log(`[MAL] Skipping - not an anime/manga media type`);
      return [];
    }

    // Return empty array - actual implementation would call MAL API
    return [];
  }

  isConfigured(): boolean {
    // TODO: Check for MAL API credentials
    // return !!process.env.MAL_CLIENT_ID;
    return true; // Stub always returns true for testing
  }
}

/**
 * AniList Comment Provider
 * Only supports ANIME and MANGA media types
 */
export class AniListCommentProvider implements ExternalCommentProvider {
  name = 'anilist';
  displayName = 'AniList';
  supportedMediaTypes: Array<'TV' | 'MOVIE' | 'ANIME' | 'MANGA'> = ['ANIME', 'MANGA'];

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    // TODO: Implement AniList GraphQL API integration
    // Would query AniList's GraphQL API for the media, then fetch activity/reviews
    // Endpoint: https://graphql.anilist.co

    console.log(`[AniList] Would fetch comments for: "${params.title}" (${params.mediaType})`);

    if (params.mediaType !== 'ANIME' && params.mediaType !== 'MANGA') {
      console.log(`[AniList] Skipping - not an anime/manga media type`);
      return [];
    }

    // Return empty array - actual implementation would call AniList API
    return [];
  }

  isConfigured(): boolean {
    // AniList doesn't require API keys for public queries
    return true;
  }
}

/**
 * Letterboxd Comment Provider
 * Only supports MOVIE media type
 */
export class LetterboxdCommentProvider implements ExternalCommentProvider {
  name = 'letterboxd';
  displayName = 'Letterboxd';
  supportedMediaTypes: Array<'TV' | 'MOVIE' | 'ANIME' | 'MANGA'> = ['MOVIE'];

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    // TODO: Implement Letterboxd API integration
    // Note: Letterboxd API is invite-only, may need to use web scraping
    // or wait for API access

    console.log(`[Letterboxd] Would fetch comments for: "${params.title}" (${params.mediaType})`);

    if (params.mediaType !== 'MOVIE') {
      console.log(`[Letterboxd] Skipping - not a movie`);
      return [];
    }

    if (params.year) {
      console.log(`[Letterboxd] Year: ${params.year}`);
    }

    // Return empty array - actual implementation would call Letterboxd API
    return [];
  }

  isConfigured(): boolean {
    // TODO: Check for Letterboxd API credentials
    // return !!process.env.LETTERBOXD_API_KEY;
    return true; // Stub always returns true for testing
  }
}

/**
 * HiAnime Comment Provider
 * Fetches comments from HiAnime episode pages
 * Only supports ANIME media type
 */
export class HiAnimeCommentProvider implements ExternalCommentProvider {
  name = 'hianime';
  displayName = 'HiAnime';
  supportedMediaTypes: Array<'TV' | 'MOVIE' | 'ANIME' | 'MANGA'> = ['ANIME'];

  private readonly baseUrl = 'https://hianime.to';

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    if (params.mediaType !== 'ANIME') {
      console.log(`[HiAnime] Skipping - not anime content`);
      return [];
    }

    // HiAnime requires a specific episode ID from their system
    const episodeId = params.providerIds?.hianimeEpisodeId;
    if (!episodeId) {
      console.log(`[HiAnime] Skipping - no hianimeEpisodeId provided`);
      return [];
    }

    console.log(`[HiAnime] Fetching comments for episode ID: ${episodeId}`);

    try {
      const apiUrl = `${this.baseUrl}/ajax/comment/list/${episodeId}?sort=newest`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `${this.baseUrl}/watch/anime?ep=${episodeId}`,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { status?: boolean; html?: string };
      
      if (!data.html) {
        console.log(`[HiAnime] No HTML content in response`);
        return [];
      }

      // Parse the HTML response using cheerio
      const $ = cheerio.load(data.html);
      const comments: ExternalComment[] = [];
      const limit = params.limit ?? 50;

      $('.cw_l-line').each((i, element) => {
        if (comments.length >= limit) return false; // Stop if we've reached the limit

        const $el = $(element);

        const commentId = ($el.attr('id') || '').replace('cm-', '');
        const username = $el.find('.user-name').text().trim();
        const content = $el.find('.content').text().trim();
        const timestamp = $el.find('.time').text().trim();
        const avatar = $el.find('.item-avatar img').attr('src');
        const likes = $el.find('.btn-vote .value').text().trim();

        if (!commentId || !content) return; // Skip invalid comments

        comments.push({
          externalSource: 'hianime',
          externalId: commentId,
          externalAuthor: username || 'Anonymous',
          externalAuthorAvatar: avatar,
          externalUrl: `${this.baseUrl}/watch/anime?ep=${episodeId}#cm-${commentId}`,
          content: content,
          createdAt: this.parseHiAnimeTimestamp(timestamp),
          score: parseInt(likes, 10) || 0,
        });
      });

      console.log(`[HiAnime] Fetched ${comments.length} comments`);
      return comments;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[HiAnime] Error fetching comments: ${errorMessage}`);
      
      if (errorMessage.includes('403')) {
        console.error('[HiAnime] 403 error - site may be protected by Cloudflare');
      }
      
      throw error;
    }
  }

  /**
   * Parse HiAnime's relative timestamp format (e.g., "2 hours ago", "3 days ago")
   */
  private parseHiAnimeTimestamp(timestamp: string): Date {
    const now = new Date();
    const lower = timestamp.toLowerCase();

    // Try to parse relative timestamps
    const match = lower.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];

      switch (unit) {
        case 'second':
          now.setSeconds(now.getSeconds() - value);
          break;
        case 'minute':
          now.setMinutes(now.getMinutes() - value);
          break;
        case 'hour':
          now.setHours(now.getHours() - value);
          break;
        case 'day':
          now.setDate(now.getDate() - value);
          break;
        case 'week':
          now.setDate(now.getDate() - value * 7);
          break;
        case 'month':
          now.setMonth(now.getMonth() - value);
          break;
        case 'year':
          now.setFullYear(now.getFullYear() - value);
          break;
      }
      return now;
    }

    // If can't parse, return current time
    return now;
  }

  isConfigured(): boolean {
    // HiAnime doesn't require API keys
    return true;
  }
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Map external media types to Prisma MediaType
 */
function mapToPrismaMediaType(mediaType: 'TV' | 'MOVIE' | 'ANIME' | 'MANGA'): MediaType {
  return mediaType as MediaType;
}

/**
 * Fetch comments from all relevant providers and import them to the database.
 * 
 * @param refId - The media item reference ID
 * @param mediaType - The type of media
 * @param title - The title to search for
 * @param options - Additional options like year, season, episode
 * @returns Result containing import count and providers used
 */
export async function fetchAndImportComments(
  refId: string,
  mediaType: 'TV' | 'MOVIE' | 'ANIME' | 'MANGA',
  title: string,
  options?: {
    year?: number;
    seasonNumber?: number;
    episodeNumber?: number;
    chapterNumber?: number;
    volumeNumber?: number;
    limit?: number;
    providerNames?: string[]; // Optionally filter to specific providers
    providerIds?: {
      hianimeEpisodeId?: string;
      [key: string]: string | undefined;
    };
  }
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    providers: [],
    errors: [],
  };

  // Get applicable providers
  let providers = getProvidersForMediaType(mediaType);

  // Filter to specific providers if requested
  if (options?.providerNames && options.providerNames.length > 0) {
    providers = providers.filter((p) => options.providerNames!.includes(p.name));
  }

  if (providers.length === 0) {
    console.log(`[ExternalComments] No configured providers for media type: ${mediaType}`);
    return result;
  }

  console.log(
    `[ExternalComments] Fetching comments for "${title}" from ${providers.length} providers`
  );

  // Build fetch params
  const fetchParams: FetchCommentsParams = {
    title,
    mediaType,
    year: options?.year,
    seasonNumber: options?.seasonNumber,
    episodeNumber: options?.episodeNumber,
    chapterNumber: options?.chapterNumber,
    volumeNumber: options?.volumeNumber,
    limit: options?.limit ?? 50,
    providerIds: options?.providerIds,
  };

  // Fetch from all providers in parallel
  const fetchPromises = providers.map(async (provider) => {
    try {
      const comments = await provider.fetchComments(fetchParams);
      return { provider: provider.name, comments, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ExternalComments] Error from ${provider.name}: ${errorMessage}`);
      return { provider: provider.name, comments: [], error: errorMessage };
    }
  });

  const fetchResults = await Promise.all(fetchPromises);

  // Import all comments to database
  const prismaMediaType = mapToPrismaMediaType(mediaType);

  for (const fetchResult of fetchResults) {
    if (fetchResult.error) {
      result.errors.push({ provider: fetchResult.provider, error: fetchResult.error });
      continue;
    }

    if (fetchResult.comments.length > 0) {
      result.providers.push(fetchResult.provider);
    }

    for (const comment of fetchResult.comments) {
      try {
        await commentService.importExternalComment({
          content: comment.content,
          refId,
          mediaType: prismaMediaType,
          seasonNumber: options?.seasonNumber,
          episodeNumber: options?.episodeNumber,
          chapterNumber: options?.chapterNumber,
          volumeNumber: options?.volumeNumber,
          externalSource: comment.externalSource,
          externalId: comment.externalId,
          externalAuthor: comment.externalAuthor,
          externalAuthorAvatar: comment.externalAuthorAvatar,
          externalUrl: comment.externalUrl,
          createdAt: comment.createdAt,
        });
        result.imported++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[ExternalComments] Failed to import comment ${comment.externalId}: ${errorMessage}`
        );
      }
    }
  }

  console.log(
    `[ExternalComments] Imported ${result.imported} comments from ${result.providers.length} providers`
  );

  return result;
}

/**
 * Fetch comments from a specific provider only
 */
export async function fetchFromProvider(
  providerName: string,
  refId: string,
  mediaType: 'TV' | 'MOVIE' | 'ANIME' | 'MANGA',
  title: string,
  options?: {
    year?: number;
    seasonNumber?: number;
    episodeNumber?: number;
    chapterNumber?: number;
    volumeNumber?: number;
    limit?: number;
    providerIds?: {
      hianimeEpisodeId?: string;
      [key: string]: string | undefined;
    };
  }
): Promise<ImportResult> {
  return fetchAndImportComments(refId, mediaType, title, {
    ...options,
    providerNames: [providerName],
  });
}

// ============================================================================
// Smart Comment Fetching with Resolution
// ============================================================================

/** Providers that support direct ID-based comment fetching */
const SUPPORTED_COMMENT_PROVIDER_PREFIXES = ['mal:', 'anilist:', 'hianime:'];

/** Match threshold for accepting a resolved match */
const MATCH_THRESHOLD = 0.8;

/**
 * Check if a refId belongs to a supported comment provider
 */
function isRefIdFromSupportedProvider(refId: string): boolean {
  return SUPPORTED_COMMENT_PROVIDER_PREFIXES.some((prefix) =>
    refId.toLowerCase().startsWith(prefix)
  );
}

/**
 * Extract provider name and ID from a refId
 * @example "mal:12345" -> { provider: "mal", id: "12345" }
 */
function parseRefId(refId: string): { provider: string; id: string } | null {
  const colonIndex = refId.indexOf(':');
  if (colonIndex === -1) return null;

  const provider = refId.substring(0, colonIndex).toLowerCase();
  const id = refId.substring(colonIndex + 1);

  return { provider, id };
}

/**
 * Convert a UnifiedSearchResult to a MatchableItem for similarity comparison
 */
function toMatchableItem(result: UnifiedSearchResult): MatchableItem {
  return {
    title: result.title,
    year: result.year ?? null,
    alternativeTitles: result.altTitles,
  };
}

/**
 * Search meta providers and find the best match for a given title
 */
async function searchAndMatchProviders(
  title: string,
  mediaType: 'ANIME' | 'MOVIE' | 'TV' | 'MANGA',
  year?: number
): Promise<ResolvedProviderMatch[]> {
  const target: MatchableItem = {
    title,
    year: year ?? null,
  };

  const resolvedMatches: ResolvedProviderMatch[] = [];
  const searchPromises: Promise<void>[] = [];

  // Search Anilist for anime/manga
  if (mediaType === 'ANIME' || mediaType === 'MANGA') {
    const searchFn =
      mediaType === 'ANIME' ? searchAnilistAnime : searchAnilistManga;
    const providerName = mediaType === 'ANIME' ? 'anilist' : 'anilist-manga';

    searchPromises.push(
      (async () => {
        try {
          const results = await searchFn(title, { page: 1, perPage: 10 });
          console.log(
            `[Resolution] Anilist returned ${results.results.length} results for "${title}"`
          );

          const matchableResults = results.results.map((r) => ({
            original: r,
            matchable: toMatchableItem(r),
          }));

          const bestMatch = findBestMatch(
            matchableResults.map((m) => m.matchable),
            target,
            MATCH_THRESHOLD
          );

          if (bestMatch) {
            const matchedResult = matchableResults.find(
              (m) => m.matchable === bestMatch
            );
            if (matchedResult) {
              const similarity = calculateSimilarity(bestMatch, target);
              console.log(
                `[Resolution] Anilist match: "${matchedResult.original.title}" (score: ${similarity.score.toFixed(2)})`
              );
              resolvedMatches.push({
                provider: providerName,
                providerId: matchedResult.original.id,
                title: matchedResult.original.title,
                matchScore: similarity.score,
                alternativeTitles: matchedResult.original.altTitles,
                year: matchedResult.original.year,
              });
            }
          }
        } catch (error) {
          console.error(`[Resolution] Anilist search error:`, error);
        }
      })()
    );
  }

  // Search MAL for anime/manga
  if (mediaType === 'ANIME' || mediaType === 'MANGA') {
    searchPromises.push(
      (async () => {
        try {
          const results = await searchMAL(title, { page: 1 });
          console.log(
            `[Resolution] MAL returned ${results.results.length} results for "${title}"`
          );

          const matchableResults = results.results.map((r) => ({
            original: r,
            matchable: toMatchableItem(r),
          }));

          const bestMatch = findBestMatch(
            matchableResults.map((m) => m.matchable),
            target,
            MATCH_THRESHOLD
          );

          if (bestMatch) {
            const matchedResult = matchableResults.find(
              (m) => m.matchable === bestMatch
            );
            if (matchedResult) {
              const similarity = calculateSimilarity(bestMatch, target);
              console.log(
                `[Resolution] MAL match: "${matchedResult.original.title}" (score: ${similarity.score.toFixed(2)})`
              );
              resolvedMatches.push({
                provider: 'myanimelist',
                providerId: matchedResult.original.id,
                title: matchedResult.original.title,
                matchScore: similarity.score,
                alternativeTitles: matchedResult.original.altTitles,
                year: matchedResult.original.year,
              });
            }
          }
        } catch (error) {
          console.error(`[Resolution] MAL search error:`, error);
        }
      })()
    );
  }

  // Search TMDB for movies/TV
  if (mediaType === 'MOVIE' || mediaType === 'TV') {
    searchPromises.push(
      (async () => {
        try {
          const results = await searchTMDB(title, { page: 1 });
          console.log(
            `[Resolution] TMDB returned ${results.results.length} results for "${title}"`
          );

          const matchableResults = results.results.map((r) => ({
            original: r,
            matchable: toMatchableItem(r),
          }));

          const bestMatch = findBestMatch(
            matchableResults.map((m) => m.matchable),
            target,
            MATCH_THRESHOLD
          );

          if (bestMatch) {
            const matchedResult = matchableResults.find(
              (m) => m.matchable === bestMatch
            );
            if (matchedResult) {
              const similarity = calculateSimilarity(bestMatch, target);
              console.log(
                `[Resolution] TMDB match: "${matchedResult.original.title}" (score: ${similarity.score.toFixed(2)})`
              );
              resolvedMatches.push({
                provider: 'tmdb',
                providerId: matchedResult.original.id,
                title: matchedResult.original.title,
                matchScore: similarity.score,
                alternativeTitles: matchedResult.original.altTitles,
                year: matchedResult.original.year,
              });
            }
          }
        } catch (error) {
          console.error(`[Resolution] TMDB search error:`, error);
        }
      })()
    );
  }

  await Promise.all(searchPromises);

  // Sort by match score descending
  resolvedMatches.sort((a, b) => b.matchScore - a.matchScore);

  return resolvedMatches;
}

/**
 * Get title-based providers that can search by title without needing a specific ID
 */
function getTitleBasedProviders(
  mediaType: 'ANIME' | 'MOVIE' | 'TV' | 'MANGA'
): string[] {
  // Reddit can search by title for all media types
  const providers: string[] = ['reddit'];

  // Add other title-based providers based on media type
  if (mediaType === 'MOVIE') {
    providers.push('letterboxd');
  }

  return providers;
}

/**
 * Preview what providers would be matched for a given title without fetching comments.
 * Useful for debugging and UI previews.
 */
export async function previewResolution(
  params: CommentFetchWithResolutionParams
): Promise<ResolutionPreviewResult> {
  const { title, mediaType, year, refId } = params;

  console.log(
    `[Resolution] Preview for "${title}" (${mediaType}), year: ${year ?? 'unknown'}, refId: ${refId ?? 'none'}`
  );

  let resolvedMatches: ResolvedProviderMatch[] = [];

  // Check if refId is from a supported provider
  if (refId && isRefIdFromSupportedProvider(refId)) {
    const parsed = parseRefId(refId);
    if (parsed) {
      console.log(
        `[Resolution] RefId "${refId}" is from supported provider: ${parsed.provider}`
      );
      resolvedMatches.push({
        provider: parsed.provider,
        providerId: parsed.id,
        title: title,
        matchScore: 1.0, // Direct ID match has perfect score
        year,
      });
    }
  }

  // Search for matches from meta providers
  const searchedMatches = await searchAndMatchProviders(title, mediaType, year);
  resolvedMatches = [...resolvedMatches, ...searchedMatches];

  // Deduplicate by provider (keep highest score)
  const providerMap = new Map<string, ResolvedProviderMatch>();
  for (const match of resolvedMatches) {
    const existing = providerMap.get(match.provider);
    if (!existing || match.matchScore > existing.matchScore) {
      providerMap.set(match.provider, match);
    }
  }
  resolvedMatches = Array.from(providerMap.values());

  // Get title-based providers
  const titleBasedProviders = getTitleBasedProviders(mediaType);

  // Calculate overall confidence
  const maxScore = resolvedMatches.reduce(
    (max, m) => Math.max(max, m.matchScore),
    0
  );
  const confidence =
    resolvedMatches.length > 0
      ? Math.min(1, (maxScore + resolvedMatches.length * 0.1) / 1.5)
      : 0;

  return {
    resolvedMatches,
    titleBasedProviders,
    confidence,
  };
}

/**
 * Fetch comments with smart resolution.
 * This function resolves content even when the specific provider ID isn't known,
 * using title-based search and matching.
 *
 * Flow:
 * 1. If refId is provided and belongs to a supported comment provider, fetch directly
 * 2. If refId is unsupported or missing:
 *    a. Search supported meta providers (MAL, Anilist) using the title
 *    b. Use findBestMatch to find the best result
 *    c. If match score > 0.8, use that ID to fetch comments
 *    d. Also search on title-based providers (Reddit) directly
 * 3. Aggregate all found comments
 * 4. Return merged results
 */
export async function fetchCommentsWithResolution(
  params: CommentFetchWithResolutionParams
): Promise<AggregatedComments> {
  const {
    title,
    mediaType,
    year,
    refId,
    seasonNumber,
    episodeNumber,
    providerIds,
    limit = 50,
  } = params;

  console.log(
    `[Resolution] Fetching comments for "${title}" (${mediaType}), year: ${year ?? 'unknown'}`
  );

  const result: AggregatedComments = {
    comments: [],
    resolvedMatches: [],
    errors: [],
    confidence: 0,
    usedDirectFetch: false,
  };

  const commentPromises: Promise<{
    provider: string;
    comments: ExternalComment[];
    error: string | null;
  }>[] = [];

  // Step 1: Check if refId is from a supported provider
  if (refId && isRefIdFromSupportedProvider(refId)) {
    const parsed = parseRefId(refId);
    if (parsed) {
      console.log(
        `[Resolution] Using direct fetch with provider: ${parsed.provider}, id: ${parsed.id}`
      );
      result.usedDirectFetch = true;

      result.resolvedMatches.push({
        provider: parsed.provider,
        providerId: parsed.id,
        title,
        matchScore: 1.0,
        year,
      });

      // Fetch from the provider directly using its ID
      const provider = getProvider(parsed.provider);
      if (provider) {
        commentPromises.push(
          (async () => {
            try {
              const comments = await provider.fetchComments({
                title,
                mediaType,
                year,
                seasonNumber,
                episodeNumber,
                limit,
                providerIds: {
                  ...providerIds,
                  [`${parsed.provider}Id`]: parsed.id,
                },
              });
              return { provider: parsed.provider, comments, error: null };
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              return { provider: parsed.provider, comments: [], error: errorMessage };
            }
          })()
        );
      }
    }
  }

  // Step 2: Search and match with meta providers
  const searchedMatches = await searchAndMatchProviders(title, mediaType, year);

  for (const match of searchedMatches) {
    // Skip if we already have a direct fetch for this provider
    if (result.resolvedMatches.some((m) => m.provider === match.provider)) {
      continue;
    }

    result.resolvedMatches.push(match);

    // Only fetch if score is above threshold
    if (match.matchScore >= MATCH_THRESHOLD) {
      const provider = getProvider(match.provider);
      if (provider) {
        console.log(
          `[Resolution] Fetching from ${match.provider} with resolved ID: ${match.providerId}`
        );
        commentPromises.push(
          (async () => {
            try {
              const comments = await provider.fetchComments({
                title: match.title, // Use the matched title
                mediaType,
                year: match.year,
                seasonNumber,
                episodeNumber,
                limit,
                providerIds: {
                  ...providerIds,
                  [`${match.provider}Id`]: match.providerId,
                },
              });
              return { provider: match.provider, comments, error: null };
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              return { provider: match.provider, comments: [], error: errorMessage };
            }
          })()
        );
      }
    }
  }

  // Step 3: Fetch from title-based providers (like Reddit)
  const titleBasedProviders = getTitleBasedProviders(mediaType);
  for (const providerName of titleBasedProviders) {
    // Skip if already fetching from this provider
    if (result.resolvedMatches.some((m) => m.provider === providerName)) {
      continue;
    }

    const provider = getProvider(providerName);
    if (provider && provider.supportedMediaTypes.includes(mediaType)) {
      console.log(`[Resolution] Fetching from title-based provider: ${providerName}`);
      commentPromises.push(
        (async () => {
          try {
            const comments = await provider.fetchComments({
              title,
              mediaType,
              year,
              seasonNumber,
              episodeNumber,
              limit,
              providerIds,
            });
            return { provider: providerName, comments, error: null };
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            return { provider: providerName, comments: [], error: errorMessage };
          }
        })()
      );
    }
  }

  // Step 4: Wait for all fetches to complete
  const fetchResults = await Promise.all(commentPromises);

  // Aggregate results
  const seenCommentIds = new Set<string>();
  for (const fetchResult of fetchResults) {
    if (fetchResult.error) {
      result.errors.push({
        provider: fetchResult.provider,
        error: fetchResult.error,
      });
      continue;
    }

    for (const comment of fetchResult.comments) {
      // Deduplicate by external source + ID
      const key = `${comment.externalSource}:${comment.externalId}`;
      if (!seenCommentIds.has(key)) {
        seenCommentIds.add(key);
        result.comments.push(comment);
      }
    }
  }

  // Sort comments by score (highest first), then by date (newest first)
  result.comments.sort((a, b) => {
    if ((b.score ?? 0) !== (a.score ?? 0)) {
      return (b.score ?? 0) - (a.score ?? 0);
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Limit total comments
  result.comments = result.comments.slice(0, limit);

  // Calculate overall confidence
  const maxScore = result.resolvedMatches.reduce(
    (max, m) => Math.max(max, m.matchScore),
    0
  );
  result.confidence = result.usedDirectFetch
    ? 1.0
    : result.resolvedMatches.length > 0
      ? Math.min(1, (maxScore + result.resolvedMatches.length * 0.1) / 1.5)
      : 0;

  console.log(
    `[Resolution] Fetched ${result.comments.length} comments from ${result.resolvedMatches.length} providers (confidence: ${result.confidence.toFixed(2)})`
  );

  return result;
}

// ============================================================================
// Background Job Functions
// ============================================================================

/**
 * Refresh external comments for popular media items.
 * This could be called by a cron job to keep comments up to date.
 * 
 * NOTE: This is a stub implementation. A real implementation would:
 * 1. Query for media items that are trending/popular
 * 2. Fetch fresh comments for each
 * 3. Handle rate limiting appropriately
 */
export async function refreshExternalCommentsForPopularMedia(): Promise<{
  mediaProcessed: number;
  totalImported: number;
}> {
  console.log('[ExternalComments] Starting refresh for popular media...');

  // TODO: Implement actual refresh logic
  // 1. Query MediaItem for items with high activity or on trending lists
  // 2. For each, call fetchAndImportComments
  // 3. Respect rate limits (add delays between provider calls)

  console.log('[ExternalComments] Refresh complete (stub implementation)');

  return {
    mediaProcessed: 0,
    totalImported: 0,
  };
}

/**
 * Schedule parameters for background jobs
 */
export interface RefreshScheduleParams {
  /** How often to run refresh (in hours) */
  intervalHours: number;
  /** Maximum number of media items to process per run */
  maxItemsPerRun: number;
  /** Minimum age of last refresh before re-fetching (in hours) */
  minRefreshAgeHours: number;
}

/**
 * Default refresh schedule parameters
 */
export const DEFAULT_REFRESH_SCHEDULE: RefreshScheduleParams = {
  intervalHours: 6,
  maxItemsPerRun: 100,
  minRefreshAgeHours: 24,
};

// ============================================================================
// Initialization - Register Default Providers
// ============================================================================

/**
 * Initialize the external comment service with default providers.
 * Call this during app startup.
 */
export function initializeExternalCommentService(): void {
  console.log('[ExternalComments] Initializing service...');

  // Register default providers
  registerProvider(new RedditCommentProvider());
  registerProvider(new MALCommentProvider());
  registerProvider(new AniListCommentProvider());
  registerProvider(new LetterboxdCommentProvider());
  registerProvider(new HiAnimeCommentProvider());

  console.log(`[ExternalComments] Initialized with ${providerRegistry.size} providers`);
}

// Provider classes are already exported via their class declarations above
