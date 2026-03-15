import type { ProviderMappingResponse } from '../../../../services/providerMappingService.js';
import type { ProviderInfo, ProviderName } from '../../../../services/consumet/types.js';
import type { SearchCategory, SearchOptions, SearchResult, TrendingCategory } from '../../../../services/mediaSearchService.js';
import type { MediaSource, MediaSourceAlias } from '@prisma/client';

export type CatalogSearchCategory = SearchCategory;
export type CatalogSearchOptions = SearchOptions;
export type CatalogSearchResult = SearchResult;
export type CatalogTrendingCategory = TrendingCategory;
export type CatalogProviderInfo = ProviderInfo;
export type CatalogProviderName = ProviderName;
export type CatalogMediaSource = MediaSource;
export type CatalogMediaSourceAlias = MediaSourceAlias;
export type CatalogProviderMapping = ProviderMappingResponse;

export interface UpsertCatalogProviderMappingInput {
  refId: string;
  provider: string;
  providerId: string;
  providerTitle: string;
  confidence?: number;
}
