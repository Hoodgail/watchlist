import type { NextFunction, Request, Response } from 'express';
import { requireAuthenticatedUser } from '../../../../shared/interface/http/requireAuthenticatedUser.js';
import { commentsApplication } from '../../composition/createCommentsApplication.js';
import type {
  CreateCommentInput,
  FeedQuery,
  GetMediaCommentsQuery,
  ImportExternalCommentInput,
  ReactionInput,
  UpdateCommentInput,
} from './commentSchemas.js';

export async function createComment(
  req: Request<unknown, unknown, CreateCommentInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const comment = await commentsApplication.createComment({ userId: user.id, data: req.body });
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

export async function getMediaComments(req: Request<{ refId: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as GetMediaCommentsQuery;
    const result = await commentsApplication.getMediaComments({
      refId: req.params.refId,
      options: query,
      userId: req.user?.id,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getFriendsFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const query = req.query as unknown as FeedQuery;
    const result = await commentsApplication.getFriendsFeed({ userId: user.id, options: query });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPublicFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as FeedQuery;
    const result = await commentsApplication.getPublicFeed({ options: query });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getComment(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const comment = await commentsApplication.getComment({ commentId: req.params.id, userId: req.user?.id });
    res.json(comment);
  } catch (error) {
    next(error);
  }
}

export async function updateComment(
  req: Request<{ id: string }, unknown, UpdateCommentInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const comment = await commentsApplication.updateComment({
      userId: user.id,
      commentId: req.params.id,
      data: req.body,
    });
    res.json(comment);
  } catch (error) {
    next(error);
  }
}

export async function deleteComment(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await commentsApplication.deleteComment({ userId: user.id, commentId: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function addReaction(
  req: Request<{ id: string }, unknown, ReactionInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const reaction = await commentsApplication.addReaction({
      userId: user.id,
      commentId: req.params.id,
      reactionType: req.body.reactionType,
    });
    res.status(201).json(reaction);
  } catch (error) {
    next(error);
  }
}

export async function removeReaction(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await commentsApplication.removeReaction({ userId: user.id, commentId: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function importExternalComment(
  req: Request<unknown, unknown, ImportExternalCommentInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    requireAuthenticatedUser(req);
    const comment = await commentsApplication.importExternalComment({ data: req.body });
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}
