import type { CatalogProviderMapping } from '../dto/catalog.js';
import type { CatalogProviderMappingGateway } from '../ports/CatalogProviderMappingGateway.js';

export interface GetCatalogProviderMappingsQuery {
  refId: string;
}

export function createGetCatalogProviderMappingsUseCase(dependencies: { providerMappingGateway: CatalogProviderMappingGateway }) {
  return async function getCatalogProviderMappings(query: GetCatalogProviderMappingsQuery): Promise<CatalogProviderMapping[]> {
    return dependencies.providerMappingGateway.getMappingsForRefId(query.refId);
  };
}
