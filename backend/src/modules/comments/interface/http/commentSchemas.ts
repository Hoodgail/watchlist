import { z } from 'zod';
import { mediaTypeEnum } from '../../../../utils/schemas.js';

export const reactionTypeEnum = z.enum(['LIKE', 'HELPFUL', 'FUNNY', 'SPOILER']);

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(2000, 'Comment must be at most 2000 characters'),
  refId: z.string().min(1, 'Media reference ID is required'),
  mediaType: mediaTypeEnum,
  seasonNumber: z.number().int().min(1).optional(),
  episodeNumber: z.number().int().min(1).optional(),
  chapterNumber: z.number().int().min(1).optional(),
  volumeNumber: z.number().int().min(1).optional(),
  isPublic: z.boolean().optional().default(true),
  isSpoiler: z.boolean().optional().default(false),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(2000, 'Comment must be at most 2000 characters').optional(),
  isPublic: z.boolean().optional(),
  isSpoiler: z.boolean().optional(),
});

export const getMediaCommentsSchema = z.object({
  mediaType: mediaTypeEnum,
  seasonNumber: z.coerce.number().int().min(1).optional(),
  episodeNumber: z.coerce.number().int().min(1).optional(),
  chapterNumber: z.coerce.number().int().min(1).optional(),
  volumeNumber: z.coerce.number().int().min(1).optional(),
  includeExternal: z.string().transform((value) => value === 'true').optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
  mediaType: mediaTypeEnum.optional(),
});

export const reactionSchema = z.object({
  reactionType: reactionTypeEnum,
});

export const importExternalCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(2000, 'Comment must be at most 2000 characters'),
  refId: z.string().min(1, 'Media reference ID is required'),
  mediaType: mediaTypeEnum,
  externalSource: z.string().min(1, 'External source is required'),
  externalId: z.string().min(1, 'External ID is required'),
  externalAuthor: z.string().optional(),
  externalAuthorAvatar: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
  seasonNumber: z.number().int().min(1).optional(),
  episodeNumber: z.number().int().min(1).optional(),
  chapterNumber: z.number().int().min(1).optional(),
  volumeNumber: z.number().int().min(1).optional(),
  createdAt: z.coerce.date().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type GetMediaCommentsQuery = z.infer<typeof getMediaCommentsSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
export type ImportExternalCommentInput = z.infer<typeof importExternalCommentSchema>;
export type ReactionInputType = z.infer<typeof reactionTypeEnum>;
