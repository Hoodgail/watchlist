import { prisma } from '../../../config/database.js';
import { parseRefId } from '@shared/refId.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../../utils/errors.js';
import type { MediaType, MediaSource } from '@prisma/client';
import type { CatalogSourceGateway } from '../application/ports/CatalogSourceGateway.js';
import { fetchMediaMetadata } from './mediaMetadata.js';

const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

async function refreshMediaSource(source: MediaSource): Promise<MediaSource> {
  try {
    const metadata = await fetchMediaMetadata(source.refId, source.type);
    return prisma.mediaSource.update({
      where: { id: source.id },
      data: {
        title: metadata.title,
        imageUrl: metadata.imageUrl,
        total: metadata.total,
        year: metadata.year,
        releaseDate: metadata.releaseDate,
        description: metadata.description,
        genres: metadata.genres,
        platforms: metadata.platforms,
        playtimeHours: metadata.playtimeHours,
      },
    });
  } catch (error) {
    console.error(`Failed to refresh MediaSource ${source.refId}:`, error);
    return source;
  }
}

export async function getOrCreateCatalogMediaSource(refId: string, type: MediaType) {
  const existing = await prisma.mediaSource.findUnique({ where: { refId } });
  if (existing) {
    const age = Date.now() - existing.updatedAt.getTime();
    if (age > STALE_THRESHOLD_MS) return refreshMediaSource(existing);
    return existing;
  }

  const alias = await prisma.mediaSourceAlias.findUnique({
    where: { refId },
    include: { mediaSource: true },
  });

  if (alias) {
    const age = Date.now() - alias.mediaSource.updatedAt.getTime();
    if (age > STALE_THRESHOLD_MS) return refreshMediaSource(alias.mediaSource);
    return alias.mediaSource;
  }

  const metadata = await fetchMediaMetadata(refId, type);
  return prisma.mediaSource.create({
    data: {
      refId,
      title: metadata.title,
      imageUrl: metadata.imageUrl,
      total: metadata.total,
      type,
      year: metadata.year,
      releaseDate: metadata.releaseDate,
      description: metadata.description,
      genres: metadata.genres,
      platforms: metadata.platforms,
      playtimeHours: metadata.playtimeHours,
    },
  });
}

export function createPrismaCatalogSourceGateway(): CatalogSourceGateway {
  return {
    async findSourceByRefId(refId) {
      const directMatch = await prisma.mediaSource.findUnique({ where: { refId } });
      if (directMatch) return directMatch;

      const alias = await prisma.mediaSourceAlias.findUnique({
        where: { refId },
        include: { mediaSource: true },
      });

      return alias?.mediaSource ?? null;
    },

    async addAliasToSource(sourceId, newRefId) {
      const parsed = parseRefId(newRefId);
      if (!parsed) {
        throw new BadRequestError(`Invalid refId format: ${newRefId}. Expected format "source:id"`);
      }

      const existingSource = await prisma.mediaSource.findUnique({ where: { refId: newRefId } });
      if (existingSource) {
        throw new ConflictError(`refId "${newRefId}" is already in use as a primary source`);
      }

      const existingAlias = await prisma.mediaSourceAlias.findUnique({ where: { refId: newRefId } });
      if (existingAlias) {
        throw new ConflictError(`refId "${newRefId}" is already in use as an alias`);
      }

      const mediaSource = await prisma.mediaSource.findUnique({ where: { id: sourceId } });
      if (!mediaSource) {
        throw new NotFoundError(`MediaSource with id "${sourceId}" not found`);
      }

      return prisma.mediaSourceAlias.create({
        data: {
          mediaSourceId: sourceId,
          refId: newRefId,
          provider: parsed.source,
        },
      });
    },

    async getSourceWithAliases(sourceId) {
      const source = await prisma.mediaSource.findUnique({
        where: { id: sourceId },
        include: { aliases: true },
      });

      if (!source) {
        throw new NotFoundError(`MediaSource with id "${sourceId}" not found`);
      }

      return source;
    },

    async removeAlias(aliasId) {
      const alias = await prisma.mediaSourceAlias.findUnique({ where: { id: aliasId } });
      if (!alias) {
        throw new NotFoundError(`Alias with id "${aliasId}" not found`);
      }
      await prisma.mediaSourceAlias.delete({ where: { id: aliasId } });
    },
  };
}
