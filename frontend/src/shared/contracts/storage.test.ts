import { describe, expect, it } from 'vitest';
import {
  localStorageContract,
  mangaOfflineStorageContract,
  videoOfflineStorageContract,
} from './storage';

describe('storage contracts', () => {
  it('keeps auth localStorage keys stable', () => {
    expect(localStorageContract).toEqual({
      auth: {
        accessToken: 'accessToken',
        refreshToken: 'refreshToken',
        cachedUser: 'watchlist_cached_user',
      },
    });
  });

  it('keeps manga offline storage shape stable', () => {
    expect(mangaOfflineStorageContract).toEqual({
      dbName: 'watchlist-manga',
      dbVersion: 1,
      stores: {
        MANGA: 'manga',
        CHAPTERS: 'chapters',
        PAGES: 'pages',
        READING_PROGRESS: 'reading_progress',
        SETTINGS: 'settings',
      },
    });
  });

  it('keeps video offline storage shape stable', () => {
    expect(videoOfflineStorageContract).toEqual({
      dbName: 'watchlist-video',
      dbVersion: 2,
      chunkSizeBytes: 5 * 1024 * 1024,
      stores: {
        MEDIA: 'media',
        EPISODES: 'episodes',
        BLOBS: 'blobs',
        CHUNKS: 'chunks',
        HLS_SEGMENTS: 'hls_segments',
        WATCH_PROGRESS: 'watch_progress',
        SETTINGS: 'settings',
      },
    });
  });
});
