import type { CreateSuggestionInput } from '../../../../utils/schemas.js';
import type {
  FriendActivityEntry,
  FriendListResponse,
  FriendResponse,
  GroupedFriendListFilters,
  GroupedFriendListResponse,
  PublicProfileResponse,
  PrivateProfileResponse,
  SuggestionResponse,
  UserSearchResult,
} from '../dto/social.js';
import type { SuggestionStatus } from '@prisma/client';

export interface SocialGateway {
  getFollowing(userId: string): Promise<FriendResponse[]>;
  getFollowers(userId: string): Promise<FriendResponse[]>;
  followUser(followerId: string, followingId: string): Promise<void>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  getFriendList(userId: string, friendId: string): Promise<FriendListResponse>;
  getGroupedFriendList(userId: string, friendId: string, filters?: GroupedFriendListFilters): Promise<GroupedFriendListResponse>;
  searchUsers(query: string, currentUserId: string): Promise<UserSearchResult[]>;
  getPublicProfile(username: string, requesterId?: string): Promise<PublicProfileResponse | PrivateProfileResponse>;
  updatePrivacySettings(userId: string, isPublic: boolean): Promise<{ isPublic: boolean }>;
  getUserPrivacySettings(userId: string): Promise<{ isPublic: boolean }>;
  createSuggestion(fromUserId: string, toUserId: string, input: CreateSuggestionInput): Promise<SuggestionResponse>;
  getReceivedSuggestions(userId: string, status?: SuggestionStatus): Promise<SuggestionResponse[]>;
  getSentSuggestions(userId: string): Promise<SuggestionResponse[]>;
  acceptSuggestion(userId: string, suggestionId: string): Promise<SuggestionResponse>;
  dismissSuggestion(userId: string, suggestionId: string): Promise<SuggestionResponse>;
  deleteSuggestion(userId: string, suggestionId: string): Promise<void>;
  getFriendsActivity(userId: string): Promise<FriendActivityEntry[]>;
}
