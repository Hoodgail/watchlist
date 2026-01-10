import { prisma } from '../config/database.js';
import { parseRefId } from '@shared/refId.js';
import { getAnilistAnimeInfo, getAnilistMangaInfo, getTMDBInfo } from './consumet/metaProviders.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';
import type { MediaType, MediaSource, MediaSourceAlias } from '@prisma/client';

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
 * Also checks MediaSourceAlias table for existing aliases
 */
export async function getOrCreateMediaSource(refId: string, type: MediaType): Promise<MediaSource> {
  // First check if source exists directly by refId
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

  // Check if this refId exists as an alias
  const alias = await prisma.mediaSourceAlias.findUnique({
    where: { refId },
    include: { mediaSource: true },
  });

  if (alias) {
    // Found via alias, check if parent source needs refresh
    const age = Date.now() - alias.mediaSource.updatedAt.getTime();
    if (age > STALE_THRESHOLD_MS) {
      return refreshMediaSource(alias.mediaSource);
    }
    return alias.mediaSource;
  }

  // Neither found, fetch metadata and create new source
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

/**
 * Find a MediaSource by refId, checking both primary refId and aliases
 */
export async function findSourceByRefId(refId: string): Promise<MediaSource | null> {
  // First check direct refId match
  const directMatch = await prisma.mediaSource.findUnique({
    where: { refId },
  });

  if (directMatch) {
    return directMatch;
  }

  // Check if refId exists as an alias
  const alias = await prisma.mediaSourceAlias.findUnique({
    where: { refId },
    include: { mediaSource: true },
  });

  return alias?.mediaSource ?? null;
}

/**
 * Add an alias refId to an existing MediaSource
 */
export async function addAliasToSource(sourceId: string, newRefId: string): Promise<MediaSourceAlias> {
  // Validate the refId format
  const parsed = parseRefId(newRefId);
  if (!parsed) {
    throw new BadRequestError(`Invalid refId format: ${newRefId}. Expected format "source:id"`);
  }

  const { source: provider } = parsed;

  // Check if this refId already exists as a primary MediaSource refId
  const existingSource = await prisma.mediaSource.findUnique({
    where: { refId: newRefId },
  });

  if (existingSource) {
    throw new ConflictError(`refId "${newRefId}" is already in use as a primary source`);
  }

  // Check if this refId already exists as an alias
  const existingAlias = await prisma.mediaSourceAlias.findUnique({
    where: { refId: newRefId },
  });

  if (existingAlias) {
    throw new ConflictError(`refId "${newRefId}" is already in use as an alias`);
  }

  // Verify the source exists
  const mediaSource = await prisma.mediaSource.findUnique({
    where: { id: sourceId },
  });

  if (!mediaSource) {
    throw new NotFoundError(`MediaSource with id "${sourceId}" not found`);
  }

  // Create the alias
  return prisma.mediaSourceAlias.create({
    data: {
      mediaSourceId: sourceId,
      refId: newRefId,
      provider,
    },
  });
}

/**
 * Get a MediaSource with all its aliases
 */
export async function getSourceWithAliases(sourceId: string): Promise<MediaSource & { aliases: MediaSourceAlias[] }> {
  const source = await prisma.mediaSource.findUnique({
    where: { id: sourceId },
    include: { aliases: true },
  });

  if (!source) {
    throw new NotFoundError(`MediaSource with id "${sourceId}" not found`);
  }

  return source;
}

/**
 * Remove an alias from a MediaSource
 */
export async function removeAlias(aliasId: string): Promise<void> {
  const alias = await prisma.mediaSourceAlias.findUnique({
    where: { id: aliasId },
  });

  if (!alias) {
    throw new NotFoundError(`Alias with id "${aliasId}" not found`);
  }

  await prisma.mediaSourceAlias.delete({
    where: { id: aliasId },
  });
}
