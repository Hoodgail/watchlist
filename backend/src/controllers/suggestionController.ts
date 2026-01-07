import { Request, Response, NextFunction } from 'express';
import * as suggestionService from '../services/suggestionService.js';
import type { CreateSuggestionInput } from '../utils/schemas.js';

type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'DISMISSED';

export async function createSuggestion(
  req: Request<{ userId: string }, unknown, CreateSuggestionInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const suggestion = await suggestionService.createSuggestion(
      req.user.id,
      req.params.userId,
      req.body
    );
    res.status(201).json(suggestion);
  } catch (error) {
    next(error);
  }
}

export async function getReceivedSuggestions(
  req: Request<unknown, unknown, unknown, { status?: SuggestionStatus }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const suggestions = await suggestionService.getReceivedSuggestions(
      req.user.id,
      req.query.status
    );
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
}

export async function getSentSuggestions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const suggestions = await suggestionService.getSentSuggestions(req.user.id);
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
}

export async function acceptSuggestion(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const suggestion = await suggestionService.acceptSuggestion(
      req.user.id,
      req.params.id
    );
    res.json(suggestion);
  } catch (error) {
    next(error);
  }
}

export async function dismissSuggestion(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const suggestion = await suggestionService.dismissSuggestion(
      req.user.id,
      req.params.id
    );
    res.json(suggestion);
  } catch (error) {
    next(error);
  }
}

export async function deleteSuggestion(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await suggestionService.deleteSuggestion(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
