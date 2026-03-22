import crypto from 'node:crypto';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../../utils/errors.js';
import type { CollectionsGateway } from '../ports/CollectionsGateway.js';
import { isCollectionOwner } from '../../domain/permissions.js';

const INVITE_TOKEN_LENGTH = 32;
const DEFAULT_INVITE_EXPIRY_DAYS = 7;

function generateInviteToken(): string {
  return crypto.randomBytes(INVITE_TOKEN_LENGTH / 2).toString('hex');
}

async function requireCollection(collectionsGateway: CollectionsGateway, collectionId: string) {
  const context = await collectionsGateway.getCollectionAccessContext(collectionId);

  if (!context) {
    throw new NotFoundError('Collection not found');
  }

  return context;
}

export function createCreateCollectionInviteUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function createCollectionInvite(command: {
    userId: string;
    collectionId: string;
    input: { role: 'EDITOR' | 'VIEWER' | 'OWNER'; maxUses?: number; expiresInDays?: number };
  }) {
    const context = await requireCollection(dependencies.collectionsGateway, command.collectionId);

    if (!isCollectionOwner(command.userId, context)) {
      throw new ForbiddenError('Only the owner can create invites');
    }

    if (command.input.role === 'OWNER') {
      throw new BadRequestError('Cannot create an invite with OWNER role');
    }

    const expiryDays = command.input.expiresInDays ?? DEFAULT_INVITE_EXPIRY_DAYS;
    return dependencies.collectionsGateway.createCollectionInvite(command.collectionId, {
      token: generateInviteToken(),
      role: command.input.role,
      maxUses: command.input.maxUses,
      expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
    });
  };
}

export function createGetCollectionInvitesUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function getCollectionInvites(query: { userId: string; collectionId: string }) {
    const context = await requireCollection(dependencies.collectionsGateway, query.collectionId);

    if (!isCollectionOwner(query.userId, context)) {
      throw new ForbiddenError('Only the owner can view invites');
    }

    return dependencies.collectionsGateway.getActiveCollectionInvites(query.collectionId, new Date());
  };
}

export function createRevokeCollectionInviteUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function revokeCollectionInvite(command: { userId: string; collectionId: string; inviteId: string }) {
    const context = await requireCollection(dependencies.collectionsGateway, command.collectionId);

    if (!isCollectionOwner(command.userId, context)) {
      throw new ForbiddenError('Only the owner can revoke invites');
    }

    const invite = await dependencies.collectionsGateway.getCollectionInvite(command.inviteId, command.collectionId);
    if (!invite) {
      throw new NotFoundError('Invite not found');
    }

    await dependencies.collectionsGateway.deleteCollectionInvite(command.inviteId);
  };
}

export function createJoinCollectionByInviteUseCase(dependencies: { collectionsGateway: CollectionsGateway }) {
  return async function joinCollectionByInvite(command: { userId: string; token: string }) {
    const invite = await dependencies.collectionsGateway.findCollectionInviteByToken(command.token);
    if (!invite) {
      throw new NotFoundError('Invalid invite token');
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestError('This invite has expired');
    }

    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
      throw new BadRequestError('This invite has reached its maximum uses');
    }

    if (invite.ownerId === command.userId) {
      throw new BadRequestError('You are already the owner of this collection');
    }

    const existingMember = await dependencies.collectionsGateway.getMemberByCollectionAndUser(invite.collectionId, command.userId);
    if (existingMember) {
      throw new ConflictError('You are already a member of this collection');
    }

    if (invite.role === 'OWNER') {
      throw new BadRequestError('Cannot join via an OWNER invite');
    }

    await dependencies.collectionsGateway.createCollectionMemberFromInviteAndIncrementUseCount({
      inviteId: invite.id,
      collectionId: invite.collectionId,
      userId: command.userId,
      role: invite.role,
    });

    return {
      collectionId: invite.collectionId,
      role: invite.role,
    };
  };
}
