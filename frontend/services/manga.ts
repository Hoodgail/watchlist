/**
 * Unified Manga API Service
 * Supports multiple manga providers through the consumet backend
 */

import { createRefId, parseRefId, isSourceRefId } from '@shared/refId';

// Types
export type MangaProviderName = 
  | 'mangadex' 
  | 'mangahere'
  | 'mangapill' 
  | 'comick' 
  | 'mangareader'
  | 'asurascans'
  | 'anilist-manga';

export interface MangaProvider {
  id: MangaProviderName;
  name: string;
  isDefault: boolean;
}

export interface MangaSearchResult {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  cover?: string;
  description?: string;
  status?: string;
  releaseDate?: string | number;
  year?: number;
  rating?: number;
  genres?: string[];
  totalChapters?: number | null;
  provider: MangaProviderName;
  url?: string;
}

export interface MangaChapter {
  id: string;
  number: number | string;
  title?: string;
  releaseDate?: string;
  pages?: number;
  url?: string;
  volume?: string;
}

export interface MangaInfo {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  cover?: string;
  description?: string;
  status?: string;
  releaseDate?: string | number;
  year?: number;
  rating?: number;
  genres?: string[];
  totalChapters?: number | null;
  chapters?: MangaChapter[];
  similar?: MangaSearchResult[];
  recommendations?: MangaSearchResult[];
  provider: MangaProviderName;
  url?: string;
}

export interface ChapterPage {
  page: number;
  img: string;
  headerForImage?: Record<string, string>;
}

export interface ChapterPages {
  chapterId: string;
  pages: ChapterPage[];
  provider: MangaProviderName;
}

export interface PaginatedResults<T> {
  currentPage: number;
  hasNextPage: boolean;
  totalPages?: number;
  totalResults?: number;
  results: T[];
  provider?: MangaProviderName;
}

// API base - use same pattern as api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const API_BASE = `${API_BASE_URL}/manga`;

// Rate limiting for API calls
const REQUEST_QUEUE: { resolve: () => void; timestamp: number }[] = [];
const RATE_LIMIT_MS = 200;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  return new Promise((resolve) => {
    const now = Date.now();
    const lastRequest = REQUEST_QUEUE[REQUEST_QUEUE.length - 1]?.timestamp || 0;
    const delay = Math.max(0, lastRequest + RATE_LIMIT_MS - now);

    const entry = {
      resolve: () => {
        fetch(url, options).then(resolve);
      },
      timestamp: now + delay,
    };

    REQUEST_QUEUE.push(entry);

    // Clean old entries
    while (REQUEST_QUEUE.length > 0 && REQUEST_QUEUE[0].timestamp < now - 1000) {
      REQUEST_QUEUE.shift();
    }

    setTimeout(entry.resolve, delay);
  });
}

// ============ API Functions ============

/**
 * Get list of available manga providers
 */
export async function getProviders(): Promise<MangaProvider[]> {
  const response = await rateLimitedFetch(`${API_BASE}/providers`);
  if (!response.ok) {
    throw new Error('Failed to fetch providers');
  }
  const json = await response.json();
  return json.providers;
}

/**
 * Search manga across a specific provider
 */
export async function searchManga(
  query: string,
  provider: MangaProviderName = 'mangadex',
  page: number = 1
): Promise<PaginatedResults<MangaSearchResult>> {
  const params = new URLSearchParams({
    q: query,
    provider,
    page: String(page),
  });

  const response = await rateLimitedFetch(`${API_BASE}/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to search manga');
  }
  return response.json();
}

/**
 * Get manga info from a specific provider
 */
export async function getMangaInfo(
  mangaId: string,
  provider: MangaProviderName = 'mangadex'
): Promise<MangaInfo> {
  const response = await rateLimitedFetch(`${API_BASE}/${provider}/${encodeURIComponent(mangaId)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch manga info');
  }
  return response.json();
}

/**
 * Get chapter pages from a specific provider
 */
export async function getChapterPages(
  chapterId: string,
  provider: MangaProviderName = 'mangadex'
): Promise<ChapterPages> {
  const response = await rateLimitedFetch(
    `${API_BASE}/${provider}/chapter/${encodeURIComponent(chapterId)}/pages`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch chapter pages');
  }
  return response.json();
}

/**
 * Get popular manga
 */
export async function getPopularManga(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<MangaSearchResult>> {
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
  });

  const response = await rateLimitedFetch(`${API_BASE}/popular?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch popular manga');
  }
  return response.json();
}

/**
 * Get latest updated manga
 */
export async function getLatestManga(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<MangaSearchResult>> {
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
  });

  const response = await rateLimitedFetch(`${API_BASE}/latest?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch latest manga');
  }
  return response.json();
}

