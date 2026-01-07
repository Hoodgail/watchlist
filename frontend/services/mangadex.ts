// MangaDex API Service Layer
// Full implementation for manga details, chapters, and image retrieval

import {
  Manga,
  MangaResponse,
  MangaListResponse,
  Chapter,
  ChapterListResponse,
  ChapterResponse,
  AggregateResponse,
  AtHomeResponse,
  StatisticsResponse,
  MangaDetails,
  ChapterInfo,
  ChapterImages,
  VolumeWithChapters,
} from './mangadexTypes';

const MANGADEX_API_BASE = '/api/mangadex';
const COVERS_BASE = '/api/mangadex/covers';

// Rate limiting: 5 requests per second
const REQUEST_QUEUE: { resolve: () => void; timestamp: number }[] = [];
const RATE_LIMIT_MS = 200; // 5 requests per second = 200ms between requests

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

// ============ Helper Functions ============

function getPreferredTitle(titleObj: Record<string, string>): string {
  return (
    titleObj['en'] ||
    titleObj['en-us'] ||
    titleObj['ja-ro'] ||
    titleObj['ja'] ||
    Object.values(titleObj)[0] ||
    'Unknown'
  );
}

function getPreferredDescription(descObj: Record<string, string>): string {
  return (
    descObj['en'] ||
    descObj['en-us'] ||
    Object.values(descObj)[0] ||
    ''
  );
}

function getCoverUrl(mangaId: string, fileName: string | null, size?: '256' | '512'): string | null {
  if (!fileName) return null;
  const sizeStr = size ? `.${size}.jpg` : '';
  return `${COVERS_BASE}/${mangaId}/${fileName}${sizeStr}`;
}

function extractRelationship(relationships: { id: string; type: string; attributes?: any }[], type: string): any | null {
  const rel = relationships.find((r) => r.type === type);
  return rel || null;
}

function extractRelationshipName(relationships: { id: string; type: string; attributes?: any }[], type: string): string | null {
  const rel = extractRelationship(relationships, type);
  if (rel?.attributes?.name) {
    return getPreferredTitle(rel.attributes.name) || rel.attributes.name;
  }
  return null;
}

// ============ API Functions ============

/**
 * Search for manga by title
 */
