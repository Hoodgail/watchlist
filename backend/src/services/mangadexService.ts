const MANGADEX_API_BASE = 'https://api.mangadex.org';

// ============ Types ============

interface MangaDexMangaAttributes {
  title: { [key: string]: string };
  altTitles?: { [key: string]: string }[];
  description?: { [key: string]: string };
  year?: number | null;
  status?: string;
  contentRating?: string;
  tags?: {
    id: string;
    type: string;
    attributes: { name: { [key: string]: string } };
  }[];
}

interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: {
    fileName?: string;
    volume?: string | null;
  };
}

interface MangaDexManga {
  id: string;
  type: 'manga';
  attributes: MangaDexMangaAttributes;
  relationships: MangaDexRelationship[];
}

interface MangaDexChapterAttributes {
  volume: string | null;
  chapter: string | null;
  title: string | null;
  translatedLanguage: string;
  pages: number;
  publishAt: string;
}

interface MangaDexChapter {
  id: string;
  type: 'chapter';
  attributes: MangaDexChapterAttributes;
  relationships: MangaDexRelationship[];
}

interface MangaDexSearchResponse {
  result: string;
  response: string;
  data: MangaDexManga[];
  limit: number;
  offset: number;
  total: number;
}

interface MangaDexMangaResponse {
  result: string;
  response: string;
  data: MangaDexManga;
}

interface MangaDexChapterListResponse {
  result: string;
  response: string;
  data: MangaDexChapter[];
  limit: number;
  offset: number;
  total: number;
}

interface MangaDexAggregateResponse {
  result: string;
  volumes: {
    [volume: string]: {
      volume: string;
      count: number;
      chapters: {
        [chapter: string]: {
          chapter: string;
          id: string;
          count: number;
        };
      };
    };
  };
}

