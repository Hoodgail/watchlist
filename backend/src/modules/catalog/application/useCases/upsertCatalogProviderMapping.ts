import type { CatalogProviderMapping, UpsertCatalogProviderMappingInput } from '../dto/catalog.js';
import type { CatalogProviderMappingGateway } from '../ports/CatalogProviderMappingGateway.js';

export interface UpsertCatalogProviderMappingCommand {
  input: UpsertCatalogProviderMappingInput;
  userId?: string;
}

export function createUpsertCatalogProviderMappingUseCase(dependencies: { providerMappingGateway: CatalogProviderMappingGateway }) {
  return async function upsertCatalogProviderMapping(command: UpsertCatalogProviderMappingCommand): Promise<CatalogProviderMapping> {
    return dependencies.providerMappingGateway.upsertMapping(command.input, command.userId);
  };
}
