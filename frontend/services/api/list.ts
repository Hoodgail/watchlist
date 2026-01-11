/**
 * List/Media Items API
 */

import {
  MediaItem,
  MediaType,
  MediaStatus,
  SortBy,
  FriendStatus,
  ActiveProgress,
} from '../../types';
import { fetchWithAuth } from './client';

// ============ TYPES ============

interface ListFilters {
  type?: MediaType;
  status?: MediaStatus;
  sortBy?: SortBy;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedListResponse {
  items: MediaItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// Backend uses same field names as frontend for list items
interface BackendMediaItem {
  id: string;
  title: string;
  type: MediaType;
  current: number;
  total: number | null;
  status: MediaStatus;
  notes: string | null;
  rating: number | null;
  imageUrl?: string | null;
  refId?: string | null;
  friendsStatuses?: FriendStatus[];
  activeProgress?: ActiveProgress | null;
  aliases?: Array<{ id?: string; refId: string; provider: string; createdAt?: string }>;
  // Metadata fields from MediaSource
  year?: number | null;
  releaseDate?: string | null;
  description?: string | null;
  genres?: string[];
  // Game-specific fields
  platforms?: string[];
  metacritic?: number | null;
  playtimeHours?: number | null;
}

interface BackendPaginatedResponse {
  items: BackendMediaItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export function transformBackendItem(item: BackendMediaItem): MediaItem {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    current: item.current,
    total: item.total,
    status: item.status,
    notes: item.notes || undefined,
    rating: item.rating,
    imageUrl: item.imageUrl || undefined,
    refId: item.refId || undefined,
    friendsStatuses: item.friendsStatuses,
    activeProgress: item.activeProgress,
    aliases: item.aliases?.map(a => ({
      id: a.id || '',
      refId: a.refId,
      provider: a.provider,
      createdAt: a.createdAt || new Date().toISOString(),
    })),
    // Metadata fields from MediaSource
    year: item.year,
    releaseDate: item.releaseDate,
    description: item.description,
    genres: item.genres,
    // Game-specific fields
    platforms: item.platforms,
    metacritic: item.metacritic,
    playtimeHours: item.playtimeHours,
  };
}

// Grouped list types for per-status pagination
export interface StatusGroupPagination {
  items: MediaItem[];
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

export type MediaTypeFilter = 'video' | 'manga' | 'game';

interface GroupedListFilters {
  type?: MediaType;
  mediaTypeFilter?: MediaTypeFilter;
  search?: string;
  statusPages?: Partial<Record<MediaStatus, number>>;
  limit?: number;
}

// Bulk status lookup for trending/discovery pages
export interface BulkStatusItem {
  refId: string;
  status: MediaStatus;
  current: number;
  total: number | null;
}

// ============ API FUNCTIONS ============

export async function getMyList(filters?: ListFilters): Promise<PaginatedListResponse> {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/list${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch list');
  }

  const data: BackendPaginatedResponse = await response.json();
  return {
    items: data.items.map(transformBackendItem),
    total: data.total,
    page: data.page,
    limit: data.limit,
    totalPages: data.totalPages,
    hasMore: data.hasMore,
  };
}

export async function getMyGroupedList(filters?: GroupedListFilters): Promise<GroupedListResponse> {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.mediaTypeFilter) params.append('mediaTypeFilter', filters.mediaTypeFilter);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.statusPages) params.append('statusPages', JSON.stringify(filters.statusPages));

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/list/grouped${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch grouped list');
  }

  const data = await response.json();
  
  // Transform items in each group
  const transformGroup = (group: any): StatusGroupPagination => ({
    items: group.items.map(transformBackendItem),
    total: group.total,
    hasMore: group.hasMore,
    page: group.page,
  });

  return {
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

export async function addToList(item: Omit<MediaItem, 'id'>): Promise<MediaItem> {
  // Backend fetches title/imageUrl/total from MediaSource via refId
  const payload = {
    refId: item.refId,
    type: item.type,
    status: item.status,
    current: item.current,
    notes: item.notes,
    rating: item.rating,
  };

  const response = await fetchWithAuth('/list', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add item');
  }

  const created: BackendMediaItem = await response.json();
  return transformBackendItem(created);
}

export async function updateListItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem> {
  // Only send fields that are being updated
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.current !== undefined) payload.current = updates.current;
  if (updates.total !== undefined) payload.total = updates.total;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.rating !== undefined) payload.rating = updates.rating;

  const response = await fetchWithAuth(`/list/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update item');
  }

  const updated: BackendMediaItem = await response.json();
  return transformBackendItem(updated);
}

export async function deleteListItem(id: string): Promise<void> {
  const response = await fetchWithAuth(`/list/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete item');
  }
}

/**
 * Link a new refId as an alias to an existing source.
 * This allows tracking the same media from different providers.
 * 
 * @param sourceRefId - The refId of the existing source in the user's list
 * @param newRefId - The new refId to link as an alias
 */
export async function linkSource(sourceRefId: string, newRefId: string): Promise<void> {
  const response = await fetchWithAuth('/media/link', {
    method: 'POST',
    body: JSON.stringify({ sourceRefId, newRefId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to link sources');
  }
}

export async function getStatusesByRefIds(refIds: string[]): Promise<Record<string, BulkStatusItem>> {
  if (refIds.length === 0) {
    return {};
  }

  const response = await fetchWithAuth('/list/statuses', {
    method: 'POST',
    body: JSON.stringify({ refIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch statuses');
  }

  return await response.json();
}
