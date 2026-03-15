import type { NextFunction, Request, Response } from 'express';
import { catalogApplication } from '../../composition/createCatalogApplication.js';
import type { SearchCategory } from '../../../../services/mediaSearchService.js';

interface SearchQuery {
  q?: string;
  category?: string;
  year?: string;
  includeAdult?: string;
  provider?: string;
  page?: string;
  perPage?: string;
}

export async function search(
  req: Request<unknown, unknown, unknown, SearchQuery>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { q, category = 'all', year, includeAdult, provider, page, perPage } = req.query;

    if (!q || !q.trim()) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const validCategories = ['all', 'tv', 'movie', 'anime', 'manga', 'book', 'lightnovel', 'comic', 'game'];
    const validCategory = validCategories.includes(category) ? (category as SearchCategory) : 'all';

    const results = await catalogApplication.searchCatalog({
      query: q,
      category: validCategory,
      options: {
        year,
        includeAdult: includeAdult === 'true',
        provider: provider as any,
        page: page ? parseInt(page, 10) : undefined,
        perPage: perPage ? parseInt(perPage, 10) : undefined,
      },
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getProviders(
  req: Request<unknown, unknown, unknown, { category?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const providers = catalogApplication.getCatalogProviders({ category: req.query.category as SearchCategory | undefined });
    res.json(providers);
  } catch (error) {
    next(error);
  }
}

export async function searchProvider(
  req: Request<{ provider: string }, unknown, unknown, SearchQuery>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { provider } = req.params;
    const { q, page, perPage } = req.query;

    if (!q || !q.trim()) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    if (!catalogApplication.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const results = await catalogApplication.searchCatalogProvider({
      query: q,
      provider,
      options: {
        page: page ? parseInt(page, 10) : undefined,
        perPage: perPage ? parseInt(perPage, 10) : undefined,
      },
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getInfo(
  req: Request<{ provider: string; id: string }, unknown, unknown, { mediaType?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { provider, id } = req.params;
    const { mediaType } = req.query;

    if (!catalogApplication.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const info = await catalogApplication.getCatalogInfo({ id, provider, mediaType: mediaType as 'movie' | 'tv' | undefined });
    if (!info) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    res.json(info);
  } catch (error) {
    next(error);
  }
}

export async function getEpisodeSources(
  req: Request<{ provider: string; episodeId: string }, unknown, unknown, { mediaId?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { provider, episodeId } = req.params;
    const { mediaId } = req.query;

    if (!catalogApplication.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const sources = await catalogApplication.getEpisodeSources({ provider, episodeId, mediaId });
    if (!sources) {
      res.status(404).json({ error: 'Sources not found' });
      return;
    }

    res.json(sources);
  } catch (error) {
    next(error);
  }
}

export async function getEpisodeServers(
  req: Request<{ provider: string; episodeId: string }, unknown, unknown, { mediaId?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { provider, episodeId } = req.params;
    const { mediaId } = req.query;

    if (!catalogApplication.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const servers = await catalogApplication.getEpisodeServers({ provider, episodeId, mediaId });
    res.json(servers);
  } catch (error) {
    next(error);
  }
}

export async function getChapterPages(
  req: Request<{ provider: string; chapterId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { provider, chapterId } = req.params;

    if (!catalogApplication.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const pages = await catalogApplication.getChapterPages({ provider, chapterId });
    if (!pages) {
      res.status(404).json({ error: 'Chapter pages not found' });
      return;
    }

    res.json(pages);
  } catch (error) {
    next(error);
  }
}

export async function getAllTrending(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await catalogApplication.getAllTrendingCatalog());
  } catch (error) {
    next(error);
  }
}

export async function getTrendingMovies(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await catalogApplication.getTrendingMovies());
  } catch (error) {
    next(error);
  }
}

export async function getTrendingTV(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await catalogApplication.getTrendingTV());
  } catch (error) {
    next(error);
  }
}

export async function getTrendingAnime(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await catalogApplication.getTrendingAnime());
  } catch (error) {
    next(error);
  }
}

export async function getPopularAnime(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await catalogApplication.getPopularAnime());
  } catch (error) {
    next(error);
  }
}

export async function getPopularManga(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await catalogApplication.getPopularManga());
  } catch (error) {
    next(error);
  }
}

export async function getTrendingGames(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await catalogApplication.getTrendingGames());
  } catch (error) {
    next(error);
  }
}

export async function getPopularGames(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await catalogApplication.getPopularGames());
  } catch (error) {
    next(error);
  }
}
