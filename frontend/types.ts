export type MediaType = 'TV' | 'MOVIE' | 'ANIME' | 'MANGA';

export type MediaStatus = 'WATCHING' | 'READING' | 'COMPLETED' | 'PLAN_TO_WATCH' | 'DROPPED' | 'PAUSED';

export type SortBy = 'status' | 'title' | 'rating' | 'updatedAt' | 'createdAt';

export type FriendActivityFilter = '' | 'friends_watching' | 'friends_done' | 'friends_dropped';

export interface FriendStatus {
  id: string;
  username: string;
  displayName: string | null;
  status: MediaStatus;
  current: number;
  rating: number | null;
}

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  current: number;
  total: number | null; // null if unknown
  status: MediaStatus;
  notes?: string;
  rating?: number | null; // Personal rating 0-10
  imageUrl?: string; // For TMDB/MangaHook images
  refId: string; // External API ref as "source:id" (e.g., "tmdb:12345", "mangadex:abc123")
  friendsStatuses?: FriendStatus[]; // Friends who have this item
}

// User type for friends list display
export interface User {
  id: string;
  username: string;
  list: MediaItem[];
}

// Auth types
export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

// API Response types
export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Search result types (from external APIs)
export interface SearchResult {
  id: string;
  title: string;
  type: MediaType;
  total: number | null;
  imageUrl?: string;
  year?: number;
  overview?: string;
}

export type View = 'WATCHLIST' | 'READLIST' | 'SEARCH' | 'FRIENDS' | 'FRIEND_VIEW' | 'LOGIN' | 'REGISTER';
