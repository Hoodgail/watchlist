import type {
  IdentityOAuthCallbackResult,
  LinkedOAuthAccount,
  LinkedOAuthProvider,
} from '../dto/identity.js';

export interface IdentityOAuthGateway {
  getAuthorizationUrl(provider: string, state?: string): string;
  handleCallback(provider: string, code: string): Promise<IdentityOAuthCallbackResult>;
  linkAccount(userId: string, provider: string, code: string): Promise<LinkedOAuthAccount>;
  unlinkAccount(userId: string, provider: string): Promise<void>;
  getLinkedProviders(userId: string): Promise<LinkedOAuthProvider[]>;
  getSupportedProviders(): string[];
}
