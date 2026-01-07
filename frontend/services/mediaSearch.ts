import { MediaItem, MediaType, SearchResult } from '../types';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

const MANGADEX_API_BASE = 'https://api.mangadex.org';

// ============ TMDB API (TV, Movie, Anime) ============

interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  media_type?: string;
  genre_ids?: number[];
  number_of_episodes?: number;
  number_of_seasons?: number;
  popularity?: number;
}

export interface SearchOptions {
  year?: string;
  includeAdult?: boolean;
}

interface TMDBSearchResponse {
  results: TMDBSearchResult[];
  total_results: number;
  total_pages: number;
}

interface TMDBTVDetails {
  id: number;
  name: string;
  number_of_episodes: number;
  number_of_seasons: number;
  poster_path: string | null;
  first_air_date?: string;
  overview?: string;
  genres?: { id: number; name: string }[];
}

// Anime genre IDs in TMDB
const ANIME_GENRE_ID = 16; // Animation genre

async function searchTMDBMulti(
  query: string,
  options: SearchOptions = {}
): Promise<TMDBSearchResult[]> {
  if (!TMDB_API_KEY) {
    console.warn('TMDB API key not found');
    return [];
  }

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      query: query,
      page: '1',
      include_adult: options.includeAdult ? 'true' : 'false',
    });

    const response = await fetch(
      `${TMDB_BASE_URL}/search/multi?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('TMDB multi search failed');
    }

    const data: TMDBSearchResponse = await response.json();
    // Sort by popularity (descending) and filter to only movie/tv
    const filtered = data.results
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return filtered.slice(0, 10);
  } catch (error) {
    console.error('TMDB multi search error:', error);
    return [];
  }
}

async function searchTMDB(
  query: string,
  mediaType: 'movie' | 'tv',
  options: SearchOptions = {}
): Promise<TMDBSearchResult[]> {
  if (!TMDB_API_KEY) {
    console.warn('TMDB API key not found');
    return [];
  }

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      query: query,
      page: '1',
      include_adult: options.includeAdult ? 'true' : 'false',
    });

    if (options.year) {
      params.append('year', options.year);
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/search/${mediaType}?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('TMDB search failed');
    }

    const data: TMDBSearchResponse = await response.json();
    // Sort by popularity (descending)
    const sorted = [...data.results].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return sorted.slice(0, 5);
  } catch (error) {
    console.error('TMDB search error:', error);
    return [];
  }
}

async function getTVDetails(id: number): Promise<TMDBTVDetails | null> {
  if (!TMDB_API_KEY) return null;

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`
    );

    if (!response.ok) return null;

    return await response.json();
  } catch {
    return null;
  }
}

function isAnime(result: TMDBSearchResult | TMDBTVDetails): boolean {
  // Check if it's animation genre and has Japanese origin
  let genres: number[] = [];
  if ('genre_ids' in result && result.genre_ids) {
    genres = result.genre_ids;
  } else if ('genres' in result && result.genres) {
    genres = result.genres.map(g => g.id);
  }
  return genres.includes(ANIME_GENRE_ID);
}

export async function searchMovies(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const results = await searchTMDB(query, 'movie', options);

  return results.map((item) => ({
    id: `tmdb:${item.id}`,
    title: item.title || 'Unknown Title',
    type: 'MOVIE' as MediaType,
    total: 1,
    imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
    year: item.release_date ? parseInt(item.release_date.split('-')[0]) : undefined,
    overview: item.overview,
  }));
}

export async function searchTV(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const results = await searchTMDB(query, 'tv', options);

  // Get details for each show to get episode count
  const detailedResults = await Promise.all(
    results.map(async (item) => {
      const details = await getTVDetails(item.id);
      const anime = isAnime(item);

      return {
        id: `tmdb:${item.id}`,
        title: item.name || 'Unknown Title',
        type: (anime ? 'ANIME' : 'TV') as MediaType,
        total: details?.number_of_episodes || null,
        imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
        year: item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : undefined,
        overview: item.overview,
      };
    })
  );

  return detailedResults;
}

export async function searchAnime(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  // Search for animation genre specifically
  if (!TMDB_API_KEY) return [];

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      query: query,
      with_genres: String(ANIME_GENRE_ID),
      page: '1',
      include_adult: options.includeAdult ? 'true' : 'false',
    });

    if (options.year) {
      params.append('year', options.year);
    }

    const response = await fetch(
      `${TMDB_BASE_URL}/search/tv?${params.toString()}`
    );

    if (!response.ok) return [];

    const data: TMDBSearchResponse = await response.json();
    // Sort by popularity (descending)
    const animeResults = data.results
      .filter(isAnime)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 5);

    const detailedResults = await Promise.all(
      animeResults.map(async (item) => {
        const details = await getTVDetails(item.id);

        return {
          id: `tmdb:${item.id}`,
          title: item.name || 'Unknown Title',
          type: 'ANIME' as MediaType,
          total: details?.number_of_episodes || null,
          imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
          year: item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : undefined,
          overview: item.overview,
        };
      })
    );

    return detailedResults;
  } catch {
    return [];
  }
}

