import { z } from 'zod';

// Auth schemas
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().max(64).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Media schemas
export const mediaTypeEnum = z.enum(['TV', 'MOVIE', 'ANIME', 'MANGA']);
export const mediaStatusEnum = z.enum(['WATCHING', 'READING', 'COMPLETED', 'PLAN_TO_WATCH', 'DROPPED', 'PAUSED']);

export const createMediaItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  type: mediaTypeEnum,
  status: mediaStatusEnum,
  current: z.number().int().min(0).default(0),
  total: z.number().int().min(1).nullable().optional(),
  notes: z.string().max(5000).optional(),
  rating: z.number().int().min(0).max(10).nullable().optional(),
  imageUrl: z.string().url().max(500).optional(),
  refId: z.string().max(100).regex(/^[a-z-]+:[a-zA-Z0-9_-]+$/, 'refId must be in format "source:id" (e.g., "tmdb:12345")') ,
});

export const updateMediaItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: mediaStatusEnum.optional(),
  current: z.number().int().min(0).optional(),
  total: z.number().int().min(1).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  rating: z.number().int().min(0).max(10).nullable().optional(),
});

// User schemas
export const updateUserSchema = z.object({
  displayName: z.string().max(64).optional(),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
});

// Query schemas
export const sortByEnum = z.enum(['status', 'title', 'rating', 'updatedAt', 'createdAt']);

export const listQuerySchema = z.object({
  type: mediaTypeEnum.optional(),
  status: mediaStatusEnum.optional(),
  sortBy: sortByEnum.optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
});

// Suggestion schemas
export const suggestionStatusEnum = z.enum(['PENDING', 'ACCEPTED', 'DISMISSED']);

export const createSuggestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  type: mediaTypeEnum,
  refId: z.string().max(100).regex(/^[a-z-]+:[a-zA-Z0-9_-]+$/, 'refId must be in format "source:id" (e.g., "tmdb:12345")'),
  imageUrl: z.string().url().optional(),
  message: z.string().max(1000).optional(),
});

export const suggestionQuerySchema = z.object({
  status: suggestionStatusEnum.optional(),
});

// Types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateMediaItemInput = z.infer<typeof createMediaItemSchema>;
export type UpdateMediaItemInput = z.infer<typeof updateMediaItemSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;
