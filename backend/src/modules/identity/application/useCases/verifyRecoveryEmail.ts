import type { VerifyRecoveryEmailInput } from '../../../../utils/schemas.js';
import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';

export type VerifyRecoveryEmailCommand = VerifyRecoveryEmailInput;

export function createVerifyRecoveryEmailUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function verifyRecoveryEmail(command: VerifyRecoveryEmailCommand): Promise<{ verified: boolean }> {
    return dependencies.authGateway.verifyRecoveryEmail(command);
  };
}
