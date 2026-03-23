import type { MediaStatus, MediaType, SuggestionStatus } from '@prisma/client';

export interface FriendResponse {
  id: string;
  username: string;
  displayName: string | null;
  listCount: number;
  activeCount: number;
}

export interface FriendListItem {
  id: string;
  title: string;
  type: MediaType;
  status: MediaStatus;
  current: number;
  total: number | null;
  notes: string | null;
  rating: number | null;
  imageUrl: string | null;
  refId: string | null;
}

export interface FriendListResponse {
  id: string;
  username: string;
  displayName: string | null;
  list: FriendListItem[];
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

export interface GroupedFriendListItem extends FriendListItem {
  activeProgress?: ActiveProgress | null;
}

export interface StatusGroupPagination {
  items: GroupedFriendListItem[];
  total: number;
  hasMore: boolean;
  page: number;
}

export interface GroupedFriendListResponse {
  id: string;
  username: string;
  displayName: string | null;
  groups: Record<MediaStatus, StatusGroupPagination>;
  grandTotal: number;
}

export type MediaTypeFilter = 'video' | 'manga' | 'game';
export type SortBy = 'status' | 'title' | 'rating' | 'updatedAt' | 'createdAt';

export interface GroupedFriendListFilters {
  mediaTypeFilter?: MediaTypeFilter;
  statusPages?: Partial<Record<MediaStatus, number>>;
  limit?: number;
  sortBy?: SortBy;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string | null;
  isFollowing: boolean;
}

export interface SuggestionResponse {
  id: string;
  title: string;
  type: MediaType;
  refId: string;
  imageUrl: string | null;
  message: string | null;
  status: SuggestionStatus;
  createdAt: Date;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
  toUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

export interface PublicProfileResponse {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  list?: FriendListItem[];
}

export interface PrivateProfileResponse {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPublic: false;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
}

export type SocialProfileResponse = PublicProfileResponse | PrivateProfileResponse;

export interface FriendActivityItem {
  id: string;
  title: string;
  type: MediaType;
  status: MediaStatus;
  current: number;
  total: number | null;
  imageUrl: string | null;
  refId: string | null;
  updatedAt: Date;
}

export interface FriendActivityEntry {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  latestItem: FriendActivityItem | null;
  updatedAt: Date;
}
