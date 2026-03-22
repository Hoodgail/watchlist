import type { NextFunction, Request, Response } from 'express';
import type { CreateSuggestionInput } from '../../../../utils/schemas.js';
import { requireAuthenticatedUser } from '../../../../shared/interface/http/requireAuthenticatedUser.js';
import { socialApplication } from '../../composition/createSocialApplication.js';
import type { SuggestionStatus } from '@prisma/client';

export async function createSuggestion(
  req: Request<{ userId: string }, unknown, CreateSuggestionInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const suggestion = await socialApplication.createSuggestion({
      fromUserId: user.id,
      toUserId: req.params.userId,
      input: req.body,
    });
    res.status(201).json(suggestion);
  } catch (error) {
    next(error);
  }
}

export async function getReceivedSuggestions(
  req: Request<unknown, unknown, unknown, { status?: SuggestionStatus }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const suggestions = await socialApplication.getReceivedSuggestions({ userId: user.id, status: req.query.status });
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
}

export async function getSentSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const suggestions = await socialApplication.getSentSuggestions({ userId: user.id });
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
}

export async function acceptSuggestion(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const suggestion = await socialApplication.acceptSuggestion({ userId: user.id, suggestionId: req.params.id });
    res.json(suggestion);
  } catch (error) {
    next(error);
  }
}

export async function dismissSuggestion(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const suggestion = await socialApplication.dismissSuggestion({ userId: user.id, suggestionId: req.params.id });
    res.json(suggestion);
  } catch (error) {
    next(error);
  }
}

export async function deleteSuggestion(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await socialApplication.deleteSuggestion({ userId: user.id, suggestionId: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