// ============ Utility Functions ============

/**
 * Build full image URLs for pages
 */
export function buildImageUrls(pages: ChapterPage[]): string[] {
  return pages.map(p => p.img);
}

/**
 * Fetch an image as a Blob (for offline storage)
 */
export async function fetchImageAsBlob(
  url: string,
  headers?: Record<string, string>
): Promise<Blob> {
  const response = await fetch(url, {
    headers: headers || {},
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  return response.blob();
}

/**
 * Format chapter number for display
 */
export function formatChapterNumber(chapter: MangaChapter): string {
  const parts: string[] = [];
  if (chapter.volume) {
    parts.push(`Vol. ${chapter.volume}`);
  }
  if (chapter.number !== undefined) {
    parts.push(`Ch. ${chapter.number}`);
  }
  if (chapter.title) {
    parts.push(`- ${chapter.title}`);
  }
  return parts.join(' ') || 'Oneshot';
}

/**
 * Get the next chapter in a list
 */
export function getNextChapter(
  chapters: MangaChapter[],
  currentChapterId: string
): MangaChapter | null {
  const currentIndex = chapters.findIndex((c) => c.id === currentChapterId);
  if (currentIndex === -1 || currentIndex >= chapters.length - 1) return null;
  return chapters[currentIndex + 1];
}

/**
 * Get the previous chapter in a list
 */
export function getPreviousChapter(
  chapters: MangaChapter[],
  currentChapterId: string
): MangaChapter | null {
  const currentIndex = chapters.findIndex((c) => c.id === currentChapterId);
  if (currentIndex <= 0) return null;
  return chapters[currentIndex - 1];
}

/**
 * Sort chapters by chapter number (ascending)
 */
export function sortChaptersAsc(chapters: MangaChapter[]): MangaChapter[] {
  return [...chapters].sort((a, b) => {
    const aNum = typeof a.number === 'number' ? a.number : parseFloat(String(a.number)) || 0;
    const bNum = typeof b.number === 'number' ? b.number : parseFloat(String(b.number)) || 0;
    return aNum - bNum;
  });
}

/**
 * Sort chapters by chapter number (descending)
 */
export function sortChaptersDesc(chapters: MangaChapter[]): MangaChapter[] {
  return [...chapters].sort((a, b) => {
    const aNum = typeof a.number === 'number' ? a.number : parseFloat(String(a.number)) || 0;
    const bNum = typeof b.number === 'number' ? b.number : parseFloat(String(b.number)) || 0;
    return bNum - aNum;
  });
}

/**
 * Create a reference ID for storing manga in watchlist
 * Format: provider:mangaId
 */
export function createMangaRefId(mangaId: string, provider: MangaProviderName): string {
  return createRefId(provider, mangaId);
}

/**
 * Parse a reference ID to get provider and manga ID
 */
export function parseMangaRefId(refId: string): { provider: MangaProviderName; mangaId: string } | null {
  const parsed = parseRefId(refId);
  if (!parsed) return null;
  
  return { 
    provider: parsed.source as MangaProviderName, 
    mangaId: parsed.id 
  };
}

/**
 * Check if a refId is for a specific provider
 */
export function isProviderRefId(refId: string, provider: MangaProviderName): boolean {
  return isSourceRefId(refId, provider);
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: MangaProviderName): string {
  const names: Record<MangaProviderName, string> = {
    mangadex: 'MangaDex',
    mangahere: 'MangaHere',
    mangapill: 'MangaPill',
    comick: 'ComicK',
    mangareader: 'MangaReader',
    asurascans: 'AsuraScans',
    'anilist-manga': 'AniList',
  };
  return names[provider] || provider;
}

// Default provider
export const DEFAULT_PROVIDER: MangaProviderName = 'mangadex';

// ============ ChapterInfo compatibility ============

// Re-export ChapterInfo type compatibility function
import { ChapterInfo } from './mangadexTypes';

/**
 * Format chapter number for display (ChapterInfo version)
 */
export function formatChapterInfo(chapter: ChapterInfo): string {
  const parts: string[] = [];
  if (chapter.volume) {
    parts.push(`Vol. ${chapter.volume}`);
  }
  if (chapter.chapter) {
    parts.push(`Ch. ${chapter.chapter}`);
  }
  if (chapter.title) {
    parts.push(`- ${chapter.title}`);
  }
  return parts.join(' ') || 'Oneshot';
}

/**
 * Get all chapters for a manga (fetches manga info and returns chapters)
 */
export async function getAllChapters(
  mangaId: string,
  provider: MangaProviderName = 'mangadex'
): Promise<ChapterInfo[]> {
  const mangaInfo = await getMangaInfo(mangaId, provider);
  const chapters = mangaInfo.chapters || [];
  
  // Convert MangaChapter to ChapterInfo format
  return chapters.map(ch => ({
    id: ch.id,
    title: ch.title || null,
    volume: ch.volume || null,
    chapter: String(ch.number),
    pages: ch.pages || 0,
    translatedLanguage: 'en',
    scanlationGroup: null,
    publishedAt: ch.releaseDate || new Date().toISOString(),
    externalUrl: ch.url || null,
  }));
}

// ============ Chapter Page URL Resolution ============

// Import mediaSearch for external chapter handling
import * as mediaSearch from './mediaSearch';

/**
 * Result of resolving chapter page URLs
 */
export interface ChapterPageUrlsResult {
  urls: string[];
  headers: (Record<string, string> | undefined)[];
  isMangaPlus: boolean;
  isExternal: boolean;
  externalMessage?: string;
}

/**
 * Helper to proxy image URLs through our server to bypass hotlink protection
 */
export function proxyImageUrl(url: string): string {
  // Don't proxy blob URLs or already-proxied URLs
  if (url.startsWith('blob:') || url.startsWith('/api/')) {
    return url;
  }
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

/**
 * Get chapter page URLs for reading or downloading.
 * Handles MangaDex, MangaPlus, and other providers uniformly.
 * 
 * @param chapterId - The chapter ID to fetch pages for
 * @param provider - The manga provider (defaults to 'mangadex')
 * @returns ChapterPageUrlsResult with URLs and metadata
 * @throws Error if chapter cannot be loaded
 */
export async function getChapterPageUrls(
  chapterId: string,
  provider: MangaProviderName = 'mangadex'
): Promise<ChapterPageUrlsResult> {
  // For MangaDex provider, use the external chapter info endpoint
  // This handles MangaPlus external URLs and regular MangaDex chapters
  if (provider === 'mangadex') {
    const chapterInfo = await mediaSearch.getExternalChapterInfo(chapterId);
    
    if (!chapterInfo) {
      throw new Error('Failed to fetch chapter info');
    }
    
    if (chapterInfo.type === 'external') {
      // Non-MangaPlus external URL - not supported for in-app reading
      return {
        urls: [],
        headers: [],
        isMangaPlus: false,
        isExternal: true,
        externalMessage: chapterInfo.message || 'This chapter is only available on an external website',
      };
    }
    
    if (chapterInfo.type === 'mangaplus') {
      // MangaPlus chapter - build proxy URLs
      const mangaPlusPages = chapterInfo.pages as mediaSearch.MangaPlusPageInfo[];
      const urls = mangaPlusPages.map(p => 
        mediaSearch.getMangaPlusImageUrl(p.url, p.encryptionKey)
      );
      return {
        urls,
        headers: mangaPlusPages.map(() => undefined),
        isMangaPlus: true,
        isExternal: false,
      };
    }
    
    // Regular MangaDex chapter
    const mangaDexPages = chapterInfo.pages as mediaSearch.MangaDexPageInfo[];
    const urls = mangaDexPages.map(p => proxyImageUrl(p.img));
    return {
      urls,
      headers: mangaDexPages.map(() => undefined),
      isMangaPlus: false,
      isExternal: false,
    };
  }
  
  // Other providers - use unified manga service
  const chapterPages = await getChapterPages(chapterId, provider);
  const urls = chapterPages.pages.map(p => proxyImageUrl(p.img));
  const headers = chapterPages.pages.map(p => p.headerForImage);
  
  return {
    urls,
    headers,
    isMangaPlus: false,
    isExternal: false,
  };
}
