import * as watchProgressService from '../../../services/watchProgressService.js';
import type { LibraryWatchProgressGateway } from '../application/ports/LibraryWatchProgressGateway.js';

export function createLegacyLibraryWatchProgressGateway(): LibraryWatchProgressGateway {
  return {
    upsertProgress: (userId, input) => watchProgressService.upsertProgress(userId, input),
    getProgressForMedia: (userId, mediaId) => watchProgressService.getProgressForMedia(userId, mediaId),
    getProgressForEpisode: (userId, mediaId, episodeId) => watchProgressService.getProgressForEpisode(userId, mediaId, episodeId),
    getAllProgress: (userId) => watchProgressService.getAllProgress(userId),
    deleteProgressForEpisode: (userId, mediaId, episodeId) => watchProgressService.deleteProgressForEpisode(userId, mediaId, episodeId),
    deleteProgressForMedia: (userId, mediaId) => watchProgressService.deleteProgressForMedia(userId, mediaId),
  };
}
