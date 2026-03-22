import type { CatalogSourceGateway } from '../ports/CatalogSourceGateway.js';

export interface GetSourceWithAliasesQuery {
  sourceId: string;
}

export function createGetSourceWithAliasesUseCase(dependencies: { sourceGateway: CatalogSourceGateway }) {
  return async function getSourceWithAliases(query: GetSourceWithAliasesQuery): Promise<unknown> {
    return dependencies.sourceGateway.getSourceWithAliases(query.sourceId);
  };
}
