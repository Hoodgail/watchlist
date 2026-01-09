/**
 * Manga Providers - MangaDex, ComicK, MangaPill, MangaHere, MangaReader, AsuraScans
 * Note: MangaKakalot is not available in the current SDK version
 */

import { MANGA } from '@consumet/extensions';
import type { IMangaResult, IMangaInfo, IMangaChapterPage, ISearch } from '@consumet/extensions';
import { 
  MangaProviderName, 
  UnifiedSearchResult, 
  UnifiedMediaInfo, 
  UnifiedChapter,
  UnifiedChapterPages,
  SearchOptions,
  PaginatedResults,
} from './types.js';

// ============ Provider Instances ============

type MangaProvider = InstanceType<typeof MANGA.MangaDex> | InstanceType<typeof MANGA.ComicK> | InstanceType<typeof MANGA.MangaPill> | InstanceType<typeof MANGA.MangaHere> | InstanceType<typeof MANGA.MangaReader> | InstanceType<typeof MANGA.AsuraScans>;

const providers: Partial<Record<MangaProviderName, () => MangaProvider>> = {
  mangadex: () => new MANGA.MangaDex(),
  comick: () => new MANGA.ComicK(),
  mangapill: () => new MANGA.MangaPill(),
  mangahere: () => new MANGA.MangaHere(),
  mangareader: () => new MANGA.MangaReader(),
  asurascans: () => new MANGA.AsuraScans(),
  // mangakakalot is not available in the current SDK version
};

function getProvider(name: MangaProviderName): MangaProvider {
  const factory = providers[name];
  if (!factory) {
    // Default to MangaDex if provider not found
    console.warn(`Manga provider ${name} not available, using MangaDex`);
    return new MANGA.MangaDex();
  }
  return factory();
}

// ============ Helper Functions ============

function extractTitle(title: unknown): string {
  if (typeof title === 'string') return title;
  if (title && typeof title === 'object') {
    const t = title as Record<string, string | undefined>;
    return t.english || t.romaji || t.native || 'Unknown';
  }
  return 'Unknown';
}

function extractAltTitles(title: unknown): string[] | undefined {
  if (title && typeof title === 'object' && !Array.isArray(title)) {
    const t = title as Record<string, string | undefined>;
    return [t.romaji, t.native, t.english].filter((v): v is string => !!v);
  }
  return undefined;
}

function extractDescription(description: unknown): string | undefined {
  if (typeof description === 'string') return description;
  if (description && typeof description === 'object' && !Array.isArray(description)) {
    const d = description as Record<string, string>;
    return d.en || d.english || Object.values(d)[0];
  }
  return undefined;
}

// ============ Result Converters ============

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function convertMangaResult(result: IMangaResult, provider: MangaProviderName): UnifiedSearchResult {
  return {
    id: String(result.id),
    title: extractTitle(result.title),
    altTitles: extractAltTitles(result.title),
    image: result.image,
    cover: safeString(result.cover),
    description: extractDescription(result.description),
    status: safeString(result.status),
    releaseDate: safeString(result.releaseDate as unknown),
    year: typeof result.releaseDate === 'number' ? result.releaseDate : undefined,
    rating: typeof result.rating === 'number' ? result.rating : undefined,
    genres: Array.isArray(result.genres) ? result.genres : undefined,
    totalChapters: null,
    provider,
    url: safeString(result.url),
  };
}

