import { Request, Response, NextFunction } from 'express';
import * as mediaSearchService from '../services/mediaSearchService.js';

interface SearchQuery {
  q?: string;
  category?: string;
  year?: string;
  includeAdult?: string;
}

export async function search(
  req: Request<unknown, unknown, unknown, SearchQuery>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { q, category = 'all', year, includeAdult } = req.query;

    if (!q || !q.trim()) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const validCategory = ['all', 'tv', 'movie', 'anime', 'manga'].includes(category)
      ? (category as mediaSearchService.SearchCategory)
      : 'all';

    const results = await mediaSearchService.searchMedia(q, validCategory, {
      year: year,
      includeAdult: includeAdult === 'true',
    });

    res.json(results);
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
