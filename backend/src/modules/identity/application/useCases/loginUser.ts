import type { LoginInput } from '../../../../utils/schemas.js';
import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';
import type { IdentityAuthResult } from '../dto/identity.js';

export interface LoginUserCommand extends LoginInput {}

export function createLoginUserUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function loginUser(command: LoginUserCommand): Promise<IdentityAuthResult> {
    return dependencies.authGateway.login(command);
  };
}
