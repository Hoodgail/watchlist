import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createCollection,
  getMyCollections,
  getPublicCollections,
  getStarredCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  joinCollectionByInvite,
  addCollectionItem,
  reorderCollectionItems,
  updateCollectionItem,
  removeCollectionItem,
  getCollectionMembers,
  addCollectionMember,
  updateMemberRole,
  removeCollectionMember,
  leaveCollection,
  createCollectionInvite,
  getCollectionInvites,
  revokeCollectionInvite,
  starCollection,
  unstarCollection,
  getCollectionComments,
  addCollectionComment,
  updateCollectionComment,
  deleteCollectionComment,
} from '../controllers/collectionController.js';
import {
  createCollectionSchema,
  updateCollectionSchema,
  addCollectionItemSchema,
  reorderCollectionItemsSchema,
  updateCollectionItemSchema,
  addCollectionMemberSchema,
  updateMemberRoleSchema,
  createCollectionInviteSchema,
  addCollectionCommentSchema,
  updateCollectionCommentSchema,
} from '../validators/collectionValidators.js';

const router = Router();

// Join by invite (must be before /:id routes)
router.post('/join/:token', authenticate, joinCollectionByInvite);

// Collection CRUD
router.post('/', authenticate, validate(createCollectionSchema), createCollection);
router.get('/', authenticate, getMyCollections);
router.get('/public', optionalAuth, getPublicCollections);
router.get('/starred', authenticate, getStarredCollections);
router.get('/:id', optionalAuth, getCollection);
router.patch('/:id', authenticate, validate(updateCollectionSchema), updateCollection);
router.delete('/:id', authenticate, deleteCollection);

// Items
router.post('/:id/items', authenticate, validate(addCollectionItemSchema), addCollectionItem);
router.patch('/:id/items/reorder', authenticate, validate(reorderCollectionItemsSchema), reorderCollectionItems);
router.patch('/:id/items/:itemId', authenticate, validate(updateCollectionItemSchema), updateCollectionItem);
router.delete('/:id/items/:itemId', authenticate, removeCollectionItem);

// Members
router.get('/:id/members', authenticate, getCollectionMembers);
router.post('/:id/members', authenticate, validate(addCollectionMemberSchema), addCollectionMember);
router.patch('/:id/members/:userId', authenticate, validate(updateMemberRoleSchema), updateMemberRole);
router.delete('/:id/members/:userId', authenticate, removeCollectionMember);
router.post('/:id/leave', authenticate, leaveCollection);

// Invites
router.post('/:id/invites', authenticate, validate(createCollectionInviteSchema), createCollectionInvite);
router.get('/:id/invites', authenticate, getCollectionInvites);
router.delete('/:id/invites/:inviteId', authenticate, revokeCollectionInvite);

// Stars
router.post('/:id/star', authenticate, starCollection);
router.delete('/:id/star', authenticate, unstarCollection);

// Comments
router.get('/:id/comments', optionalAuth, getCollectionComments);
router.post('/:id/comments', authenticate, validate(addCollectionCommentSchema), addCollectionComment);
router.patch('/:id/comments/:commentId', authenticate, validate(updateCollectionCommentSchema), updateCollectionComment);
router.delete('/:id/comments/:commentId', authenticate, deleteCollectionComment);

export default router;
