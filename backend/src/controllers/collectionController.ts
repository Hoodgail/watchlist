import { Request, Response, NextFunction } from 'express';
import * as collectionService from '../services/collectionService.js';

// ============================================================================
// Collection CRUD
// ============================================================================

export async function createCollection(
  req: Request<unknown, unknown, collectionService.CreateCollectionInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const collection = await collectionService.createCollection(req.user.id, req.body);
    res.status(201).json(collection);
  } catch (error) {
    next(error);
  }
}

export async function getMyCollections(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const collections = await collectionService.getMyCollections(req.user.id);
    res.json(collections);
  } catch (error) {
    next(error);
  }
}

export async function getPublicCollections(
  req: Request<unknown, unknown, unknown, { 
    page?: string; 
    limit?: string;
    sortBy?: string;
  }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const sortBy = req.query.sortBy;
    const collections = await collectionService.getPublicCollections({ userId, page, limit, sortBy });
    res.json(collections);
  } catch (error) {
    next(error);
  }
}

export async function getStarredCollections(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const collections = await collectionService.getStarredCollections(req.user.id);
    res.json(collections);
  } catch (error) {
    next(error);
  }
}

export async function getCollection(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const collection = await collectionService.getCollection(req.params.id, userId);
    res.json(collection);
  } catch (error) {
    next(error);
  }
}

export async function updateCollection(
  req: Request<{ id: string }, unknown, collectionService.UpdateCollectionInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const collection = await collectionService.updateCollection(
      req.user.id,
      req.params.id,
      req.body
    );
    res.json(collection);
  } catch (error) {
    next(error);
  }
}

export async function deleteCollection(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await collectionService.deleteCollection(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Collection Items
// ============================================================================

export async function addCollectionItem(
  req: Request<{ id: string }, unknown, collectionService.AddCollectionItemInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const item = await collectionService.addCollectionItem(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

export async function updateCollectionItem(
  req: Request<{ id: string; itemId: string }, unknown, collectionService.UpdateCollectionItemInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const item = await collectionService.updateCollectionItem(
      req.user.id,
      req.params.id,
      req.params.itemId,
      req.body
    );
    res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function removeCollectionItem(
  req: Request<{ id: string; itemId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await collectionService.removeCollectionItem(
      req.user.id,
      req.params.id,
      req.params.itemId
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function reorderCollectionItems(
  req: Request<{ id: string }, unknown, collectionService.ReorderItemsInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const items = await collectionService.reorderCollectionItems(
      req.user.id,
      req.params.id,
      req.body
    );
    res.json(items);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Collection Members
// ============================================================================

export async function getCollectionMembers(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const members = await collectionService.getCollectionMembers(
      req.user.id,
      req.params.id
    );
    res.json(members);
  } catch (error) {
    next(error);
  }
}

export async function addCollectionMember(
  req: Request<{ id: string }, unknown, collectionService.AddMemberInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const member = await collectionService.addCollectionMember(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
}

export async function updateMemberRole(
  req: Request<{ id: string; userId: string }, unknown, collectionService.UpdateMemberRoleInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const member = await collectionService.updateMemberRole(
      req.user.id,
      req.params.id,
      req.params.userId,
      req.body
    );
    res.json(member);
  } catch (error) {
    next(error);
  }
}

export async function removeCollectionMember(
  req: Request<{ id: string; userId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await collectionService.removeCollectionMember(
      req.user.id,
      req.params.id,
      req.params.userId
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function leaveCollection(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await collectionService.leaveCollection(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Collection Invites
// ============================================================================

export async function createCollectionInvite(
  req: Request<{ id: string }, unknown, collectionService.CreateInviteInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const invite = await collectionService.createCollectionInvite(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json(invite);
  } catch (error) {
    next(error);
  }
}

export async function getCollectionInvites(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const invites = await collectionService.getCollectionInvites(
      req.user.id,
      req.params.id
    );
    res.json(invites);
  } catch (error) {
    next(error);
  }
}

export async function revokeCollectionInvite(
  req: Request<{ id: string; inviteId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await collectionService.revokeCollectionInvite(
      req.user.id,
      req.params.id,
      req.params.inviteId
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function joinCollectionByInvite(
  req: Request<{ token: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const membership = await collectionService.joinCollectionByInvite(
      req.user.id,
      req.params.token
    );
    res.status(201).json(membership);
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Collection Stars
// ============================================================================

export async function starCollection(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const star = await collectionService.starCollection(req.user.id, req.params.id);
    res.status(201).json(star);
  } catch (error) {
    next(error);
  }
}

export async function unstarCollection(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await collectionService.unstarCollection(req.user.id, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Collection Comments
// ============================================================================

export async function getCollectionComments(
  req: Request<{ id: string }, unknown, unknown, { page?: string; limit?: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const comments = await collectionService.getCollectionComments(
      req.params.id,
      { userId, page, limit }
    );
    res.json(comments);
  } catch (error) {
    next(error);
  }
}

export async function addCollectionComment(
  req: Request<{ id: string }, unknown, collectionService.AddCommentInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const comment = await collectionService.addCollectionComment(
      req.user.id,
      req.params.id,
      req.body
    );
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

export async function updateCollectionComment(
  req: Request<{ id: string; commentId: string }, unknown, collectionService.UpdateCommentInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const comment = await collectionService.updateCollectionComment(
      req.user.id,
      req.params.id,
      req.params.commentId,
      req.body
    );
    res.json(comment);
  } catch (error) {
    next(error);
  }
}

export async function deleteCollectionComment(
  req: Request<{ id: string; commentId: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await collectionService.deleteCollectionComment(
      req.user.id,
      req.params.id,
      req.params.commentId
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
