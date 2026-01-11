import { prisma } from '../config/database.js';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '../utils/errors.js';
import { getOrCreateMediaSource } from './mediaSourceService.js';
import type { MediaType } from '@prisma/client';
import crypto from 'crypto';

// Define CollectionRole locally to avoid Prisma client dependency before generation
export type CollectionRole = 'OWNER' | 'EDITOR' | 'VIEWER';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CollectionOwner {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface CollectionMemberResponse {
  id: string;
  role: CollectionRole;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface CollectionItemResponse {
  id: string;
  refId: string;
  title: string;
  imageUrl: string | null;
  type: MediaType;
  orderIndex: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Metadata fields from MediaSource
  year?: number | null;
  releaseDate?: string | null;
  description?: string | null;
  genres?: string[];
  platforms?: string[];
  playtimeHours?: number | null;
}

export interface CollectionResponse {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: CollectionOwner;
  itemCount: number;
  starCount: number;
}

export interface CollectionDetailResponse extends CollectionResponse {
  items: CollectionItemResponse[];
  members: CollectionMemberResponse[];
  userRole: CollectionRole | null;
  isStarred: boolean;
}

export interface CollectionInviteResponse {
  id: string;
  token: string;
  role: CollectionRole;
  maxUses: number | null;
  useCount: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface CollectionCommentResponse {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

export interface CreateCollectionInput {
  title: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
}

export interface UpdateCollectionInput {
  title?: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
}

export interface AddCollectionItemInput {
  refId: string;
  type: MediaType;
  note?: string;
  orderIndex?: number;
}

export interface UpdateCollectionItemInput {
  note?: string;
  orderIndex?: number;
}

export interface ReorderItemsInput {
  items: { id: string; orderIndex: number }[];
}

export interface AddMemberInput {
  username: string;
  role: CollectionRole;
}

export interface UpdateMemberRoleInput {
  role: CollectionRole;
}

export interface CreateInviteInput {
  role: CollectionRole;
  maxUses?: number;
  expiresInDays?: number;
}

export interface AddCommentInput {
  content: string;
}

export interface UpdateCommentInput {
  content: string;
}

export interface PaginatedCommentsResponse {
  comments: CollectionCommentResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedCollectionsResponse {
  collections: CollectionResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const INVITE_TOKEN_LENGTH = 32;
const DEFAULT_INVITE_EXPIRY_DAYS = 7;

// ============================================================================
// Select Objects
// ============================================================================

const ownerSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

const collectionSelect = {
  id: true,
  title: true,
  description: true,
  coverUrl: true,
  isPublic: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: ownerSelect,
  },
  _count: {
    select: {
      items: true,
      stars: true,
    },
  },
} as const;

const collectionItemSelect = {
  id: true,
  refId: true,
  title: true,
  imageUrl: true,
  type: true,
  orderIndex: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  source: {
    select: {
      title: true,
      imageUrl: true,
      // Metadata fields from MediaSource
      year: true,
      releaseDate: true,
      description: true,
      genres: true,
      platforms: true,
      playtimeHours: true,
    },
  },
} as const;

const memberSelect = {
  id: true,
  role: true,
  createdAt: true,
  user: {
    select: ownerSelect,
  },
} as const;

const inviteSelect = {
  id: true,
  token: true,
  role: true,
  maxUses: true,
  useCount: true,
  expiresAt: true,
  createdAt: true,
} as const;

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: ownerSelect,
  },
} as const;

// ============================================================================
// Helper Types
// ============================================================================

type CollectionWithCounts = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  _count: {
    items: number;
    stars: number;
  };
};

type CollectionItemWithSource = {
  id: string;
  refId: string;
  title: string | null;
  imageUrl: string | null;
  type: MediaType;
  orderIndex: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  source: {
    title: string;
    imageUrl: string | null;
    // Metadata fields from MediaSource
    year?: number | null;
    releaseDate?: string | null;
    description?: string | null;
    genres?: string[];
    platforms?: string[];
    playtimeHours?: number | null;
  } | null;
};

type CollectionWithRelations = CollectionWithCounts & {
  ownerId: string;
  members: {
    id: string;
    role: CollectionRole;
    createdAt: Date;
    user: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    };
  }[];
  items: CollectionItemWithSource[];
};

// ============================================================================
// Response Formatters
// ============================================================================

function formatCollectionResponse(collection: CollectionWithCounts): CollectionResponse {
  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    coverUrl: collection.coverUrl,
    isPublic: collection.isPublic,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    owner: collection.owner,
    itemCount: collection._count.items,
    starCount: collection._count.stars,
  };
}

