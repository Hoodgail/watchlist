import type { MediaType } from '@prisma/client';

export type ReactionType = 'LIKE' | 'HELPFUL' | 'FUNNY' | 'INSIGHTFUL' | 'SPOILER';
export type SupportedCommentMediaType = 'TV' | 'MOVIE' | 'ANIME' | 'MANGA';

export interface CreateCommentInput {
  content: string;
  refId: string;
  mediaType: MediaType;
  seasonNumber?: number;
  episodeNumber?: number;
  chapterNumber?: number;
  volumeNumber?: number;
  isPublic?: boolean;
  isSpoiler?: boolean;
}

export interface UpdateCommentInput {
  content?: string;
  isPublic?: boolean;
  isSpoiler?: boolean;
}

export interface CommentWithAuthor {
  id: string;
  content: string;
  refId: string;
  mediaType: MediaType;
  seasonNumber: number | null;
  episodeNumber: number | null;
  chapterNumber: number | null;
  volumeNumber: number | null;
  isPublic: boolean;
  isSpoiler: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  externalSource: string | null;
  externalAuthor: string | null;
  externalAuthorAvatar: string | null;
  externalUrl: string | null;
}

export interface CommentFeedItem extends CommentWithAuthor {
  mediaTitle?: string;
  media?: {
    title: string;
    imageUrl?: string | null;
  };
}

export interface CommentWithReactions extends CommentWithAuthor {
  reactionCounts: Record<ReactionType, number>;
}

export interface ExternalCommentInput {
  content: string;
  refId: string;
  mediaType: MediaType;
  seasonNumber?: number;
  episodeNumber?: number;
  chapterNumber?: number;
  volumeNumber?: number;
  externalSource: string;
  externalId: string;
  externalAuthor?: string;
  externalAuthorAvatar?: string;
  externalUrl?: string;
  isSpoiler?: boolean;
  createdAt?: Date;
}

export interface GetMediaCommentsOptions {
  mediaType: MediaType;
  seasonNumber?: number;
  episodeNumber?: number;
  chapterNumber?: number;
  volumeNumber?: number;
  includeExternal?: boolean;
  limit?: number;
  cursor?: string;
}

export interface FeedOptions {
  limit?: number;
  cursor?: string;
  mediaType?: MediaType;
}

export interface FetchCommentsParams {
  title: string;
  mediaType: SupportedCommentMediaType;
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

export interface ExternalComment {
  externalSource: string;
  externalId: string;
  externalAuthor: string;
  externalAuthorAvatar?: string;
  externalUrl: string;
  content: string;
  createdAt: Date;
  score?: number;
}

export interface ExternalCommentProvider {
  name: string;
  displayName: string;
  supportedMediaTypes: SupportedCommentMediaType[];
  fetchComments(params: FetchCommentsParams): Promise<ExternalComment[]>;
  isConfigured(): boolean;
}

export interface ImportResult {
  imported: number;
  providers: string[];
  errors: Array<{ provider: string; error: string }>;
}

export interface CommentFetchWithResolutionParams {
  title: string;
  mediaType: SupportedCommentMediaType;
  year?: number;
  refId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  providerIds?: {
    hianimeEpisodeId?: string;
    [key: string]: string | undefined;
  };
  limit?: number;
}

export interface ResolvedProviderMatch {
  provider: string;
  providerId: string;
  title: string;
  matchScore: number;
  alternativeTitles?: string[];
  year?: number;
}

export interface AggregatedComments {
  comments: ExternalComment[];
  resolvedMatches: ResolvedProviderMatch[];
  errors: Array<{ provider: string; error: string }>;
  confidence: number;
  usedDirectFetch: boolean;
}

export interface ResolutionPreviewResult {
  resolvedMatches: ResolvedProviderMatch[];
  titleBasedProviders: string[];
  confidence: number;
}
