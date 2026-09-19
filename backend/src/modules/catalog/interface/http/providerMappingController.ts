import type { NextFunction, Request, Response } from 'express';
import { catalogApplication } from '../../composition/createCatalogApplication.js';

export async function getMapping(
  req: Request<{ refId: string; provider: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const mapping = await catalogApplication.getCatalogProviderMapping({ refId: req.params.refId, provider: req.params.provider, userId: req.user?.id });
    if (!mapping) {
      res.status(404).json({ error: 'Mapping not found' });
      return;
    }
    res.json(mapping);
  } catch (error) {
    next(error);
  }
}

export async function getMappingsForRefId(req: Request<{ refId: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const mappings = await catalogApplication.getCatalogProviderMappings({ refId: req.params.refId, userId: req.user?.id });
    res.json(mappings);
  } catch (error) {
    next(error);
  }
}

export async function createMapping(
  req: Request<unknown, unknown, { refId: string; provider: string; providerId: string; providerTitle: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refId, provider, providerId, providerTitle } = req.body;
    if (!refId || !provider || !providerId || !providerTitle) {
      res.status(400).json({ error: 'Missing required fields: refId, provider, providerId, providerTitle' });
      return;
    }

    const mapping = await catalogApplication.upsertCatalogProviderMapping({
      input: { refId, provider, providerId, providerTitle, confidence: 1.0 },
      userId: req.user?.id,
    });
    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
}

export async function deleteMapping(
  req: Request<{ refId: string; provider: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await catalogApplication.deleteCatalogProviderMapping({ refId: req.params.refId, provider: req.params.provider, userId: req.user?.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
