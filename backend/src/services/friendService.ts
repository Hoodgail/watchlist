import { prisma } from '../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../utils/errors.js';
import type { ActiveProgress } from './listService.js';
import { parseEpisodeNumber } from './listService.js';

export interface FriendResponse {
  id: string;
  username: string;
  displayName: string | null;
  listCount: number;
  activeCount: number;
}

export interface FriendListResponse {
  id: string;
  username: string;
  displayName: string | null;
  list: {
    id: string;
    title: string;
    type: string;
    status: string;
    current: number;
    total: number | null;
    notes: string | null;
    rating: number | null;
    imageUrl: string | null;
    refId: string | null;
  }[];
}

export async function getFollowing(userId: string): Promise<FriendResponse[]> {
  const friendships = await prisma.friendship.findMany({
    where: { followerId: userId },
    include: {
      following: {
        select: {
          id: true,
          username: true,
          displayName: true,
          mediaItems: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  return friendships.map(f => ({
    id: f.following.id,
    username: f.following.username,
    displayName: f.following.displayName,
    listCount: f.following.mediaItems.length,
    activeCount: f.following.mediaItems.filter(
      item => item.status === 'WATCHING' || item.status === 'READING'
    ).length,
  }));
}

export async function getFollowers(userId: string): Promise<FriendResponse[]> {
  const friendships = await prisma.friendship.findMany({
    where: { followingId: userId },
    include: {
      follower: {
        select: {
          id: true,
          username: true,
          displayName: true,
          mediaItems: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

  return friendships.map(f => ({
    id: f.follower.id,
    username: f.follower.username,
    displayName: f.follower.displayName,
    listCount: f.follower.mediaItems.length,
    activeCount: f.follower.mediaItems.filter(
      item => item.status === 'WATCHING' || item.status === 'READING'
    ).length,
  }));
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) {
    throw new ConflictError('Cannot follow yourself');
  }

  // Check if user to follow exists
  const userToFollow = await prisma.user.findUnique({
    where: { id: followingId },
  });

  if (!userToFollow) {
    throw new NotFoundError('User not found');
  }

  // Check if already following
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

  await prisma.friendship.create({
    data: {
      followerId,
      followingId,
    },
  });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
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

  await prisma.friendship.delete({
    where: { id: friendship.id },
  });
}

export async function getFriendList(
  userId: string,
  friendId: string
): Promise<FriendListResponse> {
  // Check if following this user
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
        },
        orderBy: {
          updatedAt: 'desc',
        },
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
    list: friend.mediaItems,
  };
}

// Grouped list types for per-status pagination
export interface StatusGroupPagination {
  items: {
    id: string;
    title: string;
    type: string;
    status: string;
    current: number;
    total: number | null;
    notes: string | null;
    rating: number | null;
    imageUrl: string | null;
    refId: string | null;
    activeProgress?: ActiveProgress | null;
  }[];
  total: number;
  hasMore: boolean;
  page: number;
}

export interface GroupedFriendListResponse {
  id: string;
  username: string;
  displayName: string | null;
  groups: {
    WATCHING: StatusGroupPagination;
    READING: StatusGroupPagination;
    PAUSED: StatusGroupPagination;
    PLAN_TO_WATCH: StatusGroupPagination;
    COMPLETED: StatusGroupPagination;
    DROPPED: StatusGroupPagination;
  };
  grandTotal: number;
}

export type MediaTypeFilter = 'video' | 'manga';

export interface GroupedFriendListFilters {
  mediaTypeFilter?: MediaTypeFilter;
  statusPages?: Partial<Record<string, number>>;
  limit?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type MediaStatus = 'WATCHING' | 'READING' | 'PAUSED' | 'PLAN_TO_WATCH' | 'COMPLETED' | 'DROPPED';

export async function getGroupedFriendList(
  userId: string,
  friendId: string,
  filters?: GroupedFriendListFilters
): Promise<GroupedFriendListResponse> {
  // Check if following this user
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
  
  // All statuses we need to fetch
  const allStatuses: MediaStatus[] = ['WATCHING', 'READING', 'PAUSED', 'PLAN_TO_WATCH', 'COMPLETED', 'DROPPED'];
  
  // Build base where clause (without status)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseWhere: any = { userId: friendId };
  if (filters?.mediaTypeFilter) {
    // Filter by video (TV, MOVIE, ANIME) or manga (MANGA)
    if (filters.mediaTypeFilter === 'video') {
      baseWhere.type = { in: ['TV', 'MOVIE', 'ANIME'] };
    } else if (filters.mediaTypeFilter === 'manga') {
      baseWhere.type = 'MANGA';
    }
  }
  
  // Fetch counts and items for each status in parallel
  const statusQueries = allStatuses.map(async (status) => {
    const page = Math.max(1, statusPages[status] ?? 1);
    const skip = (page - 1) * limit;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { ...baseWhere, status };
    
    const [total, items] = await Promise.all([
      prisma.mediaItem.count({ where }),
      prisma.mediaItem.findMany({
        where,
        orderBy: [{ title: 'asc' }],
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
  });
  
  const statusResults = await Promise.all(statusQueries);
  
  // Collect all items for active progress fetching
  const allItems = statusResults.flatMap(r => r.data.items);
  
  // Get watch progress for video content (not MANGA)
  const videoItems = allItems.filter(item => item.type !== 'MANGA');
  const videoRefIds = videoItems.map(item => item.refId).filter((refId): refId is string => refId !== null);
  const watchProgressMap = new Map<string, ActiveProgress>();
  
  if (videoRefIds.length > 0) {
    // Look up provider mappings for all refIds to get provider-specific IDs
    const providerMappings = await prisma.providerMapping.findMany({
      where: { refId: { in: videoRefIds } },
      select: { refId: true, providerId: true },
    });
    
    const refIdToProviderIds = new Map<string, string[]>();
    for (const mapping of providerMappings) {
      const existing = refIdToProviderIds.get(mapping.refId) || [];
      existing.push(mapping.providerId);
      refIdToProviderIds.set(mapping.refId, existing);
    }
    
    const allPossibleMediaIds = new Set<string>(videoRefIds);
    for (const providerIds of refIdToProviderIds.values()) {
      for (const providerId of providerIds) {
        allPossibleMediaIds.add(providerId);
      }
    }
    
    // Get watch progress for the FRIEND, not the current user
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
      const refId = providerIdToRefId.get(progress.mediaId) || progress.mediaId;
      const existing = progressByRefId.get(refId) || [];
      existing.push(progress);
      progressByRefId.set(refId, existing);
    }
    
    for (const [refId, progressEntries] of progressByRefId) {
      const item = videoItems.find(i => i.refId === refId);
      if (!item) continue;
      
      const incompleteProgress = progressEntries.find(p => !p.completed && p.currentTime > 0);
      const activeEntry = incompleteProgress || progressEntries[0];
      
      if (activeEntry) {
        const episodeNumber = parseEpisodeNumber(activeEntry.episodeId);
        const percentComplete = activeEntry.duration > 0
          ? (activeEntry.currentTime / activeEntry.duration) * 100
          : 0;
        
        watchProgressMap.set(refId, {
          episodeId: activeEntry.episodeId,
          episodeNumber,
          currentTime: activeEntry.currentTime,
          duration: activeEntry.duration,
          percentComplete: Math.round(percentComplete * 10) / 10,
          completed: activeEntry.completed,
          updatedAt: activeEntry.updatedAt,
          provider: activeEntry.provider,
        });
      }
    }
  }
  
  // Helper to attach activeProgress to items
  const attachActiveProgress = (item: typeof allItems[0]) => {
    const activeProgress = item.type !== 'MANGA' && item.refId 
      ? watchProgressMap.get(item.refId) || null 
      : null;
    return { ...item, activeProgress };
  };
  
  // Build groups object
  const groups = {} as GroupedFriendListResponse['groups'];
  let grandTotal = 0;
  
  for (const result of statusResults) {
    groups[result.status] = {
      items: result.data.items.map(attachActiveProgress),
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
}

export async function searchUsers(query: string, currentUserId: string): Promise<{
  id: string;
  username: string;
  displayName: string | null;
  isFollowing: boolean;
}[]> {
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

  return users.map(u => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    isFollowing: u.followers.length > 0,
  }));
}
