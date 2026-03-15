import type { LibraryWatchProgress, LibraryWatchProgressInput } from '../dto/library.js';

export interface LibraryWatchProgressGateway {
  upsertProgress(userId: string, input: LibraryWatchProgressInput): Promise<LibraryWatchProgress>;
  getProgressForMedia(userId: string, mediaId: string): Promise<LibraryWatchProgress[]>;
  getProgressForEpisode(userId: string, mediaId: string, episodeId: string): Promise<LibraryWatchProgress | null>;
  getAllProgress(userId: string): Promise<LibraryWatchProgress[]>;
  deleteProgressForEpisode(userId: string, mediaId: string, episodeId: string): Promise<void>;
  deleteProgressForMedia(userId: string, mediaId: string): Promise<{ count: number }>;
}
