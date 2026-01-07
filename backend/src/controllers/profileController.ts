import { Request, Response, NextFunction } from 'express';
import * as profileService from '../services/profileService.js';

export async function getPublicProfile(
  req: Request<{ username: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username } = req.params;
    const requesterId = req.user?.id;
    
    const profile = await profileService.getPublicProfile(username, requesterId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function updatePrivacySettings(
  req: Request<unknown, unknown, { isPublic: boolean }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { isPublic } = req.body;
    const result = await profileService.updatePrivacySettings(req.user.id, isPublic);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPrivacySettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await profileService.getUserPrivacySettings(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}
