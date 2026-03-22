import type { LibraryListGateway } from '../ports/LibraryListGateway.js';

export interface DeleteMediaItemCommand {
  userId: string;
  itemId: string;
}

export function createDeleteMediaItemUseCase(dependencies: { listGateway: LibraryListGateway }) {
  return async function deleteMediaItem(command: DeleteMediaItemCommand): Promise<void> {
    await dependencies.listGateway.deleteMediaItem(command.userId, command.itemId);
  };
}
