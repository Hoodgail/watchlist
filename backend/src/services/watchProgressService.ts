import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { UpdateWatchProgressInput } from '../utils/schemas.js';

export interface WatchProgressResponse {
  id: string;
  mediaId: string;
  episodeId: string | null;
  currentTime: number;
  duration: number;
  provider: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const watchProgressSelect = {
  id: true,
  mediaId: true,
  episodeId: true,
  currentTime: true,
  duration: true,
  provider: true,
  completed: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Threshold for marking as completed (95% watched)
const COMPLETION_THRESHOLD = 0.95;

/**
 * Upsert watch progress for a media/episode
 */
export async function upsertProgress(
  userId: string,
  input: UpdateWatchProgressInput
): Promise<WatchProgressResponse> {
  const { mediaId, episodeId, currentTime, duration, provider } = input;

  // Calculate if completed (watched 95% or more)
  const completed = duration > 0 && currentTime / duration >= COMPLETION_THRESHOLD;

  return prisma.watchProgress.upsert({
    where: {
      userId_mediaId_episodeId: {
        userId,
        mediaId,
        episodeId: episodeId ?? '',
      },
    },
    update: {
      currentTime,
      duration,
      completed,
      updatedAt: new Date(),
    },
    create: {
      userId,
      mediaId,
      episodeId: episodeId ?? '',
      currentTime,
      duration,
      provider,
      completed,
    },
    select: watchProgressSelect,
  });
}

/**
 * Get progress for a specific media (all episodes)
 */
export async function getProgressForMedia(
  userId: string,
  mediaId: string
): Promise<WatchProgressResponse[]> {
  return prisma.watchProgress.findMany({
    where: {
      userId,
      mediaId,
    },
    select: watchProgressSelect,
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get progress for a specific episode
 */
export async function getProgressForEpisode(
  userId: string,
  mediaId: string,
  episodeId: string
): Promise<WatchProgressResponse | null> {
  return prisma.watchProgress.findUnique({
    where: {
      userId_mediaId_episodeId: {
        userId,
        mediaId,
        episodeId,
      },
    },
    select: watchProgressSelect,
  });
}

/**
 * Get all progress for a user
 */
export async function getAllProgress(
  userId: string
): Promise<WatchProgressResponse[]> {
  return prisma.watchProgress.findMany({
    where: { userId },
    select: watchProgressSelect,
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Delete progress for a specific media (all episodes)
 */
export async function deleteProgressForMedia(
  userId: string,
  mediaId: string
): Promise<{ count: number }> {
  const result = await prisma.watchProgress.deleteMany({
    where: {
      userId,
      mediaId,
    },
  });

  return { count: result.count };
}

/**
 * Delete progress for a specific episode
 */
export async function deleteProgressForEpisode(
  userId: string,
  mediaId: string,
  episodeId: string
): Promise<void> {
  const existing = await prisma.watchProgress.findUnique({
    where: {
      userId_mediaId_episodeId: {
        userId,
        mediaId,
        episodeId,
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Watch progress not found');
  }

  await prisma.watchProgress.delete({
    where: {
      userId_mediaId_episodeId: {
        userId,
        mediaId,
        episodeId,
      },
    },
  });
}
