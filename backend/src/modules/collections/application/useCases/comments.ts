import { ForbiddenError, NotFoundError } from '../../../../utils/errors.js';
import type { CollectionsGateway } from '../ports/CollectionsGateway.js';
import { normalizeCollectionCommentContent } from '../../domain/commentContent.js';
import { canViewCollection } from '../../domain/permissions.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

async function requireVisibleCollection(
  collectionsGateway: CollectionsGateway,
  collectionId: string,
  userId?: string,
) {
  const collection = await collectionsGateway.getCollectionAccessContext(collectionId);

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canViewCollection(userId ?? null, collection)) {
    throw new ForbiddenError('You do not have permission to view comments on this collection');
  }

  return collection;
}

export function createGetCollectionCommentsUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function getCollectionComments(query: { collectionId: string; userId?: string; page?: number; limit?: number }) {
    await requireVisibleCollection(dependencies.collectionsGateway, query.collectionId, query.userId);

    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const { total, comments } = await dependencies.collectionsGateway.listCollectionComments(query.collectionId, {
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      comments,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  };
}

export function createAddCollectionCommentUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function addCollectionComment(command: { userId: string; collectionId: string; input: { content: string } }) {
    await requireVisibleCollection(dependencies.collectionsGateway, command.collectionId, command.userId);

    return dependencies.collectionsGateway.createCollectionComment(
      command.collectionId,
      command.userId,
      normalizeCollectionCommentContent(command.input.content),
    );
  };
}

export function createUpdateCollectionCommentUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function updateCollectionComment(command: {
    userId: string;
    collectionId: string;
    commentId: string;
    input: { content: string };
  }) {
    const authorId = await dependencies.collectionsGateway.getCollectionCommentAuthorId(command.collectionId, command.commentId);

    if (!authorId) {
      throw new NotFoundError('Comment not found');
    }

    if (authorId !== command.userId) {
      throw new ForbiddenError('You can only update your own comments');
    }

    return dependencies.collectionsGateway.updateCollectionComment(
      command.commentId,
      normalizeCollectionCommentContent(command.input.content),
    );
  };
}

export function createDeleteCollectionCommentUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function deleteCollectionComment(command: { userId: string; collectionId: string; commentId: string }) {
    const authorId = await dependencies.collectionsGateway.getCollectionCommentAuthorId(command.collectionId, command.commentId);

    if (!authorId) {
      throw new NotFoundError('Comment not found');
    }

    if (authorId !== command.userId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    await dependencies.collectionsGateway.deleteCollectionComment(command.commentId);
  };
}
