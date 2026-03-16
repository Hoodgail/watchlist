import { z } from 'zod';

export const updatePrivacySchema = z.object({
  isPublic: z.boolean(),
});
