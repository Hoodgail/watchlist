import type { LibraryWatchProgress } from '../dto/library.js';
import type { LibraryWatchProgressGateway } from '../ports/LibraryWatchProgressGateway.js';

export interface GetWatchProgressForMediaQuery {
  userId: string;
  mediaId: string;
}

export function createGetWatchProgressForMediaUseCase(dependencies: { watchProgressGateway: LibraryWatchProgressGateway }) {
  return async function getWatchProgressForMedia(query: GetWatchProgressForMediaQuery): Promise<LibraryWatchProgress[]> {
    return dependencies.watchProgressGateway.getProgressForMedia(query.userId, query.mediaId);
  };
}
