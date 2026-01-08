const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';
const FETCH_TIMEOUT_MS = 10000; // 10 second timeout for API calls

// Helper to add timeout to fetch
async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============ Types ============

export interface TMDBSearchResult {
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

export interface TMDBTVDetails {
  id: number;
  name: string;
  number_of_episodes: number;
  number_of_seasons: number;
  poster_path: string | null;
  first_air_date?: string;
  overview?: string;
  genres?: { id: number; name: string }[];
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

// Anime genre ID in TMDB
const ANIME_GENRE_ID = 16; // Animation genre

// ============ Helper Functions ============

/**
 * Check if a TMDB result is anime based on genre
 */
export function isAnime(result: TMDBSearchResult | TMDBTVDetails): boolean {
  let genres: number[] = [];
  if ('genre_ids' in result && result.genre_ids) {
    genres = result.genre_ids;
  } else if ('genres' in result && result.genres) {
    genres = result.genres.map(g => g.id);
  }
  return genres.includes(ANIME_GENRE_ID);
}

/**
 * Get full image URL from TMDB poster path
 */
export function getImageUrl(posterPath: string | null): string | undefined {
  return posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : undefined;
}

/**
 * Extract year from date string
 */
export function extractYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const year = parseInt(dateStr.split('-')[0]);
  return isNaN(year) ? undefined : year;
}

// ============ API Functions ============

/**
 * Search TMDB using multi endpoint (returns both movies and TV)
 */
export async function searchTMDBMulti(
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

    const response = await fetchWithTimeout(
      `${TMDB_BASE_URL}/search/multi?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`TMDB multi search failed: ${response.status}`);
    }

    const data = (await response.json()) as TMDBSearchResponse;
    
    // Filter to only movie/tv, sort by popularity (descending)
    const filtered = data.results
      .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    
    return filtered.slice(0, 10);
  } catch (error) {
    console.error('TMDB multi search error:', error);
    return [];
  }
}

/**
 * Search TMDB for a specific media type (movie or TV)
 */
export async function searchTMDB(
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

    const response = await fetchWithTimeout(
      `${TMDB_BASE_URL}/search/${mediaType}?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`TMDB search failed: ${response.status}`);
    }

    const data = (await response.json()) as TMDBSearchResponse;
    
    // Sort by popularity (descending)
    const sorted = [...data.results].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    return sorted.slice(0, 5);
  } catch (error) {
    console.error('TMDB search error:', error);
    return [];
  }
}

/**
 * Get TV show details including episode count
 */
export async function getTVDetails(id: number): Promise<TMDBTVDetails | null> {
  if (!TMDB_API_KEY) return null;

  try {
    const response = await fetchWithTimeout(
      `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`
    );

    if (!response.ok) return null;

    return (await response.json()) as TMDBTVDetails;
  } catch {
    return null;
  }
}

/**
 * Get trending media from TMDB
 */
export async function getTrendingTMDB(
  mediaType: 'movie' | 'tv' | 'all',
  timeWindow: 'day' | 'week' = 'week'
): Promise<TMDBSearchResult[]> {
  if (!TMDB_API_KEY) {
    console.warn('TMDB API key not found');
    return [];
  }

  try {
    const response = await fetchWithTimeout(
      `${TMDB_BASE_URL}/trending/${mediaType}/${timeWindow}?api_key=${TMDB_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`TMDB trending fetch failed: ${response.status}`);
    }

    const data = (await response.json()) as TMDBSearchResponse;
    return data.results;
  } catch (error) {
    console.error('TMDB trending error:', error);
    return [];
  }
}

/**
 * Search for anime specifically (TV shows with animation genre)
 */
export async function searchAnime(
  query: string,
  options: SearchOptions = {}
): Promise<TMDBSearchResult[]> {
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

    const response = await fetchWithTimeout(
      `${TMDB_BASE_URL}/search/tv?${params.toString()}`
    );

    if (!response.ok) return [];

    const data = (await response.json()) as TMDBSearchResponse;
    
    // Filter to animation genre and sort by popularity
    const animeResults = data.results
      .filter(isAnime)
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 5);

    return animeResults;
  } catch {
    return [];
  }
}
