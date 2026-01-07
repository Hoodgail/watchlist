import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import * as oauthController from '../controllers/oauthController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { registerSchema, loginSchema, refreshTokenSchema } from '../utils/schemas.js';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', validate(refreshTokenSchema), authController.logout);

// Protected routes
router.post('/logout-all', authenticate, authController.logoutAll);
router.get('/me', authenticate, authController.me);

// OAuth routes
router.get('/oauth/providers', authenticate, oauthController.getLinkedProviders);
router.get('/oauth/:provider', oauthController.getAuthorizationUrl);
router.get('/oauth/:provider/callback', oauthController.handleCallback);
router.post('/oauth/:provider/link', authenticate, oauthController.linkAccount);
router.delete('/oauth/:provider/link', authenticate, oauthController.unlinkAccount);

export default router;
