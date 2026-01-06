import { Router } from 'express';
import * as friendController from '../controllers/friendController.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { searchQuerySchema } from '../utils/schemas.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Following/followers
router.get('/', friendController.getFollowing);
router.get('/followers', friendController.getFollowers);

// User search
router.get('/search', validate(searchQuerySchema, 'query'), friendController.searchUsers);

// Follow/unfollow actions
router.post('/:userId', friendController.follow);
router.delete('/:userId', friendController.unfollow);

// View friend's list
router.get('/:userId/list', friendController.getFriendList);

export default router;
