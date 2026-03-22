import type { NextFunction, Request, Response } from 'express';
import { socialApplication } from '../../composition/createSocialApplication.js';
import { requireAuthenticatedUser } from '../../../../shared/interface/http/requireAuthenticatedUser.js';

export async function getPublicProfile(
  req: Request<{ username: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await socialApplication.getPublicProfile({
      username: req.params.username,
      requesterId: req.user?.id,
    });
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function updatePrivacySettings(
  req: Request<unknown, unknown, { isPublic: boolean }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const result = await socialApplication.updatePrivacySettings({ userId: user.id, isPublic: req.body.isPublic });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPrivacySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const result = await socialApplication.getUserPrivacySettings({ userId: user.id });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
