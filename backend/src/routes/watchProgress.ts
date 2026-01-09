import { Router } from 'express';
import * as watchProgressController from '../controllers/watchProgressController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { updateWatchProgressSchema } from '../utils/schemas.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all progress for user
router.get('/', watchProgressController.getAllProgress);

// Update/create progress (upsert)
router.put('/', validate(updateWatchProgressSchema), watchProgressController.updateProgress);

// Get progress for a specific media (all episodes)
router.get('/:mediaId', watchProgressController.getProgress);

// Get progress for a specific episode
router.get('/:mediaId/:episodeId', watchProgressController.getProgress);

// Delete progress for a specific media (all episodes)
router.delete('/:mediaId', watchProgressController.deleteProgress);

// Delete progress for a specific episode
router.delete('/:mediaId/:episodeId', watchProgressController.deleteProgress);

export default router;
