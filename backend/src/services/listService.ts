import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';
import type { CreateMediaItemInput, UpdateMediaItemInput } from '../utils/schemas.js';
import type { MediaType, MediaStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface FriendStatus {
  id: string;
  username: string;
  displayName: string | null;
  status: MediaStatus;
  current: number;
  rating: number | null;
}

export interface MediaItemResponse {
  id: string;
  title: string;
  type: MediaType;
  status: MediaStatus;
  current: number;
  total: number | null;
  notes: string | null;
  rating: number | null;
  imageUrl: string | null;
  refId: string;
  createdAt: Date;
  updatedAt: Date;
  friendsStatuses?: FriendStatus[];
}

const mediaItemSelect = {
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
  createdAt: true,
  updatedAt: true,
} as const;

export type SortByOption = 'status' | 'title' | 'rating' | 'updatedAt' | 'createdAt';

// Status priority for sorting (WATCHING/READING first)
const STATUS_PRIORITY: Record<MediaStatus, number> = {
  WATCHING: 1,
  READING: 1,
  PAUSED: 2,
  PLAN_TO_WATCH: 3,
  COMPLETED: 4,
  DROPPED: 5,
};

export async function getUserList(
  userId: string,
  filters?: { type?: MediaType; status?: MediaStatus; sortBy?: SortByOption }
): Promise<MediaItemResponse[]> {
  const where: { userId: string; type?: MediaType; status?: MediaStatus } = { userId };
  
  if (filters?.type) {
    where.type = filters.type;
  }
  if (filters?.status) {
    where.status = filters.status;
  }

  // Determine orderBy based on sortBy parameter
  let orderBy: { [key: string]: 'asc' | 'desc' }[];
  switch (filters?.sortBy) {
    case 'title':
      orderBy = [{ title: 'asc' }];
      break;
    case 'rating':
      orderBy = [{ rating: 'desc' }, { title: 'asc' }];
      break;
    case 'createdAt':
      orderBy = [{ createdAt: 'desc' }];
      break;
    case 'updatedAt':
      orderBy = [{ updatedAt: 'desc' }];
      break;
    case 'status':
    default:
      // Default: sort by status priority, then by title
      // We'll fetch and sort in memory for status priority
      orderBy = [{ updatedAt: 'desc' }];
      break;
  }

  const items = await prisma.mediaItem.findMany({
    where,
    orderBy,
    select: mediaItemSelect,
  });

  // If sorting by status (default), sort in memory by priority
  if (!filters?.sortBy || filters.sortBy === 'status') {
    items.sort((a, b) => {
      const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return a.title.localeCompare(b.title);
    });
  }

  // Get friends (users the current user is following)
  const friendships = await prisma.friendship.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  
  const friendIds = friendships.map(f => f.followingId);
  
  if (friendIds.length === 0) {
    return items;
  }

  // Get refIds from user's items to find matching items in friends' lists
  const refIds = items.filter(item => item.refId).map(item => item.refId as string);

  // Fetch friends' media items that match by refId OR title
  const friendsItems = await prisma.mediaItem.findMany({
    where: {
      userId: { in: friendIds },
      OR: [
        ...(refIds.length > 0 ? [{ refId: { in: refIds } }] : []),
        { title: { in: items.map(i => i.title), mode: 'insensitive' as const } },
      ],
    },
    select: {
      title: true,
      refId: true,
      status: true,
      current: true,
      rating: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  // Create a map for quick lookup
  const friendsMapByRefId = new Map<string, FriendStatus[]>();
  const friendsMapByTitle = new Map<string, FriendStatus[]>();
  
  for (const friendItem of friendsItems) {
    const friendStatus: FriendStatus = {
      id: friendItem.user.id,
      username: friendItem.user.username,
      displayName: friendItem.user.displayName,
      status: friendItem.status,
      current: friendItem.current,
      rating: friendItem.rating,
    };

    // Key by refId if available
    if (friendItem.refId) {
      const existing = friendsMapByRefId.get(friendItem.refId) || [];
      existing.push(friendStatus);
      friendsMapByRefId.set(friendItem.refId, existing);
    }
    
    // Also key by lowercase title
    const titleKey = friendItem.title.toLowerCase();
    const existingByTitle = friendsMapByTitle.get(titleKey) || [];
    existingByTitle.push(friendStatus);
    friendsMapByTitle.set(titleKey, existingByTitle);
  }

  // Attach friends' statuses to each item
  const itemsWithFriends: MediaItemResponse[] = items.map(item => {
    // First try to match by refId
    let friendsStatuses = item.refId ? friendsMapByRefId.get(item.refId) : undefined;
    
    // Fall back to title match if no refId match
    if (!friendsStatuses || friendsStatuses.length === 0) {
      friendsStatuses = friendsMapByTitle.get(item.title.toLowerCase());
    }
    
    return { ...item, friendsStatuses: friendsStatuses || [] };
  });

  return itemsWithFriends;
}

export async function createMediaItem(
  userId: string,
  input: CreateMediaItemInput
): Promise<MediaItemResponse> {
  try {
    return await prisma.mediaItem.create({
      data: {
        userId,
        title: input.title,
        type: input.type,
        status: input.status,
        current: input.current ?? 0,
        total: input.total ?? null,
        notes: input.notes,
        rating: input.rating ?? null,
        imageUrl: input.imageUrl,
        refId: input.refId ?? '',
      },
      select: mediaItemSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictError('This item is already in your list');
    }
    throw error;
  }
}

export async function updateMediaItem(
  userId: string,
  itemId: string,
  input: UpdateMediaItemInput
): Promise<MediaItemResponse> {
  // Check if item exists and belongs to user
  const existing = await prisma.mediaItem.findUnique({
    where: { id: itemId },
  });

  if (!existing) {
    throw new NotFoundError('Media item not found');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('Not authorized to update this item');
  }

  return prisma.mediaItem.update({
    where: { id: itemId },
    data: {
      title: input.title,
      status: input.status,
      current: input.current,
      total: input.total,
      notes: input.notes,
      rating: input.rating,
    },
    select: mediaItemSelect,
  });
}

export async function deleteMediaItem(userId: string, itemId: string): Promise<void> {
  // Check if item exists and belongs to user
  const existing = await prisma.mediaItem.findUnique({
    where: { id: itemId },
  });

  if (!existing) {
    throw new NotFoundError('Media item not found');
  }

  if (existing.userId !== userId) {
    throw new ForbiddenError('Not authorized to delete this item');
  }

  await prisma.mediaItem.delete({
    where: { id: itemId },
  });
}

export async function getMediaItem(userId: string, itemId: string): Promise<MediaItemResponse> {
  const item = await prisma.mediaItem.findUnique({
    where: { id: itemId },
    select: {
      ...mediaItemSelect,
      userId: true,
    },
  });

  if (!item) {
    throw new NotFoundError('Media item not found');
  }

  if (item.userId !== userId) {
    throw new ForbiddenError('Not authorized to view this item');
  }

  const { userId: _, ...rest } = item;
  return rest;
}

export interface BulkStatusItem {
  refId: string;
  status: MediaStatus;
  current: number;
  total: number | null;
}

export async function getStatusesByRefIds(
  userId: string,
  refIds: string[]
): Promise<Record<string, BulkStatusItem>> {
  if (refIds.length === 0) {
    return {};
  }

  // Limit to prevent abuse
  const limitedRefIds = refIds.slice(0, 100);

  const items = await prisma.mediaItem.findMany({
    where: {
      userId,
      refId: { in: limitedRefIds },
    },
    select: {
      refId: true,
      status: true,
      current: true,
      total: true,
    },
  });

  const result: Record<string, BulkStatusItem> = {};
  for (const item of items) {
    if (item.refId) {
      result[item.refId] = {
        refId: item.refId,
        status: item.status,
        current: item.current,
        total: item.total,
      };
    }
  }

  return result;
}
