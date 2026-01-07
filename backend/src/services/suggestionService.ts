import { prisma } from '../config/database.js';
import { NotFoundError, ConflictError, ForbiddenError, BadRequestError } from '../utils/errors.js';
import type { CreateSuggestionInput } from '../utils/schemas.js';
import type { MediaType } from '@prisma/client';

type SuggestionStatus = 'PENDING' | 'ACCEPTED' | 'DISMISSED';

export interface SuggestionResponse {
  id: string;
  title: string;
  type: MediaType;
  refId: string;
  imageUrl: string | null;
  message: string | null;
  status: SuggestionStatus;
  createdAt: Date;
  fromUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
  toUser: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

const suggestionSelect = {
  id: true,
  title: true,
  type: true,
  refId: true,
  imageUrl: true,
  message: true,
  status: true,
  createdAt: true,
  fromUser: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  toUser: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
} as const;

export async function createSuggestion(
  fromUserId: string,
  toUserId: string,
  input: CreateSuggestionInput
): Promise<SuggestionResponse> {
  // Cannot suggest to yourself
  if (fromUserId === toUserId) {
    throw new BadRequestError('Cannot suggest media to yourself');
  }

  // Check if the target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: toUserId },
  });

  if (!targetUser) {
    throw new NotFoundError('User not found');
  }

  // Check if following the target user
  const isFollowing = await prisma.friendship.findUnique({
    where: {
      followerId_followingId: {
        followerId: fromUserId,
        followingId: toUserId,
      },
    },
  });

  if (!isFollowing) {
    throw new ForbiddenError('You must follow this user to send them suggestions');
  }

  // Check for existing pending suggestion of the same media
  const existingSuggestion = await prisma.suggestion.findFirst({
    where: {
      fromUserId,
      toUserId,
      refId: input.refId,
      status: 'PENDING',
    },
  });

  if (existingSuggestion) {
    throw new ConflictError('You already have a pending suggestion for this media to this user');
  }

  const suggestion = await prisma.suggestion.create({
    data: {
      fromUserId,
      toUserId,
      title: input.title,
      type: input.type,
      refId: input.refId,
      imageUrl: input.imageUrl,
      message: input.message,
    },
    select: suggestionSelect,
  });

  return suggestion;
}

export async function getReceivedSuggestions(
  userId: string,
  status?: SuggestionStatus
): Promise<SuggestionResponse[]> {
  const where: { toUserId: string; status?: SuggestionStatus } = { toUserId: userId };

  if (status) {
    where.status = status;
  } else {
    // Default to pending if no status filter
    where.status = 'PENDING';
  }

  const suggestions = await prisma.suggestion.findMany({
    where,
    select: suggestionSelect,
    orderBy: { createdAt: 'desc' },
  });

  return suggestions;
}

export async function getSentSuggestions(userId: string): Promise<SuggestionResponse[]> {
  const suggestions = await prisma.suggestion.findMany({
    where: { fromUserId: userId },
    select: suggestionSelect,
    orderBy: { createdAt: 'desc' },
  });

  return suggestions;
}

export async function acceptSuggestion(
  userId: string,
  suggestionId: string
): Promise<SuggestionResponse> {
  const suggestion = await prisma.suggestion.findUnique({
    where: { id: suggestionId },
    select: {
      ...suggestionSelect,
      toUserId: true,
      fromUserId: true,
    },
  });

  if (!suggestion) {
    throw new NotFoundError('Suggestion not found');
  }

  if (suggestion.toUserId !== userId) {
    throw new ForbiddenError('Only the recipient can accept a suggestion');
  }

  if (suggestion.status !== 'PENDING') {
    throw new BadRequestError('This suggestion has already been processed');
  }

  // Determine the appropriate status based on media type
  const planStatus = suggestion.type === 'MANGA' ? 'PLAN_TO_WATCH' : 'PLAN_TO_WATCH';

  // Use a transaction to update suggestion and create media item
  const [updatedSuggestion] = await prisma.$transaction([
    prisma.suggestion.update({
      where: { id: suggestionId },
      data: { status: 'ACCEPTED' },
      select: suggestionSelect,
    }),
    prisma.mediaItem.upsert({
      where: {
        userId_refId: {
          userId,
          refId: suggestion.refId,
        },
      },
      create: {
        userId,
        title: suggestion.title,
        type: suggestion.type,
        status: planStatus,
        refId: suggestion.refId,
        imageUrl: suggestion.imageUrl,
      },
      update: {
        // If the item already exists, don't change anything
      },
    }),
  ]);

  return updatedSuggestion;
}

export async function dismissSuggestion(
  userId: string,
  suggestionId: string
): Promise<SuggestionResponse> {
  const suggestion = await prisma.suggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion) {
    throw new NotFoundError('Suggestion not found');
  }

  if (suggestion.toUserId !== userId) {
    throw new ForbiddenError('Only the recipient can dismiss a suggestion');
  }

  if (suggestion.status !== 'PENDING') {
    throw new BadRequestError('This suggestion has already been processed');
  }

  const updatedSuggestion = await prisma.suggestion.update({
    where: { id: suggestionId },
    data: { status: 'DISMISSED' },
    select: suggestionSelect,
  });

  return updatedSuggestion;
}

export async function deleteSuggestion(
  userId: string,
  suggestionId: string
): Promise<void> {
  const suggestion = await prisma.suggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion) {
    throw new NotFoundError('Suggestion not found');
  }

  if (suggestion.fromUserId !== userId) {
    throw new ForbiddenError('Only the sender can delete a suggestion');
  }

  await prisma.suggestion.delete({
    where: { id: suggestionId },
  });
}
