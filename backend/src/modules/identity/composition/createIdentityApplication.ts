import { createChangePasswordUseCase } from '../application/useCases/changePassword.js';
import { createCompleteAccountRecoveryUseCase } from '../application/useCases/completeAccountRecovery.js';
import { createGetAuthorizationUrlUseCase } from '../application/useCases/getAuthorizationUrl.js';
import { createGetCurrentIdentityUseCase } from '../application/useCases/getCurrentIdentity.js';
import { createGetLinkedOAuthProvidersUseCase } from '../application/useCases/getLinkedOAuthProviders.js';
import { createHandleOAuthCallbackUseCase } from '../application/useCases/handleOAuthCallback.js';
import { createInitiateAccountRecoveryUseCase } from '../application/useCases/initiateAccountRecovery.js';
import { createLinkOAuthAccountUseCase } from '../application/useCases/linkOAuthAccount.js';
import { createLoginUserUseCase } from '../application/useCases/loginUser.js';
import { createLogoutAllSessionsUseCase } from '../application/useCases/logoutAllSessions.js';
import { createLogoutSessionUseCase } from '../application/useCases/logoutSession.js';
import { createRefreshSessionUseCase } from '../application/useCases/refreshSession.js';
import { createRegisterUserUseCase } from '../application/useCases/registerUser.js';
import { createRemoveRecoveryEmailUseCase } from '../application/useCases/removeRecoveryEmail.js';
import { createSetPasswordUseCase } from '../application/useCases/setPassword.js';
import { createSetRecoveryEmailUseCase } from '../application/useCases/setRecoveryEmail.js';
import { createUnlinkOAuthAccountUseCase } from '../application/useCases/unlinkOAuthAccount.js';
import { createVerifyRecoveryEmailUseCase } from '../application/useCases/verifyRecoveryEmail.js';
import { createLegacyIdentityAuthGateway } from '../infrastructure/legacyIdentityAuthGateway.js';
import { createLegacyIdentityOAuthGateway } from '../infrastructure/legacyIdentityOAuthGateway.js';
import type { IdentityAuthGateway } from '../application/ports/IdentityAuthGateway.js';
import type { IdentityOAuthGateway } from '../application/ports/IdentityOAuthGateway.js';

export interface IdentityApplicationDependencies {
  authGateway: IdentityAuthGateway;
  oauthGateway: IdentityOAuthGateway;
}

export function createIdentityApplication(dependencies?: Partial<IdentityApplicationDependencies>) {
  const authGateway = dependencies?.authGateway ?? createLegacyIdentityAuthGateway();
  const oauthGateway = dependencies?.oauthGateway ?? createLegacyIdentityOAuthGateway();

  return {
    registerUser: createRegisterUserUseCase({ authGateway }),
    loginUser: createLoginUserUseCase({ authGateway }),
    refreshSession: createRefreshSessionUseCase({ authGateway }),
    logoutSession: createLogoutSessionUseCase({ authGateway }),
    logoutAllSessions: createLogoutAllSessionsUseCase({ authGateway }),
    getCurrentIdentity: createGetCurrentIdentityUseCase({ authGateway }),
    setRecoveryEmail: createSetRecoveryEmailUseCase({ authGateway }),
    verifyRecoveryEmail: createVerifyRecoveryEmailUseCase({ authGateway }),
    removeRecoveryEmail: createRemoveRecoveryEmailUseCase({ authGateway }),
    setPassword: createSetPasswordUseCase({ authGateway }),
    changePassword: createChangePasswordUseCase({ authGateway }),
    initiateAccountRecovery: createInitiateAccountRecoveryUseCase({ authGateway }),
    completeAccountRecovery: createCompleteAccountRecoveryUseCase({ authGateway }),
    getAuthorizationUrl: createGetAuthorizationUrlUseCase({ oauthGateway }),
    handleOAuthCallback: createHandleOAuthCallbackUseCase({ oauthGateway }),
    linkOAuthAccount: createLinkOAuthAccountUseCase({ oauthGateway }),
    unlinkOAuthAccount: createUnlinkOAuthAccountUseCase({ oauthGateway }),
    getLinkedOAuthProviders: createGetLinkedOAuthProvidersUseCase({ oauthGateway }),
    getSupportedProviders: oauthGateway.getSupportedProviders,
  };
}

export const identityApplication = createIdentityApplication();
