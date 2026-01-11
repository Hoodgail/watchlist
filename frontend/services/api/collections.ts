/**
 * Collections API
 */

import {
  MediaType,
  Collection,
  CollectionWithDetails,
  CollectionItem,
  CollectionMember,
  CollectionInvite,
  CollectionComment,
  CollectionRole,
} from '../../types';
import { fetchWithAuth } from './client';

// ============ COLLECTIONS ============

export async function createCollection(data: {
  title: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
}): Promise<Collection> {
  const response = await fetchWithAuth('/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create collection');
  }

  return await response.json();
}

export async function getMyCollections(): Promise<Collection[]> {
  const response = await fetchWithAuth('/collections');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch collections');
  }

  return await response.json();
}

export async function getPublicCollections(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ data: Collection[]; total: number; page: number; limit: number }> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);
  const queryStr = query.toString();

  const response = await fetchWithAuth(`/collections/public${queryStr ? `?${queryStr}` : ''}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch public collections');
  }

  const result = await response.json();
  // Backend returns { collections, total, page, limit, totalPages, hasMore }
  // Transform to expected format
  return {
    data: result.collections || [],
    total: result.total || 0,
    page: result.page || 1,
    limit: result.limit || 20,
  };
}

export async function getStarredCollections(): Promise<Collection[]> {
  const response = await fetchWithAuth('/collections/starred');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch starred collections');
  }

  return await response.json();
}

export async function getCollection(id: string): Promise<CollectionWithDetails> {
  const response = await fetchWithAuth(`/collections/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch collection');
  }

  return await response.json();
}

export async function updateCollection(id: string, data: {
  title?: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
}): Promise<Collection> {
  const response = await fetchWithAuth(`/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update collection');
  }

  return await response.json();
}

export async function deleteCollection(id: string): Promise<void> {
  const response = await fetchWithAuth(`/collections/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete collection');
  }
}

// ============ COLLECTION ITEMS ============

export async function addCollectionItem(collectionId: string, data: {
  refId: string;
  title?: string;
  imageUrl?: string;
  type: MediaType;
  note?: string;
}): Promise<CollectionItem> {
  const response = await fetchWithAuth(`/collections/${collectionId}/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add item to collection');
  }

  return await response.json();
}

export async function updateCollectionItem(collectionId: string, itemId: string, data: {
  note?: string;
  orderIndex?: number;
}): Promise<CollectionItem> {
  const response = await fetchWithAuth(`/collections/${collectionId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update collection item');
  }

  return await response.json();
}

export async function removeCollectionItem(collectionId: string, itemId: string): Promise<void> {
  const response = await fetchWithAuth(`/collections/${collectionId}/items/${itemId}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove item from collection');
  }
}

export async function reorderCollectionItems(collectionId: string, items: { id: string; orderIndex: number }[]): Promise<void> {
  const response = await fetchWithAuth(`/collections/${collectionId}/items/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to reorder collection items');
  }
}

// ============ COLLECTION MEMBERS ============

export async function getCollectionMembers(collectionId: string): Promise<CollectionMember[]> {
  const response = await fetchWithAuth(`/collections/${collectionId}/members`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch collection members');
  }

  return await response.json();
}

export async function addCollectionMember(collectionId: string, username: string, role: 'EDITOR' | 'VIEWER'): Promise<CollectionMember> {
  const response = await fetchWithAuth(`/collections/${collectionId}/members`, {
    method: 'POST',
    body: JSON.stringify({ username, role }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add collection member');
  }

  return await response.json();
}

export async function updateMemberRole(collectionId: string, userId: string, role: 'EDITOR' | 'VIEWER'): Promise<CollectionMember> {
  const response = await fetchWithAuth(`/collections/${collectionId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update member role');
  }

  return await response.json();
}

export async function removeCollectionMember(collectionId: string, userId: string): Promise<void> {
  const response = await fetchWithAuth(`/collections/${collectionId}/members/${userId}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove collection member');
  }
}

export async function leaveCollection(collectionId: string): Promise<void> {
  const response = await fetchWithAuth(`/collections/${collectionId}/leave`, { method: 'POST' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to leave collection');
  }
}

// ============ COLLECTION INVITES ============

export async function createCollectionInvite(collectionId: string, data: {
  role: 'EDITOR' | 'VIEWER';
  maxUses?: number;
  expiresInDays?: number;
}): Promise<CollectionInvite> {
  const response = await fetchWithAuth(`/collections/${collectionId}/invites`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create collection invite');
  }

  return await response.json();
}

export async function getCollectionInvites(collectionId: string): Promise<CollectionInvite[]> {
  const response = await fetchWithAuth(`/collections/${collectionId}/invites`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch collection invites');
  }

  return await response.json();
}

export async function revokeCollectionInvite(collectionId: string, inviteId: string): Promise<void> {
  const response = await fetchWithAuth(`/collections/${collectionId}/invites/${inviteId}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to revoke collection invite');
  }
}

export async function joinCollectionByInvite(token: string): Promise<{ collection: Collection; role: CollectionRole }> {
  const response = await fetchWithAuth(`/collections/join/${token}`, { method: 'POST' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join collection');
  }

  return await response.json();
}

// ============ COLLECTION STARS ============

export async function starCollection(collectionId: string): Promise<void> {
  const response = await fetchWithAuth(`/collections/${collectionId}/star`, { method: 'POST' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to star collection');
  }
}

export async function unstarCollection(collectionId: string): Promise<void> {
  const response = await fetchWithAuth(`/collections/${collectionId}/star`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unstar collection');
  }
}

// ============ COLLECTION COMMENTS ============

export async function getCollectionComments(collectionId: string): Promise<CollectionComment[]> {
  const response = await fetchWithAuth(`/collections/${collectionId}/comments`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch collection comments');
  }

  return await response.json();
}

export async function addCollectionComment(collectionId: string, content: string): Promise<CollectionComment> {
  const response = await fetchWithAuth(`/collections/${collectionId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add comment');
  }

  return await response.json();
}

export async function updateCollectionComment(collectionId: string, commentId: string, content: string): Promise<CollectionComment> {
  const response = await fetchWithAuth(`/collections/${collectionId}/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update comment');
  }

  return await response.json();
}

export async function deleteCollectionComment(collectionId: string, commentId: string): Promise<void> {
  const response = await fetchWithAuth(`/collections/${collectionId}/comments/${commentId}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete comment');
  }
}
