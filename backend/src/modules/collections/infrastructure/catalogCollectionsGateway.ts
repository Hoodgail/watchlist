import type { MediaType } from '@prisma/client';
import { getOrCreateCatalogMediaSource } from '../../catalog/infrastructure/prismaCatalogSourceGateway.js';
import type { CollectionCatalogGateway } from '../application/ports/CollectionCatalogGateway.js';

export function createCatalogCollectionsGateway(): CollectionCatalogGateway {
  return {
    async getOrCreateMediaSource(refId: string, type: MediaType) {
      const source = await getOrCreateCatalogMediaSource(refId, type);
      return { id: source.id };
    },
  };
}
