import type {
  CollectionAccessContext,
  CollectionCommentResponse,
  CollectionDetailResponse,
  CollectionInviteResponse,
  CollectionItemResponse,
  CollectionMemberResponse,
  CollectionResponse,
  CollectionStarResponse,
  CollectionSummaryResponse,
  PaginatedCollectionsResponse,
  UpdateCollectionInput,
} from '../dto/collections.js';

export interface CollectionsGateway {
  createCollection(
    ownerId: string,
    input: { title: string; description?: string; coverUrl?: string; isPublic?: boolean },
  ): Promise<CollectionResponse>;
  getMyCollections(userId: string): Promise<CollectionSummaryResponse[]>;
  getPublicCollections(params: {
    page: number;
    limit: number;
    search?: string;
    sortBy?: string;
  }): Promise<PaginatedCollectionsResponse>;
  getStarredCollections(userId: string): Promise<CollectionResponse[]>;
  getCollectionDetail(collectionId: string): Promise<CollectionDetailResponse | null>;
  getCollectionAccessContext(collectionId: string): Promise<CollectionAccessContext | null>;
  updateCollection(collectionId: string, input: UpdateCollectionInput): Promise<CollectionResponse>;
  deleteCollection(collectionId: string): Promise<void>;
  getCollectionItemCount(collectionId: string): Promise<number>;
  findCollectionItemByRefId(collectionId: string, refId: string): Promise<{ id: string } | null>;
  createCollectionItem(input: {
    collectionId: string;
    refId: string;
    type: import('@prisma/client').MediaType;
    note?: string;
    orderIndex: number;
    sourceId: string;
  }): Promise<CollectionItemResponse>;
  getCollectionItem(collectionId: string, itemId: string): Promise<{ id: string } | null>;
  updateCollectionItem(itemId: string, input: { note?: string; orderIndex?: number }): Promise<CollectionItemResponse>;
  deleteCollectionItem(itemId: string): Promise<void>;
  getCollectionItemsByIds(collectionId: string, itemIds: string[]): Promise<Array<{ id: string }>>;
  reorderCollectionItems(items: Array<{ id: string; orderIndex: number }>): Promise<void>;
  getOrderedCollectionItems(collectionId: string): Promise<CollectionItemResponse[]>;
  getCollectionMembers(collectionId: string): Promise<CollectionMemberResponse[]>;
  findUserByUsername(username: string): Promise<{ id: string } | null>;
  getMemberByCollectionAndUser(collectionId: string, userId: string): Promise<{ id: string; userId: string } | null>;
  createCollectionMember(collectionId: string, userId: string, role: 'EDITOR' | 'VIEWER'): Promise<CollectionMemberResponse>;
  getCollectionMember(memberId: string, collectionId: string): Promise<{ id: string; userId: string } | null>;
  updateCollectionMemberRole(memberId: string, role: 'EDITOR' | 'VIEWER'): Promise<CollectionMemberResponse>;
  deleteCollectionMember(memberId: string): Promise<void>;
  createCollectionInvite(collectionId: string, input: {
    token: string;
    role: 'EDITOR' | 'VIEWER';
    maxUses?: number;
    expiresAt: Date;
  }): Promise<CollectionInviteResponse>;
  getActiveCollectionInvites(collectionId: string, now: Date): Promise<CollectionInviteResponse[]>;
  getCollectionInvite(inviteId: string, collectionId: string): Promise<{ id: string } | null>;
  deleteCollectionInvite(inviteId: string): Promise<void>;
  findCollectionInviteByToken(token: string): Promise<{
    id: string;
    collectionId: string;
    role: import('../dto/collections.js').CollectionRole;
    maxUses: number | null;
    useCount: number;
    expiresAt: Date;
    ownerId: string;
  } | null>;
  createCollectionMemberFromInviteAndIncrementUseCount(input: {
    inviteId: string;
    collectionId: string;
    userId: string;
    role: 'EDITOR' | 'VIEWER';
  }): Promise<void>;
  getCollectionStar(collectionId: string, userId: string): Promise<{ id: string } | null>;
  createCollectionStar(collectionId: string, userId: string): Promise<CollectionStarResponse>;
  deleteCollectionStar(starId: string): Promise<void>;
  listCollectionComments(
    collectionId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ total: number; comments: CollectionCommentResponse[] }>;
  createCollectionComment(collectionId: string, userId: string, content: string): Promise<CollectionCommentResponse>;
  getCollectionCommentAuthorId(collectionId: string, commentId: string): Promise<string | null>;
  updateCollectionComment(commentId: string, content: string): Promise<CollectionCommentResponse>;
  deleteCollectionComment(commentId: string): Promise<void>;
}
