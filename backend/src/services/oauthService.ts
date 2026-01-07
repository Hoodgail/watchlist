import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors.js';
import { createTokensForUser } from './authService.js';
import type { AuthTokens } from './authService.js';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface OAuthUserInfo {
  id: string;
  email: string | null;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface OAuthProvider {
  name: string;
  getAuthorizationUrl(state?: string): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}

export interface OAuthCallbackResult {
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  tokens: AuthTokens;
  isNewUser: boolean;
}

// ============================================================================
// Discord OAuth Provider
// ============================================================================

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_OAUTH_SCOPES = ['identify', 'email'];

interface DiscordTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope: string;
}

interface DiscordUserResponse {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  global_name?: string;
}

class DiscordOAuthProvider implements OAuthProvider {
  name = 'discord';

  private get clientId(): string {
    if (!env.DISCORD_CLIENT_ID) {
      throw new BadRequestError('Discord OAuth is not configured');
    }
    return env.DISCORD_CLIENT_ID;
  }

  private get clientSecret(): string {
    if (!env.DISCORD_CLIENT_SECRET) {
      throw new BadRequestError('Discord OAuth is not configured');
    }
    return env.DISCORD_CLIENT_SECRET;
  }

  private get redirectUri(): string {
    if (!env.DISCORD_REDIRECT_URI) {
      throw new BadRequestError('Discord OAuth is not configured');
    }
    return env.DISCORD_REDIRECT_URI;
  }

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: DISCORD_OAUTH_SCOPES.join(' '),
    });

    if (state) {
      params.set('state', state);
    }

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Discord token exchange failed:', error);
      throw new UnauthorizedError('Failed to exchange OAuth code');
    }

    const data = await response.json() as DiscordTokenResponse;
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new UnauthorizedError('Failed to get Discord user info');
    }

    const data = await response.json() as DiscordUserResponse;
    
    // Build Discord avatar URL
    let avatarUrl: string | null = null;
    if (data.avatar) {
      const extension = data.avatar.startsWith('a_') ? 'gif' : 'png';
      avatarUrl = `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${extension}`;
    }

    return {
      id: data.id,
      email: data.email || null,
      username: data.username,
      displayName: data.global_name || data.username,
      avatarUrl,
    };
  }
}

// ============================================================================
// Provider Registry
// ============================================================================

const providers: Record<string, OAuthProvider> = {
  discord: new DiscordOAuthProvider(),
};

export function getProvider(name: string): OAuthProvider {
  const provider = providers[name];
  if (!provider) {
    throw new BadRequestError(`Unknown OAuth provider: ${name}`);
  }
  return provider;
}

export function getSupportedProviders(): string[] {
  return Object.keys(providers);
}

// ============================================================================
// OAuth Service Functions
// ============================================================================

/**
 * Get the authorization URL for a provider
 */
export function getAuthorizationUrl(providerName: string, state?: string): string {
  const provider = getProvider(providerName);
  return provider.getAuthorizationUrl(state);
}

/**
 * Generate a unique username from the provider username
 */
async function generateUniqueUsername(baseUsername: string): Promise<string> {
  // Sanitize username: only alphanumeric and underscores, max 32 chars
  let sanitized = baseUsername
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .substring(0, 28); // Leave room for suffix

  // Check if username exists
  const existing = await prisma.user.findUnique({
    where: { username: sanitized },
  });

  if (!existing) {
    return sanitized;
  }

  // Add random suffix
  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const candidate = `${sanitized}_${suffix}`;
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
    });
    if (!exists) {
      return candidate;
    }
  }

  throw new ConflictError('Could not generate unique username');
}

/**
 * Handle OAuth callback - creates or logs in user
 */
