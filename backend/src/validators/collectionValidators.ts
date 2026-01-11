import { z } from 'zod';
import { mediaTypeEnum } from '../utils/schemas.js';

// Collection member role enum
export const collectionRoleEnum = z.enum(['EDITOR', 'VIEWER']);

// Create collection schema
export const createCollectionSchema = z.object({
  title: z
    .string()
    .min(1, 'Collection title is required')
    .max(255, 'Collection title must be at most 255 characters'),
  description: z.string().optional(),
  coverUrl: z.string().url('Invalid cover URL').optional(),
  isPublic: z.boolean().optional().default(false),
});

// Update collection schema
export const updateCollectionSchema = z.object({
  title: z
    .string()
    .min(1, 'Collection title is required')
    .max(255, 'Collection title must be at most 255 characters')
    .optional(),
  description: z.string().optional(),
  coverUrl: z.string().url('Invalid cover URL').optional(),
  isPublic: z.boolean().optional(),
});

// Add collection item schema
export const addCollectionItemSchema = z.object({
  refId: z.string().min(1, 'Media reference ID is required'),
  title: z.string().optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  type: mediaTypeEnum,
  note: z.string().optional(),
});

// Update collection item schema
export const updateCollectionItemSchema = z.object({
  note: z.string().optional(),
  orderIndex: z.number().int().optional(),
});

// Reorder collection items schema
export const reorderCollectionItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1, 'Item ID is required'),
      orderIndex: z.number().int(),
    })
  ),
});

// Add collection member schema
export const addCollectionMemberSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  role: collectionRoleEnum,
});

// Update member role schema
export const updateMemberRoleSchema = z.object({
  role: collectionRoleEnum,
});

// Create collection invite schema
export const createCollectionInviteSchema = z.object({
  role: collectionRoleEnum,
  maxUses: z.number().int().positive('Max uses must be a positive integer').optional(),
  expiresInDays: z.number().int().positive('Expiration days must be a positive integer').optional().default(7),
});

// Add collection comment schema
export const addCollectionCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment must be at most 2000 characters'),
});

// Update collection comment schema
export const updateCollectionCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment content is required')
    .max(2000, 'Comment must be at most 2000 characters'),
});

// Types
export type CollectionRole = z.infer<typeof collectionRoleEnum>;
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type AddCollectionItemInput = z.infer<typeof addCollectionItemSchema>;
export type UpdateCollectionItemInput = z.infer<typeof updateCollectionItemSchema>;
export type ReorderCollectionItemsInput = z.infer<typeof reorderCollectionItemsSchema>;
export type AddCollectionMemberInput = z.infer<typeof addCollectionMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type CreateCollectionInviteInput = z.infer<typeof createCollectionInviteSchema>;
export type AddCollectionCommentInput = z.infer<typeof addCollectionCommentSchema>;
export type UpdateCollectionCommentInput = z.infer<typeof updateCollectionCommentSchema>;
