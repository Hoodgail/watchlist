import type { CreateMediaItemInput, UpdateMediaItemInput } from '../../../../utils/schemas.js';
import type {
  LibraryBulkStatusMap,
  LibraryGroupedList,
  LibraryGroupedListFilters,
  LibraryListFilters,
  LibraryMediaItem,
  LibraryPaginatedList,
} from '../dto/library.js';

export interface LibraryListGateway {
  getUserList(userId: string, filters?: LibraryListFilters): Promise<LibraryPaginatedList>;
  getGroupedUserList(userId: string, filters?: LibraryGroupedListFilters): Promise<LibraryGroupedList>;
  getMediaItem(userId: string, itemId: string): Promise<LibraryMediaItem>;
  createMediaItem(userId: string, input: CreateMediaItemInput): Promise<LibraryMediaItem>;
  updateMediaItem(userId: string, itemId: string, input: UpdateMediaItemInput): Promise<LibraryMediaItem>;
  deleteMediaItem(userId: string, itemId: string): Promise<void>;
  getStatusesByRefIds(userId: string, refIds: string[]): Promise<LibraryBulkStatusMap>;
}
