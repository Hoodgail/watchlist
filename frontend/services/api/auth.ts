/**
 * Authentication API
 */

import {
  AuthUser,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
} from '../../types';
import {
  API_BASE_URL,
  fetchWithAuth,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from './client';

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  // Backend returns { user, tokens: { accessToken, refreshToken } }
  const data: AuthResponse = await response.json();
  setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  return data;
}

export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  // Backend returns { user, tokens: { accessToken, refreshToken } }
  const data: AuthResponse = await response.json();
  setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  if (refresh) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  }
  clearTokens();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const response = await fetchWithAuth('/auth/me');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to get current user:', error);
  }

  return null;
}

// ============ OAUTH API ============

export async function getOAuthUrl(provider: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/oauth/${provider}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get OAuth URL');
  }
  
  const data = await response.json();
  return data.authorizationUrl;
}

interface LinkedProvidersResponse {
  linked: Array<{ provider: string; linkedAt: string }>;
  available: string[];
}

export async function getLinkedProviders(): Promise<string[]> {
  const response = await fetchWithAuth('/auth/oauth/providers');
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get linked providers');
  }
  
  const data: LinkedProvidersResponse = await response.json();
  // Return just the provider names for backwards compatibility
  return data.linked.map(p => p.provider);
}

export async function linkOAuthAccount(provider: string, code: string): Promise<void> {
  const response = await fetchWithAuth(`/auth/oauth/${provider}/link`, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to link OAuth account');
  }
}

export async function unlinkOAuthAccount(provider: string): Promise<void> {
  const response = await fetchWithAuth(`/auth/oauth/${provider}/link`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unlink OAuth account');
  }
}

// ============ ACCOUNT SECURITY API ============

/**
 * Set a recovery email for the current user
 */
export async function setRecoveryEmail(email: string): Promise<{ recoveryEmail: string; verificationSent: boolean }> {
  const response = await fetchWithAuth('/auth/recovery-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set recovery email');
  }

  return await response.json();
}

/**
 * Remove recovery email from the current user
 */
export async function removeRecoveryEmail(): Promise<void> {
  const response = await fetchWithAuth('/auth/recovery-email', {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to remove recovery email');
  }
}

/**
 * Verify recovery email with token
 */
export async function verifyRecoveryEmail(token: string): Promise<{ verified: boolean }> {
  const response = await fetch(`${API_BASE_URL}/auth/recovery/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to verify recovery email');
  }

  return await response.json();
}

/**
 * Set a password for the current user (for OAuth-only users)
 */
export async function setPassword(password: string): Promise<void> {
  const response = await fetchWithAuth('/auth/password', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set password');
  }
}

/**
 * Change password for the current user
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetchWithAuth('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to change password');
  }
}

/**
 * Initiate account recovery using recovery email
 */
export async function initiateAccountRecovery(email: string): Promise<{ sent: boolean }> {
  const response = await fetch(`${API_BASE_URL}/auth/recovery/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to initiate recovery');
  }

  return await response.json();
}

/**
 * Complete account recovery with token and new password
 */
export async function completeAccountRecovery(token: string, newPassword: string): Promise<{ tokens: { accessToken: string; refreshToken: string } }> {
  const response = await fetch(`${API_BASE_URL}/auth/recovery/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to complete recovery');
  }

  const data = await response.json();
  
  // Store the new tokens
  setTokens(data.tokens.accessToken, data.tokens.refreshToken);
  
  return data;
}
