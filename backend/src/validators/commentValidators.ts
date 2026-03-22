export {
  createCommentSchema,
  feedQuerySchema,
  getMediaCommentsSchema,
  importExternalCommentSchema,
  reactionSchema,
  reactionTypeEnum,
  updateCommentSchema,
} from '../modules/comments/interface/http/commentSchemas.js';

export type {
  CreateCommentInput,
  FeedQuery,
  GetMediaCommentsQuery,
  ImportExternalCommentInput,
  ReactionInput,
  ReactionInputType as ReactionType,
  UpdateCommentInput,
} from '../modules/comments/interface/http/commentSchemas.js';
