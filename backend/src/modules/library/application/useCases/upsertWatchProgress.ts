import type { LibraryWatchProgress, LibraryWatchProgressInput } from '../dto/library.js';
import type { LibraryWatchProgressGateway } from '../ports/LibraryWatchProgressGateway.js';

export interface UpsertWatchProgressCommand {
  userId: string;
  input: LibraryWatchProgressInput;
}

export function createUpsertWatchProgressUseCase(dependencies: { watchProgressGateway: LibraryWatchProgressGateway }) {
  return async function upsertWatchProgress(command: UpsertWatchProgressCommand): Promise<LibraryWatchProgress> {
    return dependencies.watchProgressGateway.upsertProgress(command.userId, command.input);
  };
}
