import type { IdentityOAuthGateway } from '../ports/IdentityOAuthGateway.js';
import type { LinkedOAuthProvider } from '../dto/identity.js';

export interface GetLinkedOAuthProvidersQuery {
  userId: string;
}

export function createGetLinkedOAuthProvidersUseCase(dependencies: { oauthGateway: IdentityOAuthGateway }) {
  return async function getLinkedOAuthProviders(query: GetLinkedOAuthProvidersQuery): Promise<LinkedOAuthProvider[]> {
    return dependencies.oauthGateway.getLinkedProviders(query.userId);
  };
}
