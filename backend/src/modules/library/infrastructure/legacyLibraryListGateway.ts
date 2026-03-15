import * as listService from '../../../services/listService.js';
import type { LibraryListGateway } from '../application/ports/LibraryListGateway.js';

export function createLegacyLibraryListGateway(): LibraryListGateway {
  return {
    getUserList: (userId, filters) => listService.getUserList(userId, filters),
    getGroupedUserList: (userId, filters) => listService.getGroupedUserList(userId, filters),
    getMediaItem: (userId, itemId) => listService.getMediaItem(userId, itemId),
    createMediaItem: (userId, input) => listService.createMediaItem(userId, input),
    updateMediaItem: (userId, itemId, input) => listService.updateMediaItem(userId, itemId, input),
    deleteMediaItem: (userId, itemId) => listService.deleteMediaItem(userId, itemId),
    getStatusesByRefIds: (userId, refIds) => listService.getStatusesByRefIds(userId, refIds),
  };
}
