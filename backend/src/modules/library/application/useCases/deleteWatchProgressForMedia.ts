import type { LibraryWatchProgressGateway } from '../ports/LibraryWatchProgressGateway.js';

export interface DeleteWatchProgressForMediaCommand {
  userId: string;
  mediaId: string;
}

export function createDeleteWatchProgressForMediaUseCase(dependencies: { watchProgressGateway: LibraryWatchProgressGateway }) {
  return async function deleteWatchProgressForMedia(command: DeleteWatchProgressForMediaCommand): Promise<{ count: number }> {
    return dependencies.watchProgressGateway.deleteProgressForMedia(command.userId, command.mediaId);
  };
}
