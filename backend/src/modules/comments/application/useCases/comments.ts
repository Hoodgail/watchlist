import type { ReactionType } from '../dto/comments.js';
import type { CommentsGateway } from '../ports/CommentsGateway.js';

export function createCreateCommentUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function createComment(command: { userId: string; data: Parameters<CommentsGateway['createComment']>[1] }) {
    return dependencies.commentsGateway.createComment(command.userId, command.data);
  };
}

export function createUpdateCommentUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function updateComment(command: { userId: string; commentId: string; data: Parameters<CommentsGateway['updateComment']>[2] }) {
    return dependencies.commentsGateway.updateComment(command.userId, command.commentId, command.data);
  };
}

export function createDeleteCommentUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function deleteComment(command: { userId: string; commentId: string }) {
    return dependencies.commentsGateway.deleteComment(command.userId, command.commentId);
  };
}

export function createGetMediaCommentsUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function getMediaComments(query: { refId: string; options: Parameters<CommentsGateway['getMediaComments']>[1]; userId?: string }) {
    return dependencies.commentsGateway.getMediaComments(query.refId, query.options, query.userId);
  };
}

export function createGetFriendsFeedUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function getFriendsFeed(query: { userId: string; options?: Parameters<CommentsGateway['getFriendsFeed']>[1] }) {
    return dependencies.commentsGateway.getFriendsFeed(query.userId, query.options);
  };
}

export function createGetPublicFeedUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function getPublicFeed(query: { options?: Parameters<CommentsGateway['getPublicFeed']>[0] }) {
    return dependencies.commentsGateway.getPublicFeed(query.options);
  };
}

export function createImportExternalCommentUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function importExternalComment(command: { data: Parameters<CommentsGateway['importExternalComment']>[0] }) {
    return dependencies.commentsGateway.importExternalComment(command.data);
  };
}

export function createAddReactionUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function addReaction(command: { userId: string; commentId: string; reactionType: ReactionType }) {
    return dependencies.commentsGateway.addReaction(command.userId, command.commentId, command.reactionType);
  };
}

export function createRemoveReactionUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function removeReaction(command: { userId: string; commentId: string }) {
    return dependencies.commentsGateway.removeReaction(command.userId, command.commentId);
  };
}

export function createGetCommentUseCase(dependencies: { commentsGateway: CommentsGateway }) {
  return async function getComment(query: { commentId: string; userId?: string }) {
    return dependencies.commentsGateway.getCommentById(query.commentId, query.userId);
  };
}
