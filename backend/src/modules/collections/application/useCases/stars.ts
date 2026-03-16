import { ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors.js';
import type { CollectionsGateway } from '../ports/CollectionsGateway.js';
import { canViewCollection } from '../../domain/permissions.js';

async function requireCollection(collectionsGateway: CollectionsGateway, collectionId: string) {
  const context = await collectionsGateway.getCollectionAccessContext(collectionId);

  if (!context) {
    throw new NotFoundError('Collection not found');
  }

  return context;
}

export function createStarCollectionUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function starCollection(command: { userId: string; collectionId: string }) {
    const context = await requireCollection(dependencies.collectionsGateway, command.collectionId);

    if (!canViewCollection(command.userId, context)) {
      throw new ForbiddenError('You do not have permission to star this collection');
    }

    const existingStar = await dependencies.collectionsGateway.getCollectionStar(command.collectionId, command.userId);
    if (existingStar) {
      throw new ConflictError('You have already starred this collection');
    }

    return dependencies.collectionsGateway.createCollectionStar(command.collectionId, command.userId);
  };
}

export function createUnstarCollectionUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function unstarCollection(command: { userId: string; collectionId: string }) {
    const star = await dependencies.collectionsGateway.getCollectionStar(command.collectionId, command.userId);
    if (!star) {
      throw new NotFoundError('You have not starred this collection');
    }

    await dependencies.collectionsGateway.deleteCollectionStar(star.id);
  };
}
