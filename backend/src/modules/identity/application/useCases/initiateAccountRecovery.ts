import type { InitiateRecoveryInput } from '../../../../utils/schemas.js';
import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';

export type InitiateAccountRecoveryCommand = InitiateRecoveryInput;

export function createInitiateAccountRecoveryUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function initiateAccountRecovery(command: InitiateAccountRecoveryCommand): Promise<{ sent: boolean }> {
    return dependencies.authGateway.initiateRecovery(command);
  };
}
