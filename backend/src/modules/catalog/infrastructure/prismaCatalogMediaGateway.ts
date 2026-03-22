import * as tmdbService from '../../../services/tmdbService.js';
import * as consumetService from '../../../services/consumetService.js';
import * as mangadexService from '../../../services/mangadexService.js';
import * as rawgService from '../../../services/rawgService.js';
import type {
  MediaCategory as ConsumetMediaCategory,
  PaginatedResults,
  ProviderName,
  UnifiedBookResult,
  UnifiedSearchResult,
} from '../../../services/consumet/types.js';
import { createRefId } from '@shared/refId.js';
import { ANIME_PROVIDERS, GAME_PROVIDERS, MANGA_PROVIDERS, getCatalogProviders, getProviderInfo, isValidProvider } from './providerRegistry.js';
import type { CatalogMediaGateway } from '../application/ports/CatalogMediaGateway.js';
import type { SearchCategory, SearchOptions, SearchResult, TrendingCategory, CatalogMediaType, CatalogMediaSourceName } from './searchTypes.js';

const createPrefixedId = createRefId;

function tmdbMovieToSearchResult(item: tmdbService.TMDBSearchResult): SearchResult {
  return {
    id: createPrefixedId('tmdb', item.id),
    title: item.title || 'Unknown Title',
    type: 'MOVIE',
    total: 1,
    imageUrl: tmdbService.getImageUrl(item.poster_path),
    year: tmdbService.extractYear(item.release_date),
    overview: item.overview,
    source: 'tmdb',
  };
}

function tmdbTVToSearchResult(item: tmdbService.TMDBSearchResult, details?: tmdbService.TMDBTVDetails | null): SearchResult {
  const isAnime = tmdbService.isAnime(item);
  return {
    id: createPrefixedId('tmdb', item.id),
    title: item.name || 'Unknown Title',
    type: isAnime ? 'ANIME' : 'TV',
    total: details?.number_of_episodes || null,
    imageUrl: tmdbService.getImageUrl(item.poster_path),
    year: tmdbService.extractYear(item.first_air_date),
    overview: item.overview,
    source: 'tmdb',
  };
}

function consumetToSearchResult(item: UnifiedSearchResult, mediaType: CatalogMediaType = 'ANIME'): SearchResult {
  return {
    id: createPrefixedId(item.provider, item.id),
    title: consumetService.getPreferredTitle(item.title),
    type: mediaType,
    total: item.totalEpisodes || item.totalChapters || null,
    imageUrl: item.image,
    year: consumetService.extractYear(item.releaseDate),
    overview: item.description?.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''),
    source: item.provider as CatalogMediaSourceName,
    provider: item.provider,
  };
}

function consumetBookToSearchResult(item: UnifiedBookResult): SearchResult {
  return {
    id: createPrefixedId(item.provider, item.id),
    title: item.title,
    type: 'BOOK',
    total: null,
    imageUrl: item.image,
    year: item.year ? parseInt(item.year, 10) : undefined,
    overview: item.description,
    source: item.provider as CatalogMediaSourceName,
    provider: item.provider,
  };
}

function mangadexToSearchResult(item: mangadexService.MangaSearchResult): SearchResult {
  return {
    id: createPrefixedId('mangadex', item.id),
    title: item.title,
    type: 'MANGA',
    total: null,
    imageUrl: item.coverUrl,
    year: item.year,
    overview: item.description,
    source: 'mangadex',
    provider: 'mangadex',
  };
}

function rawgToSearchResult(item: rawgService.RAWGSearchResult): SearchResult {
  return {
    id: createPrefixedId('rawg', item.id),
    title: item.name,
    type: 'GAME',
    total: null,
    imageUrl: rawgService.getImageUrl(item.background_image, 'medium'),
    year: rawgService.extractYear(item.released),
    overview: undefined,
    source: 'rawg',
    provider: 'rawg',
    platforms: rawgService.getPlatformNames(item.platforms),
    metacritic: item.metacritic,
    genres: rawgService.getGenreNames(item.genres),
    esrbRating: item.esrb_rating?.name || null,
    playtimeHours: item.playtime || null,
  };
}

function getProviders(category?: SearchCategory) {
  if (!category || category === 'all') {
    return getCatalogProviders();
  }

  const categoryMap: Record<SearchCategory, ConsumetMediaCategory | undefined> = {
    all: undefined,
    anime: 'anime',
    movie: 'movie',
    tv: 'tv',
    manga: 'manga',
    book: 'book',
    lightnovel: 'lightnovel',
    comic: 'comic',
    game: 'game',
  };

  const consumetCategory = categoryMap[category];
  if (!consumetCategory) return getCatalogProviders();
  return getCatalogProviders(consumetCategory);
}

