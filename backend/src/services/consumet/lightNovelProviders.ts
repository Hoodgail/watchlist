/**
 * Light Novel Providers - NovelUpdates
 * Note: ReadLightNovels is not available in the SDK, only NovelUpdates
 */

import { LIGHT_NOVELS } from '@consumet/extensions';
import { 
  LightNovelProviderName, 
  UnifiedSearchResult, 
  UnifiedMediaInfo, 
  UnifiedChapter,
  SearchOptions,
  PaginatedResults,
} from './types.js';

// ============ Provider Instance ============

function getNovelUpdatesProvider() {
  return new LIGHT_NOVELS.NovelUpdates();
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

function extractDescription(description: unknown): string | undefined {
  if (typeof description === 'string') return description;
  if (description && typeof description === 'object' && !Array.isArray(description)) {
    const d = description as Record<string, string>;
    return d.en || d.english || Object.values(d)[0];
  }
  return undefined;
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function safeStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return undefined;
}

// ============ Result Converters ============

function convertLightNovelResult(result: any, provider: LightNovelProviderName): UnifiedSearchResult {
  return {
    id: String(result.id),
    title: extractTitle(result.title),
    image: safeString(result.image),
    description: extractDescription(result.description),
    status: safeString(result.status),
    releaseDate: safeString(result.releaseDate) ?? safeNumber(result.releaseDate),
    rating: safeNumber(result.rating),
    genres: safeStringArray(result.genres),
    provider,
    url: safeString(result.url),
  };
}

function convertLightNovelInfo(info: any, provider: LightNovelProviderName): UnifiedMediaInfo {
  return {
    id: String(info.id),
    title: extractTitle(info.title),
    image: safeString(info.image),
    cover: safeString(info.cover),
    description: extractDescription(info.description),
    status: safeString(info.status),
    releaseDate: safeString(info.releaseDate) ?? safeNumber(info.releaseDate),
    rating: safeNumber(info.rating),
    genres: safeStringArray(info.genres),
    chapters: info.chapters?.map((ch: any): UnifiedChapter => ({
      id: String(ch.id),
      number: ch.chapterNumber ?? ch.number ?? 0,
      title: safeString(ch.title),
      releaseDate: safeString(ch.releasedDate) ?? safeString(ch.releaseDate),
      url: safeString(ch.url),
      volume: safeString(ch.volumeNumber) ?? safeString(ch.volume),
    })),
    provider,
    url: safeString(info.url),
  };
}

// ============ API Functions ============

/**
 * Search light novels using NovelUpdates
 */
export async function searchLightNovels(
  query: string,
  _providerName: LightNovelProviderName = 'novelupdates',
  options: SearchOptions = {}
): Promise<PaginatedResults<UnifiedSearchResult>> {
  try {
    const provider = getNovelUpdatesProvider();
    const result = await provider.search(query);
    
    return {
      currentPage: result.currentPage ?? 1,
      hasNextPage: result.hasNextPage ?? false,
      totalPages: result.totalPages,
      totalResults: result.totalResults,
      results: result.results?.map((r: any) => convertLightNovelResult(r, 'novelupdates')) ?? [],
    };
  } catch (error) {
    console.error(`Light novel search error:`, error);
    return {
      currentPage: 1,
      hasNextPage: false,
      results: [],
    };
  }
}

/**
 * Get light novel info
 */
export async function getLightNovelInfo(
  id: string,
  _providerName: LightNovelProviderName = 'novelupdates'
): Promise<UnifiedMediaInfo | null> {
  try {
    const provider = getNovelUpdatesProvider();
    const info = await provider.fetchLightNovelInfo(id);
    return convertLightNovelInfo(info, 'novelupdates');
  } catch (error) {
    console.error(`Light novel info error:`, error);
    return null;
  }
}

/**
 * Get chapter content
 */
export async function getChapterContent(
  chapterId: string,
  _providerName: LightNovelProviderName = 'novelupdates'
): Promise<{ content: string } | null> {
  try {
    const provider = getNovelUpdatesProvider();
    const content = await provider.fetchChapterContent(chapterId);
    return { content: (content as any).text ?? '' };
  } catch (error) {
    console.error('Chapter content error:', error);
    return null;
  }
}
