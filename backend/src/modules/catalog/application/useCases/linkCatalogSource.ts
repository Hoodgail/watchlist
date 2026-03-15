import type { CatalogMediaSourceAlias } from '../dto/catalog.js';
import type { CatalogSourceGateway } from '../ports/CatalogSourceGateway.js';

export interface LinkCatalogSourceCommand {
  sourceRefId?: string;
  sourceId?: string;
  newRefId: string;
}

export function createLinkCatalogSourceUseCase(dependencies: { sourceGateway: CatalogSourceGateway }) {
  return async function linkCatalogSource(command: LinkCatalogSourceCommand): Promise<CatalogMediaSourceAlias> {
    let resolvedSourceId = command.sourceId;

    if (!resolvedSourceId && command.sourceRefId) {
      const source = await dependencies.sourceGateway.findSourceByRefId(command.sourceRefId);
      if (!source) {
        throw new Error('SOURCE_NOT_FOUND');
      }
      resolvedSourceId = source.id;
    }

    if (!resolvedSourceId) {
      throw new Error('SOURCE_ID_REQUIRED');
    }

    return dependencies.sourceGateway.addAliasToSource(resolvedSourceId, command.newRefId);
  };
}
