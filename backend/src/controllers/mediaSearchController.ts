import { Request, Response, NextFunction } from 'express';
import * as mediaSearchService from '../services/mediaSearchService.js';
import * as consumetService from '../services/consumetService.js';
import { ProviderName } from '../services/consumet/types.js';

interface SearchQuery {
  q?: string;
  category?: string;
  year?: string;
  includeAdult?: string;
  provider?: string;
  page?: string;
  perPage?: string;
}

interface ProviderSearchParams {
  provider: string;
}

interface ProviderInfoParams {
  provider: string;
  id: string;
}

interface SourcesParams {
  provider: string;
  episodeId: string;
}

interface ChapterPagesParams {
  provider: string;
  chapterId: string;
}

export async function search(
  req: Request<unknown, unknown, unknown, SearchQuery>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { q, category = 'all', year, includeAdult, provider, page, perPage } = req.query;

    if (!q || !q.trim()) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const validCategories = ['all', 'tv', 'movie', 'anime', 'manga', 'book', 'lightnovel', 'comic'];
    const validCategory = validCategories.includes(category)
      ? (category as mediaSearchService.SearchCategory)
      : 'all';

    const results = await mediaSearchService.searchMedia(q, validCategory, {
      year: year,
      includeAdult: includeAdult === 'true',
      provider: provider as ProviderName | undefined,
      page: page ? parseInt(page) : undefined,
      perPage: perPage ? parseInt(perPage) : undefined,
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getProviders(
  req: Request<unknown, unknown, unknown, { category?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { category } = req.query;
    const providers = mediaSearchService.getProviders(
      category as mediaSearchService.SearchCategory | undefined
    );
    res.json(providers);
  } catch (error) {
    next(error);
  }
}

export async function searchProvider(
  req: Request<ProviderSearchParams, unknown, unknown, SearchQuery>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider } = req.params;
    const { q, page, perPage } = req.query;

    if (!q || !q.trim()) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    if (!mediaSearchService.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const results = await mediaSearchService.searchWithProvider(q, provider as ProviderName, {
      page: page ? parseInt(page) : undefined,
      perPage: perPage ? parseInt(perPage) : undefined,
    });

    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getInfo(
  req: Request<ProviderInfoParams, unknown, unknown, { mediaType?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider, id } = req.params;
    const { mediaType } = req.query;

    if (!mediaSearchService.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const info = await consumetService.getInfo(
      id, 
      provider as ProviderName,
      mediaType as 'movie' | 'tv' | undefined
    );

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
  req: Request<SourcesParams, unknown, unknown, { mediaId?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider, episodeId } = req.params;
    const { mediaId } = req.query;

    if (!mediaSearchService.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const sources = await consumetService.getEpisodeSources(
      episodeId,
      provider as ProviderName,
      mediaId
    );

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
  req: Request<SourcesParams, unknown, unknown, { mediaId?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider, episodeId } = req.params;
    const { mediaId } = req.query;

    if (!mediaSearchService.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const servers = await consumetService.getEpisodeServers(
      episodeId,
      provider as ProviderName,
      mediaId
    );

    res.json(servers);
  } catch (error) {
    next(error);
  }
}

export async function getChapterPages(
  req: Request<ChapterPagesParams>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { provider, chapterId } = req.params;

    if (!mediaSearchService.isValidProvider(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    const pages = await consumetService.getChapterPages(
      chapterId,
      provider as any // MangaProviderName
    );

    if (!pages) {
      res.status(404).json({ error: 'Chapter pages not found' });
      return;
    }

    res.json(pages);
  } catch (error) {
    next(error);
  }
}

export async function getAllTrending(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const results = await mediaSearchService.getAllTrending();
    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getTrendingMovies(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const results = await mediaSearchService.getTrendingMovies();
    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getTrendingTV(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const results = await mediaSearchService.getTrendingTV();
    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getTrendingAnime(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const results = await mediaSearchService.getTrendingAnime();
    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getPopularAnime(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const results = await mediaSearchService.getPopularAnime();
    res.json(results);
  } catch (error) {
    next(error);
  }
}

export async function getPopularManga(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const results = await mediaSearchService.getPopularManga();
    res.json(results);
  } catch (error) {
    next(error);
  }
}
