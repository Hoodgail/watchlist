/**
 * MangaPlus Service - Fetch and decrypt chapter images from MangaPlus
 * Used for external URL chapters from MangaDex that link to MangaPlus
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

export interface DecryptedPage {
  page: number;
  img: string;  // Base64 data URL
}

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
 * Fetch MangaPlus chapter data (pages + encryption keys)
 */
export async function fetchMangaPlusChapter(chapterId: string): Promise<MangaPlusChapter> {
  const mangaPlusUrl = `https://jumpg-webapi.tokyo-cdn.com/api/manga_viewer?chapter_id=${chapterId}&split=yes&img_quality=high&clang=eng`;
  
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
  if (!imageUrl.startsWith('https://jumpg-assets.tokyo-cdn.com/')) {
    throw new MangaPlusError('Invalid image URL', 'PARSE_ERROR');
  }
  
  // Validate key is 128 hex characters
  if (!/^[0-9a-f]{128}$/.test(encryptionKey)) {
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
