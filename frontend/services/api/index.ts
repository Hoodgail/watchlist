/**
 * API Module Barrel Export
 * 
 * Re-exports all API functions from individual modules for easier imports.
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
} from './client';

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
} from './auth';

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
} from './list';
export type {
  PaginatedListResponse,
  StatusGroupPagination,
  GroupedListResponse,
  MediaTypeFilter,
  BulkStatusItem,
} from './list';

// Friends
export {
  getFollowing,
  getFollowers,
  followUser,
  unfollowUser,
  searchUsers,
  getUserList,
  getFriendGroupedList,
} from './friends';
export type { GroupedFriendListResponse } from './friends';

// Suggestions
export {
  getReceivedSuggestions,
  getSentSuggestions,
  sendSuggestion,
  acceptSuggestion,
  dismissSuggestion,
  deleteSuggestion,
} from './suggestions';
export type { SendSuggestionPayload } from './suggestions';

// Profile
export {
  getPublicProfile,
  updatePrivacySettings,
  getPrivacySettings,
} from './profile';

// Provider Mappings
export {
  getProviderMapping,
  getProviderMappings,
  saveProviderMapping,
  saveAutoMapping,
  deleteProviderMapping,
} from './providerMappings';
export type { ProviderMapping } from './providerMappings';

// Watch Progress
export {
  updateWatchProgress,
  getAllWatchProgress,
  getWatchProgressForMedia,
  getWatchProgressForEpisode,
  deleteWatchProgressForMedia,
  deleteWatchProgressForEpisode,
} from './watchProgress';
export type { WatchProgressData, UpdateWatchProgressPayload } from './watchProgress';

// Media Source
export {
  getMediaSourceWithAliases,
  findMediaSourceByRefId,
  linkMediaSource,
  unlinkMediaSource,
} from './mediaSource';
export type { MediaSourceWithAliases } from './mediaSource';

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
} from './comments';
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
} from './comments';

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
} from './collections';
