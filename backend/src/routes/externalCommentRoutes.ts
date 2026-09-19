import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  fetchComments,
  fetchFromProvider,
  fetchWithResolution,
  getProviders,
  getProvidersForMediaType,
  resolvePreview,
} from '../modules/comments/interface/http/externalCommentController.js';
import {
  fetchCommentsSchema,
  fetchFromProviderSchema,
  fetchWithResolutionSchema,
  resolvePreviewSchema,
} from '../modules/comments/interface/http/externalCommentSchemas.js';

const router = Router();

router.get('/providers', getProviders);
router.get('/providers/:mediaType', getProvidersForMediaType);

router.post('/fetch', authenticate, validate(fetchCommentsSchema), fetchComments);

router.post(
  '/fetch/:providerName',
  authenticate,
  validate(fetchFromProviderSchema.omit({ providerName: true })),
  fetchFromProvider,
);

router.post('/refresh', authenticate, (_req, res) => {
  res.status(410).json({ error: 'Background comment refresh is not implemented' });
});

router.post(
  '/fetch-with-resolution',
  authenticate,
  validate(fetchWithResolutionSchema),
  fetchWithResolution,
);

router.post('/resolve-preview', authenticate, validate(resolvePreviewSchema), resolvePreview);

export default router;
