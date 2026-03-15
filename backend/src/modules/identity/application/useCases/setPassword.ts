import type { SetPasswordInput } from '../../../../utils/schemas.js';
import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';

export interface SetPasswordCommand {
  userId: string;
  input: SetPasswordInput;
}

export function createSetPasswordUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function setPassword(command: SetPasswordCommand): Promise<void> {
    await dependencies.authGateway.setPassword(command.userId, command.input);
  };
}
