export type MediaType = 'TV' | 'MOVIE' | 'ANIME' | 'MANGA' | 'BOOK' | 'LIGHT_NOVEL' | 'COMIC' | 'GAME';

export type MediaStatus = 'WATCHING' | 'READING' | 'COMPLETED' | 'PLAN_TO_WATCH' | 'DROPPED' | 'PAUSED' | 'PLAYING';

export type SortBy = 'status' | 'title' | 'rating' | 'updatedAt' | 'createdAt';

export type FriendActivityFilter = '' | 'friends_watching' | 'friends_done' | 'friends_dropped';

// Provider types
export type ProviderName = 
  | 'hianime' | 'animepahe' | 'animekai' | 'kickassanime'
  | 'flixhq' | 'goku' | 'sflix' | 'himovies' | 'dramacool'
  | 'mangadex' | 'mangahere' | 'mangapill' | 'comick' | 'mangakakalot' | 'mangareader' | 'asurascans'
  | 'anilist' | 'anilist-manga' | 'tmdb'
  | 'libgen' | 'readlightnovels' | 'getcomics'
  | 'rawg';

// Video-specific provider types
export type AnimeProviderName = 'hianime' | 'animepahe' | 'animekai' | 'kickassanime';
export type MovieProviderName = 'flixhq' | 'goku' | 'sflix' | 'himovies' | 'dramacool';
export type VideoProviderName = AnimeProviderName | MovieProviderName;
export type GameProviderName = 'rawg';

export type MediaCategory = 'anime' | 'movie' | 'tv' | 'manga' | 'book' | 'lightnovel' | 'comic' | 'game';

export interface ProviderInfo {
  name: ProviderName;
  displayName: string;
  category: MediaCategory;
  language: string;
  isWorking: boolean;
  logo?: string;
  baseUrl?: string;
}

export interface FriendStatus {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  status: MediaStatus;
  current: number;
  rating: number | null;
}

/**
 * Alias/linked source for a MediaItem
 * Represents alternative refIds that map to the same content
 */
export interface SourceAlias {
  id: string;
  refId: string;
  provider: string;
  createdAt: string;
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
  activeProgress?: ActiveProgress | null; // Current playback progress for video content
  aliases?: SourceAlias[]; // Linked alternative sources for playback
  // Game-specific fields (from RAWG API)
  platforms?: string[];
  metacritic?: number | null;
  genres?: string[];
  playtimeHours?: number | null;
}

// User type for friends list display
export interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  list: MediaItem[];
}

// Auth types
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  isPublic?: boolean;
  hasPassword?: boolean;
  oauthProviders?: string[];
  recoveryEmail?: string | null;
  recoveryEmailVerified?: boolean;
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
  description?: string; // Alias for overview, used by some providers
  source?: string; // The source/provider used
  provider?: ProviderName; // The specific provider
  // Game-specific fields (from RAWG)
  platforms?: string[];
  metacritic?: number | null;
  genres?: string[];
  esrbRating?: string | null;
  playtimeHours?: number | null;
}

// Streaming source types
export interface StreamingSource {
  url: string;
  quality?: string;
  isM3U8?: boolean;
  isDASH?: boolean;
  size?: number;
}

export interface StreamingSubtitle {
  url: string;
  lang: string;
}

export interface StreamingIntroOutro {
  start: number;
  end: number;
}

export interface StreamingSources {
  sources: StreamingSource[];
  subtitles?: StreamingSubtitle[];
  headers?: Record<string, string>;
  intro?: StreamingIntroOutro;
  outro?: StreamingIntroOutro;
  download?: string;
}

// Video episode types
export interface VideoEpisode {
  id: string;
  number: number;
  title?: string;
  description?: string;
  image?: string;
  releaseDate?: string;
  isFiller?: boolean;
  url?: string;
  season?: number;
}

export interface VideoSeason {
  season: number;
  image?: string;
  episodes: VideoEpisode[];
}

export interface VideoServer {
  name: string;
  url: string;
}

// Watch progress types
export interface WatchProgress {
  mediaId: string;
  episodeId: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
}

/**
 * Active watch progress for video content returned with MediaItem
 * Represents the most relevant playback state for resuming
 */
export interface ActiveProgress {
  episodeId: string;
  episodeNumber: number | null;
  seasonNumber: number | null;
  currentTime: number;
  duration: number;
  percentComplete: number;
  completed: boolean;
  updatedAt: string;
}

// Chapter page types (for manga reading)
export interface ChapterPage {
  page: number;
  img: string;
  headerForImage?: Record<string, string>;
}

export interface ChapterPages {
  chapterId: string;
  pages: ChapterPage[];
}

export type View = 'WATCHLIST' | 'READLIST' | 'PLAYLIST' | 'SEARCH' | 'TRENDING' | 'FRIENDS' | 'FRIEND_VIEW' | 'SUGGESTIONS' | 'SETTINGS' | 'LOGIN' | 'REGISTER' | 'DOWNLOADS' | 'RECOVERY' | 'COLLECTIONS' | 'COLLECTION_VIEW';

// Suggestion types
export type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'DISMISSED';

export interface SuggestionUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string;
}

export interface Suggestion {
  id: string;
  fromUser: SuggestionUser;
  toUser: SuggestionUser;
  title: string;
  type: MediaType;
  refId: string;
  imageUrl?: string;
  message?: string;
  status: SuggestionStatus;
  createdAt: string;
}

// Public profile types
export interface PublicProfileMediaItem {
  id: string;
  title: string;
  type: string;
  status: string;
  current: number;
  total: number | null;
  notes: string | null;
  rating: number | null;
  imageUrl: string | null;
  refId: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  list?: PublicProfileMediaItem[];
}

// Collection types
export type CollectionRole = 'OWNER' | 'EDITOR' | 'VIEWER';

export interface CollectionOwner {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Collection {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  owner: CollectionOwner;
  itemCount: number;
  starCount: number;
  isStarred: boolean;
  myRole: CollectionRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionItem {
  id: string;
  refId: string;
  title: string | null;
  imageUrl: string | null;
  type: MediaType;
  orderIndex: number;
  note: string | null;
  source: { id: string; title: string; imageUrl: string | null } | null;
}

export interface CollectionMember {
  id: string;
  user: CollectionOwner;
  role: CollectionRole;
  createdAt: string;
}

export interface CollectionInvite {
  id: string;
  token: string;
  role: CollectionRole;
  maxUses: number | null;
  useCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface CollectionComment {
  id: string;
  content: string;
  user: CollectionOwner;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionWithDetails extends Collection {
  items: CollectionItem[];
  members: CollectionMember[];
}
