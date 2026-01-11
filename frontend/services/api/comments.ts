/**
 * Comments API
 */

import { API_BASE_URL, fetchWithAuth } from './client';

// ============ TYPES ============

export type CommentMediaType = 'TV' | 'MOVIE' | 'ANIME' | 'MANGA';
export type ReactionType = 'LIKE' | 'HELPFUL' | 'FUNNY' | 'INSIGHTFUL' | 'SPOILER';

export interface CommentAuthor {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface CommentMedia {
  title: string;
  imageUrl?: string | null;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  isSpoiler: boolean;
  isPublic: boolean;
  refId: string;
  mediaType: CommentMediaType;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  chapterNumber?: number | null;
  volumeNumber?: number | null;
  externalSource?: string | null;
  externalId?: string | null;
  externalAuthor?: string | null;
  externalAuthorAvatar?: string | null;
  externalUrl?: string | null;
  author?: CommentAuthor | null;
  media?: CommentMedia | null;
  reactionCounts?: Record<ReactionType, number>;
  userReaction?: ReactionType | null;
}

export interface CommentFeedResponse {
  comments: Comment[];
  nextCursor?: string;
}

export interface CreateCommentPayload {
  content: string;
  refId: string;
  mediaType: CommentMediaType;
  seasonNumber?: number;
  episodeNumber?: number;
  chapterNumber?: number;
  volumeNumber?: number;
  isPublic?: boolean;
  isSpoiler?: boolean;
}

export interface UpdateCommentPayload {
  content?: string;
  isPublic?: boolean;
  isSpoiler?: boolean;
}

export interface GetMediaCommentsOptions {
  mediaType: CommentMediaType;
  seasonNumber?: number;
  episodeNumber?: number;
  chapterNumber?: number;
  volumeNumber?: number;
  includeExternal?: boolean;
  limit?: number;
  cursor?: string;
}

export interface FeedOptions {
  limit?: number;
  cursor?: string;
  mediaType?: CommentMediaType;
}

// ============ API FUNCTIONS ============

/**
 * Create a new comment
 */
export async function createComment(payload: CreateCommentPayload): Promise<Comment> {
  const response = await fetchWithAuth('/comments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create comment');
  }

  return await response.json();
}

/**
 * Get comments for a specific media item
 */
export async function getMediaComments(
  refId: string,
  options: GetMediaCommentsOptions
): Promise<CommentFeedResponse> {
  const params = new URLSearchParams();
  params.append('mediaType', options.mediaType);
  if (options.seasonNumber !== undefined) params.append('seasonNumber', String(options.seasonNumber));
  if (options.episodeNumber !== undefined) params.append('episodeNumber', String(options.episodeNumber));
  if (options.chapterNumber !== undefined) params.append('chapterNumber', String(options.chapterNumber));
  if (options.volumeNumber !== undefined) params.append('volumeNumber', String(options.volumeNumber));
  if (options.includeExternal !== undefined) params.append('includeExternal', String(options.includeExternal));
  if (options.limit !== undefined) params.append('limit', String(options.limit));
  if (options.cursor) params.append('cursor', options.cursor);

  const response = await fetchWithAuth(`/comments/media/${encodeURIComponent(refId)}?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch comments');
  }

  return await response.json();
}

/**
 * Get friend activity feed (comments from users you follow)
 */
export async function getFriendCommentsFeed(options: FeedOptions = {}): Promise<CommentFeedResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.append('limit', String(options.limit));
  if (options.cursor) params.append('cursor', options.cursor);
  if (options.mediaType) params.append('mediaType', options.mediaType);

  const query = params.toString() ? `?${params}` : '';
  const response = await fetchWithAuth(`/comments/feed/friends${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch friend activity feed');
  }

  return await response.json();
}

/**
 * Get public comments feed (for Hot page)
 */
export async function getPublicCommentsFeed(options: FeedOptions = {}): Promise<CommentFeedResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.append('limit', String(options.limit));
  if (options.cursor) params.append('cursor', options.cursor);
  if (options.mediaType) params.append('mediaType', options.mediaType);

  const query = params.toString() ? `?${params}` : '';
  // Public feed doesn't require auth
  const response = await fetch(`${API_BASE_URL}/comments/feed/public${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch public comments feed');
  }

  return await response.json();
}

/**
 * Get a single comment with reactions
 */
export async function getComment(commentId: string): Promise<Comment> {
  const response = await fetchWithAuth(`/comments/${commentId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch comment');
  }

  return await response.json();
}

/**
 * Update own comment
 */
export async function updateComment(commentId: string, payload: UpdateCommentPayload): Promise<Comment> {
  const response = await fetchWithAuth(`/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update comment');
  }

  return await response.json();
}

/**
 * Delete own comment
 */
export async function deleteComment(commentId: string): Promise<void> {
  const response = await fetchWithAuth(`/comments/${commentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete comment');
  }
}

/**
 * Add reaction to a comment
 */
export async function addCommentReaction(commentId: string, reactionType: ReactionType): Promise<void> {
  const response = await fetchWithAuth(`/comments/${commentId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ reactionType }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to add reaction');
  }
}

/**
 * Remove reaction from a comment
 */
export async function removeCommentReaction(commentId: string): Promise<void> {
  const response = await fetchWithAuth(`/comments/${commentId}/reactions`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove reaction');
  }
}