function formatCollectionItemResponse(item: CollectionItemWithSource): CollectionItemResponse {
  return {
    id: item.id,
    refId: item.refId,
    title: item.source?.title ?? item.title ?? 'Unknown',
    imageUrl: item.source?.imageUrl ?? item.imageUrl,
    type: item.type,
    orderIndex: item.orderIndex,
    note: item.note,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    // Metadata fields from source
    year: item.source?.year,
    releaseDate: item.source?.releaseDate,
    description: item.source?.description,
    genres: item.source?.genres,
    platforms: item.source?.platforms,
    playtimeHours: item.source?.playtimeHours,
  };
}

function formatMemberResponse(member: {
  id: string;
  role: CollectionRole;
  createdAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}): CollectionMemberResponse {
  return {
    id: member.id,
    role: member.role,
    createdAt: member.createdAt,
    user: member.user,
  };
}

function formatCommentResponse(comment: {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}): CollectionCommentResponse {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.user,
  };
}

// ============================================================================
// Authorization Helpers
// ============================================================================

/**
 * Check if user can view a collection.
 * Returns true if collection is public OR user is owner/member.
 */
export function canViewCollection(
  userId: string | null,
  collection: { isPublic: boolean; ownerId: string; members?: { userId: string }[] }
): boolean {
  // Public collections are viewable by anyone
  if (collection.isPublic) {
    return true;
  }

  // Must be logged in to view private collections
  if (!userId) {
    return false;
  }

  // Owner can always view
  if (collection.ownerId === userId) {
    return true;
  }

  // Members can view
  if (collection.members?.some(m => m.userId === userId)) {
    return true;
  }

  return false;
}

/**
 * Check if user can edit a collection.
 * Returns true if user is owner OR member with EDITOR role.
 */
export function canEditCollection(
  userId: string,
  collection: { ownerId: string; members?: { userId: string; role: CollectionRole }[] }
): boolean {
  // Owner can always edit
  if (collection.ownerId === userId) {
    return true;
  }

  // Members with EDITOR role can edit
  const member = collection.members?.find(m => m.userId === userId);
  if (member && member.role === 'EDITOR') {
    return true;
  }

  return false;
}

/**
 * Check if user is the collection owner.
 */
export function isCollectionOwner(
  userId: string,
  collection: { ownerId: string }
): boolean {
  return collection.ownerId === userId;
}

/**
 * Get user's role in a collection.
 * Returns OWNER if owner, the member's role if member, or null if neither.
 */
function getUserRole(
  userId: string | null,
  collection: { ownerId: string; members?: { userId: string; role: CollectionRole }[] }
): CollectionRole | null {
  if (!userId) {
    return null;
  }

  if (collection.ownerId === userId) {
    return 'OWNER';
  }

  const member = collection.members?.find(m => m.userId === userId);
  return member?.role ?? null;
}

// ============================================================================
// Collection CRUD
// ============================================================================

/**
 * Create a new collection with the user as owner.
 */
export async function createCollection(
  userId: string,
  input: CreateCollectionInput
): Promise<CollectionResponse> {
  if (!input.title || input.title.trim().length === 0) {
    throw new BadRequestError('Collection title is required');
  }

  const collection = await prisma.collection.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      coverUrl: input.coverUrl ?? null,
      isPublic: input.isPublic ?? false,
      ownerId: userId,
    },
    select: collectionSelect,
  });

  return formatCollectionResponse(collection);
}

/**
 * Get collections the user owns or is a member of.
 */
export async function getMyCollections(userId: string): Promise<CollectionResponse[]> {
  const collections = await prisma.collection.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    select: collectionSelect,
    orderBy: { updatedAt: 'desc' },
  });

  return collections.map(formatCollectionResponse);
}

