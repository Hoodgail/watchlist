import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../utils/errors.js';
import type { CreateMediaItemInput, UpdateMediaItemInput } from '../../../utils/schemas.js';
import { getOrCreateMediaSource } from '../../../services/mediaSourceService.js';
import type { LibraryListGateway } from '../application/ports/LibraryListGateway.js';
import type {
  BulkStatusItem,
  GroupedListFilters,
  GroupedListResponse,
  ListFilters,
  MediaItemWithSource,
  MediaItemResponse,
  PaginatedListResponse,
  SortByOption,
} from '../domain/listTypes.js';
import { attachGroupedLibraryExtras, attachLibraryExtras, mediaItemSelect, resolveMediaItemResponse } from '../domain/enrichment.js';

const STATUS_PRIORITY = {
  WATCHING: 1,
  READING: 1,
  PLAYING: 1,
  PAUSED: 2,
  PLAN_TO_WATCH: 3,
  COMPLETED: 4,
  DROPPED: 5,
} as const;

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function buildBaseListWhere(userId: string, filters?: Pick<ListFilters, 'type' | 'status' | 'search'>): Prisma.MediaItemWhereInput {
  const where: Prisma.MediaItemWhereInput = { userId };
  if (filters?.type) where.type = filters.type;
  if (filters?.status) where.status = filters.status;
  if (filters?.search) where.title = { contains: filters.search, mode: 'insensitive' };
  return where;
}

function getOrderBy(sortBy?: SortByOption): Prisma.MediaItemOrderByWithRelationInput[] {
  switch (sortBy) {
    case 'title':
      return [{ title: 'asc' }];
    case 'rating':
      return [{ rating: 'desc' }, { title: 'asc' }];
    case 'createdAt':
      return [{ createdAt: 'desc' }];
    case 'updatedAt':
      return [{ updatedAt: 'desc' }];
    case 'status':
    default:
      return [{ title: 'asc' }];
  }
}

function buildGroupedBaseWhere(userId: string, filters?: GroupedListFilters): Prisma.MediaItemWhereInput {
  const where: Prisma.MediaItemWhereInput = { userId };
  if (filters?.type) {
    where.type = filters.type;
  } else if (filters?.mediaTypeFilter) {
    if (filters.mediaTypeFilter === 'video') where.type = { in: ['TV', 'MOVIE', 'ANIME'] };
    if (filters.mediaTypeFilter === 'manga') where.type = 'MANGA';
    if (filters.mediaTypeFilter === 'game') where.type = 'GAME';
  }
  if (filters?.search) where.title = { contains: filters.search, mode: 'insensitive' };
  return where;
}

