import type { ProviderInfo, ProviderName } from '../../../../services/consumet/types.js';
import type { MediaSource, MediaSourceAlias } from '@prisma/client';
import type { SearchCategory, SearchOptions, SearchResult, TrendingCategory } from '../../infrastructure/searchTypes.js';

export interface ProviderMappingResponse {
  id: string;
  refId: string;
  provider: string;
  providerId: string;
  providerTitle: string;
  confidence: number;
  verifiedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CatalogSearchCategory = SearchCategory;
export type CatalogSearchOptions = SearchOptions;
export type CatalogSearchResult = SearchResult;
export type CatalogTrendingCategory = TrendingCategory;
export type CatalogProviderInfo = ProviderInfo;
export type CatalogProviderName = ProviderName;
export type CatalogMediaSource = MediaSource;
export type CatalogMediaSourceAlias = MediaSourceAlias;
export type CatalogProviderMapping = ProviderMappingResponse;
export type { SearchCategory, SearchOptions, SearchResult, TrendingCategory };

export interface UpsertCatalogProviderMappingInput {
  refId: string;
  provider: string;
  providerId: string;
  providerTitle: string;
  confidence?: number;
}
