import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors.js';
import type { CollectionsGateway } from '../ports/CollectionsGateway.js';
import { canViewCollection, isCollectionOwner } from '../../domain/permissions.js';

async function requireCollection(collectionsGateway: CollectionsGateway, collectionId: string) {
  const context = await collectionsGateway.getCollectionAccessContext(collectionId);

  if (!context) {
    throw new NotFoundError('Collection not found');
  }

  return context;
}

export function createGetCollectionMembersUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function getCollectionMembers(query: { userId: string; collectionId: string }) {
    const context = await requireCollection(dependencies.collectionsGateway, query.collectionId);

    if (!canViewCollection(query.userId, context)) {
      throw new ForbiddenError('You do not have permission to view this collection');
    }

    return dependencies.collectionsGateway.getCollectionMembers(query.collectionId);
  };
}

export function createAddCollectionMemberUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function addCollectionMember(command: {
    userId: string;
    collectionId: string;
    input: { username: string; role: 'EDITOR' | 'VIEWER' | 'OWNER' };
  }) {
    const context = await requireCollection(dependencies.collectionsGateway, command.collectionId);

    if (!isCollectionOwner(command.userId, context)) {
      throw new ForbiddenError('Only the owner can add members');
    }

    if (command.input.role === 'OWNER') {
      throw new BadRequestError('Cannot add a member with OWNER role');
    }

    const userToAdd = await dependencies.collectionsGateway.findUserByUsername(command.input.username);
    if (!userToAdd) {
      throw new NotFoundError('User not found');
    }

    if (userToAdd.id === context.ownerId) {
      throw new BadRequestError('Cannot add the owner as a member');
    }

    const existingMember = await dependencies.collectionsGateway.getMemberByCollectionAndUser(command.collectionId, userToAdd.id);
    if (existingMember) {
      throw new ConflictError('User is already a member of this collection');
    }

    return dependencies.collectionsGateway.createCollectionMember(command.collectionId, userToAdd.id, command.input.role);
  };
}

export function createUpdateMemberRoleUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function updateMemberRole(command: {
    userId: string;
    collectionId: string;
    memberId: string;
    input: { role: 'EDITOR' | 'VIEWER' | 'OWNER' };
  }) {
    const context = await requireCollection(dependencies.collectionsGateway, command.collectionId);

    if (!isCollectionOwner(command.userId, context)) {
      throw new ForbiddenError('Only the owner can change member roles');
    }

    if (command.input.role === 'OWNER') {
      throw new BadRequestError('Cannot change a member to OWNER role');
    }

    const member = await dependencies.collectionsGateway.getCollectionMember(command.memberId, command.collectionId);
    if (!member) {
      throw new NotFoundError('Member not found');
    }

    return dependencies.collectionsGateway.updateCollectionMemberRole(member.id, command.input.role);
  };
}

export function createRemoveCollectionMemberUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function removeCollectionMember(command: { userId: string; collectionId: string; memberId: string }) {
    const context = await requireCollection(dependencies.collectionsGateway, command.collectionId);
    const member = await dependencies.collectionsGateway.getCollectionMember(command.memberId, command.collectionId);

    if (!member) {
      throw new NotFoundError('Member not found');
    }

    if (!isCollectionOwner(command.userId, context) && member.userId !== command.userId) {
      throw new ForbiddenError('You do not have permission to remove this member');
    }

    await dependencies.collectionsGateway.deleteCollectionMember(member.id);
  };
}

export function createLeaveCollectionUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function leaveCollection(command: { userId: string; collectionId: string }) {
    const context = await requireCollection(dependencies.collectionsGateway, command.collectionId);

    if (isCollectionOwner(command.userId, context)) {
      throw new BadRequestError('Owner cannot leave the collection. Transfer ownership or delete the collection instead.');
    }

    const member = await dependencies.collectionsGateway.getMemberByCollectionAndUser(command.collectionId, command.userId);
    if (!member) {
      throw new NotFoundError('You are not a member of this collection');
    }

    await dependencies.collectionsGateway.deleteCollectionMember(member.id);
  };
}
