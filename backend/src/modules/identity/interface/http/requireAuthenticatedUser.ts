import { UnauthorizedError } from '../../../../utils/errors.js';
import type { AuthenticatedUser } from '../../../../shared/auth/authTypes.js';

export function requireAuthenticatedUser(request: { user?: AuthenticatedUser }) {
  if (!request.user) {
    throw new UnauthorizedError('Unauthorized');
  }

  return request.user;
}
