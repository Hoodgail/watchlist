import {
  createAddReactionUseCase,
  createCreateCommentUseCase,
  createDeleteCommentUseCase,
  createGetCommentUseCase,
  createGetFriendsFeedUseCase,
  createGetMediaCommentsUseCase,
  createGetPublicFeedUseCase,
  createImportExternalCommentUseCase,
  createRemoveReactionUseCase,
  createUpdateCommentUseCase,
} from '../application/useCases/comments.js';
import {
  createFetchExternalCommentsFromProviderUseCase,
  createFetchExternalCommentsUseCase,
  createFetchExternalCommentsWithResolutionUseCase,
  createGetExternalProvidersForMediaTypeUseCase,
  createGetExternalProvidersUseCase,
  createPreviewExternalResolutionUseCase,
  createRefreshExternalCommentsUseCase,
} from '../application/useCases/externalComments.js';
import type { CommentsGateway } from '../application/ports/CommentsGateway.js';
import type { ExternalCommentsGateway } from '../application/ports/ExternalCommentsGateway.js';
import { createPrismaCommentsGateway } from '../infrastructure/prismaCommentsGateway.js';
import { createPrismaExternalCommentsGateway } from '../infrastructure/prismaExternalCommentsGateway.js';

export interface CommentsApplicationDependencies {
  commentsGateway: CommentsGateway;
  externalCommentsGateway: ExternalCommentsGateway;
}

export function createCommentsApplication(dependencies?: Partial<CommentsApplicationDependencies>) {
  const commentsGateway = dependencies?.commentsGateway ?? createPrismaCommentsGateway();
  const externalCommentsGateway = dependencies?.externalCommentsGateway ?? createPrismaExternalCommentsGateway(commentsGateway);

  return {
    createComment: createCreateCommentUseCase({ commentsGateway }),
    updateComment: createUpdateCommentUseCase({ commentsGateway }),
    deleteComment: createDeleteCommentUseCase({ commentsGateway }),
    getMediaComments: createGetMediaCommentsUseCase({ commentsGateway }),
    getFriendsFeed: createGetFriendsFeedUseCase({ commentsGateway }),
    getPublicFeed: createGetPublicFeedUseCase({ commentsGateway }),
    importExternalComment: createImportExternalCommentUseCase({ commentsGateway }),
    addReaction: createAddReactionUseCase({ commentsGateway }),
    removeReaction: createRemoveReactionUseCase({ commentsGateway }),
    getComment: createGetCommentUseCase({ commentsGateway }),
    getExternalProviders: createGetExternalProvidersUseCase({ externalCommentsGateway }),
    getExternalProvidersForMediaType: createGetExternalProvidersForMediaTypeUseCase({ externalCommentsGateway }),
    fetchExternalComments: createFetchExternalCommentsUseCase({ externalCommentsGateway }),
    fetchExternalCommentsFromProvider: createFetchExternalCommentsFromProviderUseCase({ externalCommentsGateway }),
    fetchExternalCommentsWithResolution: createFetchExternalCommentsWithResolutionUseCase({ externalCommentsGateway }),
    previewExternalResolution: createPreviewExternalResolutionUseCase({ externalCommentsGateway }),
    refreshExternalComments: createRefreshExternalCommentsUseCase({ externalCommentsGateway }),
    getExternalProviderByName: externalCommentsGateway.getProvider,
  };
}

export const commentsApplication = createCommentsApplication();
