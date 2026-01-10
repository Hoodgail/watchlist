import {
  MediaItem,
  MediaType,
  MediaStatus,
  SortBy,
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  User,
  Suggestion,
  SuggestionStatus,
  PublicProfile,
  FriendStatus,
  ActiveProgress,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Token management - always read from localStorage to ensure consistency
function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

function setTokens(access: string, refresh: string) {
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export { getAccessToken };

// HTTP client with automatic token refresh
async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // If 401, try to refresh token
  const refresh = getRefreshToken();
  if (response.status === 401 && refresh) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }

  return response;
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (response.ok) {
      // Refresh endpoint returns { accessToken, refreshToken } directly (not nested)
      const data = await response.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }

  clearTokens();
  return false;
}

// ============ AUTH API ============

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  // Backend returns { user, tokens: { accessToken, refreshToken } }
  const data: AuthResponse = await response.json();
  setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  return data;
}

export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  // Backend returns { user, tokens: { accessToken, refreshToken } }
  const data: AuthResponse = await response.json();
  setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  if (refresh) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  }
  clearTokens();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const response = await fetchWithAuth('/auth/me');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to get current user:', error);
  }

  return null;
}

// ============ LIST API ============

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
}

interface BackendPaginatedResponse {
  items: BackendMediaItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

function transformBackendItem(item: BackendMediaItem): MediaItem {
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
  };
}

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
    PAUSED: StatusGroupPagination;
    PLAN_TO_WATCH: StatusGroupPagination;
    COMPLETED: StatusGroupPagination;
    DROPPED: StatusGroupPagination;
  };
  grandTotal: number;
}

export type MediaTypeFilter = 'video' | 'manga';

interface GroupedListFilters {
  type?: MediaType;
  mediaTypeFilter?: MediaTypeFilter;
  search?: string;
  statusPages?: Partial<Record<MediaStatus, number>>;
  limit?: number;
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
      PAUSED: transformGroup(data.groups.PAUSED),
      PLAN_TO_WATCH: transformGroup(data.groups.PLAN_TO_WATCH),
      COMPLETED: transformGroup(data.groups.COMPLETED),
      DROPPED: transformGroup(data.groups.DROPPED),
    },
    grandTotal: data.grandTotal,
  };
}

export async function addToList(item: Omit<MediaItem, 'id'>): Promise<MediaItem> {
  // Backend expects: { title, type, status, current, total?, notes?, rating?, imageUrl?, refId? }
  const payload = {
    title: item.title,
    type: item.type,
    status: item.status,
    current: item.current,
    total: item.total,
    notes: item.notes,
    rating: item.rating,
    imageUrl: item.imageUrl,
    refId: item.refId,
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

// Bulk status lookup for trending/discovery pages
export interface BulkStatusItem {
  refId: string;
  status: MediaStatus;
  current: number;
  total: number | null;
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

// ============ FRIENDS API ============

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
    list: data.list.map(transformBackendItem),
  };
}

// Grouped friend list response type
export interface GroupedFriendListResponse {
  id: string;
  username: string;
  displayName: string | null;
  groups: {
    WATCHING: StatusGroupPagination;
    READING: StatusGroupPagination;
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
    items: group.items.map(transformBackendItem),
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
      PAUSED: transformGroup(data.groups.PAUSED),
      PLAN_TO_WATCH: transformGroup(data.groups.PLAN_TO_WATCH),
      COMPLETED: transformGroup(data.groups.COMPLETED),
      DROPPED: transformGroup(data.groups.DROPPED),
    },
    grandTotal: data.grandTotal,
  };
}

// ============ OAUTH API ============

export async function getOAuthUrl(provider: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/oauth/${provider}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get OAuth URL');
  }
  
  const data = await response.json();
  return data.authorizationUrl;
}

interface LinkedProvidersResponse {
  linked: Array<{ provider: string; linkedAt: string }>;
  available: string[];
}

export async function getLinkedProviders(): Promise<string[]> {
  const response = await fetchWithAuth('/auth/oauth/providers');
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get linked providers');
  }
  
  const data: LinkedProvidersResponse = await response.json();
  // Return just the provider names for backwards compatibility
  return data.linked.map(p => p.provider);
}

export async function linkOAuthAccount(provider: string, code: string): Promise<void> {
  const response = await fetchWithAuth(`/auth/oauth/${provider}/link`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to link OAuth account');
  }
}

