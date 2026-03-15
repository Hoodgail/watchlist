import type { CatalogProviderMappingGateway } from '../ports/CatalogProviderMappingGateway.js';

export interface DeleteCatalogProviderMappingCommand {
  refId: string;
  provider: string;
}

export function createDeleteCatalogProviderMappingUseCase(dependencies: { providerMappingGateway: CatalogProviderMappingGateway }) {
  return async function deleteCatalogProviderMapping(command: DeleteCatalogProviderMappingCommand): Promise<void> {
    await dependencies.providerMappingGateway.deleteMapping(command.refId, command.provider);
  };
}
