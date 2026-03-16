import {
  createAcceptSuggestionUseCase,
  createCreateSuggestionUseCase,
  createDeleteSuggestionUseCase,
  createDismissSuggestionUseCase,
  createFollowUserUseCase,
  createGetFollowersUseCase,
  createGetFollowingUseCase,
  createGetFriendListUseCase,
  createGetGroupedFriendListUseCase,
  createGetPublicProfileUseCase,
  createGetReceivedSuggestionsUseCase,
  createGetSentSuggestionsUseCase,
  createGetUserPrivacySettingsUseCase,
  createSearchUsersUseCase,
  createUnfollowUserUseCase,
  createUpdatePrivacySettingsUseCase,
} from '../application/useCases/social.js';
import { createPrismaSocialGateway } from '../infrastructure/prismaSocialGateway.js';
import type { SocialGateway } from '../application/ports/SocialGateway.js';

export interface SocialApplicationDependencies {
  socialGateway: SocialGateway;
}

export function createSocialApplication(dependencies?: Partial<SocialApplicationDependencies>) {
  const socialGateway = dependencies?.socialGateway ?? createPrismaSocialGateway();

  return {
    getFollowing: createGetFollowingUseCase({ socialGateway }),
    getFollowers: createGetFollowersUseCase({ socialGateway }),
    followUser: createFollowUserUseCase({ socialGateway }),
    unfollowUser: createUnfollowUserUseCase({ socialGateway }),
    getFriendList: createGetFriendListUseCase({ socialGateway }),
    getGroupedFriendList: createGetGroupedFriendListUseCase({ socialGateway }),
    searchUsers: createSearchUsersUseCase({ socialGateway }),
    getPublicProfile: createGetPublicProfileUseCase({ socialGateway }),
    updatePrivacySettings: createUpdatePrivacySettingsUseCase({ socialGateway }),
    getUserPrivacySettings: createGetUserPrivacySettingsUseCase({ socialGateway }),
    createSuggestion: createCreateSuggestionUseCase({ socialGateway }),
    getReceivedSuggestions: createGetReceivedSuggestionsUseCase({ socialGateway }),
    getSentSuggestions: createGetSentSuggestionsUseCase({ socialGateway }),
    acceptSuggestion: createAcceptSuggestionUseCase({ socialGateway }),
    dismissSuggestion: createDismissSuggestionUseCase({ socialGateway }),
    deleteSuggestion: createDeleteSuggestionUseCase({ socialGateway }),
  };
}

export const socialApplication = createSocialApplication();
