import type { CatalogMediaGateway } from '../application/ports/CatalogMediaGateway.js';
import { createPrismaCatalogMediaGateway } from './prismaCatalogMediaGateway.js';

export function createLegacyCatalogMediaGateway(): CatalogMediaGateway {
  return createPrismaCatalogMediaGateway();
}
