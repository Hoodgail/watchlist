// MangaDex API TypeScript interfaces

// ============ Core Types ============

export interface MangaAttributes {
  title: Record<string, string>;
  altTitles: Record<string, string>[];
  description: Record<string, string>;
  isLocked: boolean;
  links: Record<string, string> | null;
  originalLanguage: string;
  lastVolume: string | null;
  lastChapter: string | null;
  publicationDemographic: 'shounen' | 'shoujo' | 'josei' | 'seinen' | null;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  year: number | null;
  contentRating: 'safe' | 'suggestive' | 'erotica' | 'pornographic';
  tags: MangaTag[];
  state: 'draft' | 'submitted' | 'published' | 'rejected';
  chapterNumbersResetOnNewVolume: boolean;
  availableTranslatedLanguages: string[];
  latestUploadedChapter: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface MangaTag {
  id: string;
  type: 'tag';
  attributes: {
    name: Record<string, string>;
    description: Record<string, string>;
    group: 'content' | 'format' | 'genre' | 'theme';
    version: number;
  };
}

export interface Relationship {
  id: string;
  type: 'manga' | 'chapter' | 'cover_art' | 'author' | 'artist' | 'scanlation_group' | 'user';
  related?: string;
  attributes?: any;
}

export interface Manga {
  id: string;
  type: 'manga';
  attributes: MangaAttributes;
  relationships: Relationship[];
}

export interface ChapterAttributes {
  title: string | null;
  volume: string | null;
  chapter: string | null;
  pages: number;
  translatedLanguage: string;
  uploader: string;
  externalUrl: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  publishAt: string;
  readableAt: string;
}

export interface Chapter {
  id: string;
  type: 'chapter';
  attributes: ChapterAttributes;
  relationships: Relationship[];
}

// ============ API Responses ============

export interface MangaListResponse {
  result: 'ok' | 'error';
  response: 'collection';
  data: Manga[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaResponse {
  result: 'ok' | 'error';
  response: 'entity';
  data: Manga;
}

export interface ChapterListResponse {
  result: 'ok' | 'error';
  response: 'collection';
  data: Chapter[];
  limit: number;
  offset: number;
  total: number;
}

export interface ChapterResponse {
  result: 'ok' | 'error';
  response: 'entity';
  data: Chapter;
}

export interface AggregateVolume {
  volume: string;
  count: number;
  chapters: Record<string, {
    chapter: string;
    id: string;
    others: string[];
    count: number;
  }>;
}

export interface AggregateResponse {
  result: 'ok';
  volumes: Record<string, AggregateVolume>;
}

export interface AtHomeResponse {
  result: 'ok';
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];
    dataSaver: string[];
  };
}

export interface MangaStatistics {
  rating: {
    average: number | null;
    bayesian: number;
    distribution: Record<string, number>;
  };
  follows: number;
  comments?: {
    threadId: number;
    repliesCount: number;
  };
}

export interface StatisticsResponse {
  result: 'ok';
  statistics: Record<string, MangaStatistics>;
}

export interface ErrorResponse {
  result: 'error';
  errors: Array<{
    id: string;
    status: number;
    title: string;
    detail: string | null;
    context: string | null;
  }>;
}

// ============ Helper Types ============

export interface MangaDetails {
  id: string;
  title: string;
  altTitles: string[];
  description: string;
  coverUrl: string | null;
  coverUrlSmall: string | null;
  author: string | null;
  artist: string | null;
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  year: number | null;
  contentRating: string;
  tags: { id: string; name: string; group: string }[];
  originalLanguage: string;
  availableLanguages: string[];
  lastChapter: string | null;
  lastVolume: string | null;
  demographic: string | null;
  statistics?: MangaStatistics;
}

export interface ChapterInfo {
  id: string;
  title: string | null;
  volume: string | null;
  chapter: string | null;
  pages: number;
  translatedLanguage: string;
  scanlationGroup: string | null;
  publishedAt: string;
  externalUrl: string | null;
}

export interface ChapterImages {
  baseUrl: string;
  hash: string;
  data: string[];
  dataSaver: string[];
}

export interface VolumeWithChapters {
  volume: string;
  chapters: ChapterInfo[];
}

// ============ Offline Storage Types ============

export interface OfflineManga {
  id: string;
  data: MangaDetails;
  coverBlob?: Blob;
  downloadedAt: Date;
  chaptersDownloaded: number;
}

export interface OfflineChapter {
  id: string;
  mangaId: string;
  data: ChapterInfo;
  downloadedAt: Date;
}

export interface OfflinePage {
  id: string; // chapterId-pageNumber
  chapterId: string;
  mangaId: string;
  pageNumber: number;
  imageBlob: Blob;
}

export interface DownloadProgress {
  mangaId: string;
  chapterId: string;
  currentPage: number;
  totalPages: number;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'paused';
  error?: string;
}

export interface DownloadTask {
  mangaId: string;
  mangaTitle: string;
  chapterIds: string[];
  progress: DownloadProgress[];
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'paused';
  createdAt: Date;
}

export interface ReadingProgress {
  mangaId: string;
  chapterId: string;
  page: number;
  totalPages: number;
  updatedAt: Date;
  synced: boolean;
}

export type ImageQuality = 'full' | 'dataSaver';

export type ReadingMode = 'single' | 'longStrip' | 'doublePage';

export interface ReaderSettings {
  imageQuality: ImageQuality;
  readingMode: ReadingMode;
  autoDownloadNext: number; // 0 = disabled, N = download next N chapters
}
