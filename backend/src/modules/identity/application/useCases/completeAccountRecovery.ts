import type { CompleteRecoveryInput } from '../../../../utils/schemas.js';
import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';
import type { IdentityTokens } from '../dto/identity.js';

export type CompleteAccountRecoveryCommand = CompleteRecoveryInput;

export function createCompleteAccountRecoveryUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function completeAccountRecovery(command: CompleteAccountRecoveryCommand): Promise<IdentityTokens> {
    return dependencies.authGateway.completeRecovery(command);
  };
}
