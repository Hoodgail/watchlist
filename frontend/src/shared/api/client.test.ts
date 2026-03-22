import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildApiUrl,
  clearTokens,
  fetchApi,
  fetchWithAuth,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './client';

describe('shared api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('stores and clears auth tokens', () => {
    setTokens('access-1', 'refresh-1');

    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');

    clearTokens();

    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('builds absolute api urls from relative endpoints', () => {
    expect(buildApiUrl('/comments/feed/public')).toBe('http://localhost:3001/api/comments/feed/public');
    expect(buildApiUrl('health')).toBe('http://localhost:3001/api/health');
  });

  it('adds bearer token headers to authenticated requests', async () => {
    setTokens('access-token', 'refresh-token');

    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithAuth('/profile/settings/privacy');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3001/api/profile/settings/privacy');
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Content-Type': 'application/json',
    });
  });

  it('refreshes tokens and retries once after a 401 response', async () => {
    setTokens('stale-access', 'refresh-token');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithAuth('/auth/me');

    expect(response.ok).toBe(true);
    expect(getAccessToken()).toBe('fresh-access');
    expect(getRefreshToken()).toBe('fresh-refresh');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3001/api/auth/refresh');
    expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer fresh-access',
    });
  });

  it('uses the shared api boundary for unauthenticated requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchApi('/media/trending');

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/media/trending', {});
  });
});
