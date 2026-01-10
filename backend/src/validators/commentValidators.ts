import { z } from 'zod';
import { mediaTypeEnum } from '../utils/schemas.js';

// Reaction type enum
export const reactionTypeEnum = z.enum(['LIKE', 'HELPFUL', 'FUNNY', 'SPOILER']);

// Create comment schema
export const createCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment must be at most 2000 characters'),
  refId: z.string().min(1, 'Media reference ID is required'),
  mediaType: mediaTypeEnum,
  seasonNumber: z.number().int().min(1).optional(),
  episodeNumber: z.number().int().min(1).optional(),
  chapterNumber: z.number().int().min(1).optional(),
  volumeNumber: z.number().int().min(1).optional(),
  isPublic: z.boolean().optional().default(true),
  isSpoiler: z.boolean().optional().default(false),
});

// Update comment schema
export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment must be at most 2000 characters')
    .optional(),
  isPublic: z.boolean().optional(),
  isSpoiler: z.boolean().optional(),
});

// Get media comments query schema
export const getMediaCommentsSchema = z.object({
  mediaType: mediaTypeEnum,
  seasonNumber: z.coerce.number().int().min(1).optional(),
  episodeNumber: z.coerce.number().int().min(1).optional(),
  chapterNumber: z.coerce.number().int().min(1).optional(),
  volumeNumber: z.coerce.number().int().min(1).optional(),
  includeExternal: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

// Feed query schema
export const feedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
  mediaType: mediaTypeEnum.optional(),
});

// Reaction schema
export const reactionSchema = z.object({
  reactionType: reactionTypeEnum,
});

// Import external comment schema (admin/system use)
export const importExternalCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment must be at most 2000 characters'),
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

// Types
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type GetMediaCommentsQuery = z.infer<typeof getMediaCommentsSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
export type ImportExternalCommentInput = z.infer<typeof importExternalCommentSchema>;
export type ReactionType = z.infer<typeof reactionTypeEnum>;
