import type { Express } from 'express';
import routes from '../../routes/index.js';
import { errorHandler } from '../../middleware/errorHandler.js';

export function registerRoutes(app: Express): void {
  app.use('/api', routes);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);
}
