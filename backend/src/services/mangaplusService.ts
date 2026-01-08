/**
 * MangaPlus Service - Fetch and decrypt chapter images from MangaPlus
 * Used for external URL chapters from MangaDex that link to MangaPlus
 */

import {
  MangaPlusPage,
  MangaPlusChapter,
  MangaPlusError,
  isMangaPlusUrl,
  extractMangaPlusChapterId,
  isValidMangaPlusCdnUrl,
  isValidEncryptionKey,
  parseMangaPlusResponse,
  decryptMangaPlusImage,
  buildMangaPlusApiUrl,
} from '@shared/mangaplus.js';

// Re-export shared types and utilities for consumers of this service
export {
  MangaPlusPage,
  MangaPlusChapter,
  MangaPlusError,
  isMangaPlusUrl,
  extractMangaPlusChapterId,
  parseMangaPlusResponse,
  decryptMangaPlusImage,
};

export interface DecryptedPage {
  page: number;
  img: string;  // Base64 data URL
}

/**
 * Fetch MangaPlus chapter data (pages + encryption keys)
 */
export async function fetchMangaPlusChapter(chapterId: string): Promise<MangaPlusChapter> {
  const mangaPlusUrl = buildMangaPlusApiUrl(chapterId);
  
  let response: Response;
  try {
    response = await fetch(mangaPlusUrl);
  } catch (err) {
    throw new MangaPlusError(
      'Network error while fetching MangaPlus chapter. Please check your connection.',
      'NETWORK_ERROR'
    );
  }
  
  if (!response.ok) {
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
    throw new MangaPlusError(
      `Failed to fetch MangaPlus chapter: ${response.status}`,
      'UNKNOWN'
    );
  }
  
  const buffer = await response.arrayBuffer();
  const pages = parseMangaPlusResponse(buffer);
  
  if (pages.length === 0) {
    throw new MangaPlusError(
      'No pages found in this chapter. It may not be available in your region.',
      'NOT_AVAILABLE'
    );
  }
  
  return { pages };
}

/**
 * Fetch and decrypt a single MangaPlus page image
 * Returns decrypted image data as Buffer
 */
export async function fetchAndDecryptPage(page: MangaPlusPage): Promise<Buffer> {
  const response = await fetch(page.url);
  
  if (!response.ok) {
    throw new MangaPlusError(`Failed to fetch page: ${response.status}`, 'NETWORK_ERROR');
  }
  
  const buffer = await response.arrayBuffer();
  const encrypted = new Uint8Array(buffer);
  const decrypted = decryptMangaPlusImage(encrypted, page.encryptionKey);
  
  return Buffer.from(decrypted);
}

/**
 * Fetch chapter pages info from MangaPlus
 * Returns page metadata that can be used to construct image URLs
 */
export async function getMangaPlusChapterPages(externalUrl: string): Promise<MangaPlusPage[]> {
  const chapterId = extractMangaPlusChapterId(externalUrl);
  
  if (!chapterId) {
    throw new MangaPlusError(
      'Invalid MangaPlus URL: could not extract chapter ID',
      'PARSE_ERROR'
    );
  }
  
  const chapter = await fetchMangaPlusChapter(chapterId);
  return chapter.pages;
}

/**
 * Fetch a single decrypted page as base64 data URL
 */
export async function getDecryptedPageAsDataUrl(
  imageUrl: string,
  encryptionKey: string
): Promise<string> {
  // Validate the URL is from MangaPlus CDN
  if (!isValidMangaPlusCdnUrl(imageUrl)) {
    throw new MangaPlusError('Invalid image URL', 'PARSE_ERROR');
  }
  
  // Validate key is 128 hex characters
  if (!isValidEncryptionKey(encryptionKey)) {
    throw new MangaPlusError('Invalid encryption key', 'PARSE_ERROR');
  }
  
  const response = await fetch(imageUrl);
  
  if (!response.ok) {
    throw new MangaPlusError(`Failed to fetch image: ${response.status}`, 'NETWORK_ERROR');
  }
  
  const buffer = await response.arrayBuffer();
  const encrypted = new Uint8Array(buffer);
  const decrypted = decryptMangaPlusImage(encrypted, encryptionKey);
  
  // Convert to base64 data URL
  const base64 = Buffer.from(decrypted).toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}
