import type { Express } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import { createApp } from '../http/createApp.js';

export interface HttpApplicationContext {
  env: typeof env;
  prisma: typeof prisma;
}

export interface HttpApplicationComposition {
  app: Express;
  context: HttpApplicationContext;
}

export function createApplicationContext(): HttpApplicationContext {
  return {
    env,
    prisma,
  };
}

export function createHttpApplication(): HttpApplicationComposition {
  const context = createApplicationContext();

  return {
    app: createApp({ env: context.env }),
    context,
  };
}
