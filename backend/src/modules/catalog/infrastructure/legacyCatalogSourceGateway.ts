import * as mediaSourceService from '../../../services/mediaSourceService.js';
import type { CatalogSourceGateway } from '../application/ports/CatalogSourceGateway.js';

export function createLegacyCatalogSourceGateway(): CatalogSourceGateway {
  return {
    findSourceByRefId: (refId) => mediaSourceService.findSourceByRefId(refId),
    addAliasToSource: (sourceId, newRefId) => mediaSourceService.addAliasToSource(sourceId, newRefId),
    getSourceWithAliases: (sourceId) => mediaSourceService.getSourceWithAliases(sourceId),
    removeAlias: (aliasId) => mediaSourceService.removeAlias(aliasId),
  };
}
