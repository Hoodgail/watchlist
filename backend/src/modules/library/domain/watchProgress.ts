import type { MediaType } from '@prisma/client';

export interface WatchProgressResponse {
  id: string;
  mediaId: string;
  episodeId: string | null;
  episodeNumber: number | null;
  seasonNumber: number | null;
  currentTime: number;
  duration: number;
  provider: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const watchProgressSelect = {
  id: true,
  mediaId: true,
  episodeId: true,
  episodeNumber: true,
  seasonNumber: true,
  currentTime: true,
  duration: true,
  provider: true,
  completed: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const COMPLETION_THRESHOLD = 0.95;

export const VIDEO_MEDIA_TYPES: MediaType[] = ['TV', 'MOVIE', 'ANIME'];
