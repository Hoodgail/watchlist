import type { CatalogMediaGateway } from '../ports/CatalogMediaGateway.js';
import type { CatalogSearchResult, CatalogTrendingCategory } from '../dto/catalog.js';

export function createGetAllTrendingCatalogUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getAllTrendingCatalog(): Promise<CatalogTrendingCategory[]> {
    return dependencies.mediaGateway.getAllTrending();
  };
}

export function createGetTrendingMoviesUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getTrendingMovies(): Promise<CatalogSearchResult[]> {
    return dependencies.mediaGateway.getTrendingMovies();
  };
}

export function createGetTrendingTVUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getTrendingTV(): Promise<CatalogSearchResult[]> {
    return dependencies.mediaGateway.getTrendingTV();
  };
}

export function createGetTrendingAnimeUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getTrendingAnime(): Promise<CatalogSearchResult[]> {
    return dependencies.mediaGateway.getTrendingAnime();
  };
}

export function createGetPopularAnimeUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getPopularAnime(): Promise<CatalogSearchResult[]> {
    return dependencies.mediaGateway.getPopularAnime();
  };
}

export function createGetPopularMangaUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getPopularManga(): Promise<CatalogSearchResult[]> {
    return dependencies.mediaGateway.getPopularManga();
  };
}

export function createGetTrendingGamesUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getTrendingGames(): Promise<CatalogSearchResult[]> {
    return dependencies.mediaGateway.getTrendingGames();
  };
}

export function createGetPopularGamesUseCase(dependencies: { mediaGateway: CatalogMediaGateway }) {
  return async function getPopularGames(): Promise<CatalogSearchResult[]> {
    return dependencies.mediaGateway.getPopularGames();
  };
}
