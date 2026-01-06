import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { CreateMediaItemInput, UpdateMediaItemInput } from '../utils/schemas.js';
import type { MediaType, MediaStatus } from '@prisma/client';

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
  refId: string | null;
  createdAt: Date;
  updatedAt: Date;
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

  return items;
}

export async function createMediaItem(
  userId: string,
  input: CreateMediaItemInput
): Promise<MediaItemResponse> {
  return prisma.mediaItem.create({
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
      refId: input.refId,
    },
    select: mediaItemSelect,
  });
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
