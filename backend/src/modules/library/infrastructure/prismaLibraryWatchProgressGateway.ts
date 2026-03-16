import { prisma } from '../../../config/database.js';
import { NotFoundError } from '../../../utils/errors.js';
import type { LibraryWatchProgressGateway } from '../application/ports/LibraryWatchProgressGateway.js';
import { COMPLETION_THRESHOLD, VIDEO_MEDIA_TYPES, watchProgressSelect } from '../domain/watchProgress.js';
import { parseEpisodeNumber } from '../domain/parseEpisodeNumber.js';

async function syncMediaItemProgress(
  userId: string,
  mediaId: string,
  currentEpisode: number | null,
  totalEpisodes?: number,
): Promise<void> {
  try {
    if (currentEpisode === null) {
      return;
    }

    let mediaItem = await prisma.mediaItem.findUnique({
      where: {
        userId_refId: {
          userId,
          refId: mediaId,
        },
      },
    });

    if (!mediaItem && mediaId.includes(':')) {
      const [provider] = mediaId.split(':');
      const providerItems = await prisma.mediaItem.findMany({
        where: {
          userId,
          refId: { startsWith: `${provider}:` },
          type: { in: VIDEO_MEDIA_TYPES },
        },
      });

      if (providerItems.length === 1) {
        mediaItem = providerItems[0];
      }
    }

    if (!mediaItem || mediaItem.type === 'MANGA') {
      return;
    }

    const updates: { current?: number; total?: number; status?: 'WATCHING' } = {};

    if (currentEpisode > mediaItem.current) {
      updates.current = currentEpisode;
      if (mediaItem.status === 'PLAN_TO_WATCH') {
        updates.status = 'WATCHING';
      }
    }

    if (totalEpisodes && totalEpisodes > 0 && (!mediaItem.total || mediaItem.total !== totalEpisodes)) {
      updates.total = totalEpisodes;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.mediaItem.update({
        where: { id: mediaItem.id },
        data: updates,
      });
    }
  } catch (error) {
    console.error('[syncMediaItemProgress] Failed to sync:', error);
  }
}

export function createPrismaLibraryWatchProgressGateway(): LibraryWatchProgressGateway {
  return {
    async upsertProgress(userId, input) {
      const { mediaId, episodeId, episodeNumber, seasonNumber, currentTime, duration, provider, currentEpisode, totalEpisodes } = input;
      const completed = duration > 0 && currentTime / duration >= COMPLETION_THRESHOLD;

      const existingProgress = await prisma.watchProgress.findUnique({
        where: {
          userId_mediaId_episodeId: {
            userId,
            mediaId,
            episodeId: episodeId ?? '',
          },
        },
        select: { completed: true },
      });

      const isNewlyCompleted = completed && (!existingProgress || !existingProgress.completed);

      const result = await prisma.watchProgress.upsert({
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
          ...(episodeNumber !== undefined && { episodeNumber }),
          ...(seasonNumber !== undefined && { seasonNumber }),
          updatedAt: new Date(),
        },
        create: {
          userId,
          mediaId,
          episodeId: episodeId ?? '',
          episodeNumber: episodeNumber ?? null,
          seasonNumber: seasonNumber ?? null,
          currentTime,
          duration,
          provider,
          completed,
        },
        select: watchProgressSelect,
      });

      if (isNewlyCompleted) {
        const epNum = currentEpisode ?? result.episodeNumber ?? parseEpisodeNumber(episodeId);
        await syncMediaItemProgress(userId, mediaId, epNum, totalEpisodes);
      }

      return result;
    },

    getProgressForMedia(userId, mediaId) {
      return prisma.watchProgress.findMany({
        where: { userId, mediaId },
        select: watchProgressSelect,
        orderBy: { updatedAt: 'desc' },
      });
    },

    getProgressForEpisode(userId, mediaId, episodeId) {
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
    },

    getAllProgress(userId) {
      return prisma.watchProgress.findMany({
        where: { userId },
        select: watchProgressSelect,
        orderBy: { updatedAt: 'desc' },
      });
    },

    async deleteProgressForMedia(userId, mediaId) {
      const result = await prisma.watchProgress.deleteMany({ where: { userId, mediaId } });
      return { count: result.count };
    },

    async deleteProgressForEpisode(userId, mediaId, episodeId) {
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
    },
  };
}
