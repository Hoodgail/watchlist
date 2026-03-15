import type { CreateMediaItemInput } from '../../../../utils/schemas.js';
import type { LibraryMediaItem } from '../dto/library.js';
import type { LibraryListGateway } from '../ports/LibraryListGateway.js';

export interface CreateMediaItemCommand {
  userId: string;
  input: CreateMediaItemInput;
}

export function createCreateMediaItemUseCase(dependencies: { listGateway: LibraryListGateway }) {
  return async function createMediaItem(command: CreateMediaItemCommand): Promise<LibraryMediaItem> {
    return dependencies.listGateway.createMediaItem(command.userId, command.input);
  };
}