function convertMangaInfo(info: IMangaInfo, provider: MangaProviderName): UnifiedMediaInfo {
  return {
    id: String(info.id),
    title: extractTitle(info.title),
    altTitles: extractAltTitles(info.title),
    image: info.image,
    cover: safeString(info.cover),
    description: extractDescription(info.description),
    status: safeString(info.status),
    releaseDate: safeString(info.releaseDate as unknown),
    year: typeof info.releaseDate === 'number' ? info.releaseDate : undefined,
    rating: typeof info.rating === 'number' ? info.rating : undefined,
    genres: Array.isArray(info.genres) ? info.genres : undefined,
    totalChapters: info.chapters?.length ?? null,
    chapters: info.chapters?.map((ch): UnifiedChapter => ({
      id: String(ch.id),
      number: (ch as any).chapterNumber ?? (ch as any).number ?? 0,
      title: ch.title,
      releaseDate: safeString((ch as any).releasedDate) ?? safeString((ch as any).releaseDate),
      pages: ch.pages,
      url: safeString(ch.url),
      volume: safeString((ch as any).volumeNumber) ?? safeString((ch as any).volume),
    })),
    similar: info.recommendations?.map(r => convertMangaResult(r as IMangaResult, provider)),
    recommendations: info.recommendations?.map(r => convertMangaResult(r as IMangaResult, provider)),
    provider,
    url: safeString(info.url),
  };
}

function convertChapterPages(pages: IMangaChapterPage[], chapterId: string): UnifiedChapterPages {
  return {
    chapterId,
    pages: pages.map(p => ({
      page: p.page,
      img: p.img,
      headerForImage: p.headerForImage as Record<string, string> | undefined,
    })),
  };
}

// ============ API Functions ============

/**
 * Search manga across a specific provider
 */
export async function searchManga(
  query: string,
  providerName: MangaProviderName = 'mangadex',
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getProvider(providerName);
    const result = await provider.search(query);
    
    const searchResult = result as ISearch<IMangaResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      totalResults: searchResult.totalResults,
      results: searchResult.results?.map(r => convertMangaResult(r, providerName)) ?? [],
    };
  } catch (error) {
    console.error(`Manga search error (${providerName}):`, error);
    return {
      currentPage: 1,
      hasNextPage: false,
      results: [],
    };
  }
}

/**
 * Get manga info from a specific provider
 */
export async function getMangaInfo(
  id: string,
  providerName: MangaProviderName = 'mangadex'
): Promise<UnifiedMediaInfo | null> {
  try {
    const provider = getProvider(providerName);
    const info = await provider.fetchMangaInfo(id);
    return convertMangaInfo(info, providerName);
  } catch (error) {
    console.error(`Manga info error (${providerName}):`, error);
    return null;
  }
}

/**
 * Get chapter pages
 */
export async function getChapterPages(
  chapterId: string,
  providerName: MangaProviderName = 'mangadex'
): Promise<UnifiedChapterPages | null> {
  try {
    const provider = getProvider(providerName);
    const pages = await provider.fetchChapterPages(chapterId);
    return convertChapterPages(pages, chapterId);
  } catch (error) {
    console.error(`Chapter pages error (${providerName}):`, error);
    return null;
  }
}

// ============ MangaDex-Specific Functions ============

/**
 * Get random manga (MangaDex)
 */
export async function getRandomManga(): Promise<UnifiedMediaInfo | null> {
  try {
    const provider = new MANGA.MangaDex();
    const info = await provider.fetchRandom();
    return convertMangaInfo(info as unknown as IMangaInfo, 'mangadex');
  } catch (error) {
    console.error('Random manga error:', error);
    return null;
  }
}

/**
 * Get popular manga (MangaDex)
 */
