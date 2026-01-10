import { Router } from 'express';
import * as commentController from '../controllers/commentController.js';
import { validate } from '../middleware/validate.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import {
  createCommentSchema,
  updateCommentSchema,
  getMediaCommentsSchema,
  feedQuerySchema,
  reactionSchema,
  importExternalCommentSchema,
} from '../validators/commentValidators.js';

const router = Router();

// Public/optional auth routes
router.get(
  '/media/:refId',
  optionalAuth,
  validate(getMediaCommentsSchema, 'query'),
  commentController.getMediaComments
);

router.get(
  '/feed/public',
  validate(feedQuerySchema, 'query'),
  commentController.getPublicFeed
);

router.get(
  '/:id',
  optionalAuth,
  commentController.getComment
);

// Authenticated routes
router.post(
  '/',
  authenticate,
  validate(createCommentSchema),
  commentController.createComment
);

router.get(
  '/feed/friends',
  authenticate,
  validate(feedQuerySchema, 'query'),
  commentController.getFriendsFeed
);

router.patch(
  '/:id',
  authenticate,
  validate(updateCommentSchema),
  commentController.updateComment
);

router.delete(
  '/:id',
  authenticate,
  commentController.deleteComment
);

router.post(
  '/:id/reactions',
  authenticate,
  validate(reactionSchema),
  commentController.addReaction
);

router.delete(
  '/:id/reactions',
  authenticate,
  commentController.removeReaction
);

// Admin/system routes
router.post(
  '/import-external',
  authenticate,
  validate(importExternalCommentSchema),
  commentController.importExternalComment
);

export default router;
