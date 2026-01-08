/**
 * Book Providers
 * Note: The BOOKS namespace is empty in the current @consumet/extensions SDK.
 * This module provides stub implementations that return empty results.
 * Book functionality may be added in future SDK versions.
 */

import { 
  BookProviderName, 
  UnifiedBookResult, 
  SearchOptions,
  PaginatedResults,
} from './types.js';

// ============ Stub Implementation ============

/**
 * Search books
 * Note: Currently returns empty results as no book providers are available in the SDK
 */
export async function searchBooks(
  _query: string,
  _providerName: BookProviderName = 'libgen',
  _options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedBookResult>> {
  console.warn('Book search is not available: BOOKS namespace is empty in the current SDK version');
  return {
    currentPage: 1,
    hasNextPage: false,
    results: [],
  };
}

/**
 * Get book download link
 * Note: Currently returns null as no book providers are available in the SDK
 */
export async function getBookLinkFiction(_bookId: string): Promise<string | null> {
  console.warn('Book download is not available: BOOKS namespace is empty in the current SDK version');
  return null;
}
