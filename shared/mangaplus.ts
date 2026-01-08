/**
 * Shared MangaPlus utilities for decryption and response parsing.
 * Used by backend, frontend client, and frontend SSR server.
 */

export interface MangaPlusPage {
  url: string;
  encryptionKey: string;
  pageNumber: number;
}

export interface MangaPlusChapter {
  pages: MangaPlusPage[];
  title?: string;
}

export type MangaPlusErrorCode = 'RATE_LIMITED' | 'NOT_AVAILABLE' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'UNKNOWN';

/**
 * Custom error class for MangaPlus errors
 */
export class MangaPlusError extends Error {
  constructor(
    message: string,
    public readonly code: MangaPlusErrorCode
  ) {
    super(message);
    this.name = 'MangaPlusError';
  }
}

/**
 * MangaPlus API base URL for fetching chapter data
 */
export const MANGAPLUS_API_URL = 'https://jumpg-webapi.tokyo-cdn.com/api/manga_viewer';

/**
 * MangaPlus CDN base URL for validating image URLs
 */
export const MANGAPLUS_CDN_BASE = 'https://jumpg-assets.tokyo-cdn.com/';

/**
 * Check if a URL is a MangaPlus external URL
 */
export function isMangaPlusUrl(url: string | null | undefined): boolean {
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
 * Validate that a URL is from the MangaPlus CDN
 */
export function isValidMangaPlusCdnUrl(url: string): boolean {
  return url.startsWith(MANGAPLUS_CDN_BASE);
}

/**
 * Validate that an encryption key is valid (128 hex characters)
 */
export function isValidEncryptionKey(key: string): boolean {
  return /^[0-9a-f]{128}$/.test(key);
}

/**
 * Parse MangaPlus protobuf response to extract image URLs and encryption keys.
 * The response is binary protobuf, but we can extract URLs via regex.
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
 * Decrypt a MangaPlus image using XOR with the encryption key.
 * Works in both Node.js and browser environments.
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
 * Build the MangaPlus API URL for fetching chapter data
 */
export function buildMangaPlusApiUrl(chapterId: string): string {
  return `${MANGAPLUS_API_URL}?chapter_id=${chapterId}&split=yes&img_quality=high&clang=eng`;
}
