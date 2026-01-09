import { Request, Response, NextFunction } from 'express';
import * as friendService from '../services/friendService.js';

export async function getFollowing(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const friends = await friendService.getFollowing(req.user.id);
    res.json(friends);
  } catch (error) {
    next(error);
  }
}

export async function getFollowers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const followers = await friendService.getFollowers(req.user.id);
    res.json(followers);
  } catch (error) {
    next(error);
  }
}

export async function follow(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await friendService.followUser(req.user.id, req.params.userId);
    res.status(201).json({ message: 'Successfully followed user' });
  } catch (error) {
    next(error);
  }
}

export async function unfollow(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await friendService.unfollowUser(req.user.id, req.params.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getFriendList(
  req: Request<{ userId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const friendList = await friendService.getFriendList(req.user.id, req.params.userId);
    res.json(friendList);
  } catch (error) {
    next(error);
  }
}

export async function getGroupedFriendList(
  req: Request<{ userId: string }, unknown, unknown, {
    mediaTypeFilter?: string;
    statusPages?: string;
    limit?: string;
  }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    let statusPages: Partial<Record<string, number>> | undefined;
    if (req.query.statusPages) {
      try {
        statusPages = JSON.parse(req.query.statusPages);
      } catch {
        res.status(400).json({ error: 'Invalid statusPages format' });
        return;
      }
    }
    
    const filters: friendService.GroupedFriendListFilters = {
      mediaTypeFilter: req.query.mediaTypeFilter as friendService.MediaTypeFilter | undefined,
      statusPages,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    };
    
    const friendList = await friendService.getGroupedFriendList(req.user.id, req.params.userId, filters);
    res.json(friendList);
  } catch (error) {
    next(error);
  }
}

export async function searchUsers(
  req: Request<unknown, unknown, unknown, { q: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const users = await friendService.searchUsers(req.query.q, req.user.id);
    res.json(users);
  } catch (error) {
    next(error);
  }
}
