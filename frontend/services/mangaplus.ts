// MangaPlus Service - Fetch and decrypt chapter images from MangaPlus
// Used for external URL chapters from MangaDex that link to MangaPlus

export interface MangaPlusPage {
  url: string;
  encryptionKey: string;
  pageNumber: number;
}

export interface MangaPlusChapter {
  pages: MangaPlusPage[];
  title?: string;
}

// Proxy endpoint for CORS bypass (defined in server.ts)
const MANGAPLUS_PROXY = '/api/mangaplus';

/**
 * Check if a URL is a MangaPlus external URL
 */
export function isMangaPlusUrl(url: string | null): boolean {
  if (!url) return false;
  return url.includes('mangaplus.shueisha.co.jp');
}

/**
 * Extract chapter ID from MangaPlus viewer URL
 * e.g., https://mangaplus.shueisha.co.jp/viewer/1027248 -> 1027248
 */
export function extractMangaPlusChapterId(url: string): string | null {
  const match = url.match(/viewer\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Custom error class for MangaPlus errors
 */
export class MangaPlusError extends Error {
  constructor(
    message: string,
    public readonly code: 'RATE_LIMITED' | 'NOT_AVAILABLE' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'MangaPlusError';
  }
}

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
 * Parse MangaPlus protobuf response to extract image URLs and encryption keys
 * The response is binary protobuf, but we can extract URLs via regex
 */
export function parseMangaPlusResponse(buffer: ArrayBuffer): MangaPlusPage[] {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  
  // Pattern to match image URL followed by encryption key
  const pattern = /(https:\/\/jumpg-assets\.tokyo-cdn\.com\/secure\/title\/\d+\/chapter\/\d+\/manga_page\/\w+\/(\d+)\.jpg\?[^\s\x00-\x1f]+)[^\w]*([0-9a-f]{128})/g;
  
  const pages: MangaPlusPage[] = [];
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    const imageUrl = match[1];
    const pageNumber = parseInt(match[2], 10);
    const encryptionKey = match[3];
    
    pages.push({
      url: imageUrl,
      encryptionKey,
      pageNumber,
    });
  }
  
  // Sort by page number
  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  
  return pages;
}

/**
 * Decrypt a MangaPlus image using XOR with the encryption key
 */
export function decryptMangaPlusImage(encryptedData: Uint8Array, keyHex: string): Uint8Array {
  // Convert hex key to bytes
  const keyBytes = new Uint8Array(
    keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // XOR decrypt
  const decrypted = new Uint8Array(encryptedData.length);
  for (let i = 0; i < encryptedData.length; i++) {
    decrypted[i] = encryptedData[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return decrypted;
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
