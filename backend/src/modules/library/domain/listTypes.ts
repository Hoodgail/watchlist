import type { MediaStatus, MediaType } from '@prisma/client';

export interface FriendStatus {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: MediaStatus;
  current: number;
  rating: number | null;
}

export interface ActiveProgress {
  episodeId: string;
  episodeNumber: number | null;
  seasonNumber: number | null;
  currentTime: number;
  duration: number;
  percentComplete: number;
  completed: boolean;
  updatedAt: Date;
  provider: string;
}

export interface SourceAlias {
  refId: string;
  provider: string;
}

export interface MediaItemResponse {
  id: string;
  title: string;
  type: MediaType;
  status: MediaStatus;
  current: number;
  total: number | null;
  notes: string | null;
  rating: number | null;
  imageUrl: string | null;
  refId: string;
  createdAt: Date;
  updatedAt: Date;
  friendsStatuses?: FriendStatus[];
  activeProgress?: ActiveProgress | null;
  aliases?: SourceAlias[];
  year?: number | null;
  releaseDate?: string | null;
  description?: string | null;
  genres?: string[];
  platforms?: string[];
  metacritic?: number | null;
  playtimeHours?: number | null;
}

export interface MediaItemWithSource {
  id: string;
  title: string | null;
  type: MediaType;
  status: MediaStatus;
  current: number;
  total: number | null;
  notes: string | null;
  rating: number | null;
  imageUrl: string | null;
  refId: string;
  createdAt: Date;
  updatedAt: Date;
  platforms?: string[];
  metacritic?: number | null;
  genres?: string[];
  playtimeHours?: number | null;
  source?: {
    title: string;
    imageUrl: string | null;
    total: number | null;
    year?: number | null;
    releaseDate?: string | null;
    description?: string | null;
    genres?: string[];
    platforms?: string[];
    playtimeHours?: number | null;
    aliases?: {
      refId: string;
      provider: string;
    }[];
  } | null;
}

export type SortByOption = 'status' | 'title' | 'rating' | 'updatedAt' | 'createdAt';
export type MediaTypeFilter = 'video' | 'manga' | 'game';

export interface PaginatedListResponse {
  items: MediaItemResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ListFilters {
  type?: MediaType;
  status?: MediaStatus;
  sortBy?: SortByOption;
  search?: string;
  page?: number;
  limit?: number;
}

export interface StatusGroupPagination {
  items: MediaItemResponse[];
  total: number;
  hasMore: boolean;
  page: number;
}

export interface GroupedListResponse {
  groups: {
    WATCHING: StatusGroupPagination;
    READING: StatusGroupPagination;
    PLAYING: StatusGroupPagination;
    PAUSED: StatusGroupPagination;
    PLAN_TO_WATCH: StatusGroupPagination;
    COMPLETED: StatusGroupPagination;
    DROPPED: StatusGroupPagination;
  };
  grandTotal: number;
}

export interface GroupedListFilters {
  type?: MediaType;
  mediaTypeFilter?: MediaTypeFilter;
  search?: string;
  statusPages?: Partial<Record<MediaStatus, number>>;
  limit?: number;
}

export interface BulkStatusItem {
  refId: string;
  status: MediaStatus;
  current: number;
  total: number | null;
}
