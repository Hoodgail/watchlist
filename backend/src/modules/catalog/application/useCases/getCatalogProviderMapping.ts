import type { CatalogProviderMapping } from '../dto/catalog.js';
import type { CatalogProviderMappingGateway } from '../ports/CatalogProviderMappingGateway.js';

export interface GetCatalogProviderMappingQuery {
  refId: string;
  provider: string;
}

export function createGetCatalogProviderMappingUseCase(dependencies: { providerMappingGateway: CatalogProviderMappingGateway }) {
  return async function getCatalogProviderMapping(query: GetCatalogProviderMappingQuery): Promise<CatalogProviderMapping | null> {
    return dependencies.providerMappingGateway.getMapping(query.refId, query.provider);
  };
}
