import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';
import type { CreateMediaItemInput, UpdateMediaItemInput } from '../utils/schemas.js';
import type { MediaType, MediaStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createLocalRefId } from '@shared/refId.js';

export interface FriendStatus {
  id: string;
  username: string;
  displayName: string | null;
  status: MediaStatus;
  current: number;
  rating: number | null;
}

/**
 * Active watch progress for video content
 * Represents the most relevant playback state for resuming
 */
export interface ActiveProgress {
  episodeId: string;
  episodeNumber: number | null;
  currentTime: number;
  duration: number;
  percentComplete: number;
  completed: boolean;
  updatedAt: Date;
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
  activeProgress?: ActiveProgress | null;
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

export interface PaginatedListResponse {
  items: MediaItemResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ListFilters {
  type?: MediaType;
  status?: MediaStatus;
  sortBy?: SortByOption;
  search?: string;
  page?: number;
  limit?: number;
}

// Grouped list types
export interface StatusGroupPagination {
  items: MediaItemResponse[];
  total: number;
  hasMore: boolean;
  page: number;
}

export interface GroupedListResponse {
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

export interface GroupedListFilters {
  type?: MediaType;
  mediaTypeFilter?: MediaTypeFilter;
  search?: string;
  // Per-status pagination: { WATCHING: 1, COMPLETED: 2, ... }
  statusPages?: Partial<Record<MediaStatus, number>>;
  limit?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function getUserList(
  userId: string,
  filters?: ListFilters
): Promise<PaginatedListResponse> {
  const page = Math.max(1, filters?.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters?.limit ?? DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  const where: Prisma.MediaItemWhereInput = { userId };
  
  if (filters?.type) {
    where.type = filters.type;
  }
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }

  // Get total count for pagination metadata
  const total = await prisma.mediaItem.count({ where });

  // Determine orderBy based on sortBy parameter
  let orderBy: Prisma.MediaItemOrderByWithRelationInput[];
  const sortByStatus = !filters?.sortBy || filters.sortBy === 'status';
  
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
      // For status sorting, we fetch all and sort in memory, then paginate
      // This is necessary because status priority requires custom ordering
      orderBy = [{ title: 'asc' }];
      break;
  }

  let items: {
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
  }[];
  
  if (sortByStatus) {
    // For status-based sorting, fetch all matching items, sort in memory, then paginate
    // This is a trade-off: we load more data but get correct status priority ordering
    const allItems = await prisma.mediaItem.findMany({
      where,
      orderBy,
      select: mediaItemSelect,
    });

    // Sort in memory by status priority, then by title
    allItems.sort((a, b) => {
      const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return a.title.localeCompare(b.title);
    });

    // Apply pagination after sorting
    items = allItems.slice(skip, skip + limit);
  } else {
    // For other sort options, use database pagination directly
    items = await prisma.mediaItem.findMany({
      where,
      orderBy,
      select: mediaItemSelect,
      skip,
      take: limit,
    });
  }

  // Get watch progress for video content (not MANGA)
  const videoItems = items.filter(item => item.type !== 'MANGA');
  const videoRefIds = videoItems.map(item => item.refId);
  
  // Fetch watch progress for all video items
  // We get all progress entries and then find the most relevant one for each media
  const watchProgressMap = new Map<string, ActiveProgress>();
  
