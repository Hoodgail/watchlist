import type { IdentityAuthGateway } from '../ports/IdentityAuthGateway.js';

export interface LogoutAllSessionsCommand {
  userId: string;
}

export function createLogoutAllSessionsUseCase(dependencies: { authGateway: IdentityAuthGateway }) {
  return async function logoutAllSessions(command: LogoutAllSessionsCommand): Promise<void> {
    await dependencies.authGateway.logoutAll(command.userId);
  };
}
