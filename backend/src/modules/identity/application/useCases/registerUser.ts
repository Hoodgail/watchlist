import type { RegisterInput } from '../../../../utils/schemas.js';
import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';
import type { IdentityAuthResult } from '../dto/identity.js';

export interface RegisterUserCommand extends RegisterInput {}

export function createRegisterUserUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function registerUser(command: RegisterUserCommand): Promise<IdentityAuthResult> {
    return dependencies.authGateway.register(command);
  };
}
