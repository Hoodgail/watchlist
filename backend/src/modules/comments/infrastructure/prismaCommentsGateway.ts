import type { MediaType, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../utils/errors.js';
import {
  type CommentFeedItem,
  type CommentWithAuthor,
  type CommentWithReactions,
  type CreateCommentInput,
  type ExternalCommentInput,
  type FeedOptions,
  type GetMediaCommentsOptions,
  type ReactionType,
  type UpdateCommentInput,
} from '../application/dto/comments.js';
import type { CommentsGateway as CommentsGatewayContract } from '../application/ports/CommentsGateway.js';
import { getCommentVisibilityRules } from '../domain/visibility.js';

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

type RawComment = {
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
};

function validateContent(content: string): void {
  if (!content || content.trim().length === 0) {
    throw new BadRequestError('Comment content cannot be empty');
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new BadRequestError(`Comment content cannot exceed ${MAX_CONTENT_LENGTH} characters`);
  }
}

function formatCommentWithAuthor(comment: RawComment): CommentWithAuthor {
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

function toVisibilityCondition(rule: ReturnType<typeof getCommentVisibilityRules>[number]): Prisma.CommentWhereInput {
  switch (rule.kind) {
    case 'own':
      return { userId: rule.userId };
    case 'following':
      return { userId: { in: rule.userIds } };
    case 'external':
      return { externalSource: { not: null } };
    case 'public':
    default:
      return {
        isPublic: true,
        user: { isPublic: true },
      };
  }
}

async function buildFeedMediaInfo(refIds: string[]): Promise<Map<string, { title: string; imageUrl: string | null }>> {
  const sources = await prisma.mediaSource.findMany({
    where: { refId: { in: refIds } },
    select: { refId: true, title: true, imageUrl: true },
  });

  const mediaInfoMap = new Map<string, { title: string; imageUrl: string | null }>(
    sources.map((source) => [source.refId, { title: source.title, imageUrl: source.imageUrl }]),
  );

  const missingRefIds = refIds.filter((refId) => !mediaInfoMap.has(refId));
  if (missingRefIds.length > 0) {
    const legacyItems = await prisma.mediaItem.findMany({
      where: { refId: { in: missingRefIds }, title: { not: null } },
      select: { refId: true, title: true, imageUrl: true },
      distinct: ['refId'],
    });

    for (const item of legacyItems) {
      if (item.title && !mediaInfoMap.has(item.refId)) {
        mediaInfoMap.set(item.refId, { title: item.title, imageUrl: item.imageUrl });
      }
    }
  }

  return mediaInfoMap;
}

export function createPrismaCommentsGateway(): CommentsGatewayContract {
  return {
    async createComment(userId, data) {
      validateContent(data.content);

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
    },

    async updateComment(userId, commentId, data) {
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
    },

    async deleteComment(userId, commentId) {
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

      await prisma.comment.delete({ where: { id: commentId } });
    },

    async getMediaComments(refId, options, userId) {
      const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      let followingUserIds: string[] = [];

      if (userId) {
        const friendships = await prisma.friendship.findMany({
          where: { followerId: userId },
          select: { followingId: true },
        });
        followingUserIds = friendships.map((friendship) => friendship.followingId);
      }

      const visibilityRules = getCommentVisibilityRules({
        requesterId: userId,
        followingUserIds,
        includeExternal: options.includeExternal,
      });

      const where: Prisma.CommentWhereInput = {
        refId,
        mediaType: options.mediaType,
        OR: visibilityRules.map(toVisibilityCondition),
      };

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
      if (options.cursor) {
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

      return {
        comments: resultComments.map(formatCommentWithAuthor),
        nextCursor,
      };
    },

    async getFriendsFeed(userId, options) {
      const limit = Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      const friendships = await prisma.friendship.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const friendIds = friendships.map((friendship) => friendship.followingId);

      if (friendIds.length === 0) {
        return { comments: [], nextCursor: null };
      }

      const where: Prisma.CommentWhereInput = {
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
      const mediaInfoMap = await buildFeedMediaInfo(Array.from(new Set(resultComments.map((comment) => comment.refId))));

      const feedItems: CommentFeedItem[] = resultComments.map((comment) => {
        const mediaInfo = mediaInfoMap.get(comment.refId);
        return {
          ...formatCommentWithAuthor(comment),
          mediaTitle: mediaInfo?.title,
          media: mediaInfo ? { title: mediaInfo.title, imageUrl: mediaInfo.imageUrl } : undefined,
        };
      });

      return {
        comments: feedItems,
        nextCursor,
      };
    },

    async getPublicFeed(options) {
      const limit = Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      const where: Prisma.CommentWhereInput = {
        isPublic: true,
        user: { isPublic: true },
        userId: { not: null },
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
      const mediaInfoMap = await buildFeedMediaInfo(Array.from(new Set(resultComments.map((comment) => comment.refId))));

      const feedItems: CommentFeedItem[] = resultComments.map((comment) => {
        const mediaInfo = mediaInfoMap.get(comment.refId);
        return {
          ...formatCommentWithAuthor(comment),
          mediaTitle: mediaInfo?.title,
          media: mediaInfo ? { title: mediaInfo.title, imageUrl: mediaInfo.imageUrl } : undefined,
        };
      });

      return {
        comments: feedItems,
        nextCursor,
      };
    },

    async importExternalComment(data) {
      validateContent(data.content);

      const existing = await prisma.comment.findFirst({
        where: {
          externalSource: data.externalSource,
          externalId: data.externalId,
        },
        select: { id: true },
      });

      const comment = existing
        ? await prisma.comment.update({
            where: { id: existing.id },
            data: {
              content: data.content.trim(),
              externalAuthor: data.externalAuthor ?? null,
              externalAuthorAvatar: data.externalAuthorAvatar ?? null,
              externalUrl: data.externalUrl ?? null,
              isSpoiler: data.isSpoiler ?? false,
            },
            select: commentSelect,
          })
        : await prisma.comment.create({
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
              isPublic: true,
              isSpoiler: data.isSpoiler ?? false,
            },
            select: commentSelect,
          });

      return formatCommentWithAuthor(comment);
    },

    async addReaction(userId, commentId, reactionType) {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { id: true },
      });

      if (!comment) {
        throw new NotFoundError('Comment not found');
      }

      await prisma.commentReaction.upsert({
        where: {
          userId_commentId_reactionType: {
            userId,
            commentId,
            reactionType,
          },
        },
        update: {},
        create: {
          userId,
          commentId,
          reactionType,
        },
      });
    },

    async removeReaction(userId, commentId) {
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
    },

    async getCommentById(commentId) {
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

      const { reactions: _reactions, ...commentData } = comment;
      return {
        ...formatCommentWithAuthor(commentData),
        reactionCounts,
      } satisfies CommentWithReactions;
    },
  };
}

export const prismaCommentsGateway = createPrismaCommentsGateway();

export async function createComment(userId: string, data: CreateCommentInput) {
  return prismaCommentsGateway.createComment(userId, data);
}

export async function updateComment(userId: string, commentId: string, data: UpdateCommentInput) {
  return prismaCommentsGateway.updateComment(userId, commentId, data);
}

export async function deleteComment(userId: string, commentId: string) {
  return prismaCommentsGateway.deleteComment(userId, commentId);
}

export async function getMediaComments(refId: string, options: GetMediaCommentsOptions, userId?: string) {
  return prismaCommentsGateway.getMediaComments(refId, options, userId);
}

export async function getCommentsForMedia(userId: string, refId: string, mediaType: MediaType, options?: Omit<GetMediaCommentsOptions, 'mediaType'>) {
  return prismaCommentsGateway.getMediaComments(refId, { ...options, mediaType }, userId);
}

export async function getFriendsFeed(userId: string, options?: FeedOptions) {
  return prismaCommentsGateway.getFriendsFeed(userId, options);
}

export const getFriendActivityFeed = getFriendsFeed;

export async function getPublicFeed(options?: FeedOptions) {
  return prismaCommentsGateway.getPublicFeed(options);
}

export async function importExternalComment(data: ExternalCommentInput) {
  return prismaCommentsGateway.importExternalComment(data);
}

export async function addReaction(userId: string, commentId: string, reactionType: ReactionType) {
  return prismaCommentsGateway.addReaction(userId, commentId, reactionType);
}

export async function removeReaction(userId: string, commentId: string) {
  return prismaCommentsGateway.removeReaction(userId, commentId);
}

export async function getCommentById(commentId: string, userId?: string) {
  return prismaCommentsGateway.getCommentById(commentId, userId);
}

export async function getCommentWithReactions(commentId: string) {
  return prismaCommentsGateway.getCommentById(commentId);
}
