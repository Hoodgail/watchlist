import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors.js';
import type { CollectionCatalogGateway } from '../ports/CollectionCatalogGateway.js';
import type { CollectionsGateway } from '../ports/CollectionsGateway.js';
import { canEditCollection } from '../../domain/permissions.js';

async function requireEditableCollection(collectionsGateway: CollectionsGateway, collectionId: string, userId: string) {
  const context = await collectionsGateway.getCollectionAccessContext(collectionId);

  if (!context) {
    throw new NotFoundError('Collection not found');
  }

  if (!canEditCollection(userId, context)) {
    throw new ForbiddenError('You do not have permission to edit this collection');
  }

  return context;
}

export function createAddCollectionItemUseCase(dependencies: {
  collectionsGateway: CollectionsGateway;
  collectionCatalogGateway: CollectionCatalogGateway;
}) {
  return async function addCollectionItem(command: {
    userId: string;
    collectionId: string;
    input: { refId: string; type: import('@prisma/client').MediaType; note?: string; orderIndex?: number };
  }) {
    await requireEditableCollection(dependencies.collectionsGateway, command.collectionId, command.userId);

    const existingItem = await dependencies.collectionsGateway.findCollectionItemByRefId(command.collectionId, command.input.refId);
    if (existingItem) {
      throw new ConflictError('This item is already in the collection');
    }

    const source = await dependencies.collectionCatalogGateway.getOrCreateMediaSource(command.input.refId, command.input.type);
    const itemCount = await dependencies.collectionsGateway.getCollectionItemCount(command.collectionId);

    return dependencies.collectionsGateway.createCollectionItem({
      collectionId: command.collectionId,
      refId: command.input.refId,
      type: command.input.type,
      note: command.input.note,
      orderIndex: command.input.orderIndex ?? itemCount,
      sourceId: source.id,
    });
  };
}

export function createUpdateCollectionItemUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function updateCollectionItem(command: {
    userId: string;
    collectionId: string;
    itemId: string;
    input: { note?: string; orderIndex?: number };
  }) {
    await requireEditableCollection(dependencies.collectionsGateway, command.collectionId, command.userId);

    const item = await dependencies.collectionsGateway.getCollectionItem(command.collectionId, command.itemId);
    if (!item) {
      throw new NotFoundError('Collection item not found');
    }

    return dependencies.collectionsGateway.updateCollectionItem(command.itemId, command.input);
  };
}

export function createRemoveCollectionItemUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function removeCollectionItem(command: { userId: string; collectionId: string; itemId: string }) {
    await requireEditableCollection(dependencies.collectionsGateway, command.collectionId, command.userId);

    const item = await dependencies.collectionsGateway.getCollectionItem(command.collectionId, command.itemId);
    if (!item) {
      throw new NotFoundError('Collection item not found');
    }

    await dependencies.collectionsGateway.deleteCollectionItem(command.itemId);
  };
}

export function createReorderCollectionItemsUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function reorderCollectionItems(command: {
    userId: string;
    collectionId: string;
    input: { items: Array<{ id: string; orderIndex: number }> };
  }) {
    await requireEditableCollection(dependencies.collectionsGateway, command.collectionId, command.userId);

    const itemIds = command.input.items.map((item) => item.id);
    const existingItems = await dependencies.collectionsGateway.getCollectionItemsByIds(command.collectionId, itemIds);

    if (existingItems.length !== itemIds.length) {
      throw new BadRequestError('Some items do not belong to this collection');
    }

    await dependencies.collectionsGateway.reorderCollectionItems(command.input.items);
    return dependencies.collectionsGateway.getOrderedCollectionItems(command.collectionId);
  };
}
