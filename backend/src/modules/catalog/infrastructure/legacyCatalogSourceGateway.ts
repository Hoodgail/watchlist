import type { CatalogSourceGateway } from '../application/ports/CatalogSourceGateway.js';
import { createPrismaCatalogSourceGateway } from './prismaCatalogSourceGateway.js';

export function createLegacyCatalogSourceGateway(): CatalogSourceGateway {
  return createPrismaCatalogSourceGateway();
}