export async function searchManga(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    contentRating?: ('safe' | 'suggestive' | 'erotica')[];
    includedTags?: string[];
    excludedTags?: string[];
    status?: ('ongoing' | 'completed' | 'hiatus' | 'cancelled')[];
  } = {}
): Promise<{ data: MangaDetails[]; total: number }> {
  const params = new URLSearchParams({
    title: query,
    limit: String(options.limit || 10),
    offset: String(options.offset || 0),
    'includes[]': 'cover_art',
    'order[relevance]': 'desc',
  });

  // Add includes for author/artist
  params.append('includes[]', 'author');
  params.append('includes[]', 'artist');

  // Add content ratings
  const ratings = options.contentRating || ['safe', 'suggestive'];
  ratings.forEach((r) => params.append('contentRating[]', r));

  // Add available language filter for English
  params.append('availableTranslatedLanguage[]', 'en');

  if (options.status) {
    options.status.forEach((s) => params.append('status[]', s));
  }

  if (options.includedTags) {
    options.includedTags.forEach((t) => params.append('includedTags[]', t));
  }

  if (options.excludedTags) {
    options.excludedTags.forEach((t) => params.append('excludedTags[]', t));
  }

  const response = await rateLimitedFetch(`${MANGADEX_API_BASE}/manga?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`MangaDex search failed: ${response.status}`);
  }

  const json: MangaListResponse = await response.json();

  const data = json.data.map(mangaToDetails);

  return { data, total: json.total };
}

/**
 * Get manga details by ID
 */
export async function getMangaById(mangaId: string): Promise<MangaDetails> {
  const params = new URLSearchParams();
  ['cover_art', 'author', 'artist'].forEach((inc) => params.append('includes[]', inc));

  const response = await rateLimitedFetch(
    `${MANGADEX_API_BASE}/manga/${mangaId}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch manga: ${response.status}`);
  }

  const json: MangaResponse = await response.json();

  return mangaToDetails(json.data);
}

/**
 * Get manga statistics (rating, follows)
 */
export async function getMangaStatistics(mangaId: string): Promise<StatisticsResponse['statistics'][string] | null> {
  try {
    const response = await rateLimitedFetch(`${MANGADEX_API_BASE}/statistics/manga/${mangaId}`);

    if (!response.ok) return null;

    const json: StatisticsResponse = await response.json();
    return json.statistics[mangaId] || null;
  } catch {
    return null;
  }
}

/**
 * Get chapter feed for a manga
 */
export async function getMangaChapters(
  mangaId: string,
  options: {
    limit?: number;
    offset?: number;
    translatedLanguage?: string[];
    orderByChapter?: 'asc' | 'desc';
    includeScanlationGroup?: boolean;
    includeExternalUrl?: boolean;
  } = {}
): Promise<{ data: ChapterInfo[]; total: number }> {
  const params = new URLSearchParams({
    limit: String(options.limit || 100),
    offset: String(options.offset || 0),
    'order[chapter]': options.orderByChapter || 'desc',
    'order[volume]': options.orderByChapter || 'desc',
  });

  const languages = options.translatedLanguage || ['en'];
  languages.forEach((lang) => params.append('translatedLanguage[]', lang));

  if (options.includeScanlationGroup !== false) {
    params.append('includes[]', 'scanlation_group');
  }
  
  // Include chapters with external URLs (like MangaPlus)
  if (options.includeExternalUrl !== false) {
    params.append('includeExternalUrl', '1');
  }

  // Filter content ratings
  ['safe', 'suggestive', 'erotica'].forEach((r) => params.append('contentRating[]', r));

  const response = await rateLimitedFetch(
    `${MANGADEX_API_BASE}/manga/${mangaId}/feed?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch chapters: ${response.status}`);
  }

  const json: ChapterListResponse = await response.json();

  const data = json.data.map(chapterToInfo);

  return { data, total: json.total };
}

/**
 * Get all chapters for a manga with pagination
 */
export async function getAllMangaChapters(
  mangaId: string,
  translatedLanguage: string[] = ['en']
): Promise<ChapterInfo[]> {
  const allChapters: ChapterInfo[] = [];
  let offset = 0;
  const limit = 500;
  let total = Infinity;

  while (offset < total) {
    const result = await getMangaChapters(mangaId, {
      limit,
      offset,
      translatedLanguage,
      orderByChapter: 'asc',
      includeExternalUrl: true,
    });

    allChapters.push(...result.data);
    total = result.total;
    offset += limit;
  }

  // Deduplicate by chapter number (keep first occurrence, usually best quality group)
  const seen = new Map<string, ChapterInfo>();
  for (const chapter of allChapters) {
    const key = `${chapter.volume || 'none'}-${chapter.chapter || 'none'}`;
    if (!seen.has(key)) {
      seen.set(key, chapter);
    }
  }

  return Array.from(seen.values());
}

/**
 * Get volume/chapter aggregate structure
 */
export async function getMangaAggregate(
  mangaId: string,
  translatedLanguage: string[] = ['en'],
  options: { includeUnavailable?: boolean } = {}
): Promise<VolumeWithChapters[]> {
  const params = new URLSearchParams();
  translatedLanguage.forEach((lang) => params.append('translatedLanguage[]', lang));
  
  // Include unavailable chapters (e.g., chapters from licensed manga that aren't directly hosted)
  if (options.includeUnavailable !== false) {
    params.append('groups[]', '00e03853-1b96-4f41-9542-c71b8692033b'); // Include MangaPlus group
  }

  const response = await rateLimitedFetch(
    `${MANGADEX_API_BASE}/manga/${mangaId}/aggregate?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch aggregate: ${response.status}`);
  }

  const json: AggregateResponse = await response.json();

  // Convert to structured format
  const volumes: VolumeWithChapters[] = [];

  for (const [volKey, volData] of Object.entries(json.volumes)) {
    const chapters: ChapterInfo[] = [];

    for (const [, chapData] of Object.entries(volData.chapters)) {
      chapters.push({
        id: chapData.id,
        title: null,
        volume: volData.volume,
        chapter: chapData.chapter,
        pages: 0,
        translatedLanguage: 'en',
        scanlationGroup: null,
        publishedAt: '',
        externalUrl: null,
      });
    }

    // Sort chapters numerically
    chapters.sort((a, b) => {
      const aNum = parseFloat(a.chapter || '0');
      const bNum = parseFloat(b.chapter || '0');
      return aNum - bNum;
    });

    volumes.push({
      volume: volKey === 'none' ? 'No Volume' : volKey,
      chapters,
    });
  }

  // Sort volumes numerically
  volumes.sort((a, b) => {
    if (a.volume === 'No Volume') return 1;
    if (b.volume === 'No Volume') return -1;
    return parseFloat(a.volume) - parseFloat(b.volume);
  });

  return volumes;
}

/**
 * Get chapter by ID with full details
 */
export async function getChapterById(chapterId: string): Promise<ChapterInfo> {
  const params = new URLSearchParams();
  params.append('includes[]', 'scanlation_group');
  params.append('includes[]', 'manga');

  const response = await rateLimitedFetch(
    `${MANGADEX_API_BASE}/chapter/${chapterId}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch chapter: ${response.status}`);
  }

  const json: ChapterResponse = await response.json();

  return chapterToInfo(json.data);
}

/**
 * Get chapter images from MangaDex@Home CDN
 */
export async function getChapterImages(chapterId: string): Promise<ChapterImages> {
  const response = await rateLimitedFetch(
    `${MANGADEX_API_BASE}/at-home/server/${chapterId}?forcePort443=true`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch chapter images: ${response.status}`);
  }

  const json: AtHomeResponse = await response.json();

  return {
    baseUrl: json.baseUrl,
    hash: json.chapter.hash,
    data: json.chapter.data,
    dataSaver: json.chapter.dataSaver,
  };
}

