/**
 * Unified types for all Consumet providers
 */

// ============ Provider Types ============

export type AnimeProviderName = 
  | 'hianime' 
  | 'animepahe' 
  | 'animekai' 
  | 'kickassanime';

export type MovieProviderName = 
  | 'flixhq' 
  | 'goku' 
  | 'sflix' 
  | 'himovies'
  | 'dramacool';

export type MangaProviderName = 
  | 'mangadex' 
  | 'comick' 
  | 'mangapill' 
  | 'mangahere' 
  | 'mangareader'
  | 'asurascans';

export type MetaProviderName = 
  | 'anilist' 
  | 'anilist-manga'
  | 'tmdb'
  | 'myanimelist';

export type BookProviderName = 'libgen';

export type LightNovelProviderName = 
  | 'novelupdates';

export type ComicProviderName = 'getcomics';

export type NewsProviderName = 'animenewsnetwork';

export type ProviderName = 
  | AnimeProviderName 
  | MovieProviderName 
  | MangaProviderName 
  | MetaProviderName
  | BookProviderName
  | LightNovelProviderName
  | ComicProviderName
  | NewsProviderName;

// ============ Media Types ============

export type MediaCategory = 
  | 'anime' 
  | 'movie' 
  | 'tv'
  | 'manga' 
  | 'book' 
  | 'lightnovel' 
  | 'comic'
  | 'news';

export type MediaType = 
  | 'TV' 
  | 'MOVIE' 
  | 'ANIME' 
  | 'MANGA' 
  | 'BOOK' 
  | 'LIGHT_NOVEL' 
  | 'COMIC';

// ============ Result Types ============

export interface UnifiedSearchResult {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  cover?: string;
  description?: string;
  type?: string; // TV, Movie, OVA, etc.
  status?: string;
  releaseDate?: string | number;
  year?: number;
  rating?: number;
  genres?: string[];
  totalEpisodes?: number | null;
  totalChapters?: number | null;
  duration?: string | number;
  subOrDub?: 'sub' | 'dub' | 'both';
  provider: ProviderName;
  url?: string;
}

export interface UnifiedMediaInfo {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  cover?: string;
  description?: string;
  type?: string;
  status?: string;
  releaseDate?: string | number;
  year?: number;
  rating?: number;
  genres?: string[];
  studios?: string[];
  directors?: string[];
  writers?: string[];
  actors?: string[];
  duration?: string | number;
  totalEpisodes?: number | null;
  totalChapters?: number | null;
  totalSeasons?: number;
  subOrDub?: 'sub' | 'dub' | 'both';
  episodes?: UnifiedEpisode[];
  chapters?: UnifiedChapter[];
  seasons?: UnifiedSeason[];
  similar?: UnifiedSearchResult[];
  recommendations?: UnifiedSearchResult[];
  provider: ProviderName;
  url?: string;
}

export interface UnifiedEpisode {
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

export interface UnifiedChapter {
  id: string;
  number: number | string;
  title?: string;
  releaseDate?: string;
  pages?: number;
  url?: string;
  volume?: string;
}

export interface UnifiedSeason {
  season: number;
  image?: string;
  episodes: UnifiedEpisode[];
}

export interface UnifiedSource {
  url: string;
  quality?: string;
  isM3U8?: boolean;
  isDASH?: boolean;
  size?: number;
}

export interface UnifiedSubtitle {
  url: string;
  lang: string;
}

export interface UnifiedSourceResult {
  headers?: Record<string, string>;
  sources: UnifiedSource[];
  subtitles?: UnifiedSubtitle[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  download?: string;
}

export interface UnifiedChapterPages {
  chapterId: string;
  pages: { page: number; img: string; headerForImage?: Record<string, string> }[];
}

export interface UnifiedServer {
  name: string;
  url: string;
}

// ============ Book Types ============

export interface UnifiedBookResult {
  id: string;
  title: string;
  authors?: string[];
  publisher?: string;
  year?: string;
  edition?: string;
  volume?: string;
  series?: string;
  image?: string;
  description?: string;
  link?: string;
  isbn?: string;
  language?: string;
  format?: string;
  size?: string;
  provider: ProviderName;
}

// ============ News Types ============

export interface UnifiedNewsResult {
  id: string;
  title: string;
  image?: string;
  description?: string;
  url: string;
  uploadedAt?: string;
  topics?: string[];
  preview?: string;
  provider: ProviderName;
}

export interface UnifiedNewsInfo {
  id: string;
  title: string;
  image?: string;
  description?: string;
  url: string;
  uploadedAt?: string;
  author?: string;
  content?: string;
  provider: ProviderName;
}

// ============ Search Options ============

export interface SearchOptions {
  page?: number;
  perPage?: number;
  year?: string | number;
  season?: string;
  genres?: string[];
  type?: string;
  status?: string;
  sort?: string;
  language?: string;
}

// ============ Provider Info ============

export interface ProviderInfo {
  name: ProviderName;
  displayName: string;
  category: MediaCategory;
  language: string;
  isWorking: boolean;
  logo?: string;
  baseUrl?: string;
  supportedTypes?: string[];
}

// ============ Paginated Results ============

export interface PaginatedResults<T> {
  currentPage: number;
  hasNextPage: boolean;
  totalPages?: number;
  totalResults?: number;
  results: T[];
}
