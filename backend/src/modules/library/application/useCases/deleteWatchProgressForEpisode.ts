import type { LibraryWatchProgressGateway } from '../ports/LibraryWatchProgressGateway.js';

export interface DeleteWatchProgressForEpisodeCommand {
  userId: string;
  mediaId: string;
  episodeId: string;
}

export function createDeleteWatchProgressForEpisodeUseCase(dependencies: { watchProgressGateway: LibraryWatchProgressGateway }) {
  return async function deleteWatchProgressForEpisode(command: DeleteWatchProgressForEpisodeCommand): Promise<void> {
    await dependencies.watchProgressGateway.deleteProgressForEpisode(command.userId, command.mediaId, command.episodeId);
  };
}
