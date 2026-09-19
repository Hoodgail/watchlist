import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { REF_ID_PATTERN } from '@shared/refId.js';
import { isValidProvider } from '@shared/providers.js';
import { Router } from 'express';
import * as providerMappingController from '../controllers/providerMappingController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Get all mappings for a refId
router.get('/:refId', authenticate, providerMappingController.getMappingsForRefId);

// Get specific mapping for refId + provider
router.get('/:refId/:provider', authenticate, providerMappingController.getMapping);

// Mappings belong to the authenticated user.
router.post(
  '/',
  authenticate,
  validate(
    z.object({
      refId: z.string().max(100).regex(REF_ID_PATTERN),
      provider: z.string().refine(isValidProvider),
      providerId: z.string().min(1).max(255),
      providerTitle: z.string().min(1).max(255),
    }),
  ),
  providerMappingController.createMapping,
);

// Create an auto-matched mapping (internal use)
router.post('/auto', authenticate, (_req, res) => {
  res.status(410).json({ error: 'Automatic matches are local suggestions, not shared mappings' });
});

// Delete a mapping
router.delete('/:refId/:provider', authenticate, providerMappingController.deleteMapping);

export default router;
