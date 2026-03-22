import type { CatalogMediaSource, CatalogMediaSourceAlias } from '../dto/catalog.js';

export interface CatalogSourceGateway {
  findSourceByRefId(refId: string): Promise<CatalogMediaSource | null>;
  addAliasToSource(sourceId: string, newRefId: string): Promise<CatalogMediaSourceAlias>;
  getSourceWithAliases(sourceId: string): Promise<unknown>;
  removeAlias(aliasId: string): Promise<void>;
}