/**
 * Get paginated public collections with optional search.
 */
export async function getPublicCollections(params: {
  userId?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
}): Promise<PaginatedCollectionsResponse> {
  const page = Math.max(1, params.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    isPublic: true,
  };

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  // Determine orderBy based on sortBy parameter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: any[];
  switch (params.sortBy) {
    case 'recent':
      orderBy = [{ createdAt: 'desc' }];
      break;
    case 'stars':
    default:
      orderBy = [{ stars: { _count: 'desc' } }, { updatedAt: 'desc' }];
      break;
  }

  const [total, collections] = await Promise.all([
    prisma.collection.count({ where }),
    prisma.collection.findMany({
      where,
      select: collectionSelect,
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    collections: collections.map(formatCollectionResponse),
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Get collections the user has starred.
 */
export async function getStarredCollections(userId: string): Promise<CollectionResponse[]> {
  const stars = await prisma.collectionStar.findMany({
    where: { userId },
    select: {
      collection: {
        select: collectionSelect,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return stars.map((s: { collection: CollectionWithCounts }) => formatCollectionResponse(s.collection));
}

/**
 * Get a single collection with full details.
 * Checks visibility permissions.
 */
export async function getCollection(
  collectionId: string,
  userId?: string
): Promise<CollectionDetailResponse> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      ...collectionSelect,
      ownerId: true,
      items: {
        select: collectionItemSelect,
        orderBy: { orderIndex: 'asc' },
      },
      members: {
        select: memberSelect,
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  // Get members for permission check
  const membersForCheck = await prisma.collectionMember.findMany({
    where: { collectionId },
    select: { userId: true, role: true },
  });

  const collectionWithMembers = {
    ...collection,
    members: membersForCheck,
  };

  if (!canViewCollection(userId ?? null, collectionWithMembers)) {
    throw new ForbiddenError('You do not have permission to view this collection');
  }

  // Check if user has starred this collection
  let isStarred = false;
  if (userId) {
    const star = await prisma.collectionStar.findUnique({
      where: {
        collectionId_userId: { collectionId, userId },
      },
    });
    isStarred = !!star;
  }

  const userRole = getUserRole(userId ?? null, collectionWithMembers);

  return {
    id: collection.id,
    title: collection.title,
    description: collection.description,
    coverUrl: collection.coverUrl,
    isPublic: collection.isPublic,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    owner: collection.owner,
    itemCount: collection._count.items,
    starCount: collection._count.stars,
    items: collection.items.map(formatCollectionItemResponse),
    members: collection.members.map(formatMemberResponse),
    userRole,
    isStarred,
  };
}

/**
 * Update a collection. Requires owner or editor role.
 */
export async function updateCollection(
  userId: string,
  collectionId: string,
  input: UpdateCollectionInput
): Promise<CollectionResponse> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      ownerId: true,
      members: {
        select: { userId: true, role: true },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canEditCollection(userId, collection)) {
    throw new ForbiddenError('You do not have permission to edit this collection');
  }

  const updated = await prisma.collection.update({
    where: { id: collectionId },
    data: {
      title: input.title?.trim(),
      description: input.description?.trim(),
      coverUrl: input.coverUrl,
      isPublic: input.isPublic,
    },
    select: collectionSelect,
  });

  return formatCollectionResponse(updated);
}

/**
 * Delete a collection. Owner only.
 */
export async function deleteCollection(
  userId: string,
  collectionId: string
): Promise<void> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { ownerId: true },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!isCollectionOwner(userId, collection)) {
    throw new ForbiddenError('Only the owner can delete this collection');
  }

  await prisma.collection.delete({
    where: { id: collectionId },
  });
}

// ============================================================================
// Collection Items
// ============================================================================

/**
 * Add an item to a collection. Requires edit permission.
 * Creates MediaSource if needed.
 */
export async function addCollectionItem(
  userId: string,
  collectionId: string,
  input: AddCollectionItemInput
): Promise<CollectionItemResponse> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      ownerId: true,
      members: {
        select: { userId: true, role: true },
      },
      _count: {
        select: { items: true },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canEditCollection(userId, collection)) {
    throw new ForbiddenError('You do not have permission to add items to this collection');
  }

  // Check for duplicate refId
  const existingItem = await prisma.collectionItem.findUnique({
    where: {
      collectionId_refId: { collectionId, refId: input.refId },
    },
  });

  if (existingItem) {
    throw new ConflictError('This item is already in the collection');
  }

  // Get or create MediaSource
  const source = await getOrCreateMediaSource(input.refId, input.type);

  // Determine order index
  const orderIndex = input.orderIndex ?? collection._count.items;

  const item = await prisma.collectionItem.create({
    data: {
      collectionId,
      refId: input.refId,
      type: input.type,
      note: input.note ?? null,
      orderIndex,
      sourceId: source.id,
    },
    select: collectionItemSelect,
  });

  return formatCollectionItemResponse(item);
}

/**
 * Update a collection item's note or order. Requires edit permission.
 */
export async function updateCollectionItem(
  userId: string,
  collectionId: string,
  itemId: string,
  input: UpdateCollectionItemInput
): Promise<CollectionItemResponse> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      ownerId: true,
      members: {
        select: { userId: true, role: true },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canEditCollection(userId, collection)) {
    throw new ForbiddenError('You do not have permission to edit items in this collection');
  }

  const item = await prisma.collectionItem.findFirst({
    where: { id: itemId, collectionId },
  });

  if (!item) {
    throw new NotFoundError('Collection item not found');
  }

  const updated = await prisma.collectionItem.update({
    where: { id: itemId },
    data: {
      note: input.note,
      orderIndex: input.orderIndex,
    },
    select: collectionItemSelect,
  });

  return formatCollectionItemResponse(updated);
}

/**
 * Remove an item from a collection. Requires edit permission.
 */
export async function removeCollectionItem(
  userId: string,
  collectionId: string,
  itemId: string
): Promise<void> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      ownerId: true,
      members: {
        select: { userId: true, role: true },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canEditCollection(userId, collection)) {
    throw new ForbiddenError('You do not have permission to remove items from this collection');
  }

  const item = await prisma.collectionItem.findFirst({
    where: { id: itemId, collectionId },
  });

  if (!item) {
    throw new NotFoundError('Collection item not found');
  }

  await prisma.collectionItem.delete({
    where: { id: itemId },
  });
}

/**
 * Bulk reorder collection items. Requires edit permission.
 */
export async function reorderCollectionItems(
  userId: string,
  collectionId: string,
  input: ReorderItemsInput
): Promise<CollectionItemResponse[]> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      ownerId: true,
      members: {
        select: { userId: true, role: true },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canEditCollection(userId, collection)) {
    throw new ForbiddenError('You do not have permission to reorder items in this collection');
  }

  const items = input.items;

  // Verify all items belong to this collection
  const itemIds = items.map(i => i.id);
  const existingItems = await prisma.collectionItem.findMany({
    where: { id: { in: itemIds }, collectionId },
    select: { id: true },
  });

  if (existingItems.length !== itemIds.length) {
    throw new BadRequestError('Some items do not belong to this collection');
  }

  // Update all items in a transaction
  await prisma.$transaction(
    items.map(item =>
      prisma.collectionItem.update({
        where: { id: item.id },
        data: { orderIndex: item.orderIndex },
      })
    )
  );

  // Return updated items
  const updatedItems = await prisma.collectionItem.findMany({
    where: { collectionId },
    select: collectionItemSelect,
    orderBy: { orderIndex: 'asc' },
  });

  return updatedItems.map(formatCollectionItemResponse);
}

// ============================================================================
// Collection Members
// ============================================================================

/**
 * Get collection members. Requires view permission.
 */
export async function getCollectionMembers(
  userId: string,
  collectionId: string
): Promise<CollectionMemberResponse[]> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      isPublic: true,
      ownerId: true,
      members: {
        select: { userId: true },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canViewCollection(userId, collection)) {
    throw new ForbiddenError('You do not have permission to view this collection');
  }

  const members = await prisma.collectionMember.findMany({
    where: { collectionId },
    select: memberSelect,
    orderBy: { createdAt: 'asc' },
  });

  return members.map(formatMemberResponse);
}

/**
 * Add a member to a collection by username. Owner only.
 */
export async function addCollectionMember(
  userId: string,
  collectionId: string,
  input: AddMemberInput
): Promise<CollectionMemberResponse> {
  const { username, role } = input;

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { ownerId: true },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!isCollectionOwner(userId, collection)) {
    throw new ForbiddenError('Only the owner can add members');
  }

  // Find user by username
  const userToAdd = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!userToAdd) {
    throw new NotFoundError('User not found');
  }

  if (userToAdd.id === collection.ownerId) {
    throw new BadRequestError('Cannot add the owner as a member');
  }

  // Check if already a member
  const existingMember = await prisma.collectionMember.findUnique({
    where: {
      collectionId_userId: { collectionId, userId: userToAdd.id },
    },
  });

  if (existingMember) {
    throw new ConflictError('User is already a member of this collection');
  }

  // Cannot add member with OWNER role
  if (role === 'OWNER') {
    throw new BadRequestError('Cannot add a member with OWNER role');
  }

  const member = await prisma.collectionMember.create({
    data: {
      collectionId,
      userId: userToAdd.id,
      role,
    },
    select: memberSelect,
  });

  return formatMemberResponse(member);
}

