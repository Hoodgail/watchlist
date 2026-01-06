import { Request, Response, NextFunction } from 'express';
import * as listService from '../services/listService.js';
import type { CreateMediaItemInput, UpdateMediaItemInput } from '../utils/schemas.js';
import type { MediaType, MediaStatus } from '@prisma/client';
import type { SortByOption } from '../services/listService.js';

export async function getList(
  req: Request<unknown, unknown, unknown, { type?: MediaType; status?: MediaStatus; sortBy?: SortByOption }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const items = await listService.getUserList(req.user.id, req.query);
    res.json(items);
  } catch (error) {
    next(error);
  }
}

export async function getItem(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const item = await listService.getMediaItem(req.user.id, req.params.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function createItem(
  req: Request<unknown, unknown, CreateMediaItemInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const item = await listService.createMediaItem(req.user.id, req.body);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

export async function updateItem(
  req: Request<{ id: string }, unknown, UpdateMediaItemInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const item = await listService.updateMediaItem(req.user.id, req.params.id, req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function deleteItem(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await listService.deleteMediaItem(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
