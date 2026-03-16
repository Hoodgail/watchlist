import * as cheerio from 'cheerio';
import type { MediaType } from '@prisma/client';
import {
  calculateSimilarity,
  findBestMatch,
  type MatchableItem,
} from '@shared/matching.js';
import {
  searchAnilistAnime,
  searchAnilistManga,
  searchMAL,
  searchTMDB,
} from '../../../services/consumet/metaProviders.js';
import type { UnifiedSearchResult } from '../../../services/consumet/types.js';
import type {
  AggregatedComments,
  CommentFetchWithResolutionParams,
  ExternalComment,
  ExternalCommentProvider,
  FetchCommentsParams,
  ImportResult,
  ResolutionPreviewResult,
  ResolvedProviderMatch,
  SupportedCommentMediaType,
} from '../application/dto/comments.js';
import type { CommentsGateway } from '../application/ports/CommentsGateway.js';
import type { ExternalCommentsGateway } from '../application/ports/ExternalCommentsGateway.js';

const SUPPORTED_COMMENT_PROVIDER_PREFIXES = ['mal:', 'anilist:', 'hianime:'];
const MATCH_THRESHOLD = 0.8;

class RedditCommentProvider implements ExternalCommentProvider {
  name = 'reddit';
  displayName = 'Reddit';
  supportedMediaTypes: SupportedCommentMediaType[] = ['TV', 'MOVIE', 'ANIME', 'MANGA'];

  private readonly subredditMap: Record<SupportedCommentMediaType, string[]> = {
    TV: ['television', 'TrueFilm', 'NetflixBestOf'],
    MOVIE: ['movies', 'TrueFilm', 'MovieDetails'],
    ANIME: ['anime', 'AnimeSuggest', 'AnimeDiscussion'],
    MANGA: ['manga', 'MangaCollectors'],
  };

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    const subreddits = this.subredditMap[params.mediaType] || [];
    console.log(
      `[Reddit] Would fetch comments for: "${params.title}" from subreddits: ${subreddits.join(', ')}`,
    );

    if (params.seasonNumber !== undefined) {
      console.log(`[Reddit] Season ${params.seasonNumber}, Episode ${params.episodeNumber ?? 'all'}`);
    }

    return [];
  }

  isConfigured(): boolean {
    return true;
  }
}

class MALCommentProvider implements ExternalCommentProvider {
  name = 'mal';
  displayName = 'MyAnimeList';
  supportedMediaTypes: SupportedCommentMediaType[] = ['ANIME', 'MANGA'];

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    console.log(`[MAL] Would fetch comments for: "${params.title}" (${params.mediaType})`);

    if (params.mediaType !== 'ANIME' && params.mediaType !== 'MANGA') {
      console.log('[MAL] Skipping - not an anime/manga media type');
      return [];
    }

    return [];
  }

  isConfigured(): boolean {
    return true;
  }
}

class AniListCommentProvider implements ExternalCommentProvider {
  name = 'anilist';
  displayName = 'AniList';
  supportedMediaTypes: SupportedCommentMediaType[] = ['ANIME', 'MANGA'];

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    console.log(`[AniList] Would fetch comments for: "${params.title}" (${params.mediaType})`);

    if (params.mediaType !== 'ANIME' && params.mediaType !== 'MANGA') {
      console.log('[AniList] Skipping - not an anime/manga media type');
      return [];
    }

    return [];
  }

  isConfigured(): boolean {
    return true;
  }
}

class LetterboxdCommentProvider implements ExternalCommentProvider {
  name = 'letterboxd';
  displayName = 'Letterboxd';
  supportedMediaTypes: SupportedCommentMediaType[] = ['MOVIE'];

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    console.log(`[Letterboxd] Would fetch comments for: "${params.title}" (${params.mediaType})`);

    if (params.mediaType !== 'MOVIE') {
      console.log('[Letterboxd] Skipping - not a movie');
      return [];
    }

    if (params.year) {
      console.log(`[Letterboxd] Year: ${params.year}`);
    }

    return [];
  }

  isConfigured(): boolean {
    return true;
  }
}

