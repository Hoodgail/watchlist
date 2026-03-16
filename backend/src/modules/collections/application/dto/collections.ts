import type { MediaType } from '@prisma/client';

export type CollectionRole = 'OWNER' | 'EDITOR' | 'VIEWER';

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
  user: CollectionOwner;
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

export interface CollectionSummaryResponse extends CollectionResponse {
  myRole: CollectionRole;
}

export interface CollectionDetailResponse extends CollectionResponse {
  items: CollectionItemResponse[];
  members: CollectionMemberResponse[];
  myRole: CollectionRole | null;
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
  author: CollectionOwner;
}

export interface CollectionStarResponse {
  id: string;
  collectionId: string;
  userId: string;
  createdAt: Date;
}

export interface PaginatedCollectionCommentsResponse {
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

export interface CollectionAccessContext {
  id: string;
  isPublic: boolean;
  ownerId: string;
  members: Array<{ id: string; userId: string; role: CollectionRole }>;
}

export interface CollectionCommentAuthor {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
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
  items: Array<{ id: string; orderIndex: number }>;
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

export interface AddCollectionCommentInput {
  content: string;
}

export interface UpdateCollectionCommentInput {
  content: string;
}

export interface PublicCollectionsQuery {
  userId?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
}

export interface CollectionCommentsQuery {
  collectionId: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface CatalogMediaSourceRecord {
  id: string;
}
