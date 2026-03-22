import type { MediaType } from '@prisma/client';
import type { CatalogMediaSourceRecord } from '../dto/collections.js';

export interface CollectionCatalogGateway {
  getOrCreateMediaSource(refId: string, type: MediaType): Promise<CatalogMediaSourceRecord>;
}
