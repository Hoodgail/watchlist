import type {
  ChangePasswordInput,
  CompleteRecoveryInput,
  InitiateRecoveryInput,
  LoginInput,
  RegisterInput,
  SetRecoveryEmailInput,
  SetPasswordInput,
  VerifyRecoveryEmailInput,
} from '../../../../utils/schemas.js';
import type {
  IdentityAuthResult,
  IdentityTokens,
  IdentityUserWithOAuth,
} from '../dto/identity.js';

export interface IdentityAuthGateway {
  register(input: RegisterInput): Promise<IdentityAuthResult>;
  login(input: LoginInput): Promise<IdentityAuthResult>;
  refreshSession(refreshToken: string): Promise<IdentityTokens>;
  logout(refreshToken: string): Promise<void>;
  logoutAll(userId: string): Promise<void>;
  getCurrentIdentity(userId: string): Promise<IdentityUserWithOAuth | null>;
  setRecoveryEmail(userId: string, input: SetRecoveryEmailInput): Promise<{ recoveryEmail: string; verificationSent: boolean }>;
  verifyRecoveryEmail(input: VerifyRecoveryEmailInput): Promise<{ verified: boolean }>;
  removeRecoveryEmail(userId: string): Promise<void>;
  setPassword(userId: string, input: SetPasswordInput): Promise<void>;
  changePassword(userId: string, input: ChangePasswordInput): Promise<void>;
  initiateRecovery(input: InitiateRecoveryInput): Promise<{ sent: boolean }>;
  completeRecovery(input: CompleteRecoveryInput): Promise<IdentityTokens>;
}