export function createPrismaLibraryListGateway(): LibraryListGateway {
  return {
    async getUserList(userId, filters): Promise<PaginatedListResponse> {
      const page = Math.max(1, filters?.page ?? DEFAULT_PAGE);
      const limit = Math.min(MAX_LIMIT, Math.max(1, filters?.limit ?? DEFAULT_LIMIT));
      const skip = (page - 1) * limit;
      const where = buildBaseListWhere(userId, filters);
      const total = await prisma.mediaItem.count({ where });
      const sortByStatus = !filters?.sortBy || filters.sortBy === 'status';
      const orderBy = getOrderBy(filters?.sortBy);

      let items: MediaItemWithSource[];
      if (sortByStatus) {
        const allItems = await prisma.mediaItem.findMany({ where, orderBy, select: mediaItemSelect });
        allItems.sort((a, b) => {
          const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
          if (priorityDiff !== 0) return priorityDiff;
          const titleA = a.source?.title ?? a.title ?? 'Unknown';
          const titleB = b.source?.title ?? b.title ?? 'Unknown';
          return titleA.localeCompare(titleB);
        });
        items = allItems.slice(skip, skip + limit);
      } else {
        items = await prisma.mediaItem.findMany({ where, orderBy, select: mediaItemSelect, skip, take: limit });
      }

      const enrichedItems = await attachLibraryExtras(prisma, userId, items);
      const totalPages = Math.ceil(total / limit);

      return {
        items: enrichedItems,
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages,
      };
    },

    async getGroupedUserList(userId, filters): Promise<GroupedListResponse> {
      const limit = Math.min(MAX_LIMIT, Math.max(1, filters?.limit ?? DEFAULT_LIMIT));
      const statusPages = filters?.statusPages ?? {};
      const allStatuses: Array<keyof GroupedListResponse['groups']> = [
        'WATCHING', 'READING', 'PLAYING', 'PAUSED', 'PLAN_TO_WATCH', 'COMPLETED', 'DROPPED',
      ];
      const baseWhere = buildGroupedBaseWhere(userId, filters);

      const statusResults = await Promise.all(allStatuses.map(async (status) => {
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
      }));

      return attachGroupedLibraryExtras(prisma, userId, statusResults);
    },

    async getMediaItem(userId, itemId): Promise<MediaItemResponse> {
      const item = await prisma.mediaItem.findUnique({
        where: { id: itemId },
        select: { ...mediaItemSelect, userId: true },
      });

      if (!item) throw new NotFoundError('Media item not found');
      if (item.userId !== userId) throw new ForbiddenError('Not authorized to view this item');

      const { userId: _unused, ...rest } = item;
      return resolveMediaItemResponse(rest);
    },

    async createMediaItem(userId, input: CreateMediaItemInput): Promise<MediaItemResponse> {
      if (!input.refId) {
        throw new BadRequestError('refId is required');
      }

      try {
        const source = await getOrCreateMediaSource(input.refId, input.type);
        const item = await prisma.mediaItem.create({
          data: {
            userId,
            title: null,
            type: input.type,
            status: input.status,
            current: input.current ?? 0,
            total: null,
            notes: input.notes,
            rating: input.rating ?? null,
            imageUrl: null,
            refId: input.refId,
            sourceId: source.id,
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
    },

    async updateMediaItem(userId, itemId, input: UpdateMediaItemInput): Promise<MediaItemResponse> {
      const existing = await prisma.mediaItem.findUnique({ where: { id: itemId } });
      if (!existing) throw new NotFoundError('Media item not found');
      if (existing.userId !== userId) throw new ForbiddenError('Not authorized to update this item');

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
    },

    async deleteMediaItem(userId, itemId): Promise<void> {
      const existing = await prisma.mediaItem.findUnique({ where: { id: itemId } });
      if (!existing) throw new NotFoundError('Media item not found');
      if (existing.userId !== userId) throw new ForbiddenError('Not authorized to delete this item');
      await prisma.mediaItem.delete({ where: { id: itemId } });
    },

    async getStatusesByRefIds(userId, refIds): Promise<Record<string, BulkStatusItem>> {
      if (refIds.length === 0) return {};

      const limitedRefIds = refIds.slice(0, 100);
      const items = await prisma.mediaItem.findMany({
        where: { userId, refId: { in: limitedRefIds } },
        select: { refId: true, status: true, current: true, total: true },
      });

      const result: Record<string, BulkStatusItem> = {};
      const foundRefIds = new Set<string>();

      for (const item of items) {
        if (!item.refId) continue;
        result[item.refId] = {
          refId: item.refId,
          status: item.status,
          current: item.current,
          total: item.total,
        };
        foundRefIds.add(item.refId);
      }

      const remainingRefIds = limitedRefIds.filter((refId) => !foundRefIds.has(refId));
      if (remainingRefIds.length === 0) {
        return result;
      }

      const aliases = await prisma.mediaSourceAlias.findMany({
        where: { refId: { in: remainingRefIds } },
        select: {
          refId: true,
          mediaSource: { select: { refId: true } },
        },
      });

      const aliasToSourceRefId = new Map<string, string>();
      for (const alias of aliases) {
        aliasToSourceRefId.set(alias.refId, alias.mediaSource.refId);
      }

      const primaryRefIds = Array.from(new Set(aliases.map((alias) => alias.mediaSource.refId)));
      if (primaryRefIds.length === 0) {
        return result;
      }

      const aliasItems = await prisma.mediaItem.findMany({
        where: { userId, refId: { in: primaryRefIds } },
        select: { refId: true, status: true, current: true, total: true },
      });

      const primaryItemMap = new Map<string, typeof aliasItems[number]>();
      for (const item of aliasItems) {
        if (item.refId) primaryItemMap.set(item.refId, item);
      }

      for (const [aliasRefId, primaryRefId] of aliasToSourceRefId) {
        const item = primaryItemMap.get(primaryRefId);
        if (!item) continue;
        result[aliasRefId] = {
          refId: aliasRefId,
          status: item.status,
          current: item.current,
          total: item.total,
        };
      }

      return result;
    },
  };
}
