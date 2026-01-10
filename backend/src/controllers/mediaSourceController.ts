import { Request, Response, NextFunction } from 'express';
import * as mediaSourceService from '../services/mediaSourceService.js';

/**
 * Link a new refId as an alias to an existing MediaSource
 * POST /api/media/link
 * Body: { sourceRefId: string, newRefId: string } OR { sourceId: string, newRefId: string }
 * - sourceRefId: The refId of the existing source (e.g., "tmdb:12345")
 * - sourceId: The UUID of the existing MediaSource (alternative)
 * - newRefId: The new refId to add as an alias
 */
export async function linkSource(
  req: Request<unknown, unknown, { sourceRefId?: string; sourceId?: string; newRefId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { sourceRefId, sourceId, newRefId } = req.body;

    if (!newRefId || typeof newRefId !== 'string') {
      res.status(400).json({ error: 'newRefId is required' });
      return;
    }

    let resolvedSourceId: string;

    // Support both sourceRefId (refId like "tmdb:12345") and sourceId (UUID)
    if (sourceRefId && typeof sourceRefId === 'string') {
      // Look up the MediaSource by refId
      const existingSource = await mediaSourceService.findSourceByRefId(sourceRefId);
      if (!existingSource) {
        res.status(404).json({ error: 'MediaSource not found for the given sourceRefId' });
        return;
      }
      resolvedSourceId = existingSource.id;
    } else if (sourceId && typeof sourceId === 'string') {
      // Use the provided UUID directly
      resolvedSourceId = sourceId;
    } else {
      res.status(400).json({ error: 'Either sourceRefId or sourceId is required' });
      return;
    }

    const alias = await mediaSourceService.addAliasToSource(resolvedSourceId, newRefId);
    res.status(201).json(alias);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a MediaSource with all its aliases
 * GET /api/media/source/:id
 */
export async function getSourceWithAliases(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const source = await mediaSourceService.getSourceWithAliases(req.params.id);
    res.json(source);
  } catch (error) {
    next(error);
  }
}

/**
 * Find a MediaSource by refId (checks both primary and aliases)
 * GET /api/media/source/by-ref/:refId
 */
export async function findSourceByRefId(
  req: Request<{ refId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const source = await mediaSourceService.findSourceByRefId(req.params.refId);
    if (!source) {
      res.status(404).json({ error: 'MediaSource not found' });
      return;
    }
    res.json(source);
  } catch (error) {
    next(error);
  }
}

/**
 * Remove an alias from a MediaSource
 * DELETE /api/media/alias/:id
 */
export async function removeAlias(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await mediaSourceService.removeAlias(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
