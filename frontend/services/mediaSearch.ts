import { MediaItem, SearchResult, ProviderInfo, ProviderName, StreamingSources, ChapterPages } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface SearchOptions {
  year?: string;
  includeAdult?: boolean;
  provider?: ProviderName;
  page?: number;
  perPage?: number;
}

export type SearchCategory = 'all' | 'tv' | 'movie' | 'anime' | 'manga' | 'book' | 'lightnovel' | 'comic';

export interface TrendingCategory {
  title: string;
  items: SearchResult[];
}

export interface PaginatedSearchResults {
  currentPage: number;
  hasNextPage: boolean;
  totalPages?: number;
  totalResults?: number;
  results: SearchResult[];
}

// ============ Provider Functions ============

// Get available providers, optionally filtered by category
export async function getProviders(category?: SearchCategory): Promise<ProviderInfo[]> {
  try {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    
    const response = await fetch(`${API_BASE_URL}/media/providers?${params}`);
    if (!response.ok) {
      console.error('Providers fetch failed:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Providers fetch error:', error);
    return [];
  }
}

// ============ Search Functions ============

// Search media via backend
export async function searchMedia(
  query: string,
  category: SearchCategory = 'all',
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({ q: query, category });
  if (options.year) params.append('year', options.year);
  if (options.includeAdult) params.append('includeAdult', 'true');
  if (options.provider) params.append('provider', options.provider);
  if (options.page) params.append('page', options.page.toString());
  if (options.perPage) params.append('perPage', options.perPage.toString());

  try {
    const response = await fetch(`${API_BASE_URL}/media/search?${params}`);
    if (!response.ok) {
      console.error('Media search failed:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Media search error:', error);
    return [];
  }
}

// Search using a specific provider (returns paginated results)
export async function searchWithProvider(
  query: string,
  provider: ProviderName,
  options: { page?: number; perPage?: number } = {}
): Promise<PaginatedSearchResults> {
  if (!query.trim()) {
    return { currentPage: 1, hasNextPage: false, results: [] };
  }

  const params = new URLSearchParams({ q: query });
  if (options.page) params.append('page', options.page.toString());
  if (options.perPage) params.append('perPage', options.perPage.toString());

  try {
    const response = await fetch(`${API_BASE_URL}/media/search/${provider}?${params}`);
    if (!response.ok) {
      console.error('Provider search failed:', response.status);
      return { currentPage: 1, hasNextPage: false, results: [] };
    }
    return await response.json();
  } catch (error) {
    console.error('Provider search error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

// ============ Info Functions ============

// Get detailed media info
export async function getMediaInfo(
  provider: ProviderName,
  id: string,
  mediaType?: 'movie' | 'tv'
): Promise<any | null> {
  try {
    const params = new URLSearchParams();
    if (mediaType) params.append('mediaType', mediaType);
    
    const response = await fetch(`${API_BASE_URL}/media/info/${provider}/${encodeURIComponent(id)}?${params}`);
    if (!response.ok) {
      console.error('Media info fetch failed:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Media info error:', error);
    return null;
  }
}

// ============ Streaming Functions ============

// Get streaming sources for an episode
export async function getEpisodeSources(
  provider: ProviderName,
  episodeId: string,
  mediaId?: string
): Promise<StreamingSources | null> {
  try {
    const params = new URLSearchParams();
    if (mediaId) params.append('mediaId', mediaId);
    
    const response = await fetch(`${API_BASE_URL}/media/sources/${provider}/${encodeURIComponent(episodeId)}?${params}`);
    if (!response.ok) {
      console.error('Episode sources fetch failed:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Episode sources error:', error);
    return null;
  }
}

// Get available servers for an episode
export async function getEpisodeServers(
  provider: ProviderName,
  episodeId: string,
  mediaId?: string
): Promise<{ name: string; url: string }[]> {
  try {
    const params = new URLSearchParams();
    if (mediaId) params.append('mediaId', mediaId);
    
    const response = await fetch(`${API_BASE_URL}/media/servers/${provider}/${encodeURIComponent(episodeId)}?${params}`);
    if (!response.ok) {
      console.error('Episode servers fetch failed:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Episode servers error:', error);
    return [];
  }
}

// ============ Manga Reading Functions ============

// External chapter info response types
export interface MangaPlusPageInfo {
  page: number;
  url: string;
  encryptionKey: string;
}

export interface MangaDexPageInfo {
  page: number;
  img: string;
}

export interface ExternalChapterInfo {
  type: 'mangaplus' | 'mangadex' | 'external';
  chapterId: string;
  externalUrl?: string;
  message?: string;
  pages?: MangaPlusPageInfo[] | MangaDexPageInfo[];
}

// Get external chapter info (handles MangaPlus, external URLs, and regular MangaDex chapters)
export async function getExternalChapterInfo(
  chapterId: string
): Promise<ExternalChapterInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/manga/external/chapter/${encodeURIComponent(chapterId)}/info`);
    if (!response.ok) {
      console.error('External chapter info fetch failed:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('External chapter info error:', error);
    return null;
  }
}

// Build MangaPlus image proxy URL
export function getMangaPlusImageUrl(url: string, key: string): string {
  return `${API_BASE_URL}/manga/external/mangaplus/image?url=${encodeURIComponent(url)}&key=${key}`;
}

// Get chapter pages for manga reading
export async function getChapterPages(
  provider: ProviderName,
  chapterId: string
): Promise<ChapterPages | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/media/pages/${provider}/${encodeURIComponent(chapterId)}`);
    if (!response.ok) {
      console.error('Chapter pages fetch failed:', response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('Chapter pages error:', error);
    return null;
  }
}

// ============ Trending Functions ============

// Get all trending categories via backend
export async function getAllTrendingCategories(): Promise<TrendingCategory[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/media/trending`);
    if (!response.ok) {
      console.error('Trending fetch failed:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Trending fetch error:', error);
    return [];
  }
}

// Get trending movies via backend
export async function getTrendingMovies(): Promise<SearchResult[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/media/trending/movies`);
    if (!response.ok) {
      console.error('Trending movies fetch failed:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Trending movies error:', error);
    return [];
  }
}

// Get trending TV shows via backend
export async function getTrendingTV(): Promise<SearchResult[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/media/trending/tv`);
    if (!response.ok) {
      console.error('Trending TV fetch failed:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Trending TV error:', error);
    return [];
  }
}

// Get trending anime via backend
export async function getTrendingAnime(): Promise<SearchResult[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/media/trending/anime`);
    if (!response.ok) {
      console.error('Trending anime fetch failed:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Trending anime error:', error);
    return [];
  }
}

// Get popular anime
export async function getPopularAnime(): Promise<SearchResult[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/media/trending/anime/popular`);
    if (!response.ok) {
      console.error('Popular anime fetch failed:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Popular anime error:', error);
    return [];
  }
}

// Get popular manga
export async function getPopularManga(): Promise<SearchResult[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/media/trending/manga`);
    if (!response.ok) {
      console.error('Popular manga fetch failed:', response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Popular manga error:', error);
    return [];
  }
}

// ============ Conversion Helpers ============

// Convert search result to media item for adding to list
export function searchResultToMediaItem(result: SearchResult): Omit<MediaItem, 'id'> {
  const isReadable = result.type === 'MANGA' || result.type === 'BOOK' || result.type === 'LIGHT_NOVEL' || result.type === 'COMIC';
  return {
    title: result.title,
    type: result.type,
    current: 0,
    total: result.total,
    status: isReadable ? 'READING' : 'PLAN_TO_WATCH',
    imageUrl: result.imageUrl,
    refId: result.id,
  };
}

// Extract provider from a refId (e.g., "mangadex:abc123" -> "mangadex")
export function extractProviderFromRefId(refId: string): ProviderName | null {
  const [provider] = refId.split(':');
  return provider as ProviderName;
}

// Extract ID from a refId (e.g., "mangadex:abc123" -> "abc123")
export function extractIdFromRefId(refId: string): string {
  const parts = refId.split(':');
  return parts.slice(1).join(':');
}
