import { Router } from 'express';
import * as suggestionController from '../controllers/suggestionController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { createSuggestionSchema, suggestionQuerySchema } from '../utils/schemas.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get received suggestions (pending by default, can filter by status)
router.get('/received', validate(suggestionQuerySchema, 'query'), suggestionController.getReceivedSuggestions);

// Get sent suggestions
router.get('/sent', suggestionController.getSentSuggestions);

// Send suggestion to a user
router.post('/:userId', validate(createSuggestionSchema), suggestionController.createSuggestion);

// Accept a suggestion
router.patch('/:id/accept', suggestionController.acceptSuggestion);

// Dismiss a suggestion
router.patch('/:id/dismiss', suggestionController.dismissSuggestion);

// Delete a suggestion (only sender can delete)
router.delete('/:id', suggestionController.deleteSuggestion);

export default router;
