import { prisma } from '../../../config/database.js';
import { ForbiddenError, NotFoundError } from '../../../utils/errors.js';
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
    async getMapping(refId, provider, userId) {
      if (!userId) return null;
      return prisma.providerMapping.findUnique({
        where: { userId_refId_provider: { userId, refId, provider } },
        select: mappingSelect,
      });
    },
    async getMappingsForRefId(refId, userId) {
      if (!userId) return [];
      return prisma.providerMapping.findMany({
        where: { userId, refId },
        select: mappingSelect,
        orderBy: { confidence: 'desc' },
      });
    },
    upsertMapping(input, userId) {
      if (!userId) throw new ForbiddenError('Mapping author is required');
      const { refId, provider, providerId, providerTitle } = input;
      return prisma.providerMapping.upsert({
        where: { userId_refId_provider: { userId, refId, provider } },
        update: { providerId, providerTitle, confidence: 1, verifiedBy: userId },
        create: {
          userId,
          refId,
          provider,
          providerId,
          providerTitle,
          confidence: 1,
          verifiedBy: userId,
        },
        select: mappingSelect,
      });
    },
    async deleteMapping(refId, provider, userId) {
      if (!userId) throw new ForbiddenError('Mapping author is required');
      const deleted = await prisma.providerMapping.deleteMany({
        where: { userId, refId, provider },
      });
      if (!deleted.count) throw new NotFoundError('Mapping not found');
    },
  };
}
