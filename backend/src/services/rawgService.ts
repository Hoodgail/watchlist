/**
 * RAWG API Service
 * Provides integration with RAWG.io for game data
 * API Documentation: https://rawg.io/apidocs
 */

const RAWG_API_KEY = process.env.RAWG_API_KEY || '';
const RAWG_BASE_URL = 'https://api.rawg.io/api';
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

export interface RAWGPlatform {
  platform: {
    id: number;
    name: string;
    slug: string;
  };
  released_at?: string;
  requirements?: {
    minimum?: string;
    recommended?: string;
  };
}

export interface RAWGGenre {
  id: number;
  name: string;
  slug: string;
}

export interface RAWGESRBRating {
  id: number;
  name: string;
  slug: string;
}

export interface RAWGDeveloper {
  id: number;
  name: string;
  slug: string;
}

export interface RAWGPublisher {
  id: number;
  name: string;
  slug: string;
}

export interface RAWGScreenshot {
  id: number;
  image: string;
  width: number;
  height: number;
}

export interface RAWGSearchResult {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  metacritic: number | null;
  playtime: number; // Average hours to complete
  platforms: RAWGPlatform[] | null;
  genres: RAWGGenre[] | null;
  esrb_rating: RAWGESRBRating | null;
  rating: number; // RAWG user rating 0-5
  ratings_count: number;
  added: number; // Number of users who added this game
}

export interface RAWGGameDetails extends RAWGSearchResult {
  description: string;
  description_raw: string;
  website: string;
  developers: RAWGDeveloper[];
  publishers: RAWGPublisher[];
  screenshots_count: number;
  movies_count: number;
  creators_count: number;
  achievements_count: number;
  parent_platforms: { platform: { id: number; name: string; slug: string } }[];
  reddit_url: string;
  reddit_name: string;
  reddit_description: string;
  reddit_logo: string;
  reddit_count: number;
  twitch_count: number;
  youtube_count: number;
  alternative_names: string[];
  metacritic_url: string;
}

interface RAWGSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: RAWGSearchResult[];
}

export interface SearchOptions {
  page?: number;
  pageSize?: number;
  ordering?: string;
  dates?: string; // Date range in format "2020-01-01,2020-12-31"
  metacritic?: string; // Range like "80,100"
  platforms?: string; // Comma-separated platform IDs
  genres?: string; // Comma-separated genre slugs
}

// ============ Helper Functions ============

/**
 * Get full image URL (RAWG returns full URLs, but we can resize)
 */
export function getImageUrl(imagePath: string | null, size?: 'small' | 'medium' | 'large'): string | undefined {
  if (!imagePath) return undefined;
  
  // RAWG images can be resized by modifying the URL
  // Original: https://media.rawg.io/media/games/abc.jpg
  // Resized: https://media.rawg.io/media/resize/420/-/games/abc.jpg
  if (size && imagePath.includes('media.rawg.io/media/')) {
    const sizeMap = {
      small: '200',
      medium: '420',
      large: '640',
    };
    return imagePath.replace('/media/games/', `/media/resize/${sizeMap[size]}/-/games/`);
  }
  
  return imagePath;
}

/**
 * Extract year from release date string
 */
export function extractYear(dateStr: string | null): number | undefined {
  if (!dateStr) return undefined;
  const year = parseInt(dateStr.split('-')[0]);
  return isNaN(year) ? undefined : year;
}

/**
 * Get platform names from platforms array
 */
export function getPlatformNames(platforms: RAWGPlatform[] | null): string[] {
  if (!platforms) return [];
  return platforms.map(p => p.platform.name);
}

/**
 * Get genre names from genres array
 */
export function getGenreNames(genres: RAWGGenre[] | null): string[] {
  if (!genres) return [];
  return genres.map(g => g.name);
}

// ============ API Functions ============

/**
 * Search games on RAWG
 */