export async function getPopularManga(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = new MANGA.MangaDex();
    const result = await provider.fetchPopular(page, perPage);
    const searchResult = result as ISearch<IMangaResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      results: searchResult.results?.map(r => convertMangaResult(r, 'mangadex')) ?? [],
    };
  } catch (error) {
    console.error('Popular manga error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get recently added manga (MangaDex)
 */
export async function getRecentlyAddedManga(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = new MANGA.MangaDex();
    const result = await provider.fetchRecentlyAdded(page, perPage);
    const searchResult = result as ISearch<IMangaResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      results: searchResult.results?.map(r => convertMangaResult(r, 'mangadex')) ?? [],
    };
  } catch (error) {
    console.error('Recently added manga error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

/**
 * Get latest updated manga (MangaDex)
 */
export async function getLatestUpdatedManga(
  page: number = 1,
  perPage: number = 20
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = new MANGA.MangaDex();
    const result = await provider.fetchLatestUpdates(page, perPage);
    const searchResult = result as ISearch<IMangaResult>;
    
    return {
      currentPage: searchResult.currentPage ?? 1,
      hasNextPage: searchResult.hasNextPage ?? false,
      totalPages: searchResult.totalPages,
      results: searchResult.results?.map(r => convertMangaResult(r, 'mangadex')) ?? [],
    };
  } catch (error) {
    console.error('Latest updated manga error:', error);
    return { currentPage: 1, hasNextPage: false, results: [] };
  }
}

// ============ Paginated Chapters (Provider-Specific) ============

// Providers that support paginated chapter fetching
export const PROVIDERS_WITH_PAGINATED_CHAPTERS: MangaProviderName[] = ['comick'];

/**
 * Check if a provider supports paginated chapter fetching
 */
export function supportsPaginatedChapters(providerName: MangaProviderName): boolean {
  return PROVIDERS_WITH_PAGINATED_CHAPTERS.includes(providerName);
}

/**
 * Result type for paginated chapters
 */
export interface PaginatedChaptersResult {
  currentPage: number;
  hasNextPage: boolean;
  totalChapters?: number;
  chapters: UnifiedChapter[];
}

/**
 * ComicK API types for chapter fetching
 */
interface ComickChapter {
  hid: string;
  chap: string;
  vol?: string;
  title?: string;
  created_at: string;
  lang: string;
  group_name?: string[];
}

interface ComickChaptersResponse {
  chapters: ComickChapter[];
  total: number;
  limit: number;
}

/**
 * Fetch paginated chapters from ComicK
 * ComicK API: GET https://api.comick.io/comic/{slug}/chapters?page={page}&limit={limit}&lang=en
 */
async function fetchComickChaptersPaginated(
  mangaId: string,
  page: number = 1,
  limit: number = 60,
  lang: string = 'en'
): Promise<PaginatedChaptersResult> {
  try {
    const url = `https://api.comick.io/comic/${mangaId}/chapters?page=${page}&limit=${limit}&lang=${lang}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`ComicK API error: ${response.status}`);
    }
    
    const data = await response.json() as ComickChaptersResponse;
    
    const chapters: UnifiedChapter[] = data.chapters.map((ch): UnifiedChapter => ({
      id: `${mangaId}/${ch.hid}-chapter-${ch.chap}-${ch.lang}`,
      number: ch.chap,
      title: ch.title,
      releaseDate: ch.created_at,
      volume: ch.vol,
    }));
    
    // Calculate if there are more pages
    const totalFetched = (page - 1) * limit + data.chapters.length;
    const hasNextPage = totalFetched < data.total;
    
    return {
      currentPage: page,
      hasNextPage,
      totalChapters: data.total,
      chapters,
    };
  } catch (error) {
    console.error('ComicK chapters fetch error:', error);
    return {
      currentPage: page,
      hasNextPage: false,
      chapters: [],
    };
  }
}

/**
 * Get paginated chapters for a manga
 * Currently only supports: comick
 * Other providers will throw an error
 */
export async function getChaptersPaginated(
  mangaId: string,
  providerName: MangaProviderName,
  page: number = 1,
  limit: number = 60,
  lang: string = 'en'
): Promise<PaginatedChaptersResult> {
  if (!supportsPaginatedChapters(providerName)) {
    throw new Error(`Provider ${providerName} does not support paginated chapter fetching. Use getMangaInfo instead.`);
  }
  
  switch (providerName) {
    case 'comick':
      return fetchComickChaptersPaginated(mangaId, page, limit, lang);
    default:
      throw new Error(`Paginated chapters not implemented for ${providerName}`);
  }
}
