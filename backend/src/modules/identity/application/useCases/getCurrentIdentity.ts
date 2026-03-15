import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';
import type { IdentityUserWithOAuth } from '../dto/identity.js';

export interface GetCurrentIdentityQuery {
  userId: string;
}

export function createGetCurrentIdentityUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function getCurrentIdentity(query: GetCurrentIdentityQuery): Promise<IdentityUserWithOAuth | null> {
    return dependencies.authGateway.getCurrentIdentity(query.userId);
  };
}
