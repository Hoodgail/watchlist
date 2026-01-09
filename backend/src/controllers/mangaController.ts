import { Request, Response, NextFunction } from 'express';
import * as consumetService from '../services/consumetService.js';
import * as mangaplusService from '../services/mangaplusService.js';
import { MangaProviderName } from '../services/consumet/types.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

// MangaDex API base URL
const MANGADEX_API_BASE = 'https://api.mangadex.org';

// Valid manga providers (pure manga sources)
const MANGA_PROVIDERS: MangaProviderName[] = [
  'mangadex',
  'mangahere',
  'mangapill',
  'comick',
  'mangareader',
  'asurascans',
];

// Meta providers that support manga (for search and info only)
const META_MANGA_PROVIDERS: ('anilist-manga')[] = [
  'anilist-manga',
];

// All valid providers for manga operations
type ValidMangaProvider = MangaProviderName | 'anilist-manga';
const ALL_VALID_PROVIDERS: ValidMangaProvider[] = [
  ...MANGA_PROVIDERS,
  ...META_MANGA_PROVIDERS,
];

function validateProvider(provider: string | undefined): ValidMangaProvider {
  if (!provider) return 'mangadex';
  if (!ALL_VALID_PROVIDERS.includes(provider as ValidMangaProvider)) {
    throw new BadRequestError(`Invalid provider. Valid options: ${ALL_VALID_PROVIDERS.join(', ')}`);
  }
  return provider as ValidMangaProvider;
}

/**
 * Search manga across any provider
 * GET /api/manga/search?q=<query>&provider=mangadex&page=1
 */
