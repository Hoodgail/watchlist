import { BadRequestError, ForbiddenError, NotFoundError } from '../../../../utils/errors.js';
import type { CollectionsGateway } from '../ports/CollectionsGateway.js';
import { canEditCollection, canViewCollection, getCollectionRole, isCollectionOwner } from '../../domain/permissions.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizeCollectionTitle(title: string): string {
  if (!title || title.trim().length === 0) {
    throw new BadRequestError('Collection title is required');
  }

  return title.trim();
}

async function requireCollectionContext(collectionsGateway: CollectionsGateway, collectionId: string) {
  const context = await collectionsGateway.getCollectionAccessContext(collectionId);

  if (!context) {
    throw new NotFoundError('Collection not found');
  }

  return context;
}

export function createCreateCollectionUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function createCollection(command: {
    userId: string;
    input: { title: string; description?: string; coverUrl?: string; isPublic?: boolean };
  }) {
    return dependencies.collectionsGateway.createCollection(command.userId, {
      ...command.input,
      title: normalizeCollectionTitle(command.input.title),
    });
  };
}

export function createGetMyCollectionsUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function getMyCollections(query: { userId: string }) {
    return dependencies.collectionsGateway.getMyCollections(query.userId);
  };
}

export function createGetPublicCollectionsUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function getPublicCollections(query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
  }) {
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));

    return dependencies.collectionsGateway.getPublicCollections({
      page,
      limit,
      search: query.search,
      sortBy: query.sortBy,
    });
  };
}

export function createGetStarredCollectionsUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function getStarredCollections(query: { userId: string }) {
    return dependencies.collectionsGateway.getStarredCollections(query.userId);
  };
}

export function createGetCollectionUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function getCollection(query: { collectionId: string; userId?: string }) {
    const [detail, context] = await Promise.all([
      dependencies.collectionsGateway.getCollectionDetail(query.collectionId),
      dependencies.collectionsGateway.getCollectionAccessContext(query.collectionId),
    ]);

    if (!detail || !context) {
      throw new NotFoundError('Collection not found');
    }

    if (!canViewCollection(query.userId ?? null, context)) {
      throw new ForbiddenError('You do not have permission to view this collection');
    }

    const myRole = getCollectionRole(query.userId ?? null, context);
    const star = query.userId
      ? await dependencies.collectionsGateway.getCollectionStar(query.collectionId, query.userId)
      : null;

    return {
      ...detail,
      myRole,
      isStarred: Boolean(star),
    };
  };
}

export function createUpdateCollectionUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function updateCollection(command: {
    userId: string;
    collectionId: string;
    input: { title?: string; description?: string; coverUrl?: string; isPublic?: boolean };
  }) {
    const context = await requireCollectionContext(dependencies.collectionsGateway, command.collectionId);

    if (!canEditCollection(command.userId, context)) {
      throw new ForbiddenError('You do not have permission to edit this collection');
    }

    return dependencies.collectionsGateway.updateCollection(command.collectionId, {
      ...command.input,
      title: command.input.title !== undefined ? normalizeCollectionTitle(command.input.title) : undefined,
      description: command.input.description?.trim(),
    });
  };
}

export function createDeleteCollectionUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function deleteCollection(command: { userId: string; collectionId: string }) {
    const context = await requireCollectionContext(dependencies.collectionsGateway, command.collectionId);

    if (!isCollectionOwner(command.userId, context)) {
      throw new ForbiddenError('Only the owner can delete this collection');
    }

    await dependencies.collectionsGateway.deleteCollection(command.collectionId);
  };
}