/**
 * Update a member's role. Owner only.
 */
export async function updateMemberRole(
  userId: string,
  collectionId: string,
  memberId: string,
  input: UpdateMemberRoleInput
): Promise<CollectionMemberResponse> {
  const { role } = input;

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { ownerId: true },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!isCollectionOwner(userId, collection)) {
    throw new ForbiddenError('Only the owner can change member roles');
  }

  const member = await prisma.collectionMember.findFirst({
    where: { id: memberId, collectionId },
  });

  if (!member) {
    throw new NotFoundError('Member not found');
  }

  // Cannot set role to OWNER
  if (role === 'OWNER') {
    throw new BadRequestError('Cannot change a member to OWNER role');
  }

  const updated = await prisma.collectionMember.update({
    where: { id: memberId },
    data: { role },
    select: memberSelect,
  });

  return formatMemberResponse(updated);
}

/**
 * Remove a member from a collection. Owner only, or self can leave.
 */
export async function removeCollectionMember(
  userId: string,
  collectionId: string,
  memberId: string
): Promise<void> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { ownerId: true },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  const member = await prisma.collectionMember.findFirst({
    where: { id: memberId, collectionId },
    select: { id: true, userId: true },
  });

  if (!member) {
    throw new NotFoundError('Member not found');
  }

  // Allow owner to remove anyone, or user can remove themselves
  if (!isCollectionOwner(userId, collection) && member.userId !== userId) {
    throw new ForbiddenError('You do not have permission to remove this member');
  }

  await prisma.collectionMember.delete({
    where: { id: memberId },
  });
}

