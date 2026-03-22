import * as oauthService from '../../../services/oauthService.js';
import type { IdentityOAuthGateway } from '../application/ports/IdentityOAuthGateway.js';

export function createLegacyIdentityOAuthGateway(): IdentityOAuthGateway {
  return {
    getAuthorizationUrl: (provider, state) => oauthService.getAuthorizationUrl(provider, state),
    handleCallback: (provider, code) => oauthService.handleCallback(provider, code),
    linkAccount: (userId, provider, code) => oauthService.linkAccount(userId, provider, code),
    unlinkAccount: (userId, provider) => oauthService.unlinkAccount(userId, provider),
    getLinkedProviders: (userId) => oauthService.getLinkedProviders(userId),
    getSupportedProviders: () => oauthService.getSupportedProviders(),
  };
}
