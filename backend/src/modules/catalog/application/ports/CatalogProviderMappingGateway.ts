import type { CatalogProviderMapping, UpsertCatalogProviderMappingInput } from '../dto/catalog.js';

export interface CatalogProviderMappingGateway {
  getMapping(refId: string, provider: string): Promise<CatalogProviderMapping | null>;
  getMappingsForRefId(refId: string): Promise<CatalogProviderMapping[]>;
  upsertMapping(input: UpsertCatalogProviderMappingInput, userId?: string): Promise<CatalogProviderMapping>;
  createAutoMapping(input: UpsertCatalogProviderMappingInput): Promise<CatalogProviderMapping | null>;
  deleteMapping(refId: string, provider: string): Promise<void>;
}