export async function unlinkOAuthAccount(provider: string): Promise<void> {
  const response = await fetchWithAuth(`/auth/oauth/${provider}/link`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unlink OAuth account');
  }
}

// Store and retrieve tokens (exported for OAuth callback)
export function storeTokens(accessToken: string, refreshToken: string): void {
  setTokens(accessToken, refreshToken);
}

export function removeTokens(): void {
  clearTokens();
}

// ============ HEALTH CHECK ============

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ============ SUGGESTIONS API ============

export async function getReceivedSuggestions(status?: SuggestionStatus): Promise<Suggestion[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/suggestions/received${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch received suggestions');
  }

  return await response.json();
}

export async function getSentSuggestions(): Promise<Suggestion[]> {
  const response = await fetchWithAuth('/suggestions/sent');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sent suggestions');
  }

  return await response.json();
}

export interface SendSuggestionPayload {
  title: string;
  type: MediaType;
  refId: string;
  imageUrl?: string;
  message?: string;
}

export async function sendSuggestion(userId: string, suggestion: SendSuggestionPayload): Promise<Suggestion> {
  const response = await fetchWithAuth(`/suggestions/${userId}`, {
    method: 'POST',
    body: JSON.stringify(suggestion),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send suggestion');
  }

  return await response.json();
}

export async function acceptSuggestion(id: string): Promise<Suggestion> {
  const response = await fetchWithAuth(`/suggestions/${id}/accept`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to accept suggestion');
  }

  return await response.json();
}

export async function dismissSuggestion(id: string): Promise<Suggestion> {
  const response = await fetchWithAuth(`/suggestions/${id}/dismiss`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to dismiss suggestion');
  }

  return await response.json();
}

export async function deleteSuggestion(id: string): Promise<void> {
  const response = await fetchWithAuth(`/suggestions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete suggestion');
  }
}

// ============ PROFILE API ============

export async function getPublicProfile(username: string): Promise<PublicProfile> {
  const response = await fetchWithAuth(`/profile/${encodeURIComponent(username)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch profile');
  }

  return await response.json();
}

export async function updatePrivacySettings(isPublic: boolean): Promise<{ isPublic: boolean }> {
  const response = await fetchWithAuth('/profile/settings/privacy', {
    method: 'PATCH',
    body: JSON.stringify({ isPublic }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update privacy settings');
  }

  return await response.json();
}

export async function getPrivacySettings(): Promise<{ isPublic: boolean }> {
  const response = await fetchWithAuth('/profile/settings/privacy');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch privacy settings');
  }

  return await response.json();
}

// ============ PROVIDER MAPPING API ============

export interface ProviderMapping {
  id: string;
  refId: string;
  provider: string;
  providerId: string;
  providerTitle: string;
  confidence: number;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get a stored mapping for a refId and provider
 * Returns null if no mapping exists
 */
export async function getProviderMapping(
  refId: string,
  provider: string
): Promise<ProviderMapping | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/provider-mappings/${encodeURIComponent(refId)}/${encodeURIComponent(provider)}`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch provider mapping');
    }

    return await response.json();
  } catch (error) {
    console.error('[getProviderMapping] Error:', error);
    return null;
  }
}

/**
 * Get all mappings for a refId
 */
export async function getProviderMappings(refId: string): Promise<ProviderMapping[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/provider-mappings/${encodeURIComponent(refId)}`
    );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (error) {
    console.error('[getProviderMappings] Error:', error);
    return [];
  }
}

/**
 * Create or update a user-verified provider mapping
 * This is called when a user manually links a source
 */
export async function saveProviderMapping(
  refId: string,
  provider: string,
  providerId: string,
  providerTitle: string
): Promise<ProviderMapping> {
  const response = await fetchWithAuth('/provider-mappings', {
    method: 'POST',
    body: JSON.stringify({ refId, provider, providerId, providerTitle }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save provider mapping');
  }

  return await response.json();
}

/**
 * Save an auto-matched mapping (lower confidence)
 * Called by videoResolver when it finds a match via fuzzy search
 */
export async function saveAutoMapping(
  refId: string,
  provider: string,
  providerId: string,
  providerTitle: string,
  confidence: number
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/provider-mappings/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refId, provider, providerId, providerTitle, confidence }),
    });
  } catch (error) {
    // Non-critical, just log
    console.error('[saveAutoMapping] Error:', error);
  }
}

