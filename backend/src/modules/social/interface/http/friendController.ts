import type { NextFunction, Request, Response } from 'express';
import { requireAuthenticatedUser } from '../../../../shared/interface/http/requireAuthenticatedUser.js';
import { socialApplication } from '../../composition/createSocialApplication.js';
import type { GroupedFriendListFilters, MediaTypeFilter, SortBy } from '../../application/dto/social.js';

export async function getFollowing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const friends = await socialApplication.getFollowing({ userId: user.id });
    res.json(friends);
  } catch (error) {
    next(error);
  }
}

export async function getFollowers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const followers = await socialApplication.getFollowers({ userId: user.id });
    res.json(followers);
  } catch (error) {
    next(error);
  }
}

export async function follow(req: Request<{ userId: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await socialApplication.followUser({ followerId: user.id, followingId: req.params.userId });
    res.status(201).json({ message: 'Successfully followed user' });
  } catch (error) {
    next(error);
  }
}

export async function unfollow(req: Request<{ userId: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await socialApplication.unfollowUser({ followerId: user.id, followingId: req.params.userId });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getFriendList(req: Request<{ userId: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const friendList = await socialApplication.getFriendList({ userId: user.id, friendId: req.params.userId });
    res.json(friendList);
  } catch (error) {
    next(error);
  }
}

export async function getGroupedFriendList(
  req: Request<{ userId: string }, unknown, unknown, { mediaTypeFilter?: string; statusPages?: string; limit?: string; sortBy?: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    let statusPages: GroupedFriendListFilters['statusPages'];

    if (req.query.statusPages) {
      try {
        statusPages = JSON.parse(req.query.statusPages) as GroupedFriendListFilters['statusPages'];
      } catch {
        res.status(400).json({ error: 'Invalid statusPages format' });
        return;
      }
    }

    const validSortBy: SortBy[] = ['status', 'title', 'rating', 'updatedAt', 'createdAt'];
    const sortBy = req.query.sortBy && validSortBy.includes(req.query.sortBy as SortBy)
      ? req.query.sortBy as SortBy
      : undefined;

    const filters: GroupedFriendListFilters = {
      mediaTypeFilter: req.query.mediaTypeFilter as MediaTypeFilter | undefined,
      statusPages,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
      sortBy,
    };

    const friendList = await socialApplication.getGroupedFriendList({
      userId: user.id,
      friendId: req.params.userId,
      filters,
    });
    res.json(friendList);
  } catch (error) {
    next(error);
  }
}

export async function searchUsers(
  req: Request<unknown, unknown, unknown, { q: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const users = await socialApplication.searchUsers({ query: req.query.q, currentUserId: user.id });
    res.json(users);
  } catch (error) {
    next(error);
  }
}