/**
 * Leave a collection. For members only (not owner).
 */
export async function leaveCollection(
  userId: string,
  collectionId: string
): Promise<void> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { ownerId: true },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (isCollectionOwner(userId, collection)) {
    throw new BadRequestError('Owner cannot leave the collection. Transfer ownership or delete the collection instead.');
  }

  const member = await prisma.collectionMember.findUnique({
    where: {
      collectionId_userId: { collectionId, userId },
    },
  });

  if (!member) {
    throw new NotFoundError('You are not a member of this collection');
  }

  await prisma.collectionMember.delete({
    where: { id: member.id },
  });
}

// ============================================================================
// Collection Invites
// ============================================================================

/**
 * Generate a random token for invites.
 */
function generateInviteToken(): string {
  return crypto.randomBytes(INVITE_TOKEN_LENGTH / 2).toString('hex');
}

/**
 * Create a collection invite. Owner only.
 */
export async function createCollectionInvite(
  userId: string,
  collectionId: string,
  input: CreateInviteInput
): Promise<CollectionInviteResponse> {
  const { role, maxUses, expiresInDays } = input;

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { ownerId: true },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!isCollectionOwner(userId, collection)) {
    throw new ForbiddenError('Only the owner can create invites');
  }

  // Cannot create invite with OWNER role
  if (role === 'OWNER') {
    throw new BadRequestError('Cannot create an invite with OWNER role');
  }

  const token = generateInviteToken();
  const expiryDays = expiresInDays ?? DEFAULT_INVITE_EXPIRY_DAYS;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const invite = await prisma.collectionInvite.create({
    data: {
      collectionId,
      token,
      role,
      maxUses: maxUses ?? null,
      expiresAt,
    },
    select: inviteSelect,
  });

  return invite;
}