/**
 * Delete a provider mapping
 */
export async function deleteProviderMapping(
  refId: string,
  provider: string
): Promise<void> {
  const response = await fetchWithAuth(
    `/provider-mappings/${encodeURIComponent(refId)}/${encodeURIComponent(provider)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete provider mapping');
  }
}

// ============ WATCH PROGRESS API ============

export interface WatchProgressData {
  id: string;
  mediaId: string;
  episodeId: string;
  episodeNumber: number | null;
  seasonNumber: number | null;
  currentTime: number;
  duration: number;
  provider: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWatchProgressPayload {
  mediaId: string;
  episodeId?: string;
  episodeNumber?: number;
  seasonNumber?: number;
  currentTime: number;
  duration: number;
  provider: string;
  currentEpisode?: number;  // Absolute episode position (e.g., 42 for S2E20 of House)
  totalEpisodes?: number;   // Total episodes across all seasons
}

/**
 * Update or create watch progress for a media/episode
 */
export async function updateWatchProgress(
  payload: UpdateWatchProgressPayload
): Promise<WatchProgressData> {
  const response = await fetchWithAuth('/watch-progress', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update watch progress');
  }

  return await response.json();
}

/**
 * Get all watch progress for the current user
 */
export async function getAllWatchProgress(): Promise<WatchProgressData[]> {
  const response = await fetchWithAuth('/watch-progress');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch watch progress');
  }

  return await response.json();
}

/**
 * Get watch progress for a specific media (all episodes)
 */
export async function getWatchProgressForMedia(
  mediaId: string
): Promise<WatchProgressData[]> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch watch progress');
  }

  return await response.json();
}

/**
 * Get watch progress for a specific episode
 */
export async function getWatchProgressForEpisode(
  mediaId: string,
  episodeId: string
): Promise<WatchProgressData | null> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}/${encodeURIComponent(episodeId)}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch watch progress');
  }

  return await response.json();
}

/**
 * Delete watch progress for a media (all episodes)
 */
export async function deleteWatchProgressForMedia(mediaId: string): Promise<void> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete watch progress');
  }
}

/**
 * Delete watch progress for a specific episode
 */
export async function deleteWatchProgressForEpisode(
  mediaId: string,
  episodeId: string
): Promise<void> {
  const response = await fetchWithAuth(
    `/watch-progress/${encodeURIComponent(mediaId)}/${encodeURIComponent(episodeId)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete watch progress');
  }
}

// ============ ACCOUNT SECURITY API ============

/**
 * Set a recovery email for the current user
 */
export async function setRecoveryEmail(email: string): Promise<{ recoveryEmail: string; verificationSent: boolean }> {
  const response = await fetchWithAuth('/auth/recovery-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set recovery email');
  }

  return await response.json();
}

/**
 * Remove recovery email from the current user
 */
export async function removeRecoveryEmail(): Promise<void> {
  const response = await fetchWithAuth('/auth/recovery-email', {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove recovery email');
  }
}

/**
 * Verify recovery email with token
 */
export async function verifyRecoveryEmail(token: string): Promise<{ verified: boolean }> {
  const response = await fetch(`${API_BASE_URL}/auth/recovery/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to verify recovery email');
  }

  return await response.json();
}

/**
 * Set a password for the current user (for OAuth-only users)
 */
export async function setPassword(password: string): Promise<void> {
  const response = await fetchWithAuth('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set password');
  }
}

/**
 * Change password for the current user
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetchWithAuth('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to change password');
  }
}

/**
 * Initiate account recovery using recovery email
 */
export async function initiateAccountRecovery(email: string): Promise<{ sent: boolean }> {
  const response = await fetch(`${API_BASE_URL}/auth/recovery/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to initiate recovery');
  }

  return await response.json();
}

/**
 * Complete account recovery with token and new password
 */
export async function completeAccountRecovery(token: string, newPassword: string): Promise<{ tokens: { accessToken: string; refreshToken: string } }> {
  const response = await fetch(`${API_BASE_URL}/auth/recovery/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to complete recovery');
  }

  const data = await response.json();
  
  // Store the new tokens
  setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  
  return data;
}
