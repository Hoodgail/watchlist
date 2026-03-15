import * as authService from '../../../services/authService.js';
import type { IdentityAuthGateway } from '../application/ports/IdentityAuthGateway.js';

export function createLegacyIdentityAuthGateway(): IdentityAuthGateway {
  return {
    register: (input) => authService.register(input),
    login: (input) => authService.login(input),
    refreshSession: (refreshToken) => authService.refreshAccessToken(refreshToken),
    logout: (refreshToken) => authService.logout(refreshToken),
    logoutAll: (userId) => authService.logoutAll(userId),
    getCurrentIdentity: (userId) => authService.getCurrentUserWithOAuth(userId),
    setRecoveryEmail: (userId, input) => authService.setRecoveryEmail(userId, input.email),
    verifyRecoveryEmail: (input) => authService.verifyRecoveryEmail(input.token),
    removeRecoveryEmail: (userId) => authService.removeRecoveryEmail(userId),
    setPassword: (userId, input) => authService.setPassword(userId, input.password),
    changePassword: (userId, input) => authService.changePassword(userId, input.currentPassword, input.newPassword),
    initiateRecovery: (input) => authService.initiateAccountRecovery(input.email),
    completeRecovery: (input) => authService.completeAccountRecovery(input.token, input.newPassword),
  };
}
