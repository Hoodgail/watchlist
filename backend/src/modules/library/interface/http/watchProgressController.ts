import type { NextFunction, Request, Response } from 'express';
import type { UpdateWatchProgressInput } from '../../../../utils/schemas.js';
import { libraryApplication } from '../../composition/createLibraryApplication.js';
import { requireAuthenticatedUser } from '../../../../shared/interface/http/requireAuthenticatedUser.js';

export async function updateProgress(
  req: Request<unknown, unknown, UpdateWatchProgressInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const progress = await libraryApplication.upsertWatchProgress({ userId: user.id, input: req.body });
    res.json(progress);
  } catch (error) {
    next(error);
  }
}

export async function getProgress(
  req: Request<{ mediaId: string; episodeId?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const { mediaId, episodeId } = req.params;

    if (episodeId) {
      const progress = await libraryApplication.getWatchProgressForEpisode({ userId: user.id, mediaId, episodeId });
      if (!progress) {
        res.status(404).json({ error: 'Watch progress not found' });
        return;
      }
      res.json(progress);
      return;
    }

    const progress = await libraryApplication.getWatchProgressForMedia({ userId: user.id, mediaId });
    res.json(progress);
  } catch (error) {
    next(error);
  }
}

export async function getAllProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const progress = await libraryApplication.getAllWatchProgress({ userId: user.id });
    res.json(progress);
  } catch (error) {
    next(error);
  }
}

export async function deleteProgress(
  req: Request<{ mediaId: string; episodeId?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const { mediaId, episodeId } = req.params;

    if (episodeId) {
      await libraryApplication.deleteWatchProgressForEpisode({ userId: user.id, mediaId, episodeId });
      res.status(204).send();
      return;
    }

    const result = await libraryApplication.deleteWatchProgressForMedia({ userId: user.id, mediaId });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
