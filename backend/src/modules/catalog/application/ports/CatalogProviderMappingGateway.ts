import type { CatalogProviderMapping, UpsertCatalogProviderMappingInput } from '../dto/catalog.js';

export interface CatalogProviderMappingGateway {
  getMapping(refId: string, provider: string, userId?: string): Promise<CatalogProviderMapping | null>;
  getMappingsForRefId(refId: string, userId?: string): Promise<CatalogProviderMapping[]>;
  upsertMapping(input: UpsertCatalogProviderMappingInput, userId?: string): Promise<CatalogProviderMapping>;
  deleteMapping(refId: string, provider: string, userId?: string): Promise<void>;
}
