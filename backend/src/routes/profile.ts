import { Router } from 'express';
import * as profileController from '../controllers/profileController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updatePrivacySchema } from '../modules/social/interface/http/profileSchemas.js';

const router = Router();

// Public profile route - uses optional auth to check if viewer is following
router.get('/:username', optionalAuth, profileController.getPublicProfile);

// Privacy settings routes (authenticated)
router.get('/settings/privacy', authenticate, profileController.getPrivacySettings);
router.patch('/settings/privacy', authenticate, validate(updatePrivacySchema), profileController.updatePrivacySettings);

export default router;
