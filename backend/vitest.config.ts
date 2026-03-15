import { defineConfig } from 'vitest/config';
import path from 'path';

const defaultDatabaseUrl = 'postgresql://postgres:password@127.0.0.1:54329/watchlist_test?schema=public';
const hasExternalTestDatabase = Boolean(process.env.DATABASE_URL);

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret-key-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret-key-minimum-32-characters-long';
process.env.DATABASE_URL ??= defaultDatabaseUrl;
process.env.WATCHLIST_TEST_DB_MODE ??= hasExternalTestDatabase ? 'external' : 'embedded';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: {
      shuffle: false,
    },
    // Run test files sequentially to avoid database race conditions
    fileParallelism: false,
    // Run tests within a file sequentially
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
