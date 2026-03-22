import type { CatalogMediaSource } from '../dto/catalog.js';
import type { CatalogSourceGateway } from '../ports/CatalogSourceGateway.js';

export interface FindCatalogSourceByRefIdQuery {
  refId: string;
}

export function createFindCatalogSourceByRefIdUseCase(dependencies: { sourceGateway: CatalogSourceGateway }) {
  return async function findCatalogSourceByRefId(query: FindCatalogSourceByRefIdQuery): Promise<CatalogMediaSource | null> {
    return dependencies.sourceGateway.findSourceByRefId(query.refId);
  };
}
