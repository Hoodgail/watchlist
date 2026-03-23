import {
  MediaStatus,
  SortBy,
  Suggestion,
  SuggestionStatus,
  User,
  MediaType,
} from '../../../types';
import { API_BASE_URL, fetchWithAuth } from '@/shared/api/client';
import {
  transformBackendItem,
  type MediaTypeFilter,
  type StatusGroupPagination,
} from '@/features/library/api';

interface BackendFollowingUser {
  id: string;
  username: string;
  listCount: number;
  activeCount: number;
}

interface BackendUserWithList {
  id: string;
  username: string;
  list: BackendMediaItem[];
}

interface BackendGroupedFriendList {
  id: string;
  username: string;
  displayName: string | null;
  groups: {
    WATCHING: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    READING: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    PLAYING: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    PAUSED: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    PLAN_TO_WATCH: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    COMPLETED: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
    DROPPED: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number };
  };
  grandTotal: number;
}

interface BackendSearchUser {
  id: string;
  username: string;
  isFollowing: boolean;
}

interface BackendMediaItem {
  id: string;
  title: string;
  type: string;
  current: number;
  total: number | null;
  status: string;
  notes: string | null;
  rating: number | null;
  imageUrl?: string | null;
  refId?: string | null;
  friendsStatuses?: any[];
  activeProgress?: any | null;
  aliases?: Array<{ id?: string; refId: string; provider: string; createdAt?: string }>;
  year?: number | null;
  releaseDate?: string | null;
  description?: string | null;
  genres?: string[];
  platforms?: string[];
  metacritic?: number | null;
  playtimeHours?: number | null;
}

export interface GroupedFriendListResponse {
  id: string;
  username: string;
  displayName: string | null;
  groups: {
    WATCHING: StatusGroupPagination;
    READING: StatusGroupPagination;
    PLAYING: StatusGroupPagination;
    PAUSED: StatusGroupPagination;
    PLAN_TO_WATCH: StatusGroupPagination;
    COMPLETED: StatusGroupPagination;
    DROPPED: StatusGroupPagination;
  };
  grandTotal: number;
}

interface GroupedFriendListFilters {
  mediaTypeFilter?: MediaTypeFilter;
  statusPages?: Partial<Record<MediaStatus, number>>;
  limit?: number;
  sortBy?: SortBy;
}

export interface SendSuggestionPayload {
  refId: string;
  type: MediaType;
  message?: string;
}

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

export interface FriendActivityItem {
  id: string;
  title: string;
  type: string;
  status: string;
  current: number;
  total: number | null;
  imageUrl: string | null;
  refId: string | null;
  updatedAt: string;
}

export interface FriendActivityEntry {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  latestItem: FriendActivityItem | null;
  updatedAt: string;
}

export async function getFollowing(): Promise<User[]> {
  const response = await fetchWithAuth('/friends');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch following');
  }

  const users: BackendFollowingUser[] = await response.json();
  return users.map((user) => ({ id: user.id, username: user.username, list: [] }));
}

export async function getFollowers(): Promise<User[]> {
  const response = await fetchWithAuth('/friends/followers');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch followers');
  }

  const users: { id: string; username: string }[] = await response.json();
  return users.map((user) => ({ id: user.id, username: user.username, list: [] }));
}

export async function getFriendsActivity(): Promise<FriendActivityEntry[]> {
  const response = await fetchWithAuth('/friends/activity');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch friends activity');
  }

  return await response.json();
}

