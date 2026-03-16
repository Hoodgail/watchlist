import { localStorageContract } from '@/shared/contracts/storage';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function buildApiUrl(endpoint: string): string {
  if (/^https?:\/\//.test(endpoint)) {
    return endpoint;
  }

  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

const {
  auth: {
    accessToken: ACCESS_TOKEN_KEY,
    refreshToken: REFRESH_TOKEN_KEY,
  },
} = localStorageContract;

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

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
    const response = await fetch(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (response.ok) {
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

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response = await fetch(buildApiUrl(endpoint), {
    ...options,
    headers,
  });

  const refresh = getRefreshToken();
  if (response.status === 401 && refresh) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const newToken = getAccessToken();
      headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(buildApiUrl(endpoint), {
        ...options,
        headers,
      });
    }
  }

  return response;
}

export async function fetchApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return fetch(buildApiUrl(endpoint), options);
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(buildApiUrl('/health'));
    return response.ok;
  } catch {
    return false;
  }
}
