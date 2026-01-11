/**
 * API Service
 * 
 * This file re-exports all API functions from the modular api/ directory.
 * For new code, you can import directly from './api' or from individual modules
 * like './api/auth', './api/list', etc.
 */

// Core client
export {
  API_BASE_URL,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  storeTokens,
  removeTokens,
  fetchWithAuth,
  healthCheck,
} from './api/client';

// Auth
export {
  login,
  register,
  logout,
  getCurrentUser,
  getOAuthUrl,
  getLinkedProviders,
  linkOAuthAccount,
  unlinkOAuthAccount,
  setRecoveryEmail,
  removeRecoveryEmail,
  verifyRecoveryEmail,
  setPassword,
  changePassword,
  initiateAccountRecovery,
  completeAccountRecovery,
} from './api/auth';

// List
export {
  getMyList,
  getMyGroupedList,
  addToList,
  updateListItem,
  deleteListItem,
  linkSource,
  getStatusesByRefIds,
  transformBackendItem,
} from './api/list';
export type {
  PaginatedListResponse,
  StatusGroupPagination,
  GroupedListResponse,
  MediaTypeFilter,
  BulkStatusItem,
} from './api/list';

// Friends
export {
  getFollowing,
  getFollowers,
  followUser,
  unfollowUser,
  searchUsers,
  getUserList,
  getFriendGroupedList,
} from './api/friends';
export type { GroupedFriendListResponse } from './api/friends';

// Suggestions
export {
  getReceivedSuggestions,
  getSentSuggestions,
  sendSuggestion,
  acceptSuggestion,
  dismissSuggestion,
  deleteSuggestion,
} from './api/suggestions';
export type { SendSuggestionPayload } from './api/suggestions';

// Profile
export {
  getPublicProfile,
  updatePrivacySettings,
  getPrivacySettings,
} from './api/profile';

// Provider Mappings
export {
  getProviderMapping,
  getProviderMappings,
  saveProviderMapping,
  saveAutoMapping,
  deleteProviderMapping,
} from './api/providerMappings';
export type { ProviderMapping } from './api/providerMappings';

// Watch Progress
export {
  updateWatchProgress,
  getAllWatchProgress,
  getWatchProgressForMedia,
  getWatchProgressForEpisode,
  deleteWatchProgressForMedia,
  deleteWatchProgressForEpisode,
} from './api/watchProgress';
export type { WatchProgressData, UpdateWatchProgressPayload } from './api/watchProgress';

// Media Source
export {
  getMediaSourceWithAliases,
  findMediaSourceByRefId,
  linkMediaSource,
  unlinkMediaSource,
} from './api/mediaSource';
export type { MediaSourceWithAliases } from './api/mediaSource';

// Comments
export {
  createComment,
  getMediaComments,
  getFriendCommentsFeed,
  getPublicCommentsFeed,
  getComment,
  updateComment,
  deleteComment,
  addCommentReaction,
  removeCommentReaction,
} from './api/comments';
export type {
  CommentMediaType,
  ReactionType,
  CommentAuthor,
  CommentMedia,
  Comment,
  CommentFeedResponse,
  CreateCommentPayload,
  UpdateCommentPayload,
  GetMediaCommentsOptions,
  FeedOptions,
} from './api/comments';

// Collections
export {
  createCollection,
  getMyCollections,
  getPublicCollections,
  getPublicCollection,
  getStarredCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  addCollectionItem,
  updateCollectionItem,
  removeCollectionItem,
  reorderCollectionItems,
  getCollectionMembers,
  addCollectionMember,
  updateMemberRole,
  removeCollectionMember,
  leaveCollection,
  createCollectionInvite,
  getCollectionInvites,
  revokeCollectionInvite,
  joinCollectionByInvite,
  starCollection,
  unstarCollection,
  getCollectionComments,
  addCollectionComment,
  updateCollectionComment,
  deleteCollectionComment,
} from './api/collections';
