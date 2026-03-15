import type { IdentityOAuthGateway } from '../ports/IdentityOAuthGateway.js';

export interface UnlinkOAuthAccountCommand {
  userId: string;
  provider: string;
}

export function createUnlinkOAuthAccountUseCase(dependencies: { oauthGateway: IdentityOAuthGateway }) {
  return async function unlinkOAuthAccount(command: UnlinkOAuthAccountCommand): Promise<void> {
    await dependencies.oauthGateway.unlinkAccount(command.userId, command.provider);
  };
}