/**
 * Build full image URL from chapter images data
 */
export function buildImageUrl(
  images: ChapterImages,
  pageIndex: number,
  quality: 'full' | 'dataSaver' = 'full'
): string {
  const files = quality === 'full' ? images.data : images.dataSaver;
  const folder = quality === 'full' ? 'data' : 'data-saver';

  if (pageIndex < 0 || pageIndex >= files.length) {
    throw new Error(`Invalid page index: ${pageIndex}`);
  }

  return `${images.baseUrl}/${folder}/${images.hash}/${files[pageIndex]}`;
}

/**
 * Build all image URLs for a chapter
 */
export function buildAllImageUrls(
  images: ChapterImages,
  quality: 'full' | 'dataSaver' = 'full'
): string[] {
  const files = quality === 'full' ? images.data : images.dataSaver;
  const folder = quality === 'full' ? 'data' : 'data-saver';

  return files.map((file) => `${images.baseUrl}/${folder}/${images.hash}/${file}`);
}

/**
 * Fetch an image as a Blob (for offline storage)
 */
export async function fetchImageAsBlob(url: string): Promise<Blob> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  return response.blob();
}

// ============ Conversion Helpers ============

function mangaToDetails(manga: Manga): MangaDetails {
  const coverRel = extractRelationship(manga.relationships, 'cover_art');
  const coverFileName = coverRel?.attributes?.fileName || null;

  return {
    id: manga.id,
    title: getPreferredTitle(manga.attributes.title),
    altTitles: manga.attributes.altTitles.map((t) => Object.values(t)[0]).filter(Boolean),
    description: getPreferredDescription(manga.attributes.description),
    coverUrl: getCoverUrl(manga.id, coverFileName),
    coverUrlSmall: getCoverUrl(manga.id, coverFileName, '256'),
    author: extractRelationshipName(manga.relationships, 'author'),
    artist: extractRelationshipName(manga.relationships, 'artist'),
    status: manga.attributes.status,
    year: manga.attributes.year,
    contentRating: manga.attributes.contentRating,
    tags: manga.attributes.tags.map((tag) => ({
      id: tag.id,
      name: getPreferredTitle(tag.attributes.name),
      group: tag.attributes.group,
    })),
    originalLanguage: manga.attributes.originalLanguage,
    availableLanguages: manga.attributes.availableTranslatedLanguages,
    lastChapter: manga.attributes.lastChapter,
    lastVolume: manga.attributes.lastVolume,
    demographic: manga.attributes.publicationDemographic,
  };
}

function chapterToInfo(chapter: Chapter): ChapterInfo {
  const groupRel = extractRelationship(chapter.relationships, 'scanlation_group');

  return {
    id: chapter.id,
    title: chapter.attributes.title,
    volume: chapter.attributes.volume,
    chapter: chapter.attributes.chapter,
    pages: chapter.attributes.pages,
    translatedLanguage: chapter.attributes.translatedLanguage,
    scanlationGroup: groupRel?.attributes?.name || null,
    publishedAt: chapter.attributes.publishAt,
    externalUrl: chapter.attributes.externalUrl,
  };
}

// ============ Utility Functions ============

/**
 * Get the next chapter in a list
 */
export function getNextChapter(
  chapters: ChapterInfo[],
  currentChapterId: string
): ChapterInfo | null {
  const currentIndex = chapters.findIndex((c) => c.id === currentChapterId);
  if (currentIndex === -1 || currentIndex >= chapters.length - 1) return null;
  return chapters[currentIndex + 1];
}

/**
 * Get the previous chapter in a list
 */
export function getPreviousChapter(
  chapters: ChapterInfo[],
  currentChapterId: string
): ChapterInfo | null {
  const currentIndex = chapters.findIndex((c) => c.id === currentChapterId);
  if (currentIndex <= 0) return null;
  return chapters[currentIndex - 1];
}

/**
 * Format chapter number for display
 */
export function formatChapterNumber(chapter: ChapterInfo): string {
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
 * Get cover image URL for a manga ID and filename
 */
export function getMangaCoverUrl(mangaId: string, fileName: string, size?: '256' | '512'): string {
  const sizeStr = size ? `.${size}.jpg` : '';
  return `${COVERS_BASE}/${mangaId}/${fileName}${sizeStr}`;
}
