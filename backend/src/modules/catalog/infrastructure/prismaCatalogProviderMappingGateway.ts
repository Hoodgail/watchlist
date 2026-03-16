import { prisma } from '../../../config/database.js';
import { NotFoundError } from '../../../utils/errors.js';
import type { CatalogProviderMappingGateway } from '../application/ports/CatalogProviderMappingGateway.js';

const mappingSelect = {
  id: true,
  refId: true,
  provider: true,
  providerId: true,
  providerTitle: true,
  confidence: true,
  verifiedBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function createPrismaCatalogProviderMappingGateway(): CatalogProviderMappingGateway {
  return {
    getMapping(refId, provider) {
      return prisma.providerMapping.findUnique({
        where: { refId_provider: { refId, provider } },
        select: mappingSelect,
      });
    },

    getMappingsForRefId(refId) {
      return prisma.providerMapping.findMany({
        where: { refId },
        select: mappingSelect,
        orderBy: { confidence: 'desc' },
      });
    },

    upsertMapping(input, userId) {
      const { refId, provider, providerId, providerTitle, confidence = 1.0 } = input;
      return prisma.providerMapping.upsert({
        where: { refId_provider: { refId, provider } },
        update: {
          providerId,
          providerTitle,
          confidence,
          verifiedBy: userId || null,
          updatedAt: new Date(),
        },
        create: {
          refId,
          provider,
          providerId,
          providerTitle,
          confidence,
          verifiedBy: userId || null,
        },
        select: mappingSelect,
      });
    },

    async createAutoMapping(input) {
      const { refId, provider, providerId, providerTitle, confidence = 0.5 } = input;
      const existing = await prisma.providerMapping.findUnique({
        where: { refId_provider: { refId, provider } },
      });

      if (existing && (existing.verifiedBy || existing.confidence >= confidence)) {
        return null;
      }

      return prisma.providerMapping.upsert({
        where: { refId_provider: { refId, provider } },
        update: {
          providerId,
          providerTitle,
          confidence,
          updatedAt: new Date(),
        },
        create: {
          refId,
          provider,
          providerId,
          providerTitle,
          confidence,
          verifiedBy: null,
        },
        select: mappingSelect,
      });
    },

    async deleteMapping(refId, provider) {
      const existing = await prisma.providerMapping.findUnique({
        where: { refId_provider: { refId, provider } },
      });

      if (!existing) {
        throw new NotFoundError('Mapping not found');
      }

      await prisma.providerMapping.delete({
        where: { refId_provider: { refId, provider } },
      });
    },
  };
}
