import type { LibraryMediaItem } from '../dto/library.js';
import type { LibraryListGateway } from '../ports/LibraryListGateway.js';

export interface GetMediaItemQuery {
  userId: string;
  itemId: string;
}

export function createGetMediaItemUseCase(dependencies: { listGateway: LibraryListGateway }) {
  return async function getMediaItem(query: GetMediaItemQuery): Promise<LibraryMediaItem> {
    return dependencies.listGateway.getMediaItem(query.userId, query.itemId);
  };
}
