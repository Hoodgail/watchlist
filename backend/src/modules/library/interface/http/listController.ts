import type { NextFunction, Request, Response } from 'express';
import type { MediaStatus, MediaType } from '@prisma/client';
import type { CreateMediaItemInput, UpdateMediaItemInput } from '../../../../utils/schemas.js';
import type { MediaTypeFilter, SortByOption } from '../../../../services/listService.js';
import { libraryApplication } from '../../composition/createLibraryApplication.js';
import { requireAuthenticatedUser } from '../../../../shared/interface/http/requireAuthenticatedUser.js';

export async function getList(
  req: Request<unknown, unknown, unknown, {
    type?: MediaType;
    status?: MediaStatus;
    sortBy?: SortByOption;
    search?: string;
    page?: string;
    limit?: string;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const result = await libraryApplication.getUserList({
      userId: user.id,
      filters: {
        type: req.query.type,
        status: req.query.status,
        sortBy: req.query.sortBy,
        search: req.query.search,
        page: req.query.page ? parseInt(req.query.page, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      },
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getGroupedList(
  req: Request<unknown, unknown, unknown, {
    type?: MediaType;
    mediaTypeFilter?: MediaTypeFilter;
    search?: string;
    limit?: string;
    statusPages?: string;
  }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);

    let statusPages: Partial<Record<MediaStatus, number>> | undefined;
    if (req.query.statusPages) {
      try {
        statusPages = JSON.parse(req.query.statusPages);
      } catch {
        res.status(400).json({ error: 'Invalid statusPages format' });
        return;
      }
    }

    const result = await libraryApplication.getGroupedUserList({
      userId: user.id,
      filters: {
        type: req.query.type,
        mediaTypeFilter: req.query.mediaTypeFilter,
        search: req.query.search,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
        statusPages,
      },
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getItem(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const item = await libraryApplication.getMediaItem({ userId: user.id, itemId: req.params.id });
    res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function createItem(
  req: Request<unknown, unknown, CreateMediaItemInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const item = await libraryApplication.createMediaItem({ userId: user.id, input: req.body });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

export async function updateItem(
  req: Request<{ id: string }, unknown, UpdateMediaItemInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const item = await libraryApplication.updateMediaItem({
      userId: user.id,
      itemId: req.params.id,
      input: req.body,
    });
    res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function deleteItem(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await libraryApplication.deleteMediaItem({ userId: user.id, itemId: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getStatusesByRefIds(
  req: Request<unknown, unknown, { refIds: string[] }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const { refIds } = req.body;

    if (!Array.isArray(refIds)) {
      res.status(400).json({ error: 'refIds must be an array' });
      return;
    }

    const statuses = await libraryApplication.getStatusesByRefIds({ userId: user.id, refIds });
    res.json(statuses);
  } catch (error) {
    next(error);
  }
}
