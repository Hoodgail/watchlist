import { z } from 'zod';

export const supportedCommentMediaTypeSchema = z.enum(['TV', 'MOVIE', 'ANIME', 'MANGA']);

export const fetchCommentsSchema = z.object({
  refId: z.string().min(1, 'refId is required'),
  mediaType: supportedCommentMediaTypeSchema,
  title: z.string().min(1, 'title is required'),
  year: z.number().int().min(1800).max(2100).optional(),
  seasonNumber: z.number().int().min(0).optional(),
  episodeNumber: z.number().int().min(0).optional(),
  chapterNumber: z.number().int().min(0).optional(),
  volumeNumber: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  providerNames: z.array(z.string()).optional(),
  providerIds: z.record(z.string()).optional(),
});

export const fetchFromProviderSchema = z.object({
  providerName: z.string().min(1, 'providerName is required'),
  refId: z.string().min(1, 'refId is required'),
  mediaType: supportedCommentMediaTypeSchema,
  title: z.string().min(1, 'title is required'),
  year: z.number().int().min(1800).max(2100).optional(),
  seasonNumber: z.number().int().min(0).optional(),
  episodeNumber: z.number().int().min(0).optional(),
  chapterNumber: z.number().int().min(0).optional(),
  volumeNumber: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  providerIds: z.record(z.string()).optional(),
});

export const fetchWithResolutionSchema = z.object({
  title: z.string().min(1, 'title is required'),
  mediaType: supportedCommentMediaTypeSchema,
  year: z.number().int().min(1800).max(2100).optional(),
  refId: z.string().optional(),
  seasonNumber: z.number().int().min(0).optional(),
  episodeNumber: z.number().int().min(0).optional(),
  providerIds: z.record(z.string()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const resolvePreviewSchema = z.object({
  title: z.string().min(1, 'title is required'),
  mediaType: supportedCommentMediaTypeSchema,
  year: z.number().int().min(1800).max(2100).optional(),
  refId: z.string().optional(),
});

export type FetchCommentsInput = z.infer<typeof fetchCommentsSchema>;
export type FetchFromProviderInput = z.infer<typeof fetchFromProviderSchema>;
export type FetchWithResolutionInput = z.infer<typeof fetchWithResolutionSchema>;
export type ResolvePreviewInput = z.infer<typeof resolvePreviewSchema>;