class HiAnimeCommentProvider implements ExternalCommentProvider {
  name = 'hianime';
  displayName = 'HiAnime';
  supportedMediaTypes: SupportedCommentMediaType[] = ['ANIME'];

  private readonly baseUrl = 'https://hianime.to';

  async fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]> {
    if (params.mediaType !== 'ANIME') {
      console.log('[HiAnime] Skipping - not anime content');
      return [];
    }

    const episodeId = params.providerIds?.hianimeEpisodeId;
    if (!episodeId) {
      console.log('[HiAnime] Skipping - no hianimeEpisodeId provided');
      return [];
    }

    console.log(`[HiAnime] Fetching comments for episode ID: ${episodeId}`);

    try {
      const apiUrl = `${this.baseUrl}/ajax/comment/list/${episodeId}?sort=newest`;
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: `${this.baseUrl}/watch/anime?ep=${episodeId}`,
          'X-Requested-With': 'XMLHttpRequest',
          Accept: 'application/json, text/javascript, */*; q=0.01',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { status?: boolean; html?: string };
      if (!data.html) {
        console.log('[HiAnime] No HTML content in response');
        return [];
      }

      const $ = cheerio.load(data.html);
      const comments: ExternalComment[] = [];
      const limit = params.limit ?? 50;

      $('.cw_l-line').each((_, element) => {
        if (comments.length >= limit) {
          return false;
        }

        const $element = $(element);
        const commentId = ($element.attr('id') || '').replace('cm-', '');
        const username = $element.find('.user-name').text().trim();
        const content = $element.find('.content').text().trim();
        const timestamp = $element.find('.time').text().trim();
        const avatar = $element.find('.item-avatar img').attr('src');
        const likes = $element.find('.btn-vote .value').text().trim();

        if (!commentId || !content) {
          return;
        }

        comments.push({
          externalSource: 'hianime',
          externalId: commentId,
          externalAuthor: username || 'Anonymous',
          externalAuthorAvatar: avatar,
          externalUrl: `${this.baseUrl}/watch/anime?ep=${episodeId}#cm-${commentId}`,
          content,
          createdAt: this.parseTimestamp(timestamp),
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

  isConfigured(): boolean {
    return true;
  }

  private parseTimestamp(timestamp: string): Date {
    const now = new Date();
    const lower = timestamp.toLowerCase();
    const match = lower.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/);

    if (!match) {
      return now;
    }

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
}

function mapToPrismaMediaType(mediaType: SupportedCommentMediaType): MediaType {
  return mediaType as MediaType;
}

function isRefIdFromSupportedProvider(refId: string): boolean {
  return SUPPORTED_COMMENT_PROVIDER_PREFIXES.some((prefix) => refId.toLowerCase().startsWith(prefix));
}

function parseRefId(refId: string): { provider: string; id: string } | null {
  const colonIndex = refId.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  return {
    provider: refId.substring(0, colonIndex).toLowerCase(),
    id: refId.substring(colonIndex + 1),
  };
}

function toMatchableItem(result: UnifiedSearchResult): MatchableItem {
  return {
    title: result.title,
    year: result.year ?? null,
    alternativeTitles: result.altTitles,
  };
}

function getTitleBasedProviders(mediaType: SupportedCommentMediaType): string[] {
  const providers = ['reddit'];
  if (mediaType === 'MOVIE') {
    providers.push('letterboxd');
  }
  return providers;
}

export function createPrismaExternalCommentsGateway(commentsGateway: CommentsGateway): ExternalCommentsGateway {
  const providerRegistry = new Map<string, ExternalCommentProvider>();

  function registerProvider(provider: ExternalCommentProvider): void {
    if (providerRegistry.has(provider.name)) {
      console.warn(`[ExternalComments] Provider "${provider.name}" already registered, overwriting`);
    }

    providerRegistry.set(provider.name, provider);
  }

  function getProvider(name: string): ExternalCommentProvider | undefined {
    return providerRegistry.get(name);
  }

  function getAllProviders(): ExternalCommentProvider[] {
    return Array.from(providerRegistry.values());
  }

  function getProvidersForMediaType(mediaType: SupportedCommentMediaType): ExternalCommentProvider[] {
    return getAllProviders().filter(
      (provider) => provider.supportedMediaTypes.includes(mediaType) && provider.isConfigured(),
    );
  }

  async function searchAndMatchProviders(
    title: string,
    mediaType: SupportedCommentMediaType,
    year?: number,
  ): Promise<ResolvedProviderMatch[]> {
    const target: MatchableItem = {
      title,
      year: year ?? null,
    };

    const resolvedMatches: ResolvedProviderMatch[] = [];
    const searchPromises: Promise<void>[] = [];

    if (mediaType === 'ANIME' || mediaType === 'MANGA') {
      const searchFn = mediaType === 'ANIME' ? searchAnilistAnime : searchAnilistManga;
      const providerName = mediaType === 'ANIME' ? 'anilist' : 'anilist-manga';

      searchPromises.push(
        (async () => {
          try {
            const results = await searchFn(title, { page: 1, perPage: 10 });
            console.log(`[Resolution] Anilist returned ${results.results.length} results for "${title}"`);

            const matchableResults = results.results.map((result) => ({
              original: result,
              matchable: toMatchableItem(result),
            }));

            const bestMatch = findBestMatch(
              matchableResults.map((result) => result.matchable),
              target,
              MATCH_THRESHOLD,
            );

            if (!bestMatch) {
              return;
            }

            const matchedResult = matchableResults.find((result) => result.matchable === bestMatch);
            if (!matchedResult) {
              return;
            }

            const similarity = calculateSimilarity(bestMatch, target);
            console.log(
              `[Resolution] Anilist match: "${matchedResult.original.title}" (score: ${similarity.score.toFixed(2)})`,
            );

            resolvedMatches.push({
              provider: providerName,
              providerId: matchedResult.original.id,
              title: matchedResult.original.title,
              matchScore: similarity.score,
              alternativeTitles: matchedResult.original.altTitles,
              year: matchedResult.original.year,
            });
          } catch (error) {
            console.error('[Resolution] Anilist search error:', error);
          }
        })(),
      );
    }

    if (mediaType === 'ANIME' || mediaType === 'MANGA') {
      searchPromises.push(
        (async () => {
          try {
            const results = await searchMAL(title, { page: 1 });
            console.log(`[Resolution] MAL returned ${results.results.length} results for "${title}"`);

            const matchableResults = results.results.map((result) => ({
              original: result,
              matchable: toMatchableItem(result),
            }));

            const bestMatch = findBestMatch(
              matchableResults.map((result) => result.matchable),
              target,
              MATCH_THRESHOLD,
            );

            if (!bestMatch) {
              return;
            }

            const matchedResult = matchableResults.find((result) => result.matchable === bestMatch);
            if (!matchedResult) {
              return;
            }

            const similarity = calculateSimilarity(bestMatch, target);
            console.log(`[Resolution] MAL match: "${matchedResult.original.title}" (score: ${similarity.score.toFixed(2)})`);

            resolvedMatches.push({
              provider: 'myanimelist',
              providerId: matchedResult.original.id,
              title: matchedResult.original.title,
              matchScore: similarity.score,
              alternativeTitles: matchedResult.original.altTitles,
              year: matchedResult.original.year,
            });
          } catch (error) {
            console.error('[Resolution] MAL search error:', error);
          }
        })(),
      );
    }

    if (mediaType === 'MOVIE' || mediaType === 'TV') {
      searchPromises.push(
        (async () => {
          try {
            const results = await searchTMDB(title, { page: 1 });
            console.log(`[Resolution] TMDB returned ${results.results.length} results for "${title}"`);

            const matchableResults = results.results.map((result) => ({
              original: result,
              matchable: toMatchableItem(result),
            }));

            const bestMatch = findBestMatch(
              matchableResults.map((result) => result.matchable),
              target,
              MATCH_THRESHOLD,
            );

            if (!bestMatch) {
              return;
            }

            const matchedResult = matchableResults.find((result) => result.matchable === bestMatch);
            if (!matchedResult) {
              return;
            }

            const similarity = calculateSimilarity(bestMatch, target);
            console.log(`[Resolution] TMDB match: "${matchedResult.original.title}" (score: ${similarity.score.toFixed(2)})`);

            resolvedMatches.push({
              provider: 'tmdb',
              providerId: matchedResult.original.id,
              title: matchedResult.original.title,
              matchScore: similarity.score,
              alternativeTitles: matchedResult.original.altTitles,
              year: matchedResult.original.year,
            });
          } catch (error) {
            console.error('[Resolution] TMDB search error:', error);
          }
        })(),
      );
    }

    await Promise.all(searchPromises);
    resolvedMatches.sort((left, right) => right.matchScore - left.matchScore);
    return resolvedMatches;
  }

  registerProvider(new RedditCommentProvider());
  registerProvider(new MALCommentProvider());
  registerProvider(new AniListCommentProvider());
  registerProvider(new LetterboxdCommentProvider());
  registerProvider(new HiAnimeCommentProvider());

  return {
    getAllProviders,
    getProvidersForMediaType,
    getProvider,

    async fetchAndImportComments(refId, mediaType, title, options) {
      const result: ImportResult = {
        imported: 0,
        providers: [],
        errors: [],
      };

      let providers = getProvidersForMediaType(mediaType);
      if (options?.providerNames && options.providerNames.length > 0) {
        providers = providers.filter((provider) => options.providerNames!.includes(provider.name));
      }

      if (providers.length === 0) {
        console.log(`[ExternalComments] No configured providers for media type: ${mediaType}`);
        return result;
      }

      console.log(`[ExternalComments] Fetching comments for "${title}" from ${providers.length} providers`);

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

      const fetchResults = await Promise.all(
        providers.map(async (provider) => {
          try {
            const comments = await provider.fetchComments(fetchParams);
            return { provider: provider.name, comments, error: null as string | null };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[ExternalComments] Error from ${provider.name}: ${errorMessage}`);
            return { provider: provider.name, comments: [], error: errorMessage };
          }
        }),
      );

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
            await commentsGateway.importExternalComment({
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
            result.imported += 1;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[ExternalComments] Failed to import comment ${comment.externalId}: ${errorMessage}`);
          }
        }
      }

      console.log(`[ExternalComments] Imported ${result.imported} comments from ${result.providers.length} providers`);
      return result;
    },

    async fetchFromProvider(providerName, refId, mediaType, title, options) {
      return this.fetchAndImportComments(refId, mediaType, title, {
        ...options,
        providerNames: [providerName],
      });
    },

    async previewResolution(params: CommentFetchWithResolutionParams): Promise<ResolutionPreviewResult> {
      const { title, mediaType, year, refId } = params;
      console.log(`[Resolution] Preview for "${title}" (${mediaType}), year: ${year ?? 'unknown'}, refId: ${refId ?? 'none'}`);

      let resolvedMatches: ResolvedProviderMatch[] = [];
      if (refId && isRefIdFromSupportedProvider(refId)) {
        const parsed = parseRefId(refId);
        if (parsed) {
          console.log(`[Resolution] RefId "${refId}" is from supported provider: ${parsed.provider}`);
          resolvedMatches.push({
            provider: parsed.provider,
            providerId: parsed.id,
            title,
            matchScore: 1,
            year,
          });
        }
      }

      resolvedMatches = [...resolvedMatches, ...(await searchAndMatchProviders(title, mediaType, year))];

      const providerMap = new Map<string, ResolvedProviderMatch>();
      for (const match of resolvedMatches) {
        const existing = providerMap.get(match.provider);
        if (!existing || match.matchScore > existing.matchScore) {
          providerMap.set(match.provider, match);
        }
      }

      resolvedMatches = Array.from(providerMap.values());
      const titleBasedProviders = getTitleBasedProviders(mediaType);
      const maxScore = resolvedMatches.reduce((max, match) => Math.max(max, match.matchScore), 0);
      const confidence =
        resolvedMatches.length > 0 ? Math.min(1, (maxScore + resolvedMatches.length * 0.1) / 1.5) : 0;

      return {
        resolvedMatches,
        titleBasedProviders,
        confidence,
      };
    },

    async fetchCommentsWithResolution(params: CommentFetchWithResolutionParams): Promise<AggregatedComments> {
      const { title, mediaType, year, refId, seasonNumber, episodeNumber, providerIds, limit = 50 } = params;
      console.log(`[Resolution] Fetching comments for "${title}" (${mediaType}), year: ${year ?? 'unknown'}`);

      const result: AggregatedComments = {
        comments: [],
        resolvedMatches: [],
        errors: [],
        confidence: 0,
        usedDirectFetch: false,
      };

      const commentPromises: Promise<{ provider: string; comments: ExternalComment[]; error: string | null }>[] = [];

      if (refId && isRefIdFromSupportedProvider(refId)) {
        const parsed = parseRefId(refId);
        if (parsed) {
          console.log(`[Resolution] Using direct fetch with provider: ${parsed.provider}, id: ${parsed.id}`);
          result.usedDirectFetch = true;
          result.resolvedMatches.push({
            provider: parsed.provider,
            providerId: parsed.id,
            title,
            matchScore: 1,
            year,
          });

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
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  return { provider: parsed.provider, comments: [], error: errorMessage };
                }
              })(),
            );
          }
        }
      }

      const searchedMatches = await searchAndMatchProviders(title, mediaType, year);
      for (const match of searchedMatches) {
        if (result.resolvedMatches.some((resolved) => resolved.provider === match.provider)) {
          continue;
        }

        result.resolvedMatches.push(match);
        if (match.matchScore < MATCH_THRESHOLD) {
          continue;
        }

        const provider = getProvider(match.provider);
        if (!provider) {
          continue;
        }

        console.log(`[Resolution] Fetching from ${match.provider} with resolved ID: ${match.providerId}`);
        commentPromises.push(
          (async () => {
            try {
              const comments = await provider.fetchComments({
                title: match.title,
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
              const errorMessage = error instanceof Error ? error.message : String(error);
              return { provider: match.provider, comments: [], error: errorMessage };
            }
          })(),
        );
      }

      for (const providerName of getTitleBasedProviders(mediaType)) {
        if (result.resolvedMatches.some((resolved) => resolved.provider === providerName)) {
          continue;
        }

        const provider = getProvider(providerName);
        if (!provider || !provider.supportedMediaTypes.includes(mediaType)) {
          continue;
        }

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
              const errorMessage = error instanceof Error ? error.message : String(error);
              return { provider: providerName, comments: [], error: errorMessage };
            }
          })(),
        );
      }

      const fetchResults = await Promise.all(commentPromises);
      const seenCommentIds = new Set<string>();

      for (const fetchResult of fetchResults) {
        if (fetchResult.error) {
          result.errors.push({ provider: fetchResult.provider, error: fetchResult.error });
          continue;
        }

        for (const comment of fetchResult.comments) {
          const key = `${comment.externalSource}:${comment.externalId}`;
          if (seenCommentIds.has(key)) {
            continue;
          }

          seenCommentIds.add(key);
          result.comments.push(comment);
        }
      }

      result.comments.sort((left, right) => {
        if ((right.score ?? 0) !== (left.score ?? 0)) {
          return (right.score ?? 0) - (left.score ?? 0);
        }
        return right.createdAt.getTime() - left.createdAt.getTime();
      });

      result.comments = result.comments.slice(0, limit);
      const maxScore = result.resolvedMatches.reduce((max, match) => Math.max(max, match.matchScore), 0);
      result.confidence = result.usedDirectFetch
        ? 1
        : result.resolvedMatches.length > 0
          ? Math.min(1, (maxScore + result.resolvedMatches.length * 0.1) / 1.5)
          : 0;

      console.log(
        `[Resolution] Fetched ${result.comments.length} comments from ${result.resolvedMatches.length} providers (confidence: ${result.confidence.toFixed(2)})`,
      );

      return result;
    },

    async refreshExternalCommentsForPopularMedia() {
      console.log('[ExternalComments] Starting refresh for popular media...');
      console.log('[ExternalComments] Refresh complete (stub implementation)');

      return {
        mediaProcessed: 0,
        totalImported: 0,
      };
    },
  };
}
