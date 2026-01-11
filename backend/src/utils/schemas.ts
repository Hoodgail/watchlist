import { z } from 'zod';
import { REF_ID_PATTERN, getRefIdValidationError } from '@shared/refId.js';

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
export const mediaTypeEnum = z.enum(['TV', 'MOVIE', 'ANIME', 'MANGA', 'BOOK', 'LIGHT_NOVEL', 'COMIC', 'GAME']);
export const mediaStatusEnum = z.enum(['WATCHING', 'READING', 'PLAYING', 'COMPLETED', 'PLAN_TO_WATCH', 'DROPPED', 'PAUSED']);

export const createMediaItemSchema = z.object({
  refId: z.string().max(100).regex(REF_ID_PATTERN, getRefIdValidationError()),
  type: mediaTypeEnum,
  status: mediaStatusEnum,
  current: z.number().int().min(0).default(0),
  notes: z.string().max(5000).optional(),
  rating: z.number().int().min(0).max(10).nullable().optional(),
  // Game-specific fields (from RAWG API)
  platforms: z.array(z.string()).optional(),
  metacritic: z.number().int().min(0).max(100).nullable().optional(),
  genres: z.array(z.string()).optional(),
  playtimeHours: z.number().int().min(0).nullable().optional(),
});

export const updateMediaItemSchema = z.object({
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
  type: mediaTypeEnum,
  refId: z.string().max(100).regex(REF_ID_PATTERN, getRefIdValidationError()),
  message: z.string().max(1000).optional(),
});

export const suggestionQuerySchema = z.object({
  status: suggestionStatusEnum.optional(),
});

// Watch progress schemas
export const updateWatchProgressSchema = z.object({
  mediaId: z.string().min(1, 'Media ID is required'),
  episodeId: z.string().optional(),
  episodeNumber: z.number().int().min(1).optional(),
  seasonNumber: z.number().int().min(1).optional(),
  currentTime: z.number().min(0, 'Current time must be non-negative'),
  duration: z.number().min(0, 'Duration must be non-negative'),
  provider: z.string().min(1, 'Provider is required'),
  currentEpisode: z.number().int().min(1).optional(),  // Absolute episode position (e.g., 42 for S2E20)
  totalEpisodes: z.number().int().min(1).optional(),   // Total episodes across all seasons
});

// Types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateMediaItemInput = z.infer<typeof createMediaItemSchema>;
export type UpdateMediaItemInput = z.infer<typeof updateMediaItemSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateSuggestionInput = z.infer<typeof createSuggestionSchema>;
export type UpdateWatchProgressInput = z.infer<typeof updateWatchProgressSchema>;

// Recovery email schemas
export const setRecoveryEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const verifyRecoveryEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

// Password schemas
export const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// Account recovery schemas
export const initiateRecoverySchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const completeRecoverySchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type SetRecoveryEmailInput = z.infer<typeof setRecoveryEmailSchema>;
export type VerifyRecoveryEmailInput = z.infer<typeof verifyRecoveryEmailSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type InitiateRecoveryInput = z.infer<typeof initiateRecoverySchema>;
export type CompleteRecoveryInput = z.infer<typeof completeRecoverySchema>;
