import { BadRequestError } from '../../../utils/errors.js';

const MAX_CONTENT_LENGTH = 2000;

export function normalizeCollectionCommentContent(content: string): string {
  if (!content || content.trim().length === 0) {
    throw new BadRequestError('Comment content cannot be empty');
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    throw new BadRequestError(`Comment content cannot exceed ${MAX_CONTENT_LENGTH} characters`);
  }

  return content.trim();
}
