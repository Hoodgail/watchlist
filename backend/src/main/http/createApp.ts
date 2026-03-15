import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env as defaultEnv } from '../../config/env.js';
import { registerRoutes } from './registerRoutes.js';

interface CreateAppOptions {
  env?: typeof defaultEnv;
}

function getClientIp(req: Request): string {
  return (req.headers['cf-connecting-ip'] as string)
    || req.ip
    || req.connection.remoteAddress
    || req.socket.remoteAddress
    || (req.headers['x-forwarded-for'] as string)
    || 'x';
}

export function createApp(options: CreateAppOptions = {}) {
  const env = options.env ?? defaultEnv;
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.use(cors());

  if (env.NODE_ENV !== 'test') {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      message: { error: 'Too many requests, please try again later.' },
      keyGenerator: getClientIp,
    });
    app.use(limiter);

    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: { error: 'Too many authentication attempts, please try again later.' },
      keyGenerator: getClientIp,
    });
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);
  }

  app.use(express.json({ limit: '10kb' }));

  registerRoutes(app);

  return app;
}
