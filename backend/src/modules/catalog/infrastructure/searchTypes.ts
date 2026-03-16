import type { ProviderName } from '../../../services/consumet/types.js';

export type CatalogMediaSourceName = 'tmdb' | 'consumet-anilist' | 'mangadex' | 'rawg' | ProviderName;
export type CatalogMediaType = 'TV' | 'MOVIE' | 'ANIME' | 'MANGA' | 'BOOK' | 'LIGHT_NOVEL' | 'COMIC' | 'GAME';
export type SearchCategory = 'all' | 'tv' | 'movie' | 'anime' | 'manga' | 'book' | 'lightnovel' | 'comic' | 'game';

export interface SearchResult {
  id: string;
  title: string;
  type: CatalogMediaType;
  total: number | null;
  imageUrl?: string;
  year?: number;
  overview?: string;
  source: CatalogMediaSourceName;
  provider?: ProviderName;
  platforms?: string[];
  metacritic?: number | null;
  genres?: string[];
  esrbRating?: string | null;
  playtimeHours?: number | null;
}

export interface TrendingCategory {
  title: string;
  items: SearchResult[];
}

export interface SearchOptions {
  year?: string;
  includeAdult?: boolean;
  provider?: ProviderName;
  page?: number;
  perPage?: number;
}
