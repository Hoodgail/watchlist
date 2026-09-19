import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors.js';
/** Shared identity links affect everyone's lists. Restrict them to explicit catalog maintainers. */
export function requireCatalogEditor(req: Request, _res: Response, next: NextFunction): void {
  const editors = (process.env.CATALOG_EDITOR_IDS ?? '').split(',').filter(Boolean);
  if (!req.user || !editors.includes(req.user.id)) return next(new ForbiddenError('Catalog editor permission required'));
  next();
}
