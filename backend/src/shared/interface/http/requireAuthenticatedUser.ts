import { UnauthorizedError } from '../../../utils/errors.js';
import type { AuthenticatedUser } from '../../auth/authTypes.js';

export function requireAuthenticatedUser(request: { user?: AuthenticatedUser }): AuthenticatedUser {
  if (!request.user) {
    throw new UnauthorizedError('Unauthorized');
  }

  return request.user;
}
