import type { MediaStatus, MediaType, Prisma, SuggestionStatus } from '@prisma/client';
import { prisma } from '../../../config/database.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../utils/errors.js';
import type { CreateSuggestionInput } from '../../../utils/schemas.js';
import type {
  ActiveProgress,
  FriendActivityEntry,
  FriendListResponse,
  FriendResponse,
  GroupedFriendListFilters,
  GroupedFriendListResponse,
  PrivateProfileResponse,
  PublicProfileResponse,
  SuggestionResponse,
  UserSearchResult,
} from '../application/dto/social.js';
import type { SocialGateway } from '../application/ports/SocialGateway.js';
import { getOrCreateCatalogMediaSource } from '../../catalog/infrastructure/prismaCatalogSourceGateway.js';
import { canViewProfileList } from '../domain/profileVisibility.js';
import { parseEpisodeNumber } from '../domain/parseEpisodeNumber.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const SOCIAL_ACTIVE_STATUSES: MediaStatus[] = ['WATCHING', 'READING'];
const ALL_MEDIA_STATUSES: MediaStatus[] = ['WATCHING', 'READING', 'PLAYING', 'PAUSED', 'PLAN_TO_WATCH', 'COMPLETED', 'DROPPED'];

const suggestionSelect = {
  id: true,
  title: true,
  type: true,
  refId: true,
  imageUrl: true,
  message: true,
  status: true,
  createdAt: true,
  sourceId: true,
  fromUser: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  toUser: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  source: {
    select: {
      title: true,
      imageUrl: true,
      total: true,
    },
  },
} as const;

type SuggestionWithSource = {
  id: string;
  title: string | null;
  type: MediaType;
  refId: string;
  imageUrl: string | null;
  message: string | null;
  status: SuggestionStatus;
  createdAt: Date;
  sourceId: string | null;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
  toUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
  source: {
    title: string;
    imageUrl: string | null;
    total: number | null;
  } | null;
};

function resolveSuggestionResponse(suggestion: SuggestionWithSource): SuggestionResponse {
  return {
    id: suggestion.id,
    title: suggestion.source?.title ?? suggestion.title ?? 'Unknown',
    type: suggestion.type,
    refId: suggestion.refId,
    imageUrl: suggestion.source?.imageUrl ?? suggestion.imageUrl,
    message: suggestion.message,
    status: suggestion.status,
    createdAt: suggestion.createdAt,
    fromUser: suggestion.fromUser,
    toUser: suggestion.toUser,
  };
}

function resolveListItem(item: {
  id: string;
  title: string | null;
  type: MediaType;
  status: MediaStatus;
  current: number;
  total: number | null;
  notes: string | null;
  rating: number | null;
  imageUrl: string | null;
  refId: string | null;
  source?: {
    title: string;
    imageUrl: string | null;
    total: number | null;
  } | null;
}) {
  return {
    id: item.id,
    title: item.source?.title ?? item.title ?? 'Unknown',
    type: item.type,
    status: item.status,
    current: item.current,
    total: item.source?.total ?? item.total,
    notes: item.notes,
    rating: item.rating,
    imageUrl: item.source?.imageUrl ?? item.imageUrl,
    refId: item.refId,
  };
}

function resolveGroupedStatusOrder(sortBy: GroupedFriendListFilters['sortBy']): Prisma.MediaItemOrderByWithRelationInput[] {
  switch (sortBy) {
    case 'rating':
      return [{ rating: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }];
    case 'updatedAt':
      return [{ updatedAt: 'desc' }];
    case 'createdAt':
      return [{ createdAt: 'desc' }];
    case 'status':
    case 'title':
    default:
      return [{ title: 'asc' }];
  }
}

