import { Router } from 'express';
import * as providerMappingController from '../controllers/providerMappingController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// Get all mappings for a refId
router.get('/:refId', providerMappingController.getMappingsForRefId);

// Get specific mapping for refId + provider
router.get('/:refId/:provider', providerMappingController.getMapping);

// Create/update a user-verified mapping (optionalAuth - works for guests too, but tracks user if logged in)
router.post('/', optionalAuth, providerMappingController.createMapping);

// Create an auto-matched mapping (internal use)
router.post('/auto', providerMappingController.createAutoMapping);

// Delete a mapping
router.delete('/:refId/:provider', optionalAuth, providerMappingController.deleteMapping);

export default router;
