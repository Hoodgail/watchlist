import type { SetRecoveryEmailInput } from '../../../../utils/schemas.js';
import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';

export interface SetRecoveryEmailCommand {
  userId: string;
  input: SetRecoveryEmailInput;
}

export function createSetRecoveryEmailUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function setRecoveryEmail(command: SetRecoveryEmailCommand): Promise<{ recoveryEmail: string; verificationSent: boolean }> {
    return dependencies.authGateway.setRecoveryEmail(command.userId, command.input);
  };
}
