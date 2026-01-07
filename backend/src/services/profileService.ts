import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export interface PublicProfileResponse {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  list?: {
    id: string;
    title: string;
    type: string;
    status: string;
    current: number;
    total: number | null;
    notes: string | null;
    rating: number | null;
    imageUrl: string | null;
    refId: string;
  }[];
}

export interface PrivateProfileResponse {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPublic: false;
  isOwnProfile: boolean;
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
}

export async function getPublicProfile(
  username: string,
  requesterId?: string
): Promise<PublicProfileResponse | PrivateProfileResponse> {
  // Find user by username (case-insensitive)
  const user = await prisma.user.findFirst({
    where: { 
      username: {
        equals: username,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isPublic: true,
      mediaItems: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          current: true,
          total: true,
          notes: true,
          rating: true,
          imageUrl: true,
          refId: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
      _count: {
        select: {
          followers: true,
          following: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const isOwnProfile = requesterId === user.id;

  // Check if requester follows this user
  let isFollowing = false;
  if (requesterId && !isOwnProfile) {
    const friendship = await prisma.friendship.findUnique({
      where: {
        followerId_followingId: {
          followerId: requesterId,
          followingId: user.id,
        },
      },
    });
    isFollowing = !!friendship;
  }

  // Determine if we can show the list
  // List is visible if:
  // 1. Profile is public
  // 2. It's the user's own profile
  // 3. Requester follows this user
  const canViewList = user.isPublic || isOwnProfile || isFollowing;

  if (!canViewList) {
    // Return limited profile for private users
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isPublic: false,
      isOwnProfile,
      isFollowing,
      followerCount: user._count.followers,
      followingCount: user._count.following,
    };
  }

  // Return full profile with list
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isPublic: user.isPublic,
    isOwnProfile,
    isFollowing,
    followerCount: user._count.followers,
    followingCount: user._count.following,
    list: user.mediaItems,
  };
}

export async function updatePrivacySettings(
  userId: string,
  isPublic: boolean
): Promise<{ isPublic: boolean }> {
  await prisma.user.update({
    where: { id: userId },
    data: { isPublic },
  });

  return { isPublic };
}

export async function getUserPrivacySettings(
  userId: string
): Promise<{ isPublic: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPublic: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return { isPublic: user.isPublic };
}
