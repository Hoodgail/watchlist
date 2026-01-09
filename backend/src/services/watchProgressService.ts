import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { UpdateWatchProgressInput } from '../utils/schemas.js';
import type { MediaType } from '@prisma/client';

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
 * 
 * When an episode is completed (95%+ watched), this function will:
 * 1. Mark the WatchProgress as completed
 * 2. Find any associated MediaItem and increment its `current` counter if needed
 * 3. Update MediaItem status from PLAN_TO_WATCH to WATCHING if applicable
 */
export async function upsertProgress(
  userId: string,
  input: UpdateWatchProgressInput
): Promise<WatchProgressResponse> {
  const { mediaId, episodeId, currentTime, duration, provider } = input;

  // Calculate if completed (watched 95% or more)
  const completed = duration > 0 && currentTime / duration >= COMPLETION_THRESHOLD;
  
  // Check if this is a newly completed episode (wasn't completed before)
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

  // If newly completed, try to sync with MediaItem
  if (isNewlyCompleted) {
    await syncMediaItemProgress(userId, mediaId, episodeId);
  }

  return result;
}

/**
 * Sync MediaItem progress when an episode is completed
 * 
 * This function attempts to find a matching MediaItem and update its progress.
 * It handles the mapping between WatchProgress (provider-specific IDs) and
 * MediaItem (may use different IDs like TMDB).
 */
async function syncMediaItemProgress(
  userId: string,
  mediaId: string,
  episodeId: string | undefined
): Promise<void> {
  try {
    // Parse the episode number from episodeId if available
    // Episode IDs are often in format like "episode-5" or just contain a number
    const episodeNumber = parseEpisodeNumber(episodeId);
    
    if (episodeNumber === null) {
      // Can't determine episode number, skip sync
      return;
    }

    // Try to find matching MediaItem(s) for this user
    // We look for items that could match this mediaId
    // MediaItem.refId might be different (e.g., "tmdb:12345" vs "hianime:abc")
    // so we also check by looking at all video-type media items
    
    // First, try exact match on refId (for cases where they match)
    let mediaItem = await prisma.mediaItem.findUnique({
      where: {
        userId_refId: {
          userId,
          refId: mediaId,
        },
      },
    });

    // If no exact match, try to find by provider prefix match
    // e.g., if mediaId is "hianime:12345", check for items with same provider
    if (!mediaItem && mediaId.includes(':')) {
      const [provider] = mediaId.split(':');
      
      // Look for any media items from the same provider
      // This is a fallback that might match the wrong item in edge cases
      // but is better than nothing for now
      const providerItems = await prisma.mediaItem.findMany({
        where: {
          userId,
          refId: { startsWith: `${provider}:` },
          type: { in: ['TV', 'MOVIE', 'ANIME'] as MediaType[] },
        },
      });

      // If there's only one item from this provider, use it
      // Otherwise, we can't reliably determine which one to update
      if (providerItems.length === 1) {
        mediaItem = providerItems[0];
      }
    }

    if (!mediaItem) {
      // No matching MediaItem found, skip sync
      return;
    }

    // Skip if it's a MANGA type (manga uses different progress tracking)
    if (mediaItem.type === 'MANGA') {
      return;
    }

    // Only increment if the completed episode is greater than current progress
    if (episodeNumber > mediaItem.current) {
      const updates: { current: number; status?: 'WATCHING' } = {
        current: episodeNumber,
      };

      // If status is PLAN_TO_WATCH, change to WATCHING
      if (mediaItem.status === 'PLAN_TO_WATCH') {
        updates.status = 'WATCHING';
      }

      await prisma.mediaItem.update({
        where: { id: mediaItem.id },
        data: updates,
      });
    }
  } catch (error) {
    // Log but don't fail the main operation
    console.error('[syncMediaItemProgress] Failed to sync:', error);
  }
}

/**
 * Parse episode number from various episodeId formats
 * 
 * Common formats:
 * - "12345" (just a number)
 * - "episode-5"
 * - "ep-5"
 * - "s1e5" or "s01e05"
 * - "5" (string number)
 */
function parseEpisodeNumber(episodeId: string | undefined): number | null {
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
