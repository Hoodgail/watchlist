import type { CreateSuggestionInput } from '../../../../utils/schemas.js';
import type { SuggestionStatus } from '@prisma/client';
import type { GroupedFriendListFilters } from '../dto/social.js';
import type { SocialGateway } from '../ports/SocialGateway.js';

export function createGetFollowingUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function getFollowing(query: { userId: string }) {
    return dependencies.socialGateway.getFollowing(query.userId);
  };
}

export function createGetFollowersUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function getFollowers(query: { userId: string }) {
    return dependencies.socialGateway.getFollowers(query.userId);
  };
}

export function createFollowUserUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function followUser(command: { followerId: string; followingId: string }) {
    return dependencies.socialGateway.followUser(command.followerId, command.followingId);
  };
}

export function createUnfollowUserUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function unfollowUser(command: { followerId: string; followingId: string }) {
    return dependencies.socialGateway.unfollowUser(command.followerId, command.followingId);
  };
}

export function createGetFriendListUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function getFriendList(query: { userId: string; friendId: string }) {
    return dependencies.socialGateway.getFriendList(query.userId, query.friendId);
  };
}

export function createGetGroupedFriendListUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function getGroupedFriendList(query: { userId: string; friendId: string; filters?: GroupedFriendListFilters }) {
    return dependencies.socialGateway.getGroupedFriendList(query.userId, query.friendId, query.filters);
  };
}

export function createSearchUsersUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function searchUsers(query: { query: string; currentUserId: string }) {
    return dependencies.socialGateway.searchUsers(query.query, query.currentUserId);
  };
}

export function createGetPublicProfileUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function getPublicProfile(query: { username: string; requesterId?: string }) {
    return dependencies.socialGateway.getPublicProfile(query.username, query.requesterId);
  };
}

export function createUpdatePrivacySettingsUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function updatePrivacySettings(command: { userId: string; isPublic: boolean }) {
    return dependencies.socialGateway.updatePrivacySettings(command.userId, command.isPublic);
  };
}

export function createGetUserPrivacySettingsUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function getUserPrivacySettings(query: { userId: string }) {
    return dependencies.socialGateway.getUserPrivacySettings(query.userId);
  };
}

export function createCreateSuggestionUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function createSuggestion(command: { fromUserId: string; toUserId: string; input: CreateSuggestionInput }) {
    return dependencies.socialGateway.createSuggestion(command.fromUserId, command.toUserId, command.input);
  };
}

export function createGetReceivedSuggestionsUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function getReceivedSuggestions(query: { userId: string; status?: SuggestionStatus }) {
    return dependencies.socialGateway.getReceivedSuggestions(query.userId, query.status);
  };
}

export function createGetSentSuggestionsUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function getSentSuggestions(query: { userId: string }) {
    return dependencies.socialGateway.getSentSuggestions(query.userId);
  };
}

export function createAcceptSuggestionUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function acceptSuggestion(command: { userId: string; suggestionId: string }) {
    return dependencies.socialGateway.acceptSuggestion(command.userId, command.suggestionId);
  };
}

export function createDismissSuggestionUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function dismissSuggestion(command: { userId: string; suggestionId: string }) {
    return dependencies.socialGateway.dismissSuggestion(command.userId, command.suggestionId);
  };
}

export function createDeleteSuggestionUseCase(dependencies: { socialGateway: SocialGateway }) {
  return async function deleteSuggestion(command: { userId: string; suggestionId: string }) {
    return dependencies.socialGateway.deleteSuggestion(command.userId, command.suggestionId);
  };
}
