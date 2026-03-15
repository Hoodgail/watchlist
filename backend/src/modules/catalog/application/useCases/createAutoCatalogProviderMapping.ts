import type { CatalogProviderMapping, UpsertCatalogProviderMappingInput } from '../dto/catalog.js';
import type { CatalogProviderMappingGateway } from '../ports/CatalogProviderMappingGateway.js';

export interface CreateAutoCatalogProviderMappingCommand {
  input: UpsertCatalogProviderMappingInput;
}

export function createCreateAutoCatalogProviderMappingUseCase(dependencies: { providerMappingGateway: CatalogProviderMappingGateway }) {
  return async function createAutoCatalogProviderMapping(command: CreateAutoCatalogProviderMappingCommand): Promise<CatalogProviderMapping | null> {
    return dependencies.providerMappingGateway.createAutoMapping(command.input);
  };
}
