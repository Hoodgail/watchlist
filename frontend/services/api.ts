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
  };
}

export async function getMyList(filters?: ListFilters): Promise<MediaItem[]> {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/list${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch list');
  }

  const items: BackendMediaItem[] = await response.json();
  return items.map(transformBackendItem);
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
