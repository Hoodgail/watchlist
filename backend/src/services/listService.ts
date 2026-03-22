import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../utils/errors.js';
import type { CreateMediaItemInput, UpdateMediaItemInput } from '../utils/schemas.js';
import type { MediaType, MediaStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getOrCreateMediaSource } from './mediaSourceService.js';
export type {
  FriendStatus,
  ActiveProgress,
  SourceAlias,
  MediaItemResponse,
  SortByOption,
  PaginatedListResponse,
  ListFilters,
  StatusGroupPagination,
  GroupedListResponse,
  MediaTypeFilter,
  GroupedListFilters,
  BulkStatusItem,
} from '../modules/library/domain/listTypes.js';
export { parseEpisodeNumber } from '../modules/library/domain/parseEpisodeNumber.js';
import type {
  BulkStatusItem,
  GroupedListFilters,
  GroupedListResponse,
  ListFilters,
  MediaItemResponse,
  PaginatedListResponse,
} from '../modules/library/domain/listTypes.js';
import {
  attachGroupedLibraryExtras,
  attachLibraryExtras,
  mediaItemSelect,
  resolveMediaItemResponse,
} from '../modules/library/domain/enrichment.js';

// Status priority for sorting (WATCHING/READING/PLAYING first)
const STATUS_PRIORITY: Record<MediaStatus, number> = {
  WATCHING: 1,
  READING: 1,
  PLAYING: 1,
  PAUSED: 2,
  PLAN_TO_WATCH: 3,
  COMPLETED: 4,
  DROPPED: 5,
};


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
    title: string | null;
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
    source?: {
      title: string;
      imageUrl: string | null;
      total: number | null;
    } | null;
  }[];
  
  if (sortByStatus) {
    // For status-based sorting, fetch all matching items, sort in memory, then paginate
    // This is a trade-off: we load more data but get correct status priority ordering
    const allItems = await prisma.mediaItem.findMany({
      where,
      orderBy,
      select: mediaItemSelect,
    });

    // Sort in memory by status priority, then by title (resolved from source)
    allItems.sort((a, b) => {
      const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      const titleA = a.source?.title ?? a.title ?? 'Unknown';
      const titleB = b.source?.title ?? b.title ?? 'Unknown';
      return titleA.localeCompare(titleB);
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

  const totalPages = Math.ceil(total / limit);
  const itemsWithExtras = await attachLibraryExtras(prisma, userId, items);

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
  const allStatuses: MediaStatus[] = ['WATCHING', 'READING', 'PLAYING', 'PAUSED', 'PLAN_TO_WATCH', 'COMPLETED', 'DROPPED'];
  
  // Build base where clause (without status)
  const baseWhere: Prisma.MediaItemWhereInput = { userId };
  if (filters?.type) {
    baseWhere.type = filters.type;
  } else if (filters?.mediaTypeFilter) {
    // Filter by video (TV, MOVIE, ANIME), manga (MANGA), or game (GAME)
    if (filters.mediaTypeFilter === 'video') {
      baseWhere.type = { in: ['TV', 'MOVIE', 'ANIME'] };
    } else if (filters.mediaTypeFilter === 'manga') {
      baseWhere.type = 'MANGA';
    } else if (filters.mediaTypeFilter === 'game') {
      baseWhere.type = 'GAME';
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
  
  return attachGroupedLibraryExtras(prisma, userId, statusResults as any);
}

/**
 * Parse episode number from various episodeId formats
 */
export async function createMediaItem(
  userId: string,
  input: CreateMediaItemInput
): Promise<MediaItemResponse> {
  // refId is required - it must be provided by the API caller
  if (!input.refId) {
    throw new BadRequestError('refId is required');
  }

  try {
    // Get or create the MediaSource for this refId
    const source = await getOrCreateMediaSource(input.refId, input.type);

    const item = await prisma.mediaItem.create({
      data: {
        userId,
        title: null, // Title comes from source
        type: input.type,
        status: input.status,
        current: input.current ?? 0,
        total: null, // Total comes from source
        notes: input.notes,
        rating: input.rating ?? null,
        imageUrl: null, // ImageUrl comes from source
        refId: input.refId,
        sourceId: source.id,
        // Game-specific fields
        platforms: input.platforms ?? [],
        metacritic: input.metacritic ?? null,
        genres: input.genres ?? [],
        playtimeHours: input.playtimeHours ?? null,
      },
      select: mediaItemSelect,
    });

    return resolveMediaItemResponse(item);
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

  const item = await prisma.mediaItem.update({
    where: { id: itemId },
    data: {
      status: input.status,
      current: input.current,
      total: input.total,
      notes: input.notes,
      rating: input.rating,
    },
    select: mediaItemSelect,
  });

  return resolveMediaItemResponse(item);
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
  return resolveMediaItemResponse(rest);
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

  // First, find items directly by refId
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
  const foundRefIds = new Set<string>();
  
  for (const item of items) {
    if (item.refId) {
      result[item.refId] = {
        refId: item.refId,
        status: item.status,
        current: item.current,
        total: item.total,
      };
      foundRefIds.add(item.refId);
    }
  }

  // Find remaining refIds that might be aliases
  const remainingRefIds = limitedRefIds.filter(refId => !foundRefIds.has(refId));
  
  if (remainingRefIds.length > 0) {
    // Look up aliases to find the primary source refIds
    const aliases = await prisma.mediaSourceAlias.findMany({
      where: {
        refId: { in: remainingRefIds },
      },
      select: {
        refId: true,
        mediaSource: {
          select: {
            refId: true,
          },
        },
      },
    });

    // Map alias refId -> primary source refId
    const aliasToSourceRefId = new Map<string, string>();
    for (const alias of aliases) {
      aliasToSourceRefId.set(alias.refId, alias.mediaSource.refId);
    }

    // Get the primary source refIds for the aliases
    const primaryRefIds = Array.from(new Set(aliases.map(a => a.mediaSource.refId)));
    
    if (primaryRefIds.length > 0) {
      // Find items with those primary refIds
      const aliasItems = await prisma.mediaItem.findMany({
        where: {
          userId,
          refId: { in: primaryRefIds },
        },
        select: {
          refId: true,
          status: true,
          current: true,
          total: true,
        },
      });

      // Create a map of primary refId -> item data
      const primaryItemMap = new Map<string, typeof aliasItems[0]>();
      for (const item of aliasItems) {
        if (item.refId) {
          primaryItemMap.set(item.refId, item);
        }
      }

      // Map back to the alias refIds that were requested
      for (const [aliasRefId, primaryRefId] of aliasToSourceRefId) {
        const item = primaryItemMap.get(primaryRefId);
        if (item) {
          result[aliasRefId] = {
            refId: aliasRefId,
            status: item.status,
            current: item.current,
            total: item.total,
          };
        }
      }
    }
  }

  return result;
}
