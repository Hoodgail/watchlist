import { MediaItem, MediaType, SearchResult } from '../types';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

const MANGAHOOK_BASE_URL = import.meta.env.VITE_MANGAHOOK_API_URL || 'https://mangadex.hoodgail.me/api';

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

async function searchTMDB(query: string, mediaType: 'movie' | 'tv'): Promise<TMDBSearchResult[]> {
  if (!TMDB_API_KEY) {
    console.warn('TMDB API key not found');
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`
    );

    if (!response.ok) {
      throw new Error('TMDB search failed');
    }

    const data: TMDBSearchResponse = await response.json();
    return data.results.slice(0, 5);
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

export async function searchMovies(query: string): Promise<SearchResult[]> {
  const results = await searchTMDB(query, 'movie');

  return results.map((item) => ({
    id: `tmdb_movie_${item.id}`,
    title: item.title || 'Unknown Title',
    type: 'MOVIE' as MediaType,
    total: 1,
    imageUrl: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : undefined,
    year: item.release_date ? parseInt(item.release_date.split('-')[0]) : undefined,
    overview: item.overview,
  }));
}

export async function searchTV(query: string): Promise<SearchResult[]> {
  const results = await searchTMDB(query, 'tv');

  // Get details for each show to get episode count
  const detailedResults = await Promise.all(
    results.map(async (item) => {
      const details = await getTVDetails(item.id);
      const anime = isAnime(item);

      return {
        id: `tmdb_tv_${item.id}`,
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

export async function searchAnime(query: string): Promise<SearchResult[]> {
  // Search for animation genre specifically
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&with_genres=${ANIME_GENRE_ID}&page=1`
    );

    if (!response.ok) return [];

    const data: TMDBSearchResponse = await response.json();
    const animeResults = data.results.filter(isAnime).slice(0, 5);

    const detailedResults = await Promise.all(
      animeResults.map(async (item) => {
        const details = await getTVDetails(item.id);

        return {
          id: `tmdb_anime_${item.id}`,
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

// ============ MangaHook API (Manga) ============

interface MangaHookResult {
  id: string;
  image: string;
  title: string;
}

interface MangaHookSearchResponse {
  mangaList: MangaHookResult[];
  metaData: {
    totalPages: number;
  };
}

interface MangaHookDetails {
  id: string;
  title: string;
  alternativeTitle?: string;
  status?: string;
  imageUrl?: string;
  chapterList?: { id: string; name: string; view: string; createdAt: string }[];
}

export async function searchManga(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `${MANGAHOOK_BASE_URL}/search/${encodeURIComponent(query)}?page=1`
    );

    if (!response.ok) {
      throw new Error('MangaHook search failed');
    }

    const data: MangaHookSearchResponse = await response.json();
    const results = data.mangaList.slice(0, 5);

    // Get details for each manga to get chapter count
    const detailedResults = await Promise.all(
      results.map(async (item) => {
        const details = await getMangaDetails(item.id);

        return {
          id: `manga_${item.id}`,
          title: item.title,
          type: 'MANGA' as MediaType,
          total: details?.chapterList?.length || null,
          imageUrl: item.image || details?.imageUrl,
        };
      })
    );

    return detailedResults;
  } catch (error) {
    console.error('MangaHook search error:', error);
    return [];
  }
}

async function getMangaDetails(id: string): Promise<MangaHookDetails | null> {
  try {
    const response = await fetch(`${MANGAHOOK_BASE_URL}/manga/${id}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ============ Combined Search ============

export type SearchCategory = 'all' | 'tv' | 'movie' | 'anime' | 'manga';

export async function searchMedia(
  query: string,
  category: SearchCategory = 'all'
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const searches: Promise<SearchResult[]>[] = [];

  if (category === 'all' || category === 'movie') {
    searches.push(searchMovies(query));
  }
  if (category === 'all' || category === 'tv') {
    searches.push(searchTV(query));
  }
  if (category === 'all' || category === 'anime') {
    searches.push(searchAnime(query));
  }
  if (category === 'all' || category === 'manga') {
    searches.push(searchManga(query));
  }

  const results = await Promise.all(searches);
  return results.flat();
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
