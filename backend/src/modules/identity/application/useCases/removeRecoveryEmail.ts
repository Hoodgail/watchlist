import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';

export interface RemoveRecoveryEmailCommand {
  userId: string;
}

export function createRemoveRecoveryEmailUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function removeRecoveryEmail(command: RemoveRecoveryEmailCommand): Promise<void> {
    await dependencies.authGateway.removeRecoveryEmail(command.userId);
  };
}
