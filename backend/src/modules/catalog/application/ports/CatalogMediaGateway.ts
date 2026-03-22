import type {
  CatalogProviderInfo,
  CatalogSearchCategory,
  CatalogSearchOptions,
  CatalogSearchResult,
  CatalogTrendingCategory,
} from '../dto/catalog.js';
import type { PaginatedResults } from '../../../../services/consumet/types.js';

export interface CatalogMediaGateway {
  searchMedia(query: string, category: CatalogSearchCategory, options?: CatalogSearchOptions): Promise<CatalogSearchResult[]>;
  getProviders(category?: CatalogSearchCategory): CatalogProviderInfo[];
  isValidProvider(provider: string): boolean;
  searchWithProvider(query: string, provider: string, options?: CatalogSearchOptions): Promise<PaginatedResults<CatalogSearchResult>>;
  getInfo(id: string, provider: string, mediaType?: 'movie' | 'tv'): Promise<unknown>;
  getEpisodeSources(episodeId: string, provider: string, mediaId?: string): Promise<unknown>;
  getEpisodeServers(episodeId: string, provider: string, mediaId?: string): Promise<unknown>;
  getChapterPages(chapterId: string, provider: string): Promise<unknown>;
  getAllTrending(): Promise<CatalogTrendingCategory[]>;
  getTrendingMovies(): Promise<CatalogSearchResult[]>;
  getTrendingTV(): Promise<CatalogSearchResult[]>;
  getTrendingAnime(): Promise<CatalogSearchResult[]>;
  getPopularAnime(): Promise<CatalogSearchResult[]>;
  getPopularManga(): Promise<CatalogSearchResult[]>;
  getTrendingGames(): Promise<CatalogSearchResult[]>;
  getPopularGames(): Promise<CatalogSearchResult[]>;
}
