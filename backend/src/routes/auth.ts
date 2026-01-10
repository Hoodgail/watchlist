import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import * as oauthController from '../controllers/oauthController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema,
  setRecoveryEmailSchema,
  verifyRecoveryEmailSchema,
  setPasswordSchema,
  changePasswordSchema,
  initiateRecoverySchema,
  completeRecoverySchema,
} from '../utils/schemas.js';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);
router.post('/logout', validate(refreshTokenSchema), authController.logout);

// Account recovery (public)
router.post('/recovery/initiate', validate(initiateRecoverySchema), authController.initiateRecovery);
router.post('/recovery/complete', validate(completeRecoverySchema), authController.completeRecovery);
router.post('/recovery/verify-email', validate(verifyRecoveryEmailSchema), authController.verifyRecoveryEmail);

// Protected routes
router.post('/logout-all', authenticate, authController.logoutAll);
router.get('/me', authenticate, authController.me);

// Recovery email routes (protected)
router.post('/recovery-email', authenticate, validate(setRecoveryEmailSchema), authController.setRecoveryEmail);
router.delete('/recovery-email', authenticate, authController.removeRecoveryEmail);

// Password routes (protected)
router.post('/password', authenticate, validate(setPasswordSchema), authController.setPassword);
router.put('/password', authenticate, validate(changePasswordSchema), authController.changePassword);

// OAuth routes
router.get('/oauth/providers', authenticate, oauthController.getLinkedProviders);
router.get('/oauth/:provider', oauthController.getAuthorizationUrl);
router.get('/oauth/:provider/callback', oauthController.handleCallback);
router.post('/oauth/:provider/link', authenticate, oauthController.linkAccount);
router.delete('/oauth/:provider/link', authenticate, oauthController.unlinkAccount);

export default router;
