import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app, request } from './helpers.js';
const mocks = vi.hoisted(() => ({
  getAuthorizationUrl: vi.fn(
    ({ state }: { state: string }) => `https://discord.com/oauth2/authorize?state=${state}`,
  ),
  handleOAuthCallback: vi.fn(async () => ({
    tokens: { accessToken: 'access-fixture', refreshToken: 'refresh-fixture' },
    isNewUser: false,
  })),
}));
vi.mock('../modules/identity/composition/createIdentityApplication.js', () => ({
  identityApplication: mocks,
}));
beforeEach(() => vi.clearAllMocks());
describe('OAuth browser binding', () => {
  it('rejects a callback without browser state before exchanging the code', async () => {
    const result = await request(app)
      .get('/api/auth/oauth/discord/callback?code=untrusted')
      .expect(302);
    expect(new URL(result.headers.location).searchParams.get('error')).toContain(
      'Invalid OAuth state',
    );
    expect(mocks.handleOAuthCallback).not.toHaveBeenCalled();
  });
  it('rejects altered state and binds cookies to the provider', async () => {
    const start = await request(app)
      .get('/api/auth/oauth/discord?state=caller-controlled')
      .expect(200);
    const state = new URL(start.body.authorizationUrl).searchParams.get('state');
    expect(state).not.toBe('caller-controlled');
    const cookie = (start.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    for (const path of [
      `discord/callback?code=test&state=wrong`,
      `other/callback?code=test&state=${state}`,
    ]) {
      const result = await request(app)
        .get(`/api/auth/oauth/${path}`)
        .set('Cookie', cookie)
        .expect(302);
      expect(new URL(result.headers.location).searchParams.get('error')).toContain(
        'Invalid OAuth state',
      );
    }
    expect(mocks.handleOAuthCallback).not.toHaveBeenCalled();
  });
  it('returns tokens in a fragment and clears the state cookie on a valid callback', async () => {
    const start = await request(app).get('/api/auth/oauth/discord').expect(200);
    const state = new URL(start.body.authorizationUrl).searchParams.get('state');
    const cookie = (start.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    const result = await request(app)
      .get(`/api/auth/oauth/discord/callback?code=test&state=${state}`)
      .set('Cookie', cookie)
      .expect(302);
    const redirect = new URL(result.headers.location);
    expect(redirect.search).toBe('');
    expect(new URLSearchParams(redirect.hash.slice(1)).get('refreshToken')).toBe('refresh-fixture');
    expect(result.headers['set-cookie'][0]).toContain('watchlist_oauth=;');
    expect(mocks.handleOAuthCallback).toHaveBeenCalledOnce();
  });
});