// ============ MangaDex API (Manga) ============

interface MangaDexMangaAttributes {
  title: { [key: string]: string };
  altTitles?: { [key: string]: string }[];
  description?: { [key: string]: string };
  year?: number | null;
  status?: string;
}

interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: {
    fileName?: string;
  };
}

interface MangaDexManga {
  id: string;
  type: 'manga';
  attributes: MangaDexMangaAttributes;
  relationships: MangaDexRelationship[];
}

interface MangaDexSearchResponse {
  result: string;
  data: MangaDexManga[];
  total: number;
}

interface MangaDexAggregateResponse {
  result: string;
  volumes: {
    [volume: string]: {
      volume: string;
      count: number;
      chapters: {
        [chapter: string]: {
          chapter: string;
          id: string;
          count: number;
        };
      };
    };
  };
}

function getPreferredTitle(titleObj: { [key: string]: string }): string {
  return titleObj['en'] || titleObj['ja-ro'] || titleObj['ja'] || Object.values(titleObj)[0] || 'Unknown';
}

function getMangaCoverUrl(manga: MangaDexManga): string | undefined {
  const coverRel = manga.relationships.find(r => r.type === 'cover_art');
  if (coverRel?.attributes?.fileName) {
    return `https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}.256.jpg`;
  }
  return undefined;
}