export function createPrismaSocialGateway(): SocialGateway {
  return {
    async getFollowing(userId) {
      const friendships = await prisma.friendship.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              displayName: true,
              mediaItems: { select: { status: true } },
            },
          },
        },
      });

      return friendships.map((friendship): FriendResponse => ({
        id: friendship.following.id,
        username: friendship.following.username,
        displayName: friendship.following.displayName,
        listCount: friendship.following.mediaItems.length,
        activeCount: friendship.following.mediaItems.filter((item) => SOCIAL_ACTIVE_STATUSES.includes(item.status)).length,
      }));
    },

    async getFollowers(userId) {
      const friendships = await prisma.friendship.findMany({
        where: { followingId: userId },
        include: {
          follower: {
            select: {
              id: true,
              username: true,
              displayName: true,
              mediaItems: { select: { status: true } },
            },
          },
        },
      });

      return friendships.map((friendship): FriendResponse => ({
        id: friendship.follower.id,
        username: friendship.follower.username,
        displayName: friendship.follower.displayName,
        listCount: friendship.follower.mediaItems.length,
        activeCount: friendship.follower.mediaItems.filter((item) => SOCIAL_ACTIVE_STATUSES.includes(item.status)).length,
      }));
    },

    async followUser(followerId, followingId) {
      if (followerId === followingId) {
        throw new ConflictError('Cannot follow yourself');
      }

      const userToFollow = await prisma.user.findUnique({ where: { id: followingId } });
      if (!userToFollow) {
        throw new NotFoundError('User not found');
      }

      const existing = await prisma.friendship.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (existing) {
        throw new ConflictError('Already following this user');
      }

      await prisma.friendship.create({ data: { followerId, followingId } });
    },

    async unfollowUser(followerId, followingId) {
      const friendship = await prisma.friendship.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId,
          },
        },
      });

      if (!friendship) {
        throw new NotFoundError('Not following this user');
      }

      await prisma.friendship.delete({ where: { id: friendship.id } });
    },

    async getFriendList(userId, friendId) {
      const isFollowing = await prisma.friendship.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: friendId,
          },
        },
      });

      if (!isFollowing) {
        throw new ForbiddenError('You must follow this user to view their list');
      }

      const friend = await prisma.user.findUnique({
        where: { id: friendId },
        select: {
          id: true,
          username: true,
          displayName: true,
          mediaItems: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              current: true,
              total: true,
              notes: true,
              rating: true,
              imageUrl: true,
              refId: true,
              source: {
                select: {
                  title: true,
                  imageUrl: true,
                  total: true,
                },
              },
            },
            orderBy: { updatedAt: 'desc' },
          },
        },
      });

      if (!friend) {
        throw new NotFoundError('User not found');
      }

      return {
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        list: friend.mediaItems.map(resolveListItem),
      } satisfies FriendListResponse;
    },

    async getGroupedFriendList(userId, friendId, filters) {
      const isFollowing = await prisma.friendship.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: friendId,
          },
        },
      });

      if (!isFollowing) {
        throw new ForbiddenError('You must follow this user to view their list');
      }

      const friend = await prisma.user.findUnique({
        where: { id: friendId },
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      });

      if (!friend) {
        throw new NotFoundError('User not found');
      }

      const limit = Math.min(MAX_LIMIT, Math.max(1, filters?.limit ?? DEFAULT_LIMIT));
      const statusPages = filters?.statusPages ?? {};
      const orderBy = resolveGroupedStatusOrder(filters?.sortBy ?? 'title');

      const baseWhere: Prisma.MediaItemWhereInput = { userId: friendId };
      if (filters?.mediaTypeFilter === 'video') {
        baseWhere.type = { in: ['TV', 'MOVIE', 'ANIME'] };
      } else if (filters?.mediaTypeFilter === 'manga') {
        baseWhere.type = 'MANGA';
      } else if (filters?.mediaTypeFilter === 'game') {
        baseWhere.type = 'GAME';
      }

      const statusResults = await Promise.all(ALL_MEDIA_STATUSES.map(async (status) => {
        const page = Math.max(1, statusPages[status] ?? 1);
        const skip = (page - 1) * limit;
        const where: Prisma.MediaItemWhereInput = { ...baseWhere, status };

        const [total, items] = await Promise.all([
          prisma.mediaItem.count({ where }),
          prisma.mediaItem.findMany({
            where,
            orderBy,
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              current: true,
              total: true,
              notes: true,
              rating: true,
              imageUrl: true,
              refId: true,
              source: {
                select: {
                  title: true,
                  imageUrl: true,
                  total: true,
                },
              },
            },
            skip,
            take: limit,
          }),
        ]);

        return {
          status,
          data: {
            items,
            total,
            hasMore: skip + items.length < total,
            page,
          },
        };
      }));

      const allItems = statusResults.flatMap((result) => result.data.items);
      const videoItems = allItems.filter((item) => item.type !== 'MANGA' && item.refId !== null);
      const videoRefIds = videoItems.map((item) => item.refId).filter((refId): refId is string => refId !== null);
      const watchProgressMap = new Map<string, ActiveProgress>();

      if (videoRefIds.length > 0) {
        const providerMappings = await prisma.providerMapping.findMany({
          where: { refId: { in: videoRefIds } },
          select: { refId: true, providerId: true },
        });

        const refIdToProviderIds = new Map<string, string[]>();
        for (const mapping of providerMappings) {
          const existing = refIdToProviderIds.get(mapping.refId) ?? [];
          existing.push(mapping.providerId);
          refIdToProviderIds.set(mapping.refId, existing);
        }

        const allPossibleMediaIds = new Set<string>(videoRefIds);
        for (const providerIds of refIdToProviderIds.values()) {
          for (const providerId of providerIds) {
            allPossibleMediaIds.add(providerId);
          }
        }

        const allProgress = await prisma.watchProgress.findMany({
          where: {
            userId: friendId,
            mediaId: { in: Array.from(allPossibleMediaIds) },
          },
          orderBy: { updatedAt: 'desc' },
        });

        const providerIdToRefId = new Map<string, string>();
        for (const [refId, providerIds] of refIdToProviderIds) {
          for (const providerId of providerIds) {
            providerIdToRefId.set(providerId, refId);
          }
        }

        const progressByRefId = new Map<string, typeof allProgress>();
        for (const progress of allProgress) {
          const refId = providerIdToRefId.get(progress.mediaId) ?? progress.mediaId;
          const existing = progressByRefId.get(refId) ?? [];
          existing.push(progress);
          progressByRefId.set(refId, existing);
        }

        for (const [refId, progressEntries] of progressByRefId) {
          const item = videoItems.find((candidate) => candidate.refId === refId);
          if (!item) continue;

          const incompleteProgress = progressEntries.find((entry) => !entry.completed && entry.currentTime > 0);
          const activeEntry = incompleteProgress ?? progressEntries[0];
          if (!activeEntry) continue;

          const episodeNumber = activeEntry.episodeNumber ?? parseEpisodeNumber(activeEntry.episodeId);
          const percentComplete = activeEntry.duration > 0
            ? (activeEntry.currentTime / activeEntry.duration) * 100
            : 0;

          watchProgressMap.set(refId, {
            episodeId: activeEntry.episodeId,
            episodeNumber,
            seasonNumber: activeEntry.seasonNumber,
            currentTime: activeEntry.currentTime,
            duration: activeEntry.duration,
            percentComplete: Math.round(percentComplete * 10) / 10,
            completed: activeEntry.completed,
            updatedAt: activeEntry.updatedAt,
            provider: activeEntry.provider,
          });
        }
      }

      const groups = {} as GroupedFriendListResponse['groups'];
      let grandTotal = 0;

      for (const result of statusResults) {
        groups[result.status] = {
          items: result.data.items.map((item) => ({
            ...resolveListItem(item),
            activeProgress: item.type !== 'MANGA' && item.refId ? watchProgressMap.get(item.refId) ?? null : null,
          })),
          total: result.data.total,
          hasMore: result.data.hasMore,
          page: result.data.page,
        };
        grandTotal += result.data.total;
      }

      return {
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        groups,
        grandTotal,
      };
    },

    async searchUsers(query, currentUserId) {
      const users = await prisma.user.findMany({
        where: {
          AND: [
            { id: { not: currentUserId } },
            {
              OR: [
                { username: { contains: query, mode: 'insensitive' } },
                { displayName: { contains: query, mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          followers: {
            where: { followerId: currentUserId },
            select: { id: true },
          },
        },
        take: 20,
      });

      return users.map((user): UserSearchResult => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        isFollowing: user.followers.length > 0,
      }));
    },

    async getPublicProfile(username, requesterId) {
      const user = await prisma.user.findFirst({
        where: {
          username: {
            equals: username,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isPublic: true,
          mediaItems: {
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              current: true,
              total: true,
              notes: true,
              rating: true,
              imageUrl: true,
              refId: true,
              source: {
                select: {
                  title: true,
                  imageUrl: true,
                  total: true,
                },
              },
            },
            orderBy: { updatedAt: 'desc' },
          },
          _count: {
            select: {
              followers: true,
              following: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      const isOwnProfile = requesterId === user.id;
      let isFollowing = false;
      if (requesterId && !isOwnProfile) {
        const friendship = await prisma.friendship.findUnique({
          where: {
            followerId_followingId: {
              followerId: requesterId,
              followingId: user.id,
            },
          },
        });
        isFollowing = Boolean(friendship);
      }

      if (!canViewProfileList({ isPublic: user.isPublic, isOwnProfile, isFollowing })) {
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          isPublic: false,
          isOwnProfile,
          isFollowing,
          followerCount: user._count.followers,
          followingCount: user._count.following,
        } satisfies PrivateProfileResponse;
      }

      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isPublic: user.isPublic,
        isOwnProfile,
        isFollowing,
        followerCount: user._count.followers,
        followingCount: user._count.following,
        list: user.mediaItems.map(resolveListItem),
      } satisfies PublicProfileResponse;
    },

    async updatePrivacySettings(userId, isPublic) {
      await prisma.user.update({
        where: { id: userId },
        data: { isPublic },
      });

      return { isPublic };
    },

    async getUserPrivacySettings(userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isPublic: true },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return { isPublic: user.isPublic };
    },

    async createSuggestion(fromUserId, toUserId, input) {
      if (fromUserId === toUserId) {
        throw new BadRequestError('Cannot suggest media to yourself');
      }

      const targetUser = await prisma.user.findUnique({ where: { id: toUserId } });
      if (!targetUser) {
        throw new NotFoundError('User not found');
      }

      const isFollowing = await prisma.friendship.findUnique({
        where: {
          followerId_followingId: {
            followerId: fromUserId,
            followingId: toUserId,
          },
        },
      });

      if (!isFollowing) {
        throw new ForbiddenError('You must follow this user to send them suggestions');
      }

      const existingSuggestion = await prisma.suggestion.findFirst({
        where: {
          fromUserId,
          toUserId,
          refId: input.refId,
        },
      });

      if (existingSuggestion) {
        if (existingSuggestion.status === 'PENDING') {
          throw new ConflictError('You already have a pending suggestion for this media to this user');
        }

        await prisma.suggestion.delete({ where: { id: existingSuggestion.id } });
      }

      const source = await getOrCreateCatalogMediaSource(input.refId, input.type);
      const suggestion = await prisma.suggestion.create({
        data: {
          fromUserId,
          toUserId,
          type: input.type,
          refId: input.refId,
          sourceId: source.id,
          message: input.message,
        },
        select: suggestionSelect,
      });

      return resolveSuggestionResponse(suggestion);
    },

    async getReceivedSuggestions(userId, status) {
      const suggestions = await prisma.suggestion.findMany({
        where: { toUserId: userId, status: status ?? 'PENDING' },
        select: suggestionSelect,
        orderBy: { createdAt: 'desc' },
      });

      return suggestions.map(resolveSuggestionResponse);
    },

    async getSentSuggestions(userId) {
      const suggestions = await prisma.suggestion.findMany({
        where: { fromUserId: userId },
        select: suggestionSelect,
        orderBy: { createdAt: 'desc' },
      });

      return suggestions.map(resolveSuggestionResponse);
    },

    async acceptSuggestion(userId, suggestionId) {
      const suggestion = await prisma.suggestion.findUnique({
        where: { id: suggestionId },
        select: {
          ...suggestionSelect,
          toUserId: true,
          fromUserId: true,
        },
      });

      if (!suggestion) {
        throw new NotFoundError('Suggestion not found');
      }

      if (suggestion.toUserId !== userId) {
        throw new ForbiddenError('Only the recipient can accept a suggestion');
      }

      if (suggestion.status !== 'PENDING') {
        throw new BadRequestError('This suggestion has already been processed');
      }

      const [updatedSuggestion] = await prisma.$transaction([
        prisma.suggestion.update({
          where: { id: suggestionId },
          data: { status: 'ACCEPTED' },
          select: suggestionSelect,
        }),
        prisma.mediaItem.upsert({
          where: {
            userId_refId: {
              userId,
              refId: suggestion.refId,
            },
          },
          create: {
            userId,
            type: suggestion.type,
            status: 'PLAN_TO_WATCH',
            refId: suggestion.refId,
            sourceId: suggestion.sourceId,
          },
          update: {},
        }),
      ]);

      return resolveSuggestionResponse(updatedSuggestion);
    },

    async dismissSuggestion(userId, suggestionId) {
      const suggestion = await prisma.suggestion.findUnique({ where: { id: suggestionId } });
      if (!suggestion) {
        throw new NotFoundError('Suggestion not found');
      }

      if (suggestion.toUserId !== userId) {
        throw new ForbiddenError('Only the recipient can dismiss a suggestion');
      }

      if (suggestion.status !== 'PENDING') {
        throw new BadRequestError('This suggestion has already been processed');
      }

      const updatedSuggestion = await prisma.suggestion.update({
        where: { id: suggestionId },
        data: { status: 'DISMISSED' },
        select: suggestionSelect,
      });

      return resolveSuggestionResponse(updatedSuggestion);
    },

    async deleteSuggestion(userId, suggestionId) {
      const suggestion = await prisma.suggestion.findUnique({ where: { id: suggestionId } });
      if (!suggestion) {
        throw new NotFoundError('Suggestion not found');
      }

      if (suggestion.fromUserId !== userId) {
        throw new ForbiddenError('Only the sender can delete a suggestion');
      }

      await prisma.suggestion.delete({ where: { id: suggestionId } });
    },

    async getFriendsActivity(userId) {
      const friendships = await prisma.friendship.findMany({
        where: { followerId: userId },
        include: {
          following: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              mediaItems: {
                where: {
                  status: { in: ['WATCHING', 'READING', 'PLAYING'] },
                },
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  title: true,
                  type: true,
                  status: true,
                  current: true,
                  total: true,
                  imageUrl: true,
                  refId: true,
                  updatedAt: true,
                  source: {
                    select: {
                      title: true,
                      imageUrl: true,
                      total: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const entries: FriendActivityEntry[] = friendships.map((friendship) => {
        const friend = friendship.following;
        const latestItem = friend.mediaItems[0] ?? null;

        return {
          id: friend.id,
          username: friend.username,
          displayName: friend.displayName,
          avatarUrl: friend.avatarUrl,
          latestItem: latestItem ? {
            id: latestItem.id,
            title: latestItem.source?.title ?? latestItem.title ?? 'Unknown',
            type: latestItem.type,
            status: latestItem.status,
            current: latestItem.current,
            total: latestItem.source?.total ?? latestItem.total,
            imageUrl: latestItem.source?.imageUrl ?? latestItem.imageUrl,
            refId: latestItem.refId,
            updatedAt: latestItem.updatedAt,
          } : null,
          updatedAt: latestItem?.updatedAt ?? friendship.createdAt,
        };
      });

      // Sort by latest activity (most recently updated first)
      entries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      return entries;
    },
  };
}
