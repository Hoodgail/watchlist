import { Router } from 'express';
import * as listController from '../controllers/listController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { createMediaItemSchema, updateMediaItemSchema, listQuerySchema } from '../utils/schemas.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/', validate(listQuerySchema, 'query'), listController.getList);
router.get('/grouped', listController.getGroupedList);
router.post('/', validate(createMediaItemSchema), listController.createItem);
router.post('/statuses', listController.getStatusesByRefIds);
router.get('/:id', listController.getItem);
router.patch('/:id', validate(updateMediaItemSchema), listController.updateItem);
router.delete('/:id', listController.deleteItem);

export default router;
