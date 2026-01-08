/**
 * Comic Providers - GetComics
 */

import { COMICS } from '@consumet/extensions';
import { 
  ComicProviderName, 
  UnifiedSearchResult, 
  SearchOptions,
  PaginatedResults,
} from './types.js';

// ============ Provider Instance ============

function getGetComicsProvider() {
  return new COMICS.GetComics();
}

// ============ Helper Functions ============

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// ============ Result Converters ============

function convertComicResult(result: any): UnifiedSearchResult {
  return {
    id: String(result.id ?? result.title ?? 'unknown'),
    title: safeString(result.title) ?? 'Unknown',
    image: safeString(result.image),
    description: safeString(result.description),
    year: result.year ? parseInt(String(result.year)) : undefined,
    provider: 'getcomics',
    url: safeString(result.upipi) ?? safeString(result.url),
  };
}

// ============ API Functions ============

/**
 * Search comics using GetComics
 */
export async function searchComics(
  query: string,
  _providerName: ComicProviderName = 'getcomics',
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getGetComicsProvider();
    const result = await provider.search(query, options.page);
    
    // GetComics returns ComicRes which has different structure
    // It may return results directly or in a containers array
    const results: any[] = [];
    
    if (result && typeof result === 'object') {
      // Check for containers (GetComics specific structure)
      if ('containers' in result && Array.isArray((result as any).containers)) {
        for (const container of (result as any).containers) {
          if (container.comics && Array.isArray(container.comics)) {
            results.push(...container.comics);
          }
        }
      }
      // Check for direct results array
      else if ('results' in result && Array.isArray((result as any).results)) {
        results.push(...(result as any).results);
      }
      // Check if result itself is an array
      else if (Array.isArray(result)) {
        results.push(...result);
      }
    }
    
    return {
      currentPage: (result as any)?.currentPage ?? 1,
      hasNextPage: (result as any)?.hasNextPage ?? false,
      totalPages: (result as any)?.totalPages,
      totalResults: results.length,
      results: results.map(r => convertComicResult(r)),
    };
  } catch (error) {
    console.error('Comic search error:', error);
    return {
      currentPage: 1,
      hasNextPage: false,
      results: [],
    };
  }
}

/**
 * Get comic download links
 * Note: GetComics may not have a fetchComic method in all SDK versions
 */
export async function getComicDownloadLinks(comicUrl: string): Promise<string[] | null> {
  try {
    const provider = getGetComicsProvider();
    
    // Try to use fetchComicInfo if available, otherwise return the URL itself
    if ('fetchComicInfo' in provider && typeof (provider as any).fetchComicInfo === 'function') {
      const info = await (provider as any).fetchComicInfo(comicUrl);
      if (info && info.links && Array.isArray(info.links)) {
        return info.links.map((l: any) => typeof l === 'string' ? l : l?.link ?? '').filter(Boolean);
      }
      if (info && info.download) {
        return [info.download];
      }
    }
    
    return comicUrl ? [comicUrl] : null;
  } catch (error) {
    console.error('Comic download links error:', error);
    return null;
  }
}
