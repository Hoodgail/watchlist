import type { IdentityOAuthGateway } from '../ports/IdentityOAuthGateway.js';
import type { LinkedOAuthAccount } from '../dto/identity.js';

export interface LinkOAuthAccountCommand {
  userId: string;
  provider: string;
  code: string;
}

export function createLinkOAuthAccountUseCase(dependencies: { oauthGateway: IdentityOAuthGateway }) {
  return async function linkOAuthAccount(command: LinkOAuthAccountCommand): Promise<LinkedOAuthAccount> {
    return dependencies.oauthGateway.linkAccount(command.userId, command.provider, command.code);
  };
}
