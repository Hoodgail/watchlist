import type { UpdateMediaItemInput } from '../../../../utils/schemas.js';
import type { LibraryMediaItem } from '../dto/library.js';
import type { LibraryListGateway } from '../ports/LibraryListGateway.js';

export interface UpdateMediaItemCommand {
  userId: string;
  itemId: string;
  input: UpdateMediaItemInput;
}

export function createUpdateMediaItemUseCase(dependencies: { listGateway: LibraryListGateway }) {
  return async function updateMediaItem(command: UpdateMediaItemCommand): Promise<LibraryMediaItem> {
    return dependencies.listGateway.updateMediaItem(command.userId, command.itemId, command.input);
  };
}