  if (videoRefIds.length > 0) {
    // Look up provider mappings for all refIds to get provider-specific IDs
    // WatchProgress uses provider-specific IDs (e.g., "jujutsu-kaisen-tv-534")
    // while MediaItem uses external IDs (e.g., "tmdb:95479")
    const providerMappings = await prisma.providerMapping.findMany({
      where: {
        refId: { in: videoRefIds },
      },
      select: {
        refId: true,
        providerId: true,
      },
    });

    // Create a map from refId to all possible providerIds
    const refIdToProviderIds = new Map<string, string[]>();
    for (const mapping of providerMappings) {
      const existing = refIdToProviderIds.get(mapping.refId) || [];
      existing.push(mapping.providerId);
      refIdToProviderIds.set(mapping.refId, existing);
    }

    // Collect all possible mediaIds to query (both refIds and providerIds)
    const allPossibleMediaIds = new Set<string>(videoRefIds);
    for (const providerIds of refIdToProviderIds.values()) {
      for (const providerId of providerIds) {
        allPossibleMediaIds.add(providerId);
      }
    }

    // Get all watch progress for this user that might match our items
    const allProgress = await prisma.watchProgress.findMany({
      where: {
        userId,
        mediaId: { in: Array.from(allPossibleMediaIds) },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Create a reverse lookup: providerId -> refId (for items that have mappings)
    const providerIdToRefId = new Map<string, string>();
    for (const [refId, providerIds] of refIdToProviderIds) {
      for (const providerId of providerIds) {
        providerIdToRefId.set(providerId, refId);
      }
    }

    // Group progress by refId (normalize provider-specific IDs to refIds)
    const progressByRefId = new Map<string, typeof allProgress>();
    for (const progress of allProgress) {
      // Check if this mediaId is a provider-specific ID that maps to a refId
      const refId = providerIdToRefId.get(progress.mediaId) || progress.mediaId;
      const existing = progressByRefId.get(refId) || [];
      existing.push(progress);
      progressByRefId.set(refId, existing);
    }

    // For each media, determine the "active" progress
    for (const [refId, progressEntries] of progressByRefId) {
      // Find the item by refId
      const item = videoItems.find(i => i.refId === refId);
      if (!item) continue;

      // Find the most relevant progress entry:
      // 1. If there's an incomplete episode, use that
      // 2. Otherwise, use the most recently updated entry
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
          percentComplete: Math.round(percentComplete * 10) / 10, // Round to 1 decimal
          completed: activeEntry.completed,
          updatedAt: activeEntry.updatedAt,
        });
      }
    }
  }

  // Get friends (users the current user is following)
  const friendships = await prisma.friendship.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  
  const friendIds = friendships.map(f => f.followingId);
  
  const totalPages = Math.ceil(total / limit);
  
