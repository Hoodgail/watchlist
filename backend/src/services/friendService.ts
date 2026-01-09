import { prisma } from '../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError } from '../utils/errors.js';

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
  
  // Build groups object
  const groups = {} as GroupedFriendListResponse['groups'];
  let grandTotal = 0;
  
  for (const result of statusResults) {
    groups[result.status] = {
      items: result.data.items,
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
