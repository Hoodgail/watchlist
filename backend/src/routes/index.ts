import { Router } from 'express';
import authRoutes from './auth.js';
import listRoutes from './list.js';
import friendRoutes from './friends.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/list', listRoutes);
router.use('/friends', friendRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
