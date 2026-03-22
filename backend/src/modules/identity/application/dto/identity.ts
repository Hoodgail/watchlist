export interface IdentityTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IdentityUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  createdAt: Date;
}

export interface IdentityUserWithOAuth extends IdentityUser {
  hasPassword: boolean;
  oauthProviders: Array<{ provider: string; linkedAt: Date }>;
  recoveryEmail: string | null;
  recoveryEmailVerified: boolean;
}

export interface IdentityAuthResult {
  user: IdentityUser;
  tokens: IdentityTokens;
}

export interface OAuthCallbackUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface IdentityOAuthCallbackResult {
  user: OAuthCallbackUser;
  tokens: IdentityTokens;
  isNewUser: boolean;
}

export interface LinkedOAuthProvider {
  provider: string;
  linkedAt: Date;
}

export interface LinkedOAuthAccount {
  provider: string;
  providerId: string;
}
