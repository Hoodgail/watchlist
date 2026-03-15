import type { CatalogMediaGateway } from '../ports/CatalogMediaGateway.js';
import type { CatalogSearchOptions, CatalogSearchResult } from '../dto/catalog.js';
import type { PaginatedResults } from '../../../../services/consumet/types.js';

export interface SearchCatalogProviderQuery {
  query: string;
  provider: string;
  options?: CatalogSearchOptions;
}

export function createSearchCatalogProviderUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function searchCatalogProvider(query: SearchCatalogProviderQuery): Promise<PaginatedResults<CatalogSearchResult>> {
    return dependencies.mediaGateway.searchWithProvider(query.query, query.provider, query.options);
  };
}
