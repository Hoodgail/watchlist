import { Request, Response, NextFunction } from 'express';
import * as commentService from '../services/commentService.js';
import type {
  CreateCommentInput,
  UpdateCommentInput,
  GetMediaCommentsQuery,
  FeedQuery,
  ReactionInput,
  ImportExternalCommentInput,
} from '../validators/commentValidators.js';

// Create a new comment
export async function createComment(
  req: Request<unknown, unknown, CreateCommentInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const comment = await commentService.createComment(req.user.id, req.body);
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

// Get comments for a media item
export async function getMediaComments(
  req: Request<{ refId: string }, unknown, unknown, GetMediaCommentsQuery>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refId } = req.params;
    const query = req.query;

    const result = await commentService.getMediaComments(refId, query, req.user?.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// Get friend activity feed
export async function getFriendsFeed(
  req: Request<unknown, unknown, unknown, FeedQuery>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await commentService.getFriendsFeed(req.user.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// Get public feed (for Hot page)
export async function getPublicFeed(
  req: Request<unknown, unknown, unknown, FeedQuery>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await commentService.getPublicFeed(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// Get single comment with reactions
export async function getComment(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const comment = await commentService.getCommentById(req.params.id, req.user?.id);
    res.json(comment);
  } catch (error) {
    next(error);
  }
}

// Update own comment
export async function updateComment(
  req: Request<{ id: string }, unknown, UpdateCommentInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const comment = await commentService.updateComment(
      req.user.id,
      req.params.id,
      req.body
    );
    res.json(comment);
  } catch (error) {
    next(error);
  }
}

// Delete own comment
export async function deleteComment(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await commentService.deleteComment(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Add reaction to comment
export async function addReaction(
  req: Request<{ id: string }, unknown, ReactionInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const reaction = await commentService.addReaction(
      req.user.id,
      req.params.id,
      req.body.reactionType
    );
    res.status(201).json(reaction);
  } catch (error) {
    next(error);
  }
}

// Remove reaction from comment
export async function removeReaction(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await commentService.removeReaction(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Import external source comment (admin/system use)
export async function importExternalComment(
  req: Request<unknown, unknown, ImportExternalCommentInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // TODO: Add admin/system role check here
    const comment = await commentService.importExternalComment(req.body);
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}
