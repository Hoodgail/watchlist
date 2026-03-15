import { createCreateMediaItemUseCase } from '../application/useCases/createMediaItem.js';
import { createDeleteMediaItemUseCase } from '../application/useCases/deleteMediaItem.js';
import { createDeleteWatchProgressForEpisodeUseCase } from '../application/useCases/deleteWatchProgressForEpisode.js';
import { createDeleteWatchProgressForMediaUseCase } from '../application/useCases/deleteWatchProgressForMedia.js';
import { createGetAllWatchProgressUseCase } from '../application/useCases/getAllWatchProgress.js';
import { createGetGroupedUserListUseCase } from '../application/useCases/getGroupedUserList.js';
import { createGetMediaItemUseCase } from '../application/useCases/getMediaItem.js';
import { createGetStatusesByRefIdsUseCase } from '../application/useCases/getStatusesByRefIds.js';
import { createGetUserListUseCase } from '../application/useCases/getUserList.js';
import { createGetWatchProgressForEpisodeUseCase } from '../application/useCases/getWatchProgressForEpisode.js';
import { createGetWatchProgressForMediaUseCase } from '../application/useCases/getWatchProgressForMedia.js';
import { createUpdateMediaItemUseCase } from '../application/useCases/updateMediaItem.js';
import { createUpsertWatchProgressUseCase } from '../application/useCases/upsertWatchProgress.js';
import { createLegacyLibraryListGateway } from '../infrastructure/legacyLibraryListGateway.js';
import { createLegacyLibraryWatchProgressGateway } from '../infrastructure/legacyLibraryWatchProgressGateway.js';

export function createLibraryApplication() {
  const listGateway = createLegacyLibraryListGateway();
  const watchProgressGateway = createLegacyLibraryWatchProgressGateway();

  return {
    getUserList: createGetUserListUseCase({ listGateway }),
    getGroupedUserList: createGetGroupedUserListUseCase({ listGateway }),
    getMediaItem: createGetMediaItemUseCase({ listGateway }),
    createMediaItem: createCreateMediaItemUseCase({ listGateway }),
    updateMediaItem: createUpdateMediaItemUseCase({ listGateway }),
    deleteMediaItem: createDeleteMediaItemUseCase({ listGateway }),
    getStatusesByRefIds: createGetStatusesByRefIdsUseCase({ listGateway }),
    upsertWatchProgress: createUpsertWatchProgressUseCase({ watchProgressGateway }),
    getWatchProgressForMedia: createGetWatchProgressForMediaUseCase({ watchProgressGateway }),
    getWatchProgressForEpisode: createGetWatchProgressForEpisodeUseCase({ watchProgressGateway }),
    getAllWatchProgress: createGetAllWatchProgressUseCase({ watchProgressGateway }),
    deleteWatchProgressForEpisode: createDeleteWatchProgressForEpisodeUseCase({ watchProgressGateway }),
    deleteWatchProgressForMedia: createDeleteWatchProgressForMediaUseCase({ watchProgressGateway }),
  };
}

export const libraryApplication = createLibraryApplication();
