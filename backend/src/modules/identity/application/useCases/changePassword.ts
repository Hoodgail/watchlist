import type { ChangePasswordInput } from '../../../../utils/schemas.js';
import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';

export interface ChangePasswordCommand {
  userId: string;
  input: ChangePasswordInput;
}

export function createChangePasswordUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function changePassword(command: ChangePasswordCommand): Promise<void> {
    await dependencies.authGateway.changePassword(command.userId, command.input);
  };
}
