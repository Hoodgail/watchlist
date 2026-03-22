import type { IdentityOAuthGateway } from '../ports/IdentityOAuthGateway.js';
import type { IdentityOAuthCallbackResult } from '../dto/identity.js';

export interface HandleOAuthCallbackCommand {
  provider: string;
  code: string;
}

export function createHandleOAuthCallbackUseCase(dependencies: { oauthGateway: IdentityOAuthGateway }) {
  return async function handleOAuthCallback(command: HandleOAuthCallbackCommand): Promise<IdentityOAuthCallbackResult> {
    return dependencies.oauthGateway.handleCallback(command.provider, command.code);
  };
}
