import type { CatalogMediaGateway } from '../ports/CatalogMediaGateway.js';
import type { CatalogProviderInfo, CatalogSearchCategory } from '../dto/catalog.js';

export interface GetCatalogProvidersQuery {
  category?: CatalogSearchCategory;
}

export function createGetCatalogProvidersUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return function getCatalogProviders(query: GetCatalogProvidersQuery): CatalogProviderInfo[] {
    return dependencies.mediaGateway.getProviders(query.category);
  };
}
