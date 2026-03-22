import type {
  CommentFeedItem,
  CommentWithAuthor,
  CommentWithReactions,
  CreateCommentInput,
  ExternalCommentInput,
  FeedOptions,
  GetMediaCommentsOptions,
  ReactionType,
  UpdateCommentInput,
} from '../dto/comments.js';

export interface CommentsGateway {
  createComment(userId: string, data: CreateCommentInput): Promise<CommentWithAuthor>;
  updateComment(userId: string, commentId: string, data: UpdateCommentInput): Promise<CommentWithAuthor>;
  deleteComment(userId: string, commentId: string): Promise<void>;
  getMediaComments(refId: string, options: GetMediaCommentsOptions, userId?: string): Promise<{ comments: CommentWithAuthor[]; nextCursor: string | null }>;
  getFriendsFeed(userId: string, options?: FeedOptions): Promise<{ comments: CommentFeedItem[]; nextCursor: string | null }>;
  getPublicFeed(options?: FeedOptions): Promise<{ comments: CommentFeedItem[]; nextCursor: string | null }>;
  importExternalComment(data: ExternalCommentInput): Promise<CommentWithAuthor>;
  addReaction(userId: string, commentId: string, reactionType: ReactionType): Promise<void>;
  removeReaction(userId: string, commentId: string): Promise<void>;
  getCommentById(commentId: string, userId?: string): Promise<CommentWithReactions>;
}