async function searchWithProvider(query: string, provider: ProviderName, options: SearchOptions = {}): Promise<PaginatedResults<SearchResult>> {
  if (!isValidProvider(provider)) {
    return { currentPage: 1, hasNextPage: false, results: [] };
  }

  const providerInfo = getProviderInfo(provider);
  if (!providerInfo) {
    return { currentPage: 1, hasNextPage: false, results: [] };
  }

  const consumetResults = await consumetService.search(query, provider, {
    page: options.page,
    perPage: options.perPage,
  });

  let mediaType: CatalogMediaType;
  switch (providerInfo.category) {
    case 'anime': mediaType = 'ANIME'; break;
    case 'movie':
    case 'tv': mediaType = 'MOVIE'; break;
    case 'manga': mediaType = 'MANGA'; break;
    case 'book': mediaType = 'BOOK'; break;
    case 'lightnovel': mediaType = 'LIGHT_NOVEL'; break;
    case 'comic': mediaType = 'COMIC'; break;
    default: mediaType = 'ANIME';
  }

  const results = consumetResults.results.map((item) => {
    if ('authors' in item) return consumetBookToSearchResult(item as UnifiedBookResult);
    return consumetToSearchResult(item as UnifiedSearchResult, mediaType);
  });

  return {
    currentPage: consumetResults.currentPage,
    hasNextPage: consumetResults.hasNextPage,
    totalPages: consumetResults.totalPages,
    totalResults: consumetResults.totalResults,
    results,
  };
}

async function searchMovies(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const results = await tmdbService.searchTMDB(query, 'movie', options);
  return results.map(tmdbMovieToSearchResult);
}

async function searchTV(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const results = await tmdbService.searchTMDB(query, 'tv', options);
  const detailedResults = await Promise.all(results.map(async (item) => tmdbTVToSearchResult(item, await tmdbService.getTVDetails(item.id))));
  return detailedResults;
}

async function searchAnime(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  if (options.provider && ANIME_PROVIDERS.includes(options.provider as any)) {
    const results = await searchWithProvider(query, options.provider, options);
    return results.results;
  }

  const consumetResults = await consumetService.searchAnimeAnilist(query, { page: 1, perPage: 10 });
  if (consumetResults.results.length > 0) {
    return consumetResults.results.slice(0, 5).map((item) => consumetToSearchResult(item, 'ANIME'));
  }

  const tmdbResults = await tmdbService.searchAnime(query, options);
  const detailedResults = await Promise.all(tmdbResults.map(async (item) => tmdbTVToSearchResult(item, await tmdbService.getTVDetails(item.id))));
  return detailedResults.map((result) => ({ ...result, type: 'ANIME' as CatalogMediaType }));
}

async function searchMangaItems(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  if (options.provider && MANGA_PROVIDERS.includes(options.provider as any)) {
    const results = await searchWithProvider(query, options.provider, options);
    return results.results;
  }

  try {
    const { results } = await mangadexService.searchManga(query, 5, 0);
    return results.map(mangadexToSearchResult);
  } catch (error) {
    console.error('MangaDex search error:', error);
    return [];
  }
}

async function searchBooks(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const provider = options.provider || 'libgen';
  return (await searchWithProvider(query, provider, options)).results;
}

async function searchLightNovels(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const provider = options.provider || 'novelupdates';
  return (await searchWithProvider(query, provider, options)).results;
}

async function searchComics(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const provider = options.provider || 'getcomics';
  return (await searchWithProvider(query, provider, options)).results;
}

async function searchGames(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  try {
    const results = await rawgService.searchGames(query, { page: options.page || 1, pageSize: options.perPage || 10 });
    return results.map(rawgToSearchResult);
  } catch (error) {
    console.error('RAWG search error:', error);
    return [];
  }
}

async function searchAll(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const [tmdbMultiResults, mangaResults, animeResults] = await Promise.all([
    tmdbService.searchTMDBMulti(query, options),
    searchMangaItems(query),
    consumetService.searchAnimeAnilist(query, { page: 1, perPage: 5 }),
  ]);

  const tmdbSearchResults = await Promise.all(
    tmdbMultiResults.map(async (item) => item.media_type === 'movie'
      ? tmdbMovieToSearchResult(item)
      : tmdbTVToSearchResult(item, await tmdbService.getTVDetails(item.id))),
  );

  const consumetSearchResults = animeResults.results.map((item) => consumetToSearchResult(item, 'ANIME'));
  const allResults = [...tmdbSearchResults, ...mangaResults, ...consumetSearchResults];
  const seen = new Set<string>();

  return allResults.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

async function searchMedia(query: string, category: SearchCategory = 'all', options: SearchOptions = {}): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  if (options.provider && isValidProvider(options.provider)) {
    return (await searchWithProvider(query, options.provider, options)).results;
  }

  switch (category) {
    case 'all': return searchAll(query, options);
    case 'movie': return searchMovies(query, options);
    case 'tv': return searchTV(query, options);
    case 'anime': return searchAnime(query, options);
    case 'manga': return searchMangaItems(query, options);
    case 'book': return searchBooks(query, options);
    case 'lightnovel': return searchLightNovels(query, options);
    case 'comic': return searchComics(query, options);
    case 'game': return searchGames(query, options);
    default: return [];
  }
}

