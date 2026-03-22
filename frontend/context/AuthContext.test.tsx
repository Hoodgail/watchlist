import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

const mockedApi = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getOAuthUrl: vi.fn(),
}));

vi.mock('@/features/auth/api', () => mockedApi);

function AuthProbe() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div>loading</div>;
  }

  return (
    <div>
      <span data-testid="user">{auth.user?.username ?? 'none'}</span>
      <span data-testid="offline">{String(auth.isOfflineAuthenticated)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('hydrates an authenticated user from the api and caches it', async () => {
    mockedApi.getCurrentUser.mockResolvedValue({ id: 'u1', username: 'tester', email: 't@example.com' });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await vi.waitFor(() => expect(document.querySelector('[data-testid="user"]')).toHaveTextContent('tester'));
    expect(document.querySelector('[data-testid="offline"]')).toHaveTextContent('false');
    expect(document.querySelector('[data-testid="authenticated"]')).toHaveTextContent('true');
    expect(localStorage.getItem('watchlist_cached_user')).toContain('tester');
  });

  it('falls back to the cached user during network failures', async () => {
    localStorage.setItem('watchlist_cached_user', JSON.stringify({ id: 'u2', username: 'offline-user', email: 'o@example.com' }));
    mockedApi.getCurrentUser.mockRejectedValue(new TypeError('Failed to fetch'));
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await vi.waitFor(() => expect(document.querySelector('[data-testid="user"]')).toHaveTextContent('offline-user'));
    expect(document.querySelector('[data-testid="offline"]')).toHaveTextContent('true');
    expect(document.querySelector('[data-testid="authenticated"]')).toHaveTextContent('true');
  });
});
