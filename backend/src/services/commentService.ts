import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';
import type { MediaType } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

// Define ReactionType locally to avoid Prisma client dependency before generation
export type ReactionType = 'LIKE' | 'HELPFUL' | 'FUNNY' | 'INSIGHTFUL' | 'SPOILER';

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
  // Author info (null for external comments)
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  // External source info
  externalSource: string | null;
  externalAuthor: string | null;
  externalAuthorAvatar: string | null;
  externalUrl: string | null;
}

export interface CommentFeedItem extends CommentWithAuthor {
  // Media info for feed context
  mediaTitle?: string;
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

export interface CommentWithReactions extends CommentWithAuthor {
  reactionCounts: Record<ReactionType, number>;
}

export interface GetCommentsOptions {
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

// ============================================================================
// Constants
// ============================================================================

const MAX_CONTENT_LENGTH = 2000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const commentSelect = {
  id: true,
  content: true,
  refId: true,
  mediaType: true,
  seasonNumber: true,
  episodeNumber: true,
  chapterNumber: true,
  volumeNumber: true,
  isPublic: true,
  isSpoiler: true,
  createdAt: true,
  updatedAt: true,
  externalSource: true,
  externalAuthor: true,
  externalAuthorAvatar: true,
  externalUrl: true,
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

function validateContent(content: string): void {
  if (!content || content.trim().length === 0) {
    throw new BadRequestError('Comment content cannot be empty');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new BadRequestError(`Comment content cannot exceed ${MAX_CONTENT_LENGTH} characters`);
  }
}

function formatCommentWithAuthor(comment: {
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
  externalSource: string | null;
  externalAuthor: string | null;
  externalAuthorAvatar: string | null;
  externalUrl: string | null;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}): CommentWithAuthor {
  return {
    id: comment.id,
    content: comment.content,
    refId: comment.refId,
    mediaType: comment.mediaType,
    seasonNumber: comment.seasonNumber,
    episodeNumber: comment.episodeNumber,
    chapterNumber: comment.chapterNumber,
    volumeNumber: comment.volumeNumber,
    isPublic: comment.isPublic,
    isSpoiler: comment.isSpoiler,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.user,
    externalSource: comment.externalSource,
    externalAuthor: comment.externalAuthor,
    externalAuthorAvatar: comment.externalAuthorAvatar,
    externalUrl: comment.externalUrl,
  };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Create a new comment for a media item.
 * Defaults isPublic to the user's isPublic setting.
 */
export async function createComment(
  userId: string,
  data: CreateCommentInput
): Promise<CommentWithAuthor> {
  validateContent(data.content);

  // Get user's default isPublic setting
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPublic: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const comment = await prisma.comment.create({
    data: {
      userId,
      content: data.content.trim(),
      refId: data.refId,
      mediaType: data.mediaType,
      seasonNumber: data.seasonNumber ?? null,
      episodeNumber: data.episodeNumber ?? null,
      chapterNumber: data.chapterNumber ?? null,
      volumeNumber: data.volumeNumber ?? null,
      isPublic: data.isPublic ?? user.isPublic,
      isSpoiler: data.isSpoiler ?? false,
    },
    select: commentSelect,
  });

  return formatCommentWithAuthor(comment);
}

/**
 * Update an existing comment. Only the owner can update.
 */
export async function updateComment(
  userId: string,
  commentId: string,
  data: UpdateCommentInput
): Promise<CommentWithAuthor> {
  // Check if comment exists and belongs to user
  const existing = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });

  if (!existing) {
    throw new NotFoundError('Comment not found');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('Not authorized to update this comment');
  }

  // Validate content if provided
  if (data.content !== undefined) {
    validateContent(data.content);
  }

  const comment = await prisma.comment.update({
    where: { id: commentId },
    data: {
      content: data.content?.trim(),
      isPublic: data.isPublic,
      isSpoiler: data.isSpoiler,
    },
    select: commentSelect,
  });

  return formatCommentWithAuthor(comment);
}

/**
 * Delete a comment. Only the owner can delete.
 */
export async function deleteComment(userId: string, commentId: string): Promise<void> {
  const existing = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { userId: true },
  });

  if (!existing) {
    throw new NotFoundError('Comment not found');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('Not authorized to delete this comment');
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });
}

/**
 * Get comments for a specific media item.
 * Includes user's own comments, friends' comments, and optionally public/external comments.
 * 
 * This is the controller-compatible version that takes refId as first param.
 */