  // If no friends, just attach watch progress and return
  if (friendIds.length === 0) {
    const itemsWithProgress = items.map(item => ({
      ...item,
      activeProgress: item.type !== 'MANGA' ? watchProgressMap.get(item.refId) || null : null,
    }));
    return {
      items: itemsWithProgress,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
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

  // Attach friends' statuses and watch progress to each item
  const itemsWithExtras: MediaItemResponse[] = items.map(item => {
    // First try to match by refId
    let friendsStatuses = item.refId ? friendsMapByRefId.get(item.refId) : undefined;
    
    // Fall back to title match if no refId match
    if (!friendsStatuses || friendsStatuses.length === 0) {
      friendsStatuses = friendsMapByTitle.get(item.title.toLowerCase());
    }
    
    // Get active progress for video content
    const activeProgress = item.type !== 'MANGA' ? watchProgressMap.get(item.refId) || null : null;
    
    return { 
      ...item, 
      friendsStatuses: friendsStatuses || [],
      activeProgress,
    };
  });

  return {
    items: itemsWithExtras,
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Get user's list grouped by status with per-group pagination.
 * This is the preferred method for the main list view as it allows
 * independent pagination of each status group.
 */
export async function getGroupedUserList(
  userId: string,
  filters?: GroupedListFilters
): Promise<GroupedListResponse> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, filters?.limit ?? DEFAULT_LIMIT));
  const statusPages = filters?.statusPages ?? {};
  
  // All statuses we need to fetch
  const allStatuses: MediaStatus[] = ['WATCHING', 'READING', 'PAUSED', 'PLAN_TO_WATCH', 'COMPLETED', 'DROPPED'];
  
  // Build base where clause (without status)
  const baseWhere: Prisma.MediaItemWhereInput = { userId };
  if (filters?.type) {
    baseWhere.type = filters.type;
  } else if (filters?.mediaTypeFilter) {
    // Filter by video (TV, MOVIE, ANIME) or manga (MANGA)
    if (filters.mediaTypeFilter === 'video') {
      baseWhere.type = { in: ['TV', 'MOVIE', 'ANIME'] };
    } else if (filters.mediaTypeFilter === 'manga') {
      baseWhere.type = 'MANGA';
    }
  }
  if (filters?.search) {
    baseWhere.title = { contains: filters.search, mode: 'insensitive' };
  }
  
  // Fetch counts and items for each status in parallel
  const statusQueries = allStatuses.map(async (status) => {
    const page = Math.max(1, statusPages[status] ?? 1);
    const skip = (page - 1) * limit;
    
    const where: Prisma.MediaItemWhereInput = { ...baseWhere, status };
    
    const [total, items] = await Promise.all([
      prisma.mediaItem.count({ where }),
      prisma.mediaItem.findMany({
        where,
        orderBy: [{ title: 'asc' }],
        select: mediaItemSelect,
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
  
  // Collect all items for additional data fetching
  const allItems = statusResults.flatMap(r => r.data.items);
  
  // Get watch progress for video content
  const videoItems = allItems.filter(item => item.type !== 'MANGA');
  const videoRefIds = videoItems.map(item => item.refId);
  const watchProgressMap = new Map<string, ActiveProgress>();
  
  if (videoRefIds.length > 0) {
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
    
    const allProgress = await prisma.watchProgress.findMany({
      where: {
        userId,
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
        });
      }
    }
  }
  
  // Get friends' statuses
  const friendships = await prisma.friendship.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const friendIds = friendships.map(f => f.followingId);
  
  let friendsMapByRefId = new Map<string, FriendStatus[]>();
  let friendsMapByTitle = new Map<string, FriendStatus[]>();
  
  if (friendIds.length > 0) {
    const refIds = allItems.filter(item => item.refId).map(item => item.refId as string);
    
    const friendsItems = await prisma.mediaItem.findMany({
      where: {
        userId: { in: friendIds },
        OR: [
          ...(refIds.length > 0 ? [{ refId: { in: refIds } }] : []),
          { title: { in: allItems.map(i => i.title), mode: 'insensitive' as const } },
        ],
      },
      select: {
        title: true,
        refId: true,
        status: true,
        current: true,
        rating: true,
        user: {
          select: { id: true, username: true, displayName: true },
        },
      },
    });
    
    for (const friendItem of friendsItems) {
      const friendStatus: FriendStatus = {
        id: friendItem.user.id,
        username: friendItem.user.username,
        displayName: friendItem.user.displayName,
        status: friendItem.status,
        current: friendItem.current,
        rating: friendItem.rating,
      };
      
      if (friendItem.refId) {
        const existing = friendsMapByRefId.get(friendItem.refId) || [];
        existing.push(friendStatus);
        friendsMapByRefId.set(friendItem.refId, existing);
      }
      
      const titleKey = friendItem.title.toLowerCase();
      const existingByTitle = friendsMapByTitle.get(titleKey) || [];
      existingByTitle.push(friendStatus);
      friendsMapByTitle.set(titleKey, existingByTitle);
    }
  }
  
  // Attach extras to items and build response
  const attachExtras = (item: typeof allItems[0]): MediaItemResponse => {
    let friendsStatuses = item.refId ? friendsMapByRefId.get(item.refId) : undefined;
    if (!friendsStatuses || friendsStatuses.length === 0) {
      friendsStatuses = friendsMapByTitle.get(item.title.toLowerCase());
    }
    const activeProgress = item.type !== 'MANGA' ? watchProgressMap.get(item.refId) || null : null;
    return {
      ...item,
      friendsStatuses: friendsStatuses || [],
      activeProgress,
    };
  };
  
  // Build groups object
  const groups = {} as GroupedListResponse['groups'];
  let grandTotal = 0;
  
  for (const result of statusResults) {
    groups[result.status] = {
      items: result.data.items.map(attachExtras),
      total: result.data.total,
      hasMore: result.data.hasMore,
      page: result.data.page,
    };
    grandTotal += result.data.total;
  }
  
  return { groups, grandTotal };
}

/**
 * Parse episode number from various episodeId formats
 */
function parseEpisodeNumber(episodeId: string | undefined | null): number | null {
  if (!episodeId) return null;
  
  // Try direct number parse
  const direct = parseInt(episodeId, 10);
  if (!isNaN(direct) && direct > 0) {
    return direct;
  }

  // Try patterns like "episode-5", "ep-5", "ep5"
  const episodeMatch = episodeId.match(/(?:episode|ep)[-_]?(\d+)/i);
  if (episodeMatch) {
    return parseInt(episodeMatch[1], 10);
  }

  // Try pattern like "s1e5" or "s01e05"
  const seasonEpMatch = episodeId.match(/s\d+e(\d+)/i);
  if (seasonEpMatch) {
    return parseInt(seasonEpMatch[1], 10);
  }

  // Try to find any number in the string as last resort
  const anyNumber = episodeId.match(/(\d+)/);
  if (anyNumber) {
    return parseInt(anyNumber[1], 10);
  }

  return null;
}

export async function createMediaItem(
  userId: string,
  input: CreateMediaItemInput
): Promise<MediaItemResponse> {
  try {
    // Generate a unique local refId if none provided to avoid collisions
    const refId = input.refId || createLocalRefId(randomUUID());
    
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
        refId,
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
