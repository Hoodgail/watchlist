import type { NextFunction, Request, Response } from 'express';
import { catalogApplication } from '../../composition/createCatalogApplication.js';
import { requireAuthenticatedUser } from '../../../../shared/interface/http/requireAuthenticatedUser.js';

export async function linkSource(
  req: Request<unknown, unknown, { sourceRefId?: string; sourceId?: string; newRefId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    requireAuthenticatedUser(req);
    const { sourceRefId, sourceId, newRefId } = req.body;

    if (!newRefId || typeof newRefId !== 'string') {
      res.status(400).json({ error: 'newRefId is required' });
      return;
    }

    try {
      const alias = await catalogApplication.linkCatalogSource({ sourceRefId, sourceId, newRefId });
      res.status(201).json(alias);
    } catch (error) {
      if (error instanceof Error && error.message === 'SOURCE_NOT_FOUND') {
        res.status(404).json({ error: 'MediaSource not found for the given sourceRefId' });
        return;
      }
      if (error instanceof Error && error.message === 'SOURCE_ID_REQUIRED') {
        res.status(400).json({ error: 'Either sourceRefId or sourceId is required' });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

export async function getSourceWithAliases(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const source = await catalogApplication.getSourceWithAliases({ sourceId: req.params.id });
    res.json(source);
  } catch (error) {
    next(error);
  }
}

export async function findSourceByRefId(req: Request<{ refId: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const source = await catalogApplication.findCatalogSourceByRefId({ refId: req.params.refId });
    if (!source) {
      res.status(404).json({ error: 'MediaSource not found' });
      return;
    }
    res.json(source);
  } catch (error) {
    next(error);
  }
}

export async function removeAlias(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    requireAuthenticatedUser(req);
    await catalogApplication.removeCatalogAlias({ aliasId: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