export async function getMediaComments(
  refId: string,
  options: GetCommentsOptions,
  userId?: string
): Promise<{ comments: CommentWithAuthor[]; nextCursor: string | null }> {
  const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  // Build the OR conditions for visibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visibilityConditions: any[] = [];

  if (userId) {
    // Get friends (users the current user is following)
    const friendships = await prisma.friendship.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const friendIds = friendships.map(f => f.followingId);

    // User's own comments (always visible)
    visibilityConditions.push({ userId });
    // Friends' comments (users they follow)
    if (friendIds.length > 0) {
      visibilityConditions.push({ userId: { in: friendIds } });
    }
  }

  // Public comments from users with isPublic=true
  visibilityConditions.push({
    isPublic: true,
    user: { isPublic: true },
  });

  // Include external comments if requested
  if (options.includeExternal) {
    visibilityConditions.push({
      externalSource: { not: null },
    });
  }

  // Build where clause for media filtering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    refId,
    mediaType: options.mediaType,
    OR: visibilityConditions,
  };

  // Filter by season/episode/chapter/volume if specified
  if (options.seasonNumber !== undefined) {
    where.seasonNumber = options.seasonNumber;
  }
  if (options.episodeNumber !== undefined) {
    where.episodeNumber = options.episodeNumber;
  }
  if (options.chapterNumber !== undefined) {
    where.chapterNumber = options.chapterNumber;
  }
  if (options.volumeNumber !== undefined) {
    where.volumeNumber = options.volumeNumber;
  }

  // Apply cursor pagination
  if (options.cursor) {
    where.id = { lt: options.cursor };
  }

  const comments = await prisma.comment.findMany({
    where,
    select: commentSelect,
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Fetch one extra to determine if there's more
  });

  const hasMore = comments.length > limit;
  const resultComments = hasMore ? comments.slice(0, limit) : comments;
  const nextCursor = hasMore ? resultComments[resultComments.length - 1].id : null;

  return {
    comments: resultComments.map(formatCommentWithAuthor),
    nextCursor,
  };
}

/**
 * Get comments for a specific media item (alternative signature).
 * Includes user's own comments, friends' comments, and optionally public/external comments.
 */
export async function getCommentsForMedia(
  userId: string,
  refId: string,
  mediaType: MediaType,
  options?: Omit<GetCommentsOptions, 'mediaType'>
): Promise<{ comments: CommentWithAuthor[]; nextCursor: string | null }> {
  return getMediaComments(refId, { ...options, mediaType }, userId);
}

/**
 * Get recent comments from friends (users the current user follows).
 * Controller-compatible version.
 */