export async function searchGames(
  query: string,
  options: SearchOptions = {}
): Promise<RAWGSearchResult[]> {
  if (!RAWG_API_KEY) {
    console.warn('RAWG API key not found');
    return [];
  }

  try {
    const params = new URLSearchParams({
      key: RAWG_API_KEY,
      search: query,
      page: String(options.page || 1),
      page_size: String(options.pageSize || 10),
    });

    if (options.ordering) params.append('ordering', options.ordering);
    if (options.platforms) params.append('platforms', options.platforms);
    if (options.genres) params.append('genres', options.genres);

    const response = await fetchWithTimeout(
      `${RAWG_BASE_URL}/games?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`RAWG search failed: ${response.status}`);
    }

    const data = (await response.json()) as RAWGSearchResponse;
    return data.results;
  } catch (error) {
    console.error('RAWG search error:', error);
    return [];
  }
}

/**
 * Get detailed game information
 */
export async function getGameDetails(id: number | string): Promise<RAWGGameDetails | null> {
  if (!RAWG_API_KEY) {
    console.warn('RAWG API key not found');
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `${RAWG_BASE_URL}/games/${id}?key=${RAWG_API_KEY}`
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`RAWG game details failed: ${response.status}`);
    }

    return (await response.json()) as RAWGGameDetails;
  } catch (error) {
    console.error('RAWG game details error:', error);
    return null;
  }
}

/**
 * Get trending/popular games (recently released with high ratings)
 */
export async function getTrendingGames(
  options: SearchOptions = {}
): Promise<RAWGSearchResult[]> {
  if (!RAWG_API_KEY) {
    console.warn('RAWG API key not found - set RAWG_API_KEY environment variable');
    return [];
  }

  try {
    // Get games from the last 12 months, ordered by popularity (added count)
    const today = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const dateRange = `${twelveMonthsAgo.toISOString().split('T')[0]},${today.toISOString().split('T')[0]}`;

    const params = new URLSearchParams({
      key: RAWG_API_KEY,
      dates: options.dates || dateRange,
      ordering: options.ordering || '-added', // Order by most added (popularity) instead of rating
      page: String(options.page || 1),
      page_size: String(options.pageSize || 20),
    });

    // Only add metacritic filter if explicitly provided (don't require it by default)
    // Many recent games don't have metacritic scores yet
    if (options.metacritic) {
      params.append('metacritic', options.metacritic);
    }

    const response = await fetchWithTimeout(
      `${RAWG_BASE_URL}/games?${params.toString()}`
    );

    if (!response.ok) {
      console.error(`RAWG trending failed: ${response.status} ${response.statusText}`);
      throw new Error(`RAWG trending failed: ${response.status}`);
    }

    const data = (await response.json()) as RAWGSearchResponse;
    console.log(`RAWG trending: fetched ${data.results?.length || 0} games`);
    return data.results || [];
  } catch (error) {
    console.error('RAWG trending error:', error);
    return [];
  }
}

/**
 * Get popular games of all time (most added by users)
 */
export async function getPopularGames(
  options: SearchOptions = {}
): Promise<RAWGSearchResult[]> {
  if (!RAWG_API_KEY) {
    console.warn('RAWG API key not found');
    return [];
  }

  try {
    const params = new URLSearchParams({
      key: RAWG_API_KEY,
      ordering: options.ordering || '-added',
      page: String(options.page || 1),
      page_size: String(options.pageSize || 20),
    });

    if (options.metacritic) params.append('metacritic', options.metacritic);
    if (options.platforms) params.append('platforms', options.platforms);
    if (options.genres) params.append('genres', options.genres);

    const response = await fetchWithTimeout(
      `${RAWG_BASE_URL}/games?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`RAWG popular failed: ${response.status}`);
    }

    const data = (await response.json()) as RAWGSearchResponse;
    return data.results;
  } catch (error) {
    console.error('RAWG popular error:', error);
    return [];
  }
}

/**
 * Get upcoming games
 */
export async function getUpcomingGames(
  options: SearchOptions = {}
): Promise<RAWGSearchResult[]> {
  if (!RAWG_API_KEY) {
    console.warn('RAWG API key not found');
    return [];
  }

  try {
    // Get games releasing in the next 6 months
    const today = new Date();
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    
    const dateRange = `${today.toISOString().split('T')[0]},${sixMonthsFromNow.toISOString().split('T')[0]}`;

    const params = new URLSearchParams({
      key: RAWG_API_KEY,
      dates: dateRange,
      ordering: '-added',
      page: String(options.page || 1),
      page_size: String(options.pageSize || 20),
    });

    const response = await fetchWithTimeout(
      `${RAWG_BASE_URL}/games?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`RAWG upcoming failed: ${response.status}`);
    }

    const data = (await response.json()) as RAWGSearchResponse;
    return data.results;
  } catch (error) {
    console.error('RAWG upcoming error:', error);
    return [];
  }
}

/**
 * Get game screenshots
 */
export async function getGameScreenshots(id: number | string): Promise<RAWGScreenshot[]> {
  if (!RAWG_API_KEY) {
    console.warn('RAWG API key not found');
    return [];
  }

  try {
    const response = await fetchWithTimeout(
      `${RAWG_BASE_URL}/games/${id}/screenshots?key=${RAWG_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`RAWG screenshots failed: ${response.status}`);
    }

    const data = (await response.json()) as { results: RAWGScreenshot[] };
    return data.results;
  } catch (error) {
    console.error('RAWG screenshots error:', error);
    return [];
  }
}
