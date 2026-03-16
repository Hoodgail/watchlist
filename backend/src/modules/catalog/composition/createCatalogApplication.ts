import { createCreateAutoCatalogProviderMappingUseCase } from '../application/useCases/createAutoCatalogProviderMapping.js';
import { createDeleteCatalogProviderMappingUseCase } from '../application/useCases/deleteCatalogProviderMapping.js';
import { createFindCatalogSourceByRefIdUseCase } from '../application/useCases/findCatalogSourceByRefId.js';
import { createGetAllTrendingCatalogUseCase, createGetPopularAnimeUseCase, createGetPopularGamesUseCase, createGetPopularMangaUseCase, createGetTrendingAnimeUseCase, createGetTrendingGamesUseCase, createGetTrendingMoviesUseCase, createGetTrendingTVUseCase } from '../application/useCases/getTrendingCatalog.js';
import { createGetCatalogInfoUseCase } from '../application/useCases/getCatalogInfo.js';
import { createGetCatalogProviderMappingUseCase } from '../application/useCases/getCatalogProviderMapping.js';
import { createGetCatalogProviderMappingsUseCase } from '../application/useCases/getCatalogProviderMappings.js';
import { createGetCatalogProvidersUseCase } from '../application/useCases/getCatalogProviders.js';
import { createGetChapterPagesUseCase } from '../application/useCases/getChapterPages.js';
import { createGetEpisodeServersUseCase } from '../application/useCases/getEpisodeServers.js';
import { createGetEpisodeSourcesUseCase } from '../application/useCases/getEpisodeSources.js';
import { createGetSourceWithAliasesUseCase } from '../application/useCases/getSourceWithAliases.js';
import { createLinkCatalogSourceUseCase } from '../application/useCases/linkCatalogSource.js';
import { createRemoveCatalogAliasUseCase } from '../application/useCases/removeCatalogAlias.js';
import { createSearchCatalogProviderUseCase } from '../application/useCases/searchCatalogProvider.js';
import { createSearchCatalogUseCase } from '../application/useCases/searchCatalog.js';
import { createUpsertCatalogProviderMappingUseCase } from '../application/useCases/upsertCatalogProviderMapping.js';
import { createPrismaCatalogMediaGateway } from '../infrastructure/prismaCatalogMediaGateway.js';
import { createPrismaCatalogProviderMappingGateway } from '../infrastructure/prismaCatalogProviderMappingGateway.js';
import { createPrismaCatalogSourceGateway } from '../infrastructure/prismaCatalogSourceGateway.js';

export function createCatalogApplication() {
  const mediaGateway = createPrismaCatalogMediaGateway();
  const sourceGateway = createPrismaCatalogSourceGateway();
  const providerMappingGateway = createPrismaCatalogProviderMappingGateway();

  return {
    searchCatalog: createSearchCatalogUseCase({ mediaGateway }),
    getCatalogProviders: createGetCatalogProvidersUseCase({ mediaGateway }),
    searchCatalogProvider: createSearchCatalogProviderUseCase({ mediaGateway }),
    getCatalogInfo: createGetCatalogInfoUseCase({ mediaGateway }),
    getEpisodeSources: createGetEpisodeSourcesUseCase({ mediaGateway }),
    getEpisodeServers: createGetEpisodeServersUseCase({ mediaGateway }),
    getChapterPages: createGetChapterPagesUseCase({ mediaGateway }),
    getAllTrendingCatalog: createGetAllTrendingCatalogUseCase({ mediaGateway }),
    getTrendingMovies: createGetTrendingMoviesUseCase({ mediaGateway }),
    getTrendingTV: createGetTrendingTVUseCase({ mediaGateway }),
    getTrendingAnime: createGetTrendingAnimeUseCase({ mediaGateway }),
    getPopularAnime: createGetPopularAnimeUseCase({ mediaGateway }),
    getPopularManga: createGetPopularMangaUseCase({ mediaGateway }),
    getTrendingGames: createGetTrendingGamesUseCase({ mediaGateway }),
    getPopularGames: createGetPopularGamesUseCase({ mediaGateway }),
    isValidProvider: mediaGateway.isValidProvider,
    linkCatalogSource: createLinkCatalogSourceUseCase({ sourceGateway }),
    getSourceWithAliases: createGetSourceWithAliasesUseCase({ sourceGateway }),
    findCatalogSourceByRefId: createFindCatalogSourceByRefIdUseCase({ sourceGateway }),
    removeCatalogAlias: createRemoveCatalogAliasUseCase({ sourceGateway }),
    getCatalogProviderMapping: createGetCatalogProviderMappingUseCase({ providerMappingGateway }),
    getCatalogProviderMappings: createGetCatalogProviderMappingsUseCase({ providerMappingGateway }),
    upsertCatalogProviderMapping: createUpsertCatalogProviderMappingUseCase({ providerMappingGateway }),
    createAutoCatalogProviderMapping: createCreateAutoCatalogProviderMappingUseCase({ providerMappingGateway }),
    deleteCatalogProviderMapping: createDeleteCatalogProviderMappingUseCase({ providerMappingGateway }),
  };
}

export const catalogApplication = createCatalogApplication();
