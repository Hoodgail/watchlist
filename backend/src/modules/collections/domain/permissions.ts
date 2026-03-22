import type { CollectionAccessContext, CollectionRole } from '../application/dto/collections.js';

export function canViewCollection(userId: string | null, collection: CollectionAccessContext): boolean {
  if (collection.isPublic) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (collection.ownerId === userId) {
    return true;
  }

  return collection.members.some((member) => member.userId === userId);
}

export function canEditCollection(userId: string, collection: CollectionAccessContext): boolean {
  if (collection.ownerId === userId) {
    return true;
  }

  return collection.members.some((member) => member.userId === userId && member.role === 'EDITOR');
}

export function isCollectionOwner(userId: string, collection: { ownerId: string }): boolean {
  return collection.ownerId === userId;
}

export function getCollectionRole(userId: string | null, collection: CollectionAccessContext): CollectionRole | null {
  if (!userId) {
    return null;
  }

  if (collection.ownerId === userId) {
    return 'OWNER';
  }

  return collection.members.find((member) => member.userId === userId)?.role ?? null;
}