export async function searchManga(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { q, provider, page } = req.query;

    if (!q || typeof q !== 'string') {
      throw new BadRequestError('Query parameter "q" is required');
    }

    const validProvider = validateProvider(provider as string | undefined);
    const pageNum = page ? parseInt(page as string, 10) : 1;

    const results = await consumetService.search(q, validProvider, { page: pageNum });

    res.json({
      provider: validProvider,
      ...results,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get manga info from any provider
 * GET /api/manga/:provider/:id
 */
export async function getMangaInfo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider, id } = req.params;

    if (!id) {
      throw new BadRequestError('Manga ID is required');
    }

    const validProvider = validateProvider(provider);

    const info = await consumetService.getInfo(id, validProvider);

    if (!info) {
      res.status(404).json({ error: 'Manga not found' });
      return;
    }

    res.json({
      ...info,
      provider: validProvider,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get chapter pages from any provider
 * GET /api/manga/:provider/chapter/:chapterId/pages
 */
export async function getChapterPages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider, chapterId } = req.params;

    if (!chapterId) {
      throw new BadRequestError('Chapter ID is required');
    }

    const validProvider = validateProvider(provider);

    const pages = await consumetService.getChapterPages(chapterId, validProvider);

    if (!pages) {
      res.status(404).json({ error: 'Chapter not found' });
      return;
    }

    res.json({
      provider: validProvider,
      ...pages,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get popular manga (uses MangaDex)
 * GET /api/manga/popular?page=1&perPage=20
 */
export async function getPopularManga(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { page, perPage } = req.query;

    const pageNum = page ? parseInt(page as string, 10) : 1;
    const perPageNum = perPage ? Math.min(parseInt(perPage as string, 10), 50) : 20;

    const results = await consumetService.getPopularManga(pageNum, perPageNum);

    res.json(results);
  } catch (error) {
    next(error);
  }
}

/**
 * Get latest updated manga (uses MangaDex)
 * GET /api/manga/latest?page=1&perPage=20
 */
export async function getLatestManga(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { page, perPage } = req.query;

    const pageNum = page ? parseInt(page as string, 10) : 1;
    const perPageNum = perPage ? Math.min(parseInt(perPage as string, 10), 50) : 20;

    const results = await consumetService.getLatestManga(pageNum, perPageNum);

    res.json(results);
  } catch (error) {
    next(error);
  }
}

/**
 * Get list of available providers
 * GET /api/manga/providers
 */
export async function getProviders(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const providerDisplayNames: Record<string, string> = {
    'mangadex': 'MangaDex',
    'comick': 'ComicK',
    'mangapill': 'MangaPill',
    'mangahere': 'MangaHere',
    'mangareader': 'MangaReader',
    'asurascans': 'AsuraScans',
    'anilist-manga': 'AniList',
  };

  res.json({
    providers: ALL_VALID_PROVIDERS.map(provider => ({
      id: provider,
      name: providerDisplayNames[provider] || provider.charAt(0).toUpperCase() + provider.slice(1),
      isDefault: provider === 'mangadex',
      supportsPaginatedChapters: consumetService.supportsPaginatedChapters(provider as MangaProviderName),
    })),
  });
}

/**
 * Get paginated chapters for a manga (for providers that support it)
 * GET /api/manga/:provider/:id/chapters?page=1&limit=60&lang=en
 */
export async function getChaptersPaginated(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider, id } = req.params;
    const { page, limit, lang } = req.query;

    if (!id) {
      throw new BadRequestError('Manga ID is required');
    }

    const validProvider = validateProvider(provider);
    
    // Check if provider supports paginated chapters
    if (!consumetService.supportsPaginatedChapters(validProvider as MangaProviderName)) {
      throw new BadRequestError(
        `Provider ${validProvider} does not support paginated chapter fetching. ` +
        `Chapters are included in the manga info response. ` +
        `Supported providers: comick`
      );
    }

    const pageNum = page ? parseInt(page as string, 10) : 1;
    const limitNum = limit ? Math.min(parseInt(limit as string, 10), 100) : 60;
    const language = (lang as string) || 'en';

    const result = await consumetService.getChaptersPaginated(
      id,
      validProvider as MangaProviderName,
      pageNum,
      limitNum,
      language
    );

    res.json({
      provider: validProvider,
      mangaId: id,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

// ============ MangaDex External Chapter Handling ============

interface MangaDexChapterResponse {
  result: string;
  response: string;
  data: {
    id: string;
    type: string;
    attributes: {
      volume: string | null;
      chapter: string | null;
      title: string | null;
      translatedLanguage: string;
      externalUrl: string | null;
      isUnavailable: boolean;
      publishAt: string;
      readableAt: string;
      createdAt: string;
      updatedAt: string;
      version: number;
      pages: number;
    };
    relationships: Array<{
      id: string;
      type: string;
    }>;
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

/**
 * Get chapter details from MangaDex API
 */
async function getMangaDexChapterDetails(chapterId: string): Promise<MangaDexChapterResponse | null> {
  try {
    const response = await fetch(`${MANGADEX_API_BASE}/chapter/${chapterId}`);
    if (!response.ok) return null;
    return await response.json() as MangaDexChapterResponse;
  } catch (error) {
    console.error('[MangaDex] Failed to fetch chapter details:', error);
    return null;
  }
}

/**
 * Get chapter pages from MangaDex at-home server
 */
async function getMangaDexAtHomePages(chapterId: string): Promise<MangaDexAtHomeResponse | null> {
  try {
    const response = await fetch(`${MANGADEX_API_BASE}/at-home/server/${chapterId}`);
    if (!response.ok) return null;
    return await response.json() as MangaDexAtHomeResponse;
  } catch (error) {
    console.error('[MangaDex] Failed to fetch at-home pages:', error);
    return null;
  }
}

/**
 * Get external chapter page info (for MangaPlus chapters)
 * GET /api/manga/external/chapter/:chapterId/info
 * 
 * Returns page metadata including URLs and encryption keys for MangaPlus,
 * or regular MangaDex page URLs for native chapters.
 */
export async function getExternalChapterInfo(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chapterId } = req.params;

    if (!chapterId) {
      throw new BadRequestError('Chapter ID is required');
    }

    // First, get chapter details from MangaDex
    const chapterDetails = await getMangaDexChapterDetails(chapterId);
    
    if (!chapterDetails || chapterDetails.result !== 'ok') {
      throw new NotFoundError('Chapter not found');
    }

    const { externalUrl, isUnavailable } = chapterDetails.data.attributes;

    // Check if this is an external MangaPlus chapter
    if (externalUrl && mangaplusService.isMangaPlusUrl(externalUrl)) {
      // Get MangaPlus page info
      const pages = await mangaplusService.getMangaPlusChapterPages(externalUrl);
      
      res.json({
        type: 'mangaplus',
        chapterId,
        externalUrl,
        pages: pages.map((p, index) => ({
          page: index + 1,
          url: p.url,
          encryptionKey: p.encryptionKey,
        })),
      });
      return;
    }

    // Check if chapter has a non-MangaPlus external URL
    if (externalUrl) {
      res.json({
        type: 'external',
        chapterId,
        externalUrl,
        message: 'This chapter is only available on an external website',
      });
      return;
    }

    // Check if chapter is unavailable
    if (isUnavailable) {
      throw new NotFoundError('This chapter is not available');
    }

    // Regular MangaDex chapter - get pages from at-home server
    const atHomeData = await getMangaDexAtHomePages(chapterId);
    
    if (!atHomeData || atHomeData.result !== 'ok') {
      throw new NotFoundError('Failed to get chapter pages');
    }

    const { baseUrl, chapter } = atHomeData;
    
    res.json({
      type: 'mangadex',
      chapterId,
      pages: chapter.data.map((filename, index) => ({
        page: index + 1,
        img: `${baseUrl}/data/${chapter.hash}/${filename}`,
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Decrypt and serve a MangaPlus page image
 * GET /api/manga/external/mangaplus/image
 * Query params: url, key
 */
export async function getMangaPlusImage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { url, key } = req.query;

    if (!url || typeof url !== 'string') {
      throw new BadRequestError('Missing url parameter');
    }
    
    if (!key || typeof key !== 'string') {
      throw new BadRequestError('Missing key parameter');
    }

    // Validate the URL is from MangaPlus CDN
    if (!url.startsWith('https://jumpg-assets.tokyo-cdn.com/')) {
      throw new BadRequestError('Invalid image URL');
    }

    // Validate key is 128 hex characters
    if (!/^[0-9a-f]{128}$/.test(key)) {
      throw new BadRequestError('Invalid encryption key');
    }

    // Fetch the encrypted image
    const response = await fetch(url);
    
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch image' });
      return;
    }

    const buffer = await response.arrayBuffer();
    const encrypted = new Uint8Array(buffer);
    const decrypted = mangaplusService.decryptMangaPlusImage(encrypted, key);

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.set('Cross-Origin-Resource-Policy', 'cross-origin'); // Allow cross-origin embedding
    res.send(Buffer.from(decrypted));
  } catch (error) {
    next(error);
  }
}