export async function handleCallback(
  providerName: string,
  code: string
): Promise<OAuthCallbackResult> {
  const provider = getProvider(providerName);
  
  // Exchange code for tokens
  const oauthTokens = await provider.exchangeCode(code);
  
  // Get user info from provider
  const userInfo = await provider.getUserInfo(oauthTokens.accessToken);
  
  // Check if OAuth account already exists
  const existingOAuth = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerId: {
        provider: providerName,
        providerId: userInfo.id,
      },
    },
    include: { user: true },
  });

  if (existingOAuth) {
    // Update tokens and login
    await prisma.oAuthAccount.update({
      where: { id: existingOAuth.id },
      data: {
        accessToken: oauthTokens.accessToken,
        refreshToken: oauthTokens.refreshToken,
        expiresAt: oauthTokens.expiresIn
          ? new Date(Date.now() + oauthTokens.expiresIn * 1000)
          : null,
      },
    });

    // Update avatar if changed
    if (userInfo.avatarUrl && userInfo.avatarUrl !== existingOAuth.user.avatarUrl) {
      await prisma.user.update({
        where: { id: existingOAuth.user.id },
        data: { avatarUrl: userInfo.avatarUrl },
      });
    }

    const tokens = await createTokensForUser(existingOAuth.user.id, existingOAuth.user.email);
    
    return {
      user: {
        id: existingOAuth.user.id,
        username: existingOAuth.user.username,
        email: existingOAuth.user.email,
        displayName: existingOAuth.user.displayName,
        avatarUrl: userInfo.avatarUrl || existingOAuth.user.avatarUrl,
      },
      tokens,
      isNewUser: false,
    };
  }

  // Check if email matches existing user (link accounts)
  if (userInfo.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userInfo.email.toLowerCase() },
    });

    if (existingUser) {
      // Link OAuth account to existing user
      await prisma.oAuthAccount.create({
        data: {
          userId: existingUser.id,
          provider: providerName,
          providerId: userInfo.id,
          accessToken: oauthTokens.accessToken,
          refreshToken: oauthTokens.refreshToken,
          expiresAt: oauthTokens.expiresIn
            ? new Date(Date.now() + oauthTokens.expiresIn * 1000)
            : null,
        },
      });

      // Update avatar if user doesn't have one
      if (userInfo.avatarUrl && !existingUser.avatarUrl) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { avatarUrl: userInfo.avatarUrl },
        });
      }

      const tokens = await createTokensForUser(existingUser.id, existingUser.email);
      
      return {
        user: {
          id: existingUser.id,
          username: existingUser.username,
          email: existingUser.email,
          displayName: existingUser.displayName,
          avatarUrl: existingUser.avatarUrl || userInfo.avatarUrl,
        },
        tokens,
        isNewUser: false,
      };
    }
  }

  // Create new user
  if (!userInfo.email) {
    throw new BadRequestError(
      'Email is required for registration. Please ensure your Discord account has a verified email.'
    );
  }

  const username = await generateUniqueUsername(userInfo.username);
  
  const newUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        email: userInfo.email!.toLowerCase(),
        displayName: userInfo.displayName,
        avatarUrl: userInfo.avatarUrl,
        // passwordHash is null for OAuth-only users
      },
    });

    await tx.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: providerName,
        providerId: userInfo.id,
        accessToken: oauthTokens.accessToken,
        refreshToken: oauthTokens.refreshToken,
        expiresAt: oauthTokens.expiresIn
          ? new Date(Date.now() + oauthTokens.expiresIn * 1000)
          : null,
      },
    });

    return user;
  });

  const tokens = await createTokensForUser(newUser.id, newUser.email);
  
  return {
    user: {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      displayName: newUser.displayName,
      avatarUrl: newUser.avatarUrl,
    },
    tokens,
    isNewUser: true,
  };
}

/**
 * Link an OAuth account to an existing authenticated user
 */
export async function linkAccount(
  userId: string,
  providerName: string,
  code: string
): Promise<{ provider: string; providerId: string }> {
  const provider = getProvider(providerName);
  
  // Exchange code for tokens
  const oauthTokens = await provider.exchangeCode(code);
  
  // Get user info from provider
  const userInfo = await provider.getUserInfo(oauthTokens.accessToken);
  
  // Check if this OAuth account is already linked to another user
  const existingOAuth = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerId: {
        provider: providerName,
        providerId: userInfo.id,
      },
    },
  });

  if (existingOAuth) {
    if (existingOAuth.userId === userId) {
      throw new ConflictError(`${providerName} account is already linked to your account`);
    }
    throw new ConflictError(`This ${providerName} account is already linked to another user`);
  }

  // Check if user already has this provider linked
  const existingProviderLink = await prisma.oAuthAccount.findFirst({
    where: {
      userId,
      provider: providerName,
    },
  });

  if (existingProviderLink) {
    throw new ConflictError(`You already have a ${providerName} account linked`);
  }

  // Create the link
  const oauthAccount = await prisma.oAuthAccount.create({
    data: {
      userId,
      provider: providerName,
      providerId: userInfo.id,
      accessToken: oauthTokens.accessToken,
      refreshToken: oauthTokens.refreshToken,
      expiresAt: oauthTokens.expiresIn
        ? new Date(Date.now() + oauthTokens.expiresIn * 1000)
        : null,
    },
  });

  // Update user's avatar if they don't have one
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user && !user.avatarUrl && userInfo.avatarUrl) {
    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: userInfo.avatarUrl },
    });
  }

  return {
    provider: oauthAccount.provider,
    providerId: oauthAccount.providerId,
  };
}

/**
 * Check if a user can unlink an OAuth provider
 * User must have either a password or another OAuth provider
 */
export async function canUnlinkOAuth(userId: string, providerToRemove: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      oauthAccounts: true,
    },
  });

  if (!user) {
    return false;
  }

  // User has a password, they can unlink any OAuth
  if (user.passwordHash) {
    return true;
  }

  // User has other OAuth providers linked
  const otherProviders = user.oauthAccounts.filter(
    (account) => account.provider !== providerToRemove
  );
  
  return otherProviders.length > 0;
}

/**
 * Unlink an OAuth account from a user
 */
export async function unlinkAccount(
  userId: string,
  providerName: string
): Promise<void> {
  // Find the OAuth account
  const oauthAccount = await prisma.oAuthAccount.findFirst({
    where: {
      userId,
      provider: providerName,
    },
  });

  if (!oauthAccount) {
    throw new BadRequestError(`No ${providerName} account linked`);
  }

  // Check if user can unlink
  const canUnlink = await canUnlinkOAuth(userId, providerName);
  if (!canUnlink) {
    throw new BadRequestError(
      'Cannot unlink OAuth provider. You must have a password or another OAuth provider linked.'
    );
  }

  await prisma.oAuthAccount.delete({
    where: { id: oauthAccount.id },
  });
}

/**
 * Get linked OAuth providers for a user
 */
export async function getLinkedProviders(
  userId: string
): Promise<Array<{ provider: string; linkedAt: Date }>> {
  const accounts = await prisma.oAuthAccount.findMany({
    where: { userId },
    select: {
      provider: true,
      createdAt: true,
    },
  });

  return accounts.map((account) => ({
    provider: account.provider,
    linkedAt: account.createdAt,
  }));
}
