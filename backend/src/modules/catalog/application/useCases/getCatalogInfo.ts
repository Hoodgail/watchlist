import type { CatalogMediaGateway } from '../ports/CatalogMediaGateway.js';

export interface GetCatalogInfoQuery {
  provider: string;
  id: string;
  mediaType?: 'movie' | 'tv';
}

export function createGetCatalogInfoUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getCatalogInfo(query: GetCatalogInfoQuery): Promise<unknown> {
    return dependencies.mediaGateway.getInfo(query.id, query.provider, query.mediaType);
  };
}
