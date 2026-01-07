import { Router } from 'express';
import * as profileController from '../controllers/profileController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = Router();

// Schema for privacy settings update
const updatePrivacySchema = z.object({
  isPublic: z.boolean(),
});

// Public profile route - uses optional auth to check if viewer is following
router.get('/:username', optionalAuth, profileController.getPublicProfile);

// Privacy settings routes (authenticated)
router.get('/settings/privacy', authenticate, profileController.getPrivacySettings);
router.patch('/settings/privacy', authenticate, validate(updatePrivacySchema), profileController.updatePrivacySettings);

export default router;
