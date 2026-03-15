import type { LibraryWatchProgress } from '../dto/library.js';
import type { LibraryWatchProgressGateway } from '../ports/LibraryWatchProgressGateway.js';

export interface GetAllWatchProgressQuery {
  userId: string;
}

export function createGetAllWatchProgressUseCase(dependencies: { watchProgressGateway: LibraryWatchProgressGateway }) {
  return async function getAllWatchProgress(query: GetAllWatchProgressQuery): Promise<LibraryWatchProgress[]> {
    return dependencies.watchProgressGateway.getAllProgress(query.userId);
  };
}
