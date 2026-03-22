import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import EmbeddedPostgres from 'embedded-postgres';

const execFileAsync = promisify(execFile);

const EMBEDDED_DB_NAME = 'watchlist_test';
const EMBEDDED_DB_PORT = 54329;
const EMBEDDED_DB_USER = 'postgres';
const EMBEDDED_DB_PASSWORD = 'password';
const EMBEDDED_DB_DIR = path.join(os.tmpdir(), 'watchlist-embedded-postgres-tests');

let embeddedDatabase: EmbeddedPostgres | null = null;

export function getEmbeddedDatabaseUrl(): string {
  return `postgresql://${EMBEDDED_DB_USER}:${EMBEDDED_DB_PASSWORD}@127.0.0.1:${EMBEDDED_DB_PORT}/${EMBEDDED_DB_NAME}?schema=public`;
}

export async function startEmbeddedDatabase(): Promise<string> {
  if (!embeddedDatabase) {
    await fs.rm(EMBEDDED_DB_DIR, { recursive: true, force: true });

    embeddedDatabase = new EmbeddedPostgres({
      databaseDir: EMBEDDED_DB_DIR,
      port: EMBEDDED_DB_PORT,
      user: EMBEDDED_DB_USER,
      password: EMBEDDED_DB_PASSWORD,
      persistent: false,
      onLog: () => {},
      onError: (message) => {
        console.error('[embedded-postgres]', message);
      },
    });

    await embeddedDatabase.initialise();
    await embeddedDatabase.start();
    await embeddedDatabase.createDatabase(EMBEDDED_DB_NAME);
  }

  return getEmbeddedDatabaseUrl();
}

export async function pushPrismaSchema(databaseUrl: string): Promise<void> {
  const prismaBinary = path.resolve(process.cwd(), 'node_modules/.bin/prisma');

  await execFileAsync(prismaBinary, ['db', 'push', '--skip-generate'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
    },
  });
}

export async function stopEmbeddedDatabase(): Promise<void> {
  if (!embeddedDatabase) {
    return;
  }

  await embeddedDatabase.stop();
  embeddedDatabase = null;
}
