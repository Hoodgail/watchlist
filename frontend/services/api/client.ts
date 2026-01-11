/**
 * Core HTTP client with token management and automatic refresh
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Token management - always read from localStorage to ensure consistency
export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// Store and retrieve tokens (exported for OAuth callback)
export function storeTokens(accessToken: string, refreshToken: string): void {
  setTokens(accessToken, refreshToken);
}

export function removeTokens(): void {
  clearTokens();
}

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (response.ok) {
      // Refresh endpoint returns { accessToken, refreshToken } directly (not nested)
      const data = await response.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }

  clearTokens();
  return false;
}

// HTTP client with automatic token refresh
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // If 401, try to refresh token
  const refresh = getRefreshToken();
  if (response.status === 401 && refresh) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    }
  }

  return response;
}

// ============ HEALTH CHECK ============

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