export async function getFriendsFeed(
  userId: string,
  options?: FeedOptions
): Promise<{ comments: CommentFeedItem[]; nextCursor: string | null }> {
  const limit = Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  // Get friends (users the current user is following)
  const friendships = await prisma.friendship.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const friendIds = friendships.map(f => f.followingId);

  if (friendIds.length === 0) {
    return { comments: [], nextCursor: null };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    userId: { in: friendIds },
  };

  if (options?.mediaType) {
    where.mediaType = options.mediaType;
  }

  if (options?.cursor) {
    where.id = { lt: options.cursor };
  }

  const comments = await prisma.comment.findMany({
    where,
    select: commentSelect,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = comments.length > limit;
  const resultComments = hasMore ? comments.slice(0, limit) : comments;
  const nextCursor = hasMore ? resultComments[resultComments.length - 1].id : null;

  // Get media titles from the user's list or friends' lists
  const refIdSet = new Set<string>();
  for (const c of resultComments) {
    refIdSet.add(c.refId);
  }
  const refIds = Array.from(refIdSet);
  const mediaItems = await prisma.mediaItem.findMany({
    where: { refId: { in: refIds } },
    select: { refId: true, title: true },
    distinct: ['refId'],
  });

  const titleMap = new Map<string, string>(mediaItems.map(m => [m.refId, m.title]));

  const feedItems: CommentFeedItem[] = resultComments.map((comment) => ({
    ...formatCommentWithAuthor(comment),
    mediaTitle: titleMap.get(comment.refId),
  }));

  return {
    comments: feedItems,
    nextCursor,
  };
}

/**
 * Get recent comments from friends (alias for getFriendsFeed).
 */
export const getFriendActivityFeed = getFriendsFeed;

/**
 * Get recent public comments for the Hot page.
 * Only includes comments from users with isPublic=true.
 */
export async function getPublicFeed(
  options?: FeedOptions
): Promise<{ comments: CommentFeedItem[]; nextCursor: string | null }> {
  const limit = Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    isPublic: true,
    user: { isPublic: true },
    userId: { not: null }, // Exclude external comments from public feed
  };

  if (options?.mediaType) {
    where.mediaType = options.mediaType;
  }

  if (options?.cursor) {
    where.id = { lt: options.cursor };
  }

  const comments = await prisma.comment.findMany({
    where,
    select: commentSelect,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = comments.length > limit;
  const resultComments = hasMore ? comments.slice(0, limit) : comments;
  const nextCursor = hasMore ? resultComments[resultComments.length - 1].id : null;

  // Get media titles
  const publicRefIdSet = new Set<string>();
  for (const c of resultComments) {
    publicRefIdSet.add(c.refId);
  }
  const publicRefIds = Array.from(publicRefIdSet);
  const mediaItems = await prisma.mediaItem.findMany({
    where: { refId: { in: publicRefIds } },
    select: { refId: true, title: true },
    distinct: ['refId'],
  });

  const titleMap = new Map<string, string>(mediaItems.map(m => [m.refId, m.title]));

  const feedItems: CommentFeedItem[] = resultComments.map((comment) => ({
    ...formatCommentWithAuthor(comment),
    mediaTitle: titleMap.get(comment.refId),
  }));

  return {
    comments: feedItems,
    nextCursor,
  };
}

/**
 * Import a comment from an external source (Reddit, MAL, AniList, etc.).
 * Uses findFirst + create/update pattern with externalSource + externalId as the unique key.
 */
export async function importExternalComment(
  data: ExternalCommentInput
): Promise<CommentWithAuthor> {
  validateContent(data.content);

  // Check if comment already exists by externalSource + externalId
  const existing = await prisma.comment.findFirst({
    where: {
      externalSource: data.externalSource,
      externalId: data.externalId,
    },
    select: { id: true },
  });

  let comment;

  if (existing) {
    // Update existing external comment
    comment = await prisma.comment.update({
      where: { id: existing.id },
      data: {
        content: data.content.trim(),
        externalAuthor: data.externalAuthor ?? null,
        externalAuthorAvatar: data.externalAuthorAvatar ?? null,
        externalUrl: data.externalUrl ?? null,
        isSpoiler: data.isSpoiler ?? false,
      },
      select: commentSelect,
    });
  } else {
    // Create new external comment
    comment = await prisma.comment.create({
      data: {
        content: data.content.trim(),
        refId: data.refId,
        mediaType: data.mediaType,
        seasonNumber: data.seasonNumber ?? null,
        episodeNumber: data.episodeNumber ?? null,
        chapterNumber: data.chapterNumber ?? null,
        volumeNumber: data.volumeNumber ?? null,
        externalSource: data.externalSource,
        externalId: data.externalId,
        externalAuthor: data.externalAuthor ?? null,
        externalAuthorAvatar: data.externalAuthorAvatar ?? null,
        externalUrl: data.externalUrl ?? null,
        isPublic: true, // External comments are always public
        isSpoiler: data.isSpoiler ?? false,
      },
      select: commentSelect,
    });
  }

  return formatCommentWithAuthor(comment);
}

/**
 * Add a reaction to a comment.
 * Uses upsert - user can only have one reaction type per comment.
 */
export async function addReaction(
  userId: string,
  commentId: string,
  reactionType: ReactionType
): Promise<void> {
  // Verify comment exists
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true },
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  // Upsert the reaction
  await prisma.commentReaction.upsert({
    where: {
      userId_commentId_reactionType: {
        userId,
        commentId,
        reactionType,
      },
    },
    update: {}, // No update needed, reaction already exists
    create: {
      userId,
      commentId,
      reactionType,
    },
  });
}

/**
 * Remove a user's reaction from a comment.
 * Removes all reaction types for this user on this comment.
 */
export async function removeReaction(userId: string, commentId: string): Promise<void> {
  // Verify comment exists
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true },
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  await prisma.commentReaction.deleteMany({
    where: {
      userId,
      commentId,
    },
  });
}

/**
 * Get a single comment with reaction counts.
 * Controller-compatible version that takes optional userId for visibility check.
 */
export async function getCommentById(
  commentId: string,
  userId?: string
): Promise<CommentWithReactions> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      ...commentSelect,
      reactions: {
        select: {
          reactionType: true,
        },
      },
    },
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  // Count reactions by type
  const reactionCounts: Record<ReactionType, number> = {
    LIKE: 0,
    HELPFUL: 0,
    FUNNY: 0,
    INSIGHTFUL: 0,
    SPOILER: 0,
  };

  for (const reaction of comment.reactions) {
    reactionCounts[reaction.reactionType as ReactionType]++;
  }

  const { reactions: _, ...commentData } = comment;

  return {
    ...formatCommentWithAuthor(commentData),
    reactionCounts,
  };
}

/**
 * Get a single comment with reaction counts (alias for getCommentById).
 */
export async function getCommentWithReactions(
  commentId: string
): Promise<CommentWithReactions> {
  return getCommentById(commentId);
}
