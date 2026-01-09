import { Request, Response, NextFunction } from 'express';
import * as providerMappingService from '../services/providerMappingService.js';

/**
 * Get mapping for a specific refId and provider
 * GET /api/provider-mappings/:refId/:provider
 */
export async function getMapping(
  req: Request<{ refId: string; provider: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refId, provider } = req.params;
    
    const mapping = await providerMappingService.getMapping(
      decodeURIComponent(refId),
      provider
    );
    
    if (!mapping) {
      res.status(404).json({ error: 'Mapping not found' });
      return;
    }
    
    res.json(mapping);
  } catch (error) {
    next(error);
  }
}

/**
 * Get all mappings for a refId
 * GET /api/provider-mappings/:refId
 */
export async function getMappingsForRefId(
  req: Request<{ refId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refId } = req.params;
    
    const mappings = await providerMappingService.getMappingsForRefId(
      decodeURIComponent(refId)
    );
    
    res.json(mappings);
  } catch (error) {
    next(error);
  }
}

/**
 * Create or update a provider mapping (user-verified)
 * POST /api/provider-mappings
 * Body: { refId, provider, providerId, providerTitle }
 */
export async function createMapping(
  req: Request<unknown, unknown, {
    refId: string;
    provider: string;
    providerId: string;
    providerTitle: string;
  }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refId, provider, providerId, providerTitle } = req.body;
    
    if (!refId || !provider || !providerId || !providerTitle) {
      res.status(400).json({ error: 'Missing required fields: refId, provider, providerId, providerTitle' });
      return;
    }
    
    // User-verified mappings get confidence 1.0
    const mapping = await providerMappingService.upsertMapping(
      {
        refId,
        provider,
        providerId,
        providerTitle,
        confidence: 1.0,
      },
      req.user?.id
    );
    
    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
}

/**
 * Create an auto-matched mapping (called internally, lower confidence)
 * POST /api/provider-mappings/auto
 * Body: { refId, provider, providerId, providerTitle, confidence }
 */
export async function createAutoMapping(
  req: Request<unknown, unknown, {
    refId: string;
    provider: string;
    providerId: string;
    providerTitle: string;
    confidence: number;
  }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refId, provider, providerId, providerTitle, confidence } = req.body;
    
    if (!refId || !provider || !providerId || !providerTitle) {
      res.status(400).json({ error: 'Missing required fields: refId, provider, providerId, providerTitle' });
      return;
    }
    
    const mapping = await providerMappingService.createAutoMapping({
      refId,
      provider,
      providerId,
      providerTitle,
      confidence: confidence ?? 0.5,
    });
    
    if (!mapping) {
      // Higher confidence mapping already exists
      res.status(200).json({ message: 'Higher confidence mapping already exists' });
      return;
    }
    
    res.status(201).json(mapping);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a mapping
 * DELETE /api/provider-mappings/:refId/:provider
 */
export async function deleteMapping(
  req: Request<{ refId: string; provider: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refId, provider } = req.params;
    
    await providerMappingService.deleteMapping(
      decodeURIComponent(refId),
      provider
    );
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
