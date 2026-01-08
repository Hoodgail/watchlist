import { Request, Response, NextFunction } from 'express';
import * as consumetService from '../services/consumetService.js';
import { MangaProviderName } from '../services/consumet/types.js';
import { BadRequestError } from '../utils/errors.js';

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
    })),
  });
}