export async function followUser(userId: string): Promise<void> {
  const response = await fetchWithAuth(`/friends/${userId}`, { method: 'POST' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to follow user');
  }
}

export async function unfollowUser(userId: string): Promise<void> {
  const response = await fetchWithAuth(`/friends/${userId}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unfollow user');
  }
}

export async function searchUsers(query: string): Promise<User[]> {
  const response = await fetchWithAuth(`/friends/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search users');
  }

  const users: BackendSearchUser[] = await response.json();
  return users.map((user) => ({ id: user.id, username: user.username, list: [] }));
}

export async function getUserList(userId: string): Promise<User> {
  const response = await fetchWithAuth(`/friends/${userId}/list`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch user list');
  }

  const data: BackendUserWithList = await response.json();
  return {
    id: data.id,
    username: data.username,
    list: data.list.map((item) => transformBackendItem(item as any)),
  };
}

export async function getFriendGroupedList(
  userId: string,
  filters?: GroupedFriendListFilters,
): Promise<GroupedFriendListResponse> {
  const params = new URLSearchParams();
  if (filters?.mediaTypeFilter) params.append('mediaTypeFilter', filters.mediaTypeFilter);
  if (filters?.limit) params.append('limit', String(filters.limit));
  if (filters?.statusPages) params.append('statusPages', JSON.stringify(filters.statusPages));
  if (filters?.sortBy) params.append('sortBy', filters.sortBy);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/friends/${userId}/list/grouped${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch friend grouped list');
  }

  const data: BackendGroupedFriendList = await response.json();
  const transformGroup = (group: { items: BackendMediaItem[]; total: number; hasMore: boolean; page: number }): StatusGroupPagination => ({
    items: group.items.map((item) => transformBackendItem(item as any)),
    total: group.total,
    hasMore: group.hasMore,
    page: group.page,
  });

  return {
    id: data.id,
    username: data.username,
    displayName: data.displayName,
    groups: {
      WATCHING: transformGroup(data.groups.WATCHING),
      READING: transformGroup(data.groups.READING),
      PLAYING: transformGroup(data.groups.PLAYING),
      PAUSED: transformGroup(data.groups.PAUSED),
      PLAN_TO_WATCH: transformGroup(data.groups.PLAN_TO_WATCH),
      COMPLETED: transformGroup(data.groups.COMPLETED),
      DROPPED: transformGroup(data.groups.DROPPED),
    },
    grandTotal: data.grandTotal,
  };
}

export async function getReceivedSuggestions(status?: SuggestionStatus): Promise<Suggestion[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetchWithAuth(`/suggestions/received${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch received suggestions');
  }

  return await response.json();
}

export async function getSentSuggestions(): Promise<Suggestion[]> {
  const response = await fetchWithAuth('/suggestions/sent');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sent suggestions');
  }

  return await response.json();
}

export async function sendSuggestion(userId: string, suggestion: SendSuggestionPayload): Promise<Suggestion> {
  const response = await fetchWithAuth(`/suggestions/${userId}`, {
    method: 'POST',
    body: JSON.stringify(suggestion),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send suggestion');
  }

  return await response.json();
}

export async function acceptSuggestion(id: string): Promise<Suggestion> {
  const response = await fetchWithAuth(`/suggestions/${id}/accept`, { method: 'PATCH' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to accept suggestion');
  }

  return await response.json();
}

export async function dismissSuggestion(id: string): Promise<Suggestion> {
  const response = await fetchWithAuth(`/suggestions/${id}/dismiss`, { method: 'PATCH' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to dismiss suggestion');
  }

  return await response.json();
}

export async function deleteSuggestion(id: string): Promise<void> {
  const response = await fetchWithAuth(`/suggestions/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete suggestion');
  }
}

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

export async function getMediaComments(
  refId: string,
  options: GetMediaCommentsOptions,
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

export async function getPublicCommentsFeed(options: FeedOptions = {}): Promise<CommentFeedResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.append('limit', String(options.limit));
  if (options.cursor) params.append('cursor', options.cursor);
  if (options.mediaType) params.append('mediaType', options.mediaType);

  const query = params.toString() ? `?${params}` : '';
  const response = await fetch(`${API_BASE_URL}/comments/feed/public${query}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch public comments feed');
  }

  return await response.json();
}

export async function getComment(commentId: string): Promise<Comment> {
  const response = await fetchWithAuth(`/comments/${commentId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch comment');
  }

  return await response.json();
}

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

export async function deleteComment(commentId: string): Promise<void> {
  const response = await fetchWithAuth(`/comments/${commentId}`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete comment');
  }
}

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

export async function removeCommentReaction(commentId: string): Promise<void> {
  const response = await fetchWithAuth(`/comments/${commentId}/reactions`, { method: 'DELETE' });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove reaction');
  }
}
