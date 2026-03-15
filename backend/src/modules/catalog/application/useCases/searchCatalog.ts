import type { CatalogMediaGateway } from '../ports/CatalogMediaGateway.js';
import type { CatalogSearchCategory, CatalogSearchOptions, CatalogSearchResult } from '../dto/catalog.js';

export interface SearchCatalogQuery {
  query: string;
  category: CatalogSearchCategory;
  options?: CatalogSearchOptions;
}

export function createSearchCatalogUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function searchCatalog(query: SearchCatalogQuery): Promise<CatalogSearchResult[]> {
    return dependencies.mediaGateway.searchMedia(query.query, query.category, query.options);
  };
}
