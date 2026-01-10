import { prisma } from '../config/database.js';
import { parseRefId } from '@shared/refId.js';
import { getAnilistAnimeInfo, getAnilistMangaInfo, getTMDBInfo } from './consumet/metaProviders.js';
import { BadRequestError } from '../utils/errors.js';
import type { MediaType, MediaSource } from '@prisma/client';

const SUPPORTED_META_SOURCES = ['tmdb', 'anilist', 'anilist-manga'] as const;
const COMING_SOON_TYPES: MediaType[] = ['BOOK', 'LIGHT_NOVEL', 'COMIC'];
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type MetaSource = typeof SUPPORTED_META_SOURCES[number];

interface MediaMetadata {
  title: string;
  imageUrl: string | null;
  total: number | null;
}

function isMetaSource(source: string): source is MetaSource {
  return SUPPORTED_META_SOURCES.includes(source as MetaSource);
}

// Helper to determine TMDB media type from MediaType enum
function getTMDBMediaType(type: MediaType): 'movie' | 'tv' {
  return type === 'MOVIE' ? 'movie' : 'tv';
}

/**
 * Fetch metadata from external provider based on refId
 */
async function fetchMediaMetadata(refId: string, type: MediaType): Promise<MediaMetadata> {
  // Check for coming soon types
  if (COMING_SOON_TYPES.includes(type)) {
    throw new BadRequestError(`${type.replace('_', ' ')} support coming soon`);
  }

  const parsed = parseRefId(refId);
  if (!parsed) {
    throw new BadRequestError(`Invalid refId format: ${refId}`);
  }

  const { source, id } = parsed;

  if (!isMetaSource(source)) {
    throw new BadRequestError(
      `Provider "${source}" is not supported for automatic metadata. ` +
      `Supported: tmdb (movies/TV), anilist (anime), anilist-manga (manga).`
    );
  }

  let info;
  switch (source) {
    case 'tmdb':
      info = await getTMDBInfo(id, getTMDBMediaType(type));
      break;
    case 'anilist':
      info = await getAnilistAnimeInfo(id);
      break;
    case 'anilist-manga':
      info = await getAnilistMangaInfo(id);
      break;
  }

  if (!info) {
    throw new BadRequestError(`Failed to fetch metadata for ${refId}. The provider may be unavailable.`);
  }

  return {
    title: info.title || 'Unknown',
    imageUrl: info.image || null,
    total: info.totalEpisodes ?? info.totalChapters ?? null,
  };
}

/**
 * Get or create MediaSource for a given refId
 * If source exists and is stale (>7 days), refresh it
 */
export async function getOrCreateMediaSource(refId: string, type: MediaType): Promise<MediaSource> {
  // Check if source already exists
  const existing = await prisma.mediaSource.findUnique({
    where: { refId },
  });

  if (existing) {
    // Check if stale and needs refresh
    const age = Date.now() - existing.updatedAt.getTime();
    if (age > STALE_THRESHOLD_MS) {
      return refreshMediaSource(existing);
    }
    return existing;
  }

  // Fetch metadata and create new source
  const metadata = await fetchMediaMetadata(refId, type);

  return prisma.mediaSource.create({
    data: {
      refId,
      title: metadata.title,
      imageUrl: metadata.imageUrl,
      total: metadata.total,
      type,
    },
  });
}

/**
 * Refresh a stale MediaSource with fresh data from provider
 */
async function refreshMediaSource(source: MediaSource): Promise<MediaSource> {
  try {
    const metadata = await fetchMediaMetadata(source.refId, source.type);

    return prisma.mediaSource.update({
      where: { id: source.id },
      data: {
        title: metadata.title,
        imageUrl: metadata.imageUrl,
        total: metadata.total,
        // updatedAt auto-updates
      },
    });
  } catch (error) {
    // If refresh fails, just return existing source (don't break the request)
    console.error(`Failed to refresh MediaSource ${source.refId}:`, error);
    return source;
  }
}