async function getTrendingMovies(timeWindow: 'day' | 'week' = 'week'): Promise<SearchResult[]> {
  return (await tmdbService.getTrendingTMDB('movie', timeWindow)).slice(0, 20).map(tmdbMovieToSearchResult);
}

async function getTrendingTV(timeWindow: 'day' | 'week' = 'week'): Promise<SearchResult[]> {
  const results = await tmdbService.getTrendingTMDB('tv', timeWindow);
  return results.slice(0, 20).map((item) => ({
    id: createPrefixedId('tmdb', item.id),
    title: item.name || 'Unknown Title',
    type: tmdbService.isAnime(item) ? 'ANIME' : 'TV',
    total: null,
    imageUrl: tmdbService.getImageUrl(item.poster_path),
    year: tmdbService.extractYear(item.first_air_date),
    overview: item.overview,
    source: 'tmdb',
  }));
}

async function getTrendingAnime(): Promise<SearchResult[]> {
  return (await consumetService.getTrendingAnime(1, 20)).results.map((item) => consumetToSearchResult(item, 'ANIME'));
}

async function getPopularAnime(): Promise<SearchResult[]> {
  return (await consumetService.getPopularAnime(1, 20)).results.map((item) => consumetToSearchResult(item, 'ANIME'));
}

async function getPopularManga(): Promise<SearchResult[]> {
  return (await consumetService.getPopularManga(1, 20)).results.map((item) => consumetToSearchResult(item, 'MANGA'));
}

async function getTrendingGames(): Promise<SearchResult[]> {
  try {
    return (await rawgService.getTrendingGames({ pageSize: 20 })).map(rawgToSearchResult);
  } catch (error) {
    console.error('RAWG trending error:', error);
    return [];
  }
}

async function getPopularGames(): Promise<SearchResult[]> {
  try {
    return (await rawgService.getPopularGames({ pageSize: 20 })).map(rawgToSearchResult);
  } catch (error) {
    console.error('RAWG popular error:', error);
    return [];
  }
}

async function getAllTrending(): Promise<TrendingCategory[]> {
  const [trendingAll, trendingMovies, trendingTV, trendingAnime, trendingGames] = await Promise.all([
    tmdbService.getTrendingTMDB('all', 'day'),
    getTrendingMovies('week'),
    getTrendingTV('week'),
    getTrendingAnime(),
    getTrendingGames(),
  ]);

  const trendingAllResults: SearchResult[] = await Promise.all(
    trendingAll
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 20)
      .map(async (item) => item.media_type === 'movie'
        ? tmdbMovieToSearchResult(item)
        : {
            id: createPrefixedId('tmdb', item.id),
            title: item.name || 'Unknown Title',
            type: tmdbService.isAnime(item) ? 'ANIME' : 'TV',
            total: null,
            imageUrl: tmdbService.getImageUrl(item.poster_path),
            year: tmdbService.extractYear(item.first_air_date),
            overview: item.overview,
            source: 'tmdb' as const,
          }),
  );

  const trendingTVOnly = trendingTV.filter((item) => item.type === 'TV');
  const categories: TrendingCategory[] = [];
  if (trendingAllResults.length > 0) categories.push({ title: 'Trending Today', items: trendingAllResults });
  if (trendingMovies.length > 0) categories.push({ title: 'Popular Movies', items: trendingMovies });
  if (trendingTVOnly.length > 0) categories.push({ title: 'Popular TV Shows', items: trendingTVOnly });
  if (trendingAnime.length > 0) categories.push({ title: 'Popular Anime', items: trendingAnime });
  if (trendingGames.length > 0) categories.push({ title: 'Popular Games', items: trendingGames });
  return categories;
}

export function createPrismaCatalogMediaGateway(): CatalogMediaGateway {
  return {
    searchMedia,
    getProviders,
    isValidProvider,
    searchWithProvider: (query, provider, options) => searchWithProvider(query, provider as ProviderName, options),
    getInfo: (id, provider, mediaType) => consumetService.getInfo(id, provider as ProviderName, mediaType),
    getEpisodeSources: (episodeId, provider, mediaId) => consumetService.getEpisodeSources(episodeId, provider as ProviderName, mediaId),
    getEpisodeServers: (episodeId, provider, mediaId) => consumetService.getEpisodeServers(episodeId, provider as ProviderName, mediaId),
    getChapterPages: (chapterId, provider) => consumetService.getChapterPages(chapterId, provider as any),
    getAllTrending,
    getTrendingMovies,
    getTrendingTV,
    getTrendingAnime,
    getPopularAnime,
    getPopularManga,
    getTrendingGames,
    getPopularGames,
  };
}
