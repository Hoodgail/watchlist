import { prisma } from '../../../config/database.js';
import type { MediaType } from '@prisma/client';
import type {
  CollectionAccessContext,
  CollectionCommentResponse,
  CollectionDetailResponse,
  CollectionInviteResponse,
  CollectionItemResponse,
  CollectionMemberResponse,
  CollectionResponse,
  CollectionRole,
  CollectionStarResponse,
  CollectionSummaryResponse,
  PaginatedCollectionsResponse,
  UpdateCollectionInput,
} from '../application/dto/collections.js';
import type { CollectionsGateway } from '../application/ports/CollectionsGateway.js';

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
    year?: number | null;
    releaseDate?: string | null;
    description?: string | null;
    genres?: string[];
    platforms?: string[];
    playtimeHours?: number | null;
  } | null;
};

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

export function createPrismaCollectionsGateway(): CollectionsGateway {
  return {
    async createCollection(ownerId, input) {
      const collection = await prisma.collection.create({
        data: {
          title: input.title.trim(),
          description: input.description?.trim() ?? null,
          coverUrl: input.coverUrl ?? null,
          isPublic: input.isPublic ?? false,
          ownerId,
        },
        select: collectionSelect,
      });

      return formatCollectionResponse(collection);
    },

    async getMyCollections(userId) {
      const collections = await prisma.collection.findMany({
        where: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: {
          ...collectionSelect,
          ownerId: true,
          members: {
            where: { userId },
            select: { role: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return collections.map((collection) => ({
        ...formatCollectionResponse(collection),
        myRole: collection.ownerId === userId ? 'OWNER' : collection.members[0]?.role ?? 'VIEWER',
      }));
    },

    async getPublicCollections(params) {
      const where: any = { isPublic: true };
      if (params.search) {
        where.OR = [
          { title: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ];
      }

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

      const skip = (params.page - 1) * params.limit;
      const [total, collections] = await Promise.all([
        prisma.collection.count({ where }),
        prisma.collection.findMany({
          where,
          select: collectionSelect,
          orderBy,
          skip,
          take: params.limit,
        }),
      ]);

      const totalPages = Math.ceil(total / params.limit);
      const response: PaginatedCollectionsResponse = {
        collections: collections.map(formatCollectionResponse),
        total,
        page: params.page,
        limit: params.limit,
        totalPages,
        hasMore: params.page < totalPages,
      };

      return response;
    },

    async getStarredCollections(userId) {
      const stars = await prisma.collectionStar.findMany({
        where: { userId },
        select: {
          collection: {
            select: collectionSelect,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return stars.map((star) => formatCollectionResponse(star.collection));
    },

    async getCollectionDetail(collectionId) {
      const collection = await prisma.collection.findUnique({
        where: { id: collectionId },
        select: {
          ...collectionSelect,
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
        return null;
      }

      const response: CollectionDetailResponse = {
        ...formatCollectionResponse(collection),
        items: collection.items.map(formatCollectionItemResponse),
        members: collection.members.map(formatMemberResponse),
        myRole: null,
        isStarred: false,
      };

      return response;
    },

    async getCollectionAccessContext(collectionId) {
      const collection = await prisma.collection.findUnique({
        where: { id: collectionId },
        select: {
          id: true,
          isPublic: true,
          ownerId: true,
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
            },
          },
        },
      });

      if (!collection) {
        return null;
      }

      const context: CollectionAccessContext = {
        id: collection.id,
        isPublic: collection.isPublic,
        ownerId: collection.ownerId,
        members: collection.members,
      };

      return context;
    },

    async updateCollection(collectionId, input: UpdateCollectionInput) {
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
    },

    async deleteCollection(collectionId) {
      await prisma.collection.delete({ where: { id: collectionId } });
    },

    async getCollectionItemCount(collectionId) {
      return prisma.collectionItem.count({ where: { collectionId } });
    },

    async findCollectionItemByRefId(collectionId, refId) {
      return prisma.collectionItem.findUnique({
        where: {
          collectionId_refId: { collectionId, refId },
        },
        select: { id: true },
      });
    },

    async createCollectionItem(input) {
      const item = await prisma.collectionItem.create({
        data: {
          collectionId: input.collectionId,
          refId: input.refId,
          type: input.type,
          note: input.note ?? null,
          orderIndex: input.orderIndex,
          sourceId: input.sourceId,
        },
        select: collectionItemSelect,
      });

      return formatCollectionItemResponse(item);
    },

    async getCollectionItem(collectionId, itemId) {
      return prisma.collectionItem.findFirst({
        where: { id: itemId, collectionId },
        select: { id: true },
      });
    },

    async updateCollectionItem(itemId, input) {
      const item = await prisma.collectionItem.update({
        where: { id: itemId },
        data: {
          note: input.note,
          orderIndex: input.orderIndex,
        },
        select: collectionItemSelect,
      });

      return formatCollectionItemResponse(item);
    },

    async deleteCollectionItem(itemId) {
      await prisma.collectionItem.delete({ where: { id: itemId } });
    },

    async getCollectionItemsByIds(collectionId, itemIds) {
      return prisma.collectionItem.findMany({
        where: { id: { in: itemIds }, collectionId },
        select: { id: true },
      });
    },

    async reorderCollectionItems(items) {
      await prisma.$transaction(
        items.map((item) =>
          prisma.collectionItem.update({
            where: { id: item.id },
            data: { orderIndex: item.orderIndex },
          }),
        ),
      );
    },

    async getOrderedCollectionItems(collectionId) {
      const items = await prisma.collectionItem.findMany({
        where: { collectionId },
        select: collectionItemSelect,
        orderBy: { orderIndex: 'asc' },
      });

      return items.map(formatCollectionItemResponse);
    },

    async getCollectionMembers(collectionId) {
      const members = await prisma.collectionMember.findMany({
        where: { collectionId },
        select: memberSelect,
        orderBy: { createdAt: 'asc' },
      });

      return members.map(formatMemberResponse);
    },

    async findUserByUsername(username) {
      return prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
    },

    async getMemberByCollectionAndUser(collectionId, userId) {
      return prisma.collectionMember.findUnique({
        where: {
          collectionId_userId: { collectionId, userId },
        },
        select: { id: true, userId: true },
      });
    },

    async createCollectionMember(collectionId, userId, role) {
      const member = await prisma.collectionMember.create({
        data: {
          collectionId,
          userId,
          role,
        },
        select: memberSelect,
      });

      return formatMemberResponse(member);
    },

    async getCollectionMember(memberId, collectionId) {
      return prisma.collectionMember.findFirst({
        where: {
          collectionId,
          OR: [{ id: memberId }, { userId: memberId }],
        },
        select: { id: true, userId: true },
      });
    },

    async updateCollectionMemberRole(memberId, role) {
      const member = await prisma.collectionMember.update({
        where: { id: memberId },
        data: { role },
        select: memberSelect,
      });

      return formatMemberResponse(member);
    },

    async deleteCollectionMember(memberId) {
      await prisma.collectionMember.delete({ where: { id: memberId } });
    },

    async createCollectionInvite(collectionId, input) {
      const invite = await prisma.collectionInvite.create({
        data: {
          collectionId,
          token: input.token,
          role: input.role,
          maxUses: input.maxUses ?? null,
          expiresAt: input.expiresAt,
        },
        select: inviteSelect,
      });

      return invite;
    },

    async getActiveCollectionInvites(collectionId, now) {
      const invites = await prisma.collectionInvite.findMany({
        where: {
          collectionId,
          expiresAt: { gt: now },
        },
        select: inviteSelect,
        orderBy: { createdAt: 'desc' },
      });

      return invites.filter((invite) => invite.maxUses === null || invite.useCount < invite.maxUses);
    },

    async getCollectionInvite(inviteId, collectionId) {
      return prisma.collectionInvite.findFirst({
        where: { id: inviteId, collectionId },
        select: { id: true },
      });
    },

    async deleteCollectionInvite(inviteId) {
      await prisma.collectionInvite.delete({ where: { id: inviteId } });
    },

    async findCollectionInviteByToken(token) {
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
        return null;
      }

      return {
        id: invite.id,
        collectionId: invite.collectionId,
        role: invite.role,
        maxUses: invite.maxUses,
        useCount: invite.useCount,
        expiresAt: invite.expiresAt,
        ownerId: invite.collection.ownerId,
      };
    },

    async createCollectionMemberFromInviteAndIncrementUseCount(input) {
      await prisma.$transaction([
        prisma.collectionMember.create({
          data: {
            collectionId: input.collectionId,
            userId: input.userId,
            role: input.role,
          },
        }),
        prisma.collectionInvite.update({
          where: { id: input.inviteId },
          data: { useCount: { increment: 1 } },
        }),
      ]);
    },

    async getCollectionStar(collectionId, userId) {
      return prisma.collectionStar.findUnique({
        where: {
          collectionId_userId: { collectionId, userId },
        },
        select: { id: true },
      });
    },

    async createCollectionStar(collectionId, userId) {
      return prisma.collectionStar.create({
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
    },

    async deleteCollectionStar(starId) {
      await prisma.collectionStar.delete({ where: { id: starId } });
    },

    async listCollectionComments(collectionId, pagination) {
      const [total, comments] = await Promise.all([
        prisma.collectionComment.count({ where: { collectionId } }),
        prisma.collectionComment.findMany({
          where: { collectionId },
          select: commentSelect,
          orderBy: { createdAt: 'asc' },
          skip: pagination.skip,
          take: pagination.take,
        }),
      ]);

      return {
        total,
        comments: comments.map(formatCommentResponse),
      };
    },

    async createCollectionComment(collectionId, userId, content) {
      const comment = await prisma.collectionComment.create({
        data: {
          collectionId,
          userId,
          content,
        },
        select: commentSelect,
      });

      return formatCommentResponse(comment);
    },

    async getCollectionCommentAuthorId(collectionId, commentId) {
      const comment = await prisma.collectionComment.findFirst({
        where: { id: commentId, collectionId },
        select: { userId: true },
      });

      return comment?.userId ?? null;
    },

    async updateCollectionComment(commentId, content) {
      const comment = await prisma.collectionComment.update({
        where: { id: commentId },
        data: { content },
        select: commentSelect,
      });

      return formatCommentResponse(comment);
    },

    async deleteCollectionComment(commentId) {
      await prisma.collectionComment.delete({ where: { id: commentId } });
    },
  };
}
