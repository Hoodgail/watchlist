import { Request, Response, NextFunction } from 'express';
import * as mangadexService from '../services/mangadexService.js';
import { BadRequestError } from '../utils/errors.js';

export async function searchManga(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { q, limit, offset, contentRating } = req.query;

    if (!q || typeof q !== 'string') {
      throw new BadRequestError('Query parameter "q" is required');
    }

    const parsedLimit = limit ? parseInt(limit as string, 10) : 10;
    const parsedOffset = offset ? parseInt(offset as string, 10) : 0;
    const parsedContentRating = contentRating 
      ? (Array.isArray(contentRating) ? contentRating as string[] : [contentRating as string])
      : ['safe', 'suggestive'];

    const result = await mangadexService.searchManga(
      q,
      Math.min(parsedLimit, 100),
      parsedOffset,
      parsedContentRating
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMangaById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      throw new BadRequestError('Manga ID is required');
    }

    const manga = await mangadexService.getMangaById(id);
    res.json(manga);
  } catch (error) {
    next(error);
  }
}

export async function getMangaChapters(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { language, limit, offset } = req.query;

    if (!id) {
      throw new BadRequestError('Manga ID is required');
    }

    const parsedLimit = limit ? parseInt(limit as string, 10) : 100;
    const parsedOffset = offset ? parseInt(offset as string, 10) : 0;

    const result = await mangadexService.getMangaChapters(
      id,
      (language as string) || 'en',
      Math.min(parsedLimit, 500),
      parsedOffset
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getChapterPages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { chapterId } = req.params;

    if (!chapterId) {
      throw new BadRequestError('Chapter ID is required');
    }

    const pages = await mangadexService.getChapterPages(chapterId);
    res.json(pages);
  } catch (error) {
    next(error);
  }
}
