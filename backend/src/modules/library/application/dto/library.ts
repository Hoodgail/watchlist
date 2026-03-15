import type {
  BulkStatusItem,
  GroupedListFilters,
  GroupedListResponse,
  ListFilters,
  MediaItemResponse,
  PaginatedListResponse,
} from '../../../../services/listService.js';
import type { UpdateWatchProgressInput } from '../../../../utils/schemas.js';
import type { WatchProgressResponse } from '../../../../services/watchProgressService.js';

export type LibraryListFilters = ListFilters;
export type LibraryGroupedListFilters = GroupedListFilters;
export type LibraryPaginatedList = PaginatedListResponse;
export type LibraryGroupedList = GroupedListResponse;
export type LibraryMediaItem = MediaItemResponse;
export type LibraryBulkStatusMap = Record<string, BulkStatusItem>;
export type LibraryWatchProgressInput = UpdateWatchProgressInput;
export type LibraryWatchProgress = WatchProgressResponse;