interface MangaDexAtHomeResponse {
  result: string;
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

// ============ Exported Types ============

export interface MangaSearchResult {
  id: string;
  title: string;
  altTitles?: string[];
  description?: string;
  coverUrl?: string;
  year?: number;
  status?: string;
  contentRating?: string;
  tags?: string[];
}

export interface MangaDetails extends MangaSearchResult {
  totalChapters: number;
  lastChapter?: string;
  lastVolume?: string;
}

export interface ChapterInfo {
  id: string;
  volume: string | null;
  chapter: string | null;
  title: string | null;
  language: string;
  pages: number;
  publishAt: string;
}

export interface ChapterPages {
  baseUrl: string;
  hash: string;
  data: string[];
  dataSaver: string[];
}

// ============ Helper Functions ============

function getPreferredTitle(titleObj: { [key: string]: string }): string {
  // Prefer English, then romanized Japanese, then any available
  return titleObj['en'] || titleObj['ja-ro'] || titleObj['ja'] || Object.values(titleObj)[0] || 'Unknown';
}

function getPreferredDescription(descObj?: { [key: string]: string }): string | undefined {
  if (!descObj) return undefined;
  return descObj['en'] || Object.values(descObj)[0];
}

function getCoverUrl(manga: MangaDexManga): string | undefined {
  const coverRel = manga.relationships.find(r => r.type === 'cover_art');
  if (coverRel?.attributes?.fileName) {
    return `https://uploads.mangadex.org/covers/${manga.id}/${coverRel.attributes.fileName}.256.jpg`;
  }
  return undefined;
}

// ============ Service Functions ============

export async function searchManga(
  query: string,
  limit: number = 10,
  offset: number = 0,
  contentRating: string[] = ['safe', 'suggestive']
): Promise<{ results: MangaSearchResult[]; total: number }> {
  const params = new URLSearchParams({
    title: query,
    limit: String(limit),
    offset: String(offset),
    'includes[]': 'cover_art',
    'order[relevance]': 'desc',
  });

  contentRating.forEach(rating => params.append('contentRating[]', rating));

  const response = await fetch(`${MANGADEX_API_BASE}/manga?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`MangaDex search failed: ${response.status}`);
  }

  const data = await response.json() as MangaDexSearchResponse;

  const results: MangaSearchResult[] = data.data.map(manga => ({
    id: manga.id,
    title: getPreferredTitle(manga.attributes.title),
    altTitles: manga.attributes.altTitles?.map(t => Object.values(t)[0]).filter(Boolean),
    description: getPreferredDescription(manga.attributes.description),
    coverUrl: getCoverUrl(manga),
    year: manga.attributes.year ?? undefined,
    status: manga.attributes.status,
    contentRating: manga.attributes.contentRating,
    tags: manga.attributes.tags?.map(t => t.attributes.name['en'] || Object.values(t.attributes.name)[0]).filter(Boolean),
  }));

  return { results, total: data.total };
}

export async function getMangaById(id: string): Promise<MangaDetails> {
  const params = new URLSearchParams({
    'includes[]': 'cover_art',
  });

  const [mangaRes, aggregateRes] = await Promise.all([
    fetch(`${MANGADEX_API_BASE}/manga/${id}?${params.toString()}`),
    fetch(`${MANGADEX_API_BASE}/manga/${id}/aggregate?translatedLanguage[]=en`),
  ]);

  if (!mangaRes.ok) {
    throw new Error(`MangaDex manga fetch failed: ${mangaRes.status}`);
  }

  const mangaData = await mangaRes.json() as MangaDexMangaResponse;
  const manga = mangaData.data;

  let totalChapters = 0;
  let lastChapter: string | undefined;
  let lastVolume: string | undefined;

  if (aggregateRes.ok) {
    const aggregateData = await aggregateRes.json() as MangaDexAggregateResponse;
    const volumes = Object.keys(aggregateData.volumes);
    
    // Count unique chapters
    const allChapters = new Set<string>();
    let maxChapterNum = 0;
    
    for (const volKey of volumes) {
      const vol = aggregateData.volumes[volKey];
      for (const chKey of Object.keys(vol.chapters)) {
        allChapters.add(chKey);
        const chNum = parseFloat(chKey);
        if (!isNaN(chNum) && chNum > maxChapterNum) {
          maxChapterNum = chNum;
          lastChapter = chKey;
          lastVolume = vol.volume !== 'none' ? vol.volume : undefined;
        }
      }
    }
    totalChapters = allChapters.size;
  }

  return {
    id: manga.id,
    title: getPreferredTitle(manga.attributes.title),
    altTitles: manga.attributes.altTitles?.map(t => Object.values(t)[0]).filter(Boolean),
    description: getPreferredDescription(manga.attributes.description),
    coverUrl: getCoverUrl(manga),
    year: manga.attributes.year ?? undefined,
    status: manga.attributes.status,
    contentRating: manga.attributes.contentRating,
    tags: manga.attributes.tags?.map(t => t.attributes.name['en'] || Object.values(t.attributes.name)[0]).filter(Boolean),
    totalChapters,
    lastChapter,
    lastVolume,
  };
}

export async function getMangaChapters(
  mangaId: string,
  language: string = 'en',
  limit: number = 100,
  offset: number = 0
): Promise<{ chapters: ChapterInfo[]; total: number }> {
  const params = new URLSearchParams({
    manga: mangaId,
    limit: String(limit),
    offset: String(offset),
    'translatedLanguage[]': language,
    'order[chapter]': 'asc',
    'includes[]': 'scanlation_group',
  });

  const response = await fetch(`${MANGADEX_API_BASE}/chapter?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`MangaDex chapters fetch failed: ${response.status}`);
  }

  const data = await response.json() as MangaDexChapterListResponse;

  const chapters: ChapterInfo[] = data.data.map(ch => ({
    id: ch.id,
    volume: ch.attributes.volume,
    chapter: ch.attributes.chapter,
    title: ch.attributes.title,
    language: ch.attributes.translatedLanguage,
    pages: ch.attributes.pages,
    publishAt: ch.attributes.publishAt,
  }));

  return { chapters, total: data.total };
}

export async function getChapterPages(chapterId: string): Promise<ChapterPages> {
  const response = await fetch(`${MANGADEX_API_BASE}/at-home/server/${chapterId}`);

  if (!response.ok) {
    throw new Error(`MangaDex chapter pages fetch failed: ${response.status}`);
  }

  const data = await response.json() as MangaDexAtHomeResponse;

  return {
    baseUrl: data.baseUrl,
    hash: data.chapter.hash,
    data: data.chapter.data,
    dataSaver: data.chapter.dataSaver,
  };
}