/**
 * Get active invites for a collection. Owner only.
 */
export async function getCollectionInvites(
  userId: string,
  collectionId: string
): Promise<CollectionInviteResponse[]> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { ownerId: true },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!isCollectionOwner(userId, collection)) {
    throw new ForbiddenError('Only the owner can view invites');
  }

  const now = new Date();

  const invites = await prisma.collectionInvite.findMany({
    where: {
      collectionId,
      expiresAt: { gt: now },
      OR: [
        { maxUses: null },
        { useCount: { lt: prisma.collectionInvite.fields.maxUses } },
      ],
    },
    select: inviteSelect,
    orderBy: { createdAt: 'desc' },
  });

  // Filter out invites that have reached max uses (Prisma can't compare fields directly)
  return invites.filter((invite: CollectionInviteResponse) => 
    invite.maxUses === null || invite.useCount < invite.maxUses
  );
}

/**
 * Revoke (delete) a collection invite. Owner only.
 */
export async function revokeCollectionInvite(
  userId: string,
  collectionId: string,
  inviteId: string
): Promise<void> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { ownerId: true },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!isCollectionOwner(userId, collection)) {
    throw new ForbiddenError('Only the owner can revoke invites');
  }

  const invite = await prisma.collectionInvite.findFirst({
    where: { id: inviteId, collectionId },
  });

  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  await prisma.collectionInvite.delete({
    where: { id: inviteId },
  });
}

/**
 * Join a collection using an invite token.
 */
export async function joinCollectionByInvite(
  userId: string,
  token: string
): Promise<{ collectionId: string; role: CollectionRole }> {
  const invite = await prisma.collectionInvite.findUnique({
    where: { token },
    select: {
      id: true,
      collectionId: true,
      role: true,
      maxUses: true,
      useCount: true,
      expiresAt: true,
      collection: {
        select: { ownerId: true },
      },
    },
  });

  if (!invite) {
    throw new NotFoundError('Invalid invite token');
  }

  // Check if expired
  if (invite.expiresAt < new Date()) {
    throw new BadRequestError('This invite has expired');
  }

  // Check if max uses reached
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    throw new BadRequestError('This invite has reached its maximum uses');
  }

  // Check if user is already owner
  if (invite.collection.ownerId === userId) {
    throw new BadRequestError('You are already the owner of this collection');
  }

  // Check if user is already a member
  const existingMember = await prisma.collectionMember.findUnique({
    where: {
      collectionId_userId: { collectionId: invite.collectionId, userId },
    },
  });

  if (existingMember) {
    throw new ConflictError('You are already a member of this collection');
  }

  // Use transaction to create member and increment use count
  await prisma.$transaction([
    prisma.collectionMember.create({
      data: {
        collectionId: invite.collectionId,
        userId,
        role: invite.role,
      },
    }),
    prisma.collectionInvite.update({
      where: { id: invite.id },
      data: { useCount: { increment: 1 } },
    }),
  ]);

  return {
    collectionId: invite.collectionId,
    role: invite.role,
  };
}

// ============================================================================
// Starring
// ============================================================================

export interface CollectionStarResponse {
  id: string;
  collectionId: string;
  userId: string;
  createdAt: Date;
}

/**
 * Star a collection. Requires view permission.
 */
