import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';
import type { IdentityTokens } from '../dto/identity.js';

export interface RefreshSessionCommand {
  refreshToken: string;
}

export function createRefreshSessionUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function refreshSession(command: RefreshSessionCommand): Promise<IdentityTokens> {
    return dependencies.authGateway.refreshSession(command.refreshToken);
  };
}
