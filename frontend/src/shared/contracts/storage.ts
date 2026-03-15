export const localStorageContract = {
  auth: {
    accessToken: 'accessToken',
    refreshToken: 'refreshToken',
    cachedUser: 'watchlist_cached_user',
  },
} as const;

export const mangaOfflineStorageContract = {
  dbName: 'watchlist-manga',
  dbVersion: 1,
  stores: {
    MANGA: 'manga',
    CHAPTERS: 'chapters',
    PAGES: 'pages',
    READING_PROGRESS: 'reading_progress',
    SETTINGS: 'settings',
  },
} as const;

export const videoOfflineStorageContract = {
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
} as const;
