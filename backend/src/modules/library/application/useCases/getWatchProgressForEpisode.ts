import type { LibraryWatchProgress } from '../dto/library.js';
import type { LibraryWatchProgressGateway } from '../ports/LibraryWatchProgressGateway.js';

export interface GetWatchProgressForEpisodeQuery {
  userId: string;
  mediaId: string;
  episodeId: string;
}

export function createGetWatchProgressForEpisodeUseCase(dependencies: { watchProgressGateway: LibraryWatchProgressGateway }) {
  return async function getWatchProgressForEpisode(query: GetWatchProgressForEpisodeQuery): Promise<LibraryWatchProgress | null> {
    return dependencies.watchProgressGateway.getProgressForEpisode(query.userId, query.mediaId, query.episodeId);
  };
}
