import { MediaItem, SearchResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface SearchOptions {
  year?: string;
  includeAdult?: boolean;
}

export type SearchCategory = 'all' | 'tv' | 'movie' | 'anime' | 'manga';

export interface TrendingCategory {
  title: string;
  items: SearchResult[];
}

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
