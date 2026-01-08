const CONSUMET_URL = process.env.CONSUMET_URL || 'http://consumet:3000';
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

/**
 * Consumet Anilist anime result structure
 * Based on API response from /meta/anilist endpoints
 */
export interface ConsumetAnimeResult {
  id: string;
  malId?: number;
  title: {
    romaji?: string;
    english?: string;
    native?: string;
    userPreferred?: string;
  };
  image?: string;
  imageHash?: string;
  trailer?: {
    id?: string;
    site?: string;
    thumbnail?: string;
    thumbnailHash?: string;
  };
  description?: string;
  status?: string;
  cover?: string;
  coverHash?: string;
  rating?: number;
  releaseDate?: number;
  color?: string;
  genres?: string[];
  totalEpisodes?: number | null;
  currentEpisodeCount?: number;
  duration?: number;
  type?: string; // "TV", "MOVIE", "OVA", "ONA", etc.
}

interface ConsumetSearchResponse {
  currentPage: number;
  hasNextPage: boolean;
  results: ConsumetAnimeResult[];
}

// ============ Helper Functions ============

/**
 * Get the preferred title from Consumet anime result
 * Priority: English > Romaji > Native > UserPreferred
 */
export function getPreferredTitle(title: ConsumetAnimeResult['title']): string {
  if (typeof title === 'string') return title;
  return title.english || title.romaji || title.native || title.userPreferred || 'Unknown';
}

/**
 * Extract year from release date
 */
export function extractYear(releaseDate?: number): number | undefined {
  return releaseDate ?? undefined;
}

// ============ API Functions ============

/**
 * Search anime using Anilist via Consumet
 * Endpoint: GET {CONSUMET_URL}/meta/anilist/{query}
 */
export async function searchAnimeAnilist(
  query: string,
  page: number = 1,
  perPage: number = 10
): Promise<ConsumetAnimeResult[]> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    });

    const response = await fetchWithTimeout(
      `${CONSUMET_URL}/meta/anilist/${encodeURIComponent(query)}?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Consumet Anilist search failed: ${response.status}`);
    }

    const data = (await response.json()) as ConsumetSearchResponse;
    return data.results || [];
  } catch (error) {
    console.error('Consumet Anilist search error:', error);
    return [];
  }
}

/**
 * Get trending anime from Anilist via Consumet
 * Endpoint: GET {CONSUMET_URL}/meta/anilist/trending
 */
export async function getTrendingAnime(
  page: number = 1,
  perPage: number = 20
): Promise<ConsumetAnimeResult[]> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    });

    const response = await fetchWithTimeout(
      `${CONSUMET_URL}/meta/anilist/trending?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Consumet Anilist trending failed: ${response.status}`);
    }

    const data = (await response.json()) as ConsumetSearchResponse;
    return data.results || [];
  } catch (error) {
    console.error('Consumet Anilist trending error:', error);
    return [];
  }
}

/**
 * Get popular anime from Anilist via Consumet
 * Endpoint: GET {CONSUMET_URL}/meta/anilist/popular
 */
export async function getPopularAnime(
  page: number = 1,
  perPage: number = 20
): Promise<ConsumetAnimeResult[]> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(perPage),
    });

    const response = await fetchWithTimeout(
      `${CONSUMET_URL}/meta/anilist/popular?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Consumet Anilist popular failed: ${response.status}`);
    }

    const data = (await response.json()) as ConsumetSearchResponse;
    return data.results || [];
  } catch (error) {
    console.error('Consumet Anilist popular error:', error);
    return [];
  }
}

/**
 * Get anime info by ID from Anilist via Consumet
 * Endpoint: GET {CONSUMET_URL}/meta/anilist/info/{id}
 */
export async function getAnimeInfo(id: string): Promise<ConsumetAnimeResult | null> {
  try {
    const response = await fetchWithTimeout(
      `${CONSUMET_URL}/meta/anilist/info/${encodeURIComponent(id)}`
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ConsumetAnimeResult;
  } catch (error) {
    console.error('Consumet Anilist info error:', error);
    return null;
  }
}
