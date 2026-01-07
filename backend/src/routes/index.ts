import { Router } from 'express';
import authRoutes from './auth.js';
import listRoutes from './list.js';
import friendRoutes from './friends.js';
import suggestionRoutes from './suggestions.js';
import profileRoutes from './profile.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/list', listRoutes);
router.use('/friends', friendRoutes);
router.use('/suggestions', suggestionRoutes);
router.use('/profile', profileRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
