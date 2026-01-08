// MangaPlus Service - Fetch and decrypt chapter images from MangaPlus
// Used for external URL chapters from MangaDex that link to MangaPlus

import {
  MangaPlusPage,
  MangaPlusChapter,
  MangaPlusError,
  isMangaPlusUrl,
  extractMangaPlusChapterId,
  parseMangaPlusResponse,
  decryptMangaPlusImage,
} from '@shared/mangaplus';

// Re-export shared types and utilities for consumers of this service
export type { MangaPlusPage, MangaPlusChapter };
export {
  MangaPlusError,
  isMangaPlusUrl,
  extractMangaPlusChapterId,
  parseMangaPlusResponse,
  decryptMangaPlusImage,
};

// Proxy endpoint for CORS bypass (defined in server.ts)
const MANGAPLUS_PROXY = '/api/mangaplus';

/**
 * Fetch MangaPlus chapter data (pages + encryption keys)
 * Uses a proxy endpoint to bypass CORS
 */
export async function fetchMangaPlusChapter(chapterId: string): Promise<MangaPlusChapter> {
  // Use our proxy endpoint
  const proxyUrl = `${MANGAPLUS_PROXY}/chapter/${chapterId}`;
  
  let response: Response;
  try {
    response = await fetch(proxyUrl);
  } catch (err) {
    throw new MangaPlusError(
      'Network error while fetching MangaPlus chapter. Please check your connection.',
      'NETWORK_ERROR'
    );
  }
  
  if (!response.ok) {
    // Handle specific error codes
    if (response.status === 429) {
      throw new MangaPlusError(
        'MangaPlus rate limit reached. Please wait a moment and try again.',
        'RATE_LIMITED'
      );
    }
    if (response.status === 404) {
      throw new MangaPlusError(
        'This chapter is not available on MangaPlus.',
        'NOT_AVAILABLE'
      );
    }
    
    // Try to get error message from response
    try {
      const errorData = await response.json();
      if (errorData.error) {
        throw new MangaPlusError(errorData.error, 'UNKNOWN');
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
    
    throw new MangaPlusError(
      `Failed to fetch MangaPlus chapter: ${response.status}`,
      'UNKNOWN'
    );
  }
  
  const data = await response.json();
  
  if (!data.pages || data.pages.length === 0) {
    throw new MangaPlusError(
      'No pages found in this chapter. It may not be available in your region.',
      'NOT_AVAILABLE'
    );
  }
  
  return data;
}

/**
 * Fetch and decrypt a single MangaPlus page image
 * Returns a blob URL that can be used in an <img> tag
 */
export async function fetchMangaPlusPage(page: MangaPlusPage, retries = 2): Promise<string> {
  // Use proxy to fetch the encrypted image
  const proxyUrl = `${MANGAPLUS_PROXY}/image?url=${encodeURIComponent(page.url)}&key=${page.encryptionKey}`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait and retry
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            continue;
          }
          throw new MangaPlusError('Rate limited while fetching images', 'RATE_LIMITED');
        }
        throw new MangaPlusError(`Failed to fetch page: ${response.status}`, 'NETWORK_ERROR');
      }
      
      // The proxy returns the already-decrypted image
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // If it's already a MangaPlusError, throw it
      if (err instanceof MangaPlusError) {
        throw err;
      }
      
      // Network error - retry
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        continue;
      }
    }
  }
  
  throw lastError || new MangaPlusError('Failed to fetch page after retries', 'NETWORK_ERROR');
}

/**
 * Fetch all pages for a MangaPlus chapter and return blob URLs
 * Call URL.revokeObjectURL() on each URL when done to free memory
 * 
 * @param externalUrl - The MangaPlus viewer URL
 * @param onProgress - Optional callback for progress updates (0-100)
 */
export async function getMangaPlusChapterImages(
  externalUrl: string,
  onProgress?: (percent: number) => void
): Promise<string[]> {
  const chapterId = extractMangaPlusChapterId(externalUrl);
  
  if (!chapterId) {
    throw new MangaPlusError(
      'Invalid MangaPlus URL: could not extract chapter ID',
      'PARSE_ERROR'
    );
  }
  
  const chapter = await fetchMangaPlusChapter(chapterId);
  
  // Fetch pages with progress tracking
  // Use batched parallel requests to avoid overwhelming the server
  const BATCH_SIZE = 4;
  const imageUrls: string[] = new Array(chapter.pages.length);
  let completed = 0;
  
  for (let i = 0; i < chapter.pages.length; i += BATCH_SIZE) {
    const batch = chapter.pages.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (page, batchIndex) => {
        const url = await fetchMangaPlusPage(page);
        completed++;
        onProgress?.(Math.round((completed / chapter.pages.length) * 100));
        return { index: i + batchIndex, url };
      })
    );
    
    // Store results in correct order
    for (const result of batchResults) {
      imageUrls[result.index] = result.url;
    }
  }
  
  return imageUrls;
}

/**
 * Clean up blob URLs to free memory
 */
export function revokeMangaPlusImages(urls: string[]): void {
  urls.forEach(url => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
}