async function getMangaChapterCount(mangaId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${MANGADEX_API_BASE}/manga/${mangaId}/aggregate?translatedLanguage[]=en`
    );
    if (!response.ok) return null;
    
    const data: MangaDexAggregateResponse = await response.json();
    const allChapters = new Set<string>();
    
    for (const volKey of Object.keys(data.volumes)) {
      const vol = data.volumes[volKey];
      for (const chKey of Object.keys(vol.chapters)) {
        allChapters.add(chKey);
      }
    }
    
    return allChapters.size || null;
  } catch {
    return null;
  }
}

export async function searchManga(query: string): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({
      title: query,
      limit: '5',
      offset: '0',
      'includes[]': 'cover_art',
      'order[relevance]': 'desc',
      'contentRating[]': 'safe',
    });
    params.append('contentRating[]', 'suggestive');

    const response = await fetch(`${MANGADEX_API_BASE}/manga?${params.toString()}`);

    if (!response.ok) {
      throw new Error('MangaDex search failed');
    }

    const data: MangaDexSearchResponse = await response.json();
    const results = data.data.slice(0, 5);

    // Get chapter counts for each manga
    const detailedResults = await Promise.all(
      results.map(async (manga) => {
        const chapterCount = await getMangaChapterCount(manga.id);

        return {
          id: `mangadex:${manga.id}`,
          title: getPreferredTitle(manga.attributes.title),
          type: 'MANGA' as MediaType,
          total: chapterCount,
          imageUrl: getMangaCoverUrl(manga),
          year: manga.attributes.year ?? undefined,
        };
      })
    );

    return detailedResults;
  } catch (error) {
    console.error('MangaDex search error:', error);
    return [];
  }
}

// ============ Combined Search ============

export type SearchCategory = 'all' | 'tv' | 'movie' | 'anime' | 'manga';

async function searchAllWithMulti(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const results = await searchTMDBMulti(query, options);
  
  const mappedResults = await Promise.all(
    results.map(async (item) => {
      if (item.media_type === 'movie') {
        return {
          id: `tmdb:${item.id}`,
          title: item.title || 'Unknown Title',
          type: 'MOVIE' as MediaType,
          total: 1,
          imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
          year: item.release_date ? parseInt(item.release_date.split('-')[0]) : undefined,
          overview: item.overview,
        };
      } else {
        // TV show
        const details = await getTVDetails(item.id);
        const anime = isAnime(item);
        return {
          id: `tmdb:${item.id}`,
          title: item.name || 'Unknown Title',
          type: (anime ? 'ANIME' : 'TV') as MediaType,
          total: details?.number_of_episodes || null,
          imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
          year: item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : undefined,
          overview: item.overview,
        };
      }
    })
  );

  return mappedResults;
}

export async function searchMedia(
  query: string,
  category: SearchCategory = 'all',
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const searches: Promise<SearchResult[]>[] = [];

  if (category === 'all') {
    // Use multi endpoint for 'all' category (more efficient)
    searches.push(searchAllWithMulti(query, options));
    searches.push(searchManga(query));
  } else {
    if (category === 'movie') {
      searches.push(searchMovies(query, options));
    }
    if (category === 'tv') {
      searches.push(searchTV(query, options));
    }
    if (category === 'anime') {
      searches.push(searchAnime(query, options));
    }
    if (category === 'manga') {
      searches.push(searchManga(query));
    }
  }

  const results = await Promise.all(searches);
  const flatResults = results.flat();
  
  // Deduplicate by refId (id field in SearchResult)
  const seen = new Set<string>();
  const deduplicated = flatResults.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });

  return deduplicated;
}

// Convert search result to media item for adding to list
export function searchResultToMediaItem(result: SearchResult): Omit<MediaItem, 'id'> {
  return {
    title: result.title,
    type: result.type,
    current: 0,
    total: result.total,
    status: result.type === 'MANGA' ? 'READING' : 'PLAN_TO_WATCH',
    imageUrl: result.imageUrl,
    refId: result.id,
  };
}

// ============ Trending API ============

export type TrendingTimeWindow = 'day' | 'week';

interface TrendingResult extends SearchResult {
  popularity: number;
}

export interface TrendingCategory {
  title: string;
  items: SearchResult[];
}

async function fetchTMDBTrending(
  mediaType: 'movie' | 'tv' | 'all',
  timeWindow: TrendingTimeWindow = 'week'
): Promise<TMDBSearchResult[]> {
  if (!TMDB_API_KEY) {
    console.warn('TMDB API key not found');
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/trending/${mediaType}/${timeWindow}?api_key=${TMDB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error('TMDB trending fetch failed');
    }

    const data: TMDBSearchResponse = await response.json();
    return data.results;
  } catch (error) {
    console.error('TMDB trending error:', error);
    return [];
  }
}

export async function getTrendingMovies(timeWindow: TrendingTimeWindow = 'week'): Promise<SearchResult[]> {
  const results = await fetchTMDBTrending('movie', timeWindow);

  return results.slice(0, 20).map((item) => ({
    id: `tmdb:${item.id}`,
    title: item.title || 'Unknown Title',
    type: 'MOVIE' as MediaType,
    total: 1,
    imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
    year: item.release_date ? parseInt(item.release_date.split('-')[0]) : undefined,
    overview: item.overview,
  }));
}

export async function getTrendingTV(timeWindow: TrendingTimeWindow = 'week'): Promise<SearchResult[]> {
  const results = await fetchTMDBTrending('tv', timeWindow);

  return results.slice(0, 20).map((item) => {
    const anime = isAnime(item);
    return {
      id: `tmdb:${item.id}`,
      title: item.name || 'Unknown Title',
      type: (anime ? 'ANIME' : 'TV') as MediaType,
      total: null,
      imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
      year: item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : undefined,
      overview: item.overview,
    };
  });
}

export async function getTrendingAll(timeWindow: TrendingTimeWindow = 'week'): Promise<SearchResult[]> {
  const results = await fetchTMDBTrending('all', timeWindow);

  return results
    .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
    .slice(0, 20)
    .map((item) => {
      if (item.media_type === 'movie') {
        return {
          id: `tmdb:${item.id}`,
          title: item.title || 'Unknown Title',
          type: 'MOVIE' as MediaType,
          total: 1,
          imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
          year: item.release_date ? parseInt(item.release_date.split('-')[0]) : undefined,
          overview: item.overview,
        };
      } else {
        const anime = isAnime(item);
        return {
          id: `tmdb:${item.id}`,
          title: item.name || 'Unknown Title',
          type: (anime ? 'ANIME' : 'TV') as MediaType,
          total: null,
          imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
          year: item.first_air_date ? parseInt(item.first_air_date.split('-')[0]) : undefined,
          overview: item.overview,
        };
      }
    });
}

export async function getAllTrendingCategories(): Promise<TrendingCategory[]> {
  const [trendingAll, trendingMovies, trendingTV] = await Promise.all([
    getTrendingAll('day'),
    getTrendingMovies('week'),
    getTrendingTV('week'),
  ]);

  // Filter anime from TV results
  const trendingAnime = trendingTV.filter(item => item.type === 'ANIME');
  const trendingTVOnly = trendingTV.filter(item => item.type === 'TV');

  return [
    { title: 'Trending Today', items: trendingAll },
    { title: 'Popular Movies', items: trendingMovies },
    { title: 'Popular TV Shows', items: trendingTVOnly },
    { title: 'Popular Anime', items: trendingAnime },
  ].filter(cat => cat.items.length > 0);
}
