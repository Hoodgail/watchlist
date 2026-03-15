// Set test environment before anything else
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-minimum-32-characters-long';

if (typeof globalThis.File === 'undefined') {
  class TestFile extends Blob {
    name: string;
    lastModified: number;

    constructor(bits: any[] = [], name = 'test-file', options: { lastModified?: number; type?: string } = {}) {
      super(bits, options);
      this.name = name;
      this.lastModified = options.lastModified ?? Date.now();
    }
  }

  globalThis.File = TestFile as typeof File;
}

export const hasConfiguredDatabase = Boolean(process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/watchlist_test?schema=public';
}

import "dotenv/config";

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../config/database.js';

// Track which tables exist in the database for conditional test execution
export const availableTables = {
  suggestions: false,
  oauthAccounts: false,
  avatarUrl: false,
  watchProgress: false,
};

export let databaseAvailable = false;

/**
 * Check if a table exists by trying a simple query
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM ${tableName} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely delete from a table that might not exist
 * Returns true if deleted, false if table doesn't exist
 */
async function safeDeleteMany(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch (error) {
    // Check if error is because table doesn't exist
    if (error instanceof Error && error.message.includes('does not exist')) {
      return false;
    }
    throw error;
  }
}

async function cleanDatabase() {
  // Delete in order to respect foreign key constraints
  await prisma.refreshToken.deleteMany();
  
  // These tables might not exist if migrations haven't been run
  if (availableTables.suggestions) {
    await safeDeleteMany(() => prisma.suggestion.deleteMany());
  }
  if (availableTables.oauthAccounts) {
    await safeDeleteMany(() => prisma.oAuthAccount.deleteMany());
  }
  if (availableTables.watchProgress) {
    await safeDeleteMany(() => prisma.watchProgress.deleteMany());
  }
  
  await prisma.friendRequest.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.mediaItem.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => {
  if (!hasConfiguredDatabase) {
    console.warn('DATABASE_URL is not configured; skipping database-backed backend tests.');
    return;
  }

  try {
    await prisma.$connect();
    databaseAvailable = true;
  } catch (error) {
    console.warn('Configured DATABASE_URL is not reachable; skipping database-backed backend tests.');
    console.warn(error instanceof Error ? error.message : String(error));
    databaseAvailable = false;
    return;
  }
  
  // Check which tables/columns are available
  availableTables.suggestions = await checkTableExists('suggestions');
  availableTables.oauthAccounts = await checkTableExists('oauth_accounts');
  availableTables.watchProgress = await checkTableExists('watch_progress');
  
  // Check if avatar_url column exists on users table
  try {
    await prisma.$queryRaw`SELECT avatar_url FROM users LIMIT 1`;
    availableTables.avatarUrl = true;
  } catch {
    availableTables.avatarUrl = false;
  }
  
  // Log available features for debugging
  console.log('Database schema check:', availableTables);
});

beforeEach(async () => {
  if (!databaseAvailable) {
    return;
  }

  // Clean up database before each test
  await cleanDatabase();
});

afterAll(async () => {
  if (!databaseAvailable) {
    return;
  }

  // Clean up and disconnect
  await cleanDatabase();
  await prisma.$disconnect();
});