export async function starCollection(
  userId: string,
  collectionId: string
): Promise<CollectionStarResponse> {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      isPublic: true,
      ownerId: true,
      members: {
        select: { userId: true },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canViewCollection(userId, collection)) {
    throw new ForbiddenError('You do not have permission to star this collection');
  }

  // Check if already starred
  const existingStar = await prisma.collectionStar.findUnique({
    where: {
      collectionId_userId: { collectionId, userId },
    },
  });

  if (existingStar) {
    throw new ConflictError('You have already starred this collection');
  }

  const star = await prisma.collectionStar.create({
    data: {
      collectionId,
      userId,
    },
    select: {
      id: true,
      collectionId: true,
      userId: true,
      createdAt: true,
    },
  });

  return star;
}

/**
 * Unstar a collection.
 */
export async function unstarCollection(
  userId: string,
  collectionId: string
): Promise<void> {
  const star = await prisma.collectionStar.findUnique({
    where: {
      collectionId_userId: { collectionId, userId },
    },
  });

  if (!star) {
    throw new NotFoundError('You have not starred this collection');
  }

  await prisma.collectionStar.delete({
    where: { id: star.id },
  });
}

// ============================================================================
// Comments
// ============================================================================

/**
 * Get comments for a collection. Requires view permission.
 */
export async function getCollectionComments(
  collectionId: string,
  options?: { userId?: string; page?: number; limit?: number }
): Promise<PaginatedCommentsResponse> {
  const userId = options?.userId;
  const page = Math.max(1, options?.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, options?.limit ?? DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      isPublic: true,
      ownerId: true,
      members: {
        select: { userId: true },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canViewCollection(userId ?? null, collection)) {
    throw new ForbiddenError('You do not have permission to view comments on this collection');
  }

  const [total, comments] = await Promise.all([
    prisma.collectionComment.count({ where: { collectionId } }),
    prisma.collectionComment.findMany({
      where: { collectionId },
      select: commentSelect,
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    comments: comments.map(formatCommentResponse),
    total,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Add a comment to a collection. Requires view permission.
 */
export async function addCollectionComment(
  userId: string,
  collectionId: string,
  input: AddCommentInput
): Promise<CollectionCommentResponse> {
  const { content } = input;

  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: {
      isPublic: true,
      ownerId: true,
      members: {
        select: { userId: true },
      },
    },
  });

  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!canViewCollection(userId, collection)) {
    throw new ForbiddenError('You do not have permission to comment on this collection');
  }

  if (!content || content.trim().length === 0) {
    throw new BadRequestError('Comment content cannot be empty');
  }

  if (content.length > 2000) {
    throw new BadRequestError('Comment content cannot exceed 2000 characters');
  }

  const comment = await prisma.collectionComment.create({
    data: {
      collectionId,
      userId,
      content: content.trim(),
    },
    select: commentSelect,
  });

  return formatCommentResponse(comment);
}

/**
 * Update a comment. Only the author can update.
 */
export async function updateCollectionComment(
  userId: string,
  collectionId: string,
  commentId: string,
  input: UpdateCommentInput
): Promise<CollectionCommentResponse> {
  const { content } = input;

  const comment = await prisma.collectionComment.findFirst({
    where: { id: commentId, collectionId },
    select: { userId: true },
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.userId !== userId) {
    throw new ForbiddenError('You can only update your own comments');
  }

  if (!content || content.trim().length === 0) {
    throw new BadRequestError('Comment content cannot be empty');
  }

  if (content.length > 2000) {
    throw new BadRequestError('Comment content cannot exceed 2000 characters');
  }

  const updated = await prisma.collectionComment.update({
    where: { id: commentId },
    data: { content: content.trim() },
    select: commentSelect,
  });

  return formatCommentResponse(updated);
}

/**
 * Delete a comment. Only the author can delete.
 */
export async function deleteCollectionComment(
  userId: string,
  collectionId: string,
  commentId: string
): Promise<void> {
  const comment = await prisma.collectionComment.findFirst({
    where: { id: commentId, collectionId },
    select: { userId: true },
  });

  if (!comment) {
    throw new NotFoundError('Comment not found');
  }

  if (comment.userId !== userId) {
    throw new ForbiddenError('You can only delete your own comments');
  }

  await prisma.collectionComment.delete({
    where: { id: commentId },
  });
}
