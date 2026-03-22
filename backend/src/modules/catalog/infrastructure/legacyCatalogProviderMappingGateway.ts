import type { CatalogProviderMappingGateway } from '../application/ports/CatalogProviderMappingGateway.js';
import { createPrismaCatalogProviderMappingGateway } from './prismaCatalogProviderMappingGateway.js';

export function createLegacyCatalogProviderMappingGateway(): CatalogProviderMappingGateway {
  return createPrismaCatalogProviderMappingGateway();
}
