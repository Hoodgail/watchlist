import type { IdentityOAuthGateway } from '../ports/IdentityOAuthGateway.js';

export interface GetAuthorizationUrlQuery {
  provider: string;
  state?: string;
}

export function createGetAuthorizationUrlUseCase(dependencies: { oauthGateway: IdentityOAuthGateway }) {
  return function getAuthorizationUrl(query: GetAuthorizationUrlQuery): string {
    return dependencies.oauthGateway.getAuthorizationUrl(query.provider, query.state);
  };
}
