/**
 * Friends/Social API
 */

import {
  MediaItem,
  MediaStatus,
  User,
} from '../../types';
import { fetchWithAuth } from './client';
import { transformBackendItem, StatusGroupPagination, MediaTypeFilter } from './list';

// ============ TYPES ============

// GET /api/friends returns: [{ id, username, listCount, activeCount }]
interface BackendFollowingUser {
  id: string;
  username: string;
  listCount: number;
  activeCount: number;
}

// GET /api/friends/:userId/list returns: { id, username, list: [...] }
interface BackendUserWithList {
  id: string;
  username: string;
  list: BackendMediaItem[];
}

// GET /api/friends/:userId/list/grouped returns grouped list with pagination
interface BackendGroupedFriendList {
  id: string;
  username: string;
  displayName: string | null;
  groups: {
    WATCHING: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    READING: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    PLAYING: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    PAUSED: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    PLAN_TO_WATCH: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    COMPLETED: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    DROPPED: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
  };
  grandTotal: number;
}

// GET /api/friends/search returns: [{ id, username, isFollowing }]
interface BackendSearchUser {
  id: string;
  username: string;
  isFollowing: boolean;
}

// Internal type for backend media items
interface BackendMediaItem {
  id: string;
  title: string;
  type: string;
  current: number;
  total: number | null;
  status: string;
  notes: string | null;
  rating: number | null;
  imageUrl?: string | null;
  refId?: string | null;
  friendsStatuses?: any[];
  activeProgress?: any | null;
  aliases?: Array<{ id?: string; refId: string; provider: string; createdAt?: string }>;
  year?: number | null;
  releaseDate?: string | null;
  description?: string | null;
  genres?: string[];
  platforms?: string[];
  metacritic?: number | null;
  playtimeHours?: number | null;
}

// Grouped friend list response type
export interface GroupedFriendListResponse {
  id: string;
  username: string;
  displayName: string | null;
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

interface GroupedFriendListFilters {
  mediaTypeFilter?: MediaTypeFilter;
  statusPages?: Partial<Record<MediaStatus, number>>;
  limit?: number;
}

// ============ API FUNCTIONS ============

export async function getFollowing(): Promise<User[]> {
  const response = await fetchWithAuth('/friends');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch following');
  }

  // Backend returns [{ id, username, listCount, activeCount }]
  // We don't have full list here, it will be fetched separately
  const users: BackendFollowingUser[] = await response.json();
  return users.map((user) => ({
    id: user.id,
    username: user.username,
    list: [], // List fetched separately via getUserList
  }));
}

export async function getFollowers(): Promise<User[]> {
  const response = await fetchWithAuth('/friends/followers');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch followers');
  }

  const users: { id: string; username: string }[] = await response.json();
  return users.map((user) => ({
    id: user.id,
    username: user.username,
    list: [],
  }));
}

export async function followUser(userId: string): Promise<void> {
  const response = await fetchWithAuth(`/friends/${userId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to follow user');
  }
}

export async function unfollowUser(userId: string): Promise<void> {
  const response = await fetchWithAuth(`/friends/${userId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unfollow user');
  }
}

export async function searchUsers(query: string): Promise<User[]> {
  const response = await fetchWithAuth(`/friends/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search users');
  }

  // Backend returns [{ id, username, isFollowing }]
  const users: BackendSearchUser[] = await response.json();
  return users.map((user) => ({
    id: user.id,
    username: user.username,
    list: [],
  }));
}

export async function getUserList(userId: string): Promise<User> {
  const response = await fetchWithAuth(`/friends/${userId}/list`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch user list');
  }

  // Backend returns { id, username, list: [...] }
  const data: BackendUserWithList = await response.json();
  return {
    id: data.id,
    username: data.username,
    list: data.list.map((item) => transformBackendItem(item as any)),
  };
}

export async function getFriendGroupedList(
  userId: string,
  filters?: GroupedFriendListFilters
): Promise<GroupedFriendListResponse> {
  const params = new URLSearchParams();
  if (filters?.mediaTypeFilter) params.append('mediaTypeFilter', filters.mediaTypeFilter);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.statusPages) params.append('statusPages', JSON.stringify(filters.statusPages));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/friends/${userId}/list/grouped${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch friend grouped list');
  }

  const data: BackendGroupedFriendList = await response.json();
  
  // Transform items in each group
  const transformGroup = (group: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number }): StatusGroupPagination => ({
    items: group.items.map((item) => transformBackendItem(item as any)),
    total: group.total,
    hasMore: group.hasMore,
    page: group.page,
  });

  return {
    id: data.id,
    username: data.username,
    displayName: data.displayName,
    groups: {
      WATCHING: transformGroup(data.groups.WATCHING),
      READING: transformGroup(data.groups.READING),
      PLAYING: transformGroup(data.groups.PLAYING),
      PAUSED: transformGroup(data.groups.PAUSED),
      PLAN_TO_WATCH: transformGroup(data.groups.PLAN_TO_WATCH),
      COMPLETED: transformGroup(data.groups.COMPLETED),
      DROPPED: transformGroup(data.groups.DROPPED),
    },
    grandTotal: data.grandTotal,
  };
}
