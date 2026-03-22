import type { CatalogSourceGateway } from '../ports/CatalogSourceGateway.js';

export interface RemoveCatalogAliasCommand {
  aliasId: string;
}

export function createRemoveCatalogAliasUseCase(dependencies: { sourceGateway: CatalogSourceGateway }) {
  return async function removeCatalogAlias(command: RemoveCatalogAliasCommand): Promise<void> {
    await dependencies.sourceGateway.removeAlias(command.aliasId);
  };
}
