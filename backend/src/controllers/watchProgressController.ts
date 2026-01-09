import { Request, Response, NextFunction } from 'express';
import * as watchProgressService from '../services/watchProgressService.js';
import type { UpdateWatchProgressInput } from '../utils/schemas.js';

export async function updateProgress(
  req: Request<unknown, unknown, UpdateWatchProgressInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const progress = await watchProgressService.upsertProgress(req.user.id, req.body);
    res.json(progress);
  } catch (error) {
    next(error);
  }
}

export async function getProgress(
  req: Request<{ mediaId: string; episodeId?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { mediaId, episodeId } = req.params;

    if (episodeId) {
      // Get specific episode progress
      const progress = await watchProgressService.getProgressForEpisode(
        req.user.id,
        mediaId,
        episodeId
      );
      if (!progress) {
        res.status(404).json({ error: 'Watch progress not found' });
        return;
      }
      res.json(progress);
    } else {
      // Get all progress for media
      const progress = await watchProgressService.getProgressForMedia(req.user.id, mediaId);
      res.json(progress);
    }
  } catch (error) {
    next(error);
  }
}

export async function getAllProgress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const progress = await watchProgressService.getAllProgress(req.user.id);
    res.json(progress);
  } catch (error) {
    next(error);
  }
}

export async function deleteProgress(
  req: Request<{ mediaId: string; episodeId?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { mediaId, episodeId } = req.params;

    if (episodeId) {
      // Delete specific episode progress
      await watchProgressService.deleteProgressForEpisode(req.user.id, mediaId, episodeId);
      res.status(204).send();
    } else {
      // Delete all progress for media
      const result = await watchProgressService.deleteProgressForMedia(req.user.id, mediaId);
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
}
