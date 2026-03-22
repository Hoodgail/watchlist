import type { NextFunction, Request, Response } from 'express';
import { requireAuthenticatedUser } from '../../../../shared/interface/http/requireAuthenticatedUser.js';
import { collectionsApplication } from '../../composition/createCollectionsApplication.js';
import type {
  AddCollectionCommentInput,
  AddCollectionItemInput,
  AddCollectionMemberInput,
  CollectionCommentsQueryInput,
  CreateCollectionInput,
  CreateCollectionInviteInput,
  PublicCollectionsQueryInput,
  ReorderCollectionItemsInput,
  UpdateCollectionCommentInput,
  UpdateCollectionInput,
  UpdateCollectionItemInput,
  UpdateMemberRoleInput,
} from './collectionSchemas.js';

export async function createCollection(
  req: Request<unknown, unknown, CreateCollectionInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const collection = await collectionsApplication.createCollection({ userId: user.id, input: req.body });
    res.status(201).json(collection);
  } catch (error) {
    next(error);
  }
}

export async function getMyCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const collections = await collectionsApplication.getMyCollections({ userId: user.id });
    res.json(collections);
  } catch (error) {
    next(error);
  }
}

export async function getPublicCollections(
  req: Request<unknown, unknown, unknown, PublicCollectionsQueryInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const collections = await collectionsApplication.getPublicCollections(req.query);
    res.json(collections);
  } catch (error) {
    next(error);
  }
}

export async function getStarredCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const collections = await collectionsApplication.getStarredCollections({ userId: user.id });
    res.json(collections);
  } catch (error) {
    next(error);
  }
}

export async function getCollection(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const collection = await collectionsApplication.getCollection({ collectionId: req.params.id, userId: req.user?.id });
    res.json(collection);
  } catch (error) {
    next(error);
  }
}

export async function updateCollection(
  req: Request<{ id: string }, unknown, UpdateCollectionInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const collection = await collectionsApplication.updateCollection({
      userId: user.id,
      collectionId: req.params.id,
      input: req.body,
    });
    res.json(collection);
  } catch (error) {
    next(error);
  }
}

export async function deleteCollection(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await collectionsApplication.deleteCollection({ userId: user.id, collectionId: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function addCollectionItem(
  req: Request<{ id: string }, unknown, AddCollectionItemInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const item = await collectionsApplication.addCollectionItem({
      userId: user.id,
      collectionId: req.params.id,
      input: req.body,
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
}

export async function updateCollectionItem(
  req: Request<{ id: string; itemId: string }, unknown, UpdateCollectionItemInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const item = await collectionsApplication.updateCollectionItem({
      userId: user.id,
      collectionId: req.params.id,
      itemId: req.params.itemId,
      input: req.body,
    });
    res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function removeCollectionItem(
  req: Request<{ id: string; itemId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await collectionsApplication.removeCollectionItem({
      userId: user.id,
      collectionId: req.params.id,
      itemId: req.params.itemId,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function reorderCollectionItems(
  req: Request<{ id: string }, unknown, ReorderCollectionItemsInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const items = await collectionsApplication.reorderCollectionItems({
      userId: user.id,
      collectionId: req.params.id,
      input: req.body,
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
}

export async function getCollectionMembers(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const members = await collectionsApplication.getCollectionMembers({ userId: user.id, collectionId: req.params.id });
    res.json(members);
  } catch (error) {
    next(error);
  }
}

export async function addCollectionMember(
  req: Request<{ id: string }, unknown, AddCollectionMemberInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const member = await collectionsApplication.addCollectionMember({
      userId: user.id,
      collectionId: req.params.id,
      input: req.body,
    });
    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
}

export async function updateMemberRole(
  req: Request<{ id: string; userId: string }, unknown, UpdateMemberRoleInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const member = await collectionsApplication.updateMemberRole({
      userId: user.id,
      collectionId: req.params.id,
      memberId: req.params.userId,
      input: req.body,
    });
    res.json(member);
  } catch (error) {
    next(error);
  }
}

export async function removeCollectionMember(
  req: Request<{ id: string; userId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await collectionsApplication.removeCollectionMember({
      userId: user.id,
      collectionId: req.params.id,
      memberId: req.params.userId,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function leaveCollection(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await collectionsApplication.leaveCollection({ userId: user.id, collectionId: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function createCollectionInvite(
  req: Request<{ id: string }, unknown, CreateCollectionInviteInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const invite = await collectionsApplication.createCollectionInvite({
      userId: user.id,
      collectionId: req.params.id,
      input: req.body,
    });
    res.status(201).json(invite);
  } catch (error) {
    next(error);
  }
}

export async function getCollectionInvites(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const invites = await collectionsApplication.getCollectionInvites({ userId: user.id, collectionId: req.params.id });
    res.json(invites);
  } catch (error) {
    next(error);
  }
}

export async function revokeCollectionInvite(
  req: Request<{ id: string; inviteId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await collectionsApplication.revokeCollectionInvite({
      userId: user.id,
      collectionId: req.params.id,
      inviteId: req.params.inviteId,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function joinCollectionByInvite(
  req: Request<{ token: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const membership = await collectionsApplication.joinCollectionByInvite({ userId: user.id, token: req.params.token });
    res.status(201).json(membership);
  } catch (error) {
    next(error);
  }
}

export async function starCollection(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const star = await collectionsApplication.starCollection({ userId: user.id, collectionId: req.params.id });
    res.status(201).json(star);
  } catch (error) {
    next(error);
  }
}

export async function unstarCollection(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await collectionsApplication.unstarCollection({ userId: user.id, collectionId: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getCollectionComments(
  req: Request<{ id: string }, unknown, unknown, CollectionCommentsQueryInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const comments = await collectionsApplication.getCollectionComments({
      collectionId: req.params.id,
      userId: req.user?.id,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json(comments);
  } catch (error) {
    next(error);
  }
}

export async function addCollectionComment(
  req: Request<{ id: string }, unknown, AddCollectionCommentInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const comment = await collectionsApplication.addCollectionComment({
      userId: user.id,
      collectionId: req.params.id,
      input: req.body,
    });
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

export async function updateCollectionComment(
  req: Request<{ id: string; commentId: string }, unknown, UpdateCollectionCommentInput>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    const comment = await collectionsApplication.updateCollectionComment({
      userId: user.id,
      collectionId: req.params.id,
      commentId: req.params.commentId,
      input: req.body,
    });
    res.json(comment);
  } catch (error) {
    next(error);
  }
}

export async function deleteCollectionComment(
  req: Request<{ id: string; commentId: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = requireAuthenticatedUser(req);
    await collectionsApplication.deleteCollectionComment({
      userId: user.id,
      collectionId: req.params.id,
      commentId: req.params.commentId,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
