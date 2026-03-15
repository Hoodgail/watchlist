import * as mediaSearchService from '../../../services/mediaSearchService.js';
import * as consumetService from '../../../services/consumetService.js';
import type { ProviderName } from '../../../services/consumet/types.js';
import type { CatalogMediaGateway } from '../application/ports/CatalogMediaGateway.js';

export function createLegacyCatalogMediaGateway(): CatalogMediaGateway {
  return {
    searchMedia: (query, category, options) => mediaSearchService.searchMedia(query, category, options),
    getProviders: (category) => mediaSearchService.getProviders(category),
    isValidProvider: (provider) => mediaSearchService.isValidProvider(provider),
    searchWithProvider: (query, provider, options) => mediaSearchService.searchWithProvider(query, provider as ProviderName, options),
    getInfo: (id, provider, mediaType) => consumetService.getInfo(id, provider as ProviderName, mediaType),
    getEpisodeSources: (episodeId, provider, mediaId) => consumetService.getEpisodeSources(episodeId, provider as ProviderName, mediaId),
    getEpisodeServers: (episodeId, provider, mediaId) => consumetService.getEpisodeServers(episodeId, provider as ProviderName, mediaId),
    getChapterPages: (chapterId, provider) => consumetService.getChapterPages(chapterId, provider as any),
    getAllTrending: () => mediaSearchService.getAllTrending(),
    getTrendingMovies: () => mediaSearchService.getTrendingMovies(),
    getTrendingTV: () => mediaSearchService.getTrendingTV(),
    getTrendingAnime: () => mediaSearchService.getTrendingAnime(),
    getPopularAnime: () => mediaSearchService.getPopularAnime(),
    getPopularManga: () => mediaSearchService.getPopularManga(),
    getTrendingGames: () => mediaSearchService.getTrendingGames(),
    getPopularGames: () => mediaSearchService.getPopularGames(),
  };
}
