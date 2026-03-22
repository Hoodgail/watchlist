import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';

export interface LogoutSessionCommand {
  refreshToken: string;
}

export function createLogoutSessionUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function logoutSession(command: LogoutSessionCommand): Promise<void> {
    await dependencies.authGateway.logout(command.refreshToken);
  };
}
