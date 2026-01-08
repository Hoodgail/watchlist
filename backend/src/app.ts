import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Trust proxy - required for rate limiting to work correctly behind reverse proxy
// This allows express to use X-Forwarded-For header for client IP
app.set('trust proxy', 1);

// Security middleware
// Configure helmet to allow cross-origin resource loading for image proxy endpoints
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS - allow all origins
app.use(cors());

// Rate limiting - disabled in test environment
if (env.NODE_ENV !== 'test') {
  // Use Cloudflare's CF-Connecting-IP header for real client IP
  const getClientIp = (req: express.Request): string => {
    return (req.headers['cf-connecting-ip'] as string) || req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.headers['x-forwarded-for'] as string || 'x';
  };

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 500 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    keyGenerator: getClientIp,
  });
  app.use(limiter);

  // Auth rate limiting (stricter)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 auth requests per windowMs
    message: { error: 'Too many authentication attempts, please try again later.' },
    keyGenerator: getClientIp,
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
}

// Body parsing
app.use(express.json({ limit: '10kb' }));

// Routes
app.use('/api', routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorHandler);

export default app;
