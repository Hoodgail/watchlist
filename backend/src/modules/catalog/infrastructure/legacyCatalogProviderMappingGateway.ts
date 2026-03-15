import * as providerMappingService from '../../../services/providerMappingService.js';
import type { CatalogProviderMappingGateway } from '../application/ports/CatalogProviderMappingGateway.js';

export function createLegacyCatalogProviderMappingGateway(): CatalogProviderMappingGateway {
  return {
    getMapping: (refId, provider) => providerMappingService.getMapping(refId, provider),
    getMappingsForRefId: (refId) => providerMappingService.getMappingsForRefId(refId),
    upsertMapping: (input, userId) => providerMappingService.upsertMapping(input, userId),
    createAutoMapping: (input) => providerMappingService.createAutoMapping(input),
    deleteMapping: (refId, provider) => providerMappingService.deleteMapping(refId, provider),
  };
}
