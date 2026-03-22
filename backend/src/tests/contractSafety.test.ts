import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { app, authHeader, createTestUser, request } from './helpers.js';
import { describeDb } from './testSuites.js';

const repoRoot = path.resolve(process.cwd(), '..');

describeDb('Contract safety rails', () => {
  it('keeps auth token payload shapes stable', async () => {
    const registerPayload = {
      username: `contract-user-${Date.now()}`,
      email: `contract-${Date.now()}@example.com`,
      password: 'TestPassword123!',
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(registerPayload)
      .expect(201);

    expect(registerResponse.body.tokens).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
    expect(registerResponse.body.accessToken).toBeUndefined();
    expect(registerResponse.body.refreshToken).toBeUndefined();

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: registerResponse.body.tokens.refreshToken })
      .expect(200);

    expect(refreshResponse.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
    expect(refreshResponse.body.tokens).toBeUndefined();
  });

  it('keeps common error response bodies stable', async () => {
    const missingTokenResponse = await request(app)
      .get('/api/auth/me')
      .expect(401);

    expect(missingTokenResponse.body).toEqual({ error: 'No token provided' });

    const invalidTokenResponse = await request(app)
      .get('/api/auth/me')
      .set(authHeader('invalid-token'))
      .expect(401);

    expect(invalidTokenResponse.body).toEqual({ error: 'Invalid token' });

    const notFoundResponse = await request(app)
      .get('/api/this-route-does-not-exist')
      .expect(404);

    expect(notFoundResponse.body).toEqual({ error: 'Not found' });
  });

  it('keeps grouped list pagination fields stable', async () => {
    const user = await createTestUser();

    await request(app)
      .post('/api/list')
      .set(authHeader(user.accessToken))
      .send({ title: 'Watching Alpha', type: 'TV', status: 'WATCHING', current: 1, total: 10 })
      .expect(201);

    await request(app)
      .post('/api/list')
      .set(authHeader(user.accessToken))
      .send({ title: 'Watching Beta', type: 'TV', status: 'WATCHING', current: 2, total: 10 })
      .expect(201);

    await request(app)
      .post('/api/list')
      .set(authHeader(user.accessToken))
      .send({ title: 'Completed Gamma', type: 'TV', status: 'COMPLETED', current: 10, total: 10 })
      .expect(201);

    const firstPageResponse = await request(app)
      .get('/api/list/grouped')
      .set(authHeader(user.accessToken))
      .query({ mediaTypeFilter: 'video', limit: '1' })
      .expect(200);

    expect(firstPageResponse.body.grandTotal).toBe(3);
    expect(firstPageResponse.body.groups.WATCHING).toEqual({
      items: [expect.objectContaining({ status: 'WATCHING', type: 'TV' })],
      total: 2,
      hasMore: true,
      page: 1,
    });
    expect(firstPageResponse.body.groups.COMPLETED).toEqual({
      items: [expect.objectContaining({ status: 'COMPLETED', type: 'TV' })],
      total: 1,
      hasMore: false,
      page: 1,
    });

    const secondPageResponse = await request(app)
      .get('/api/list/grouped')
      .set(authHeader(user.accessToken))
      .query({ mediaTypeFilter: 'video', limit: '1', statusPages: JSON.stringify({ WATCHING: 2 }) })
      .expect(200);

    expect(secondPageResponse.body.groups.WATCHING).toEqual({
      items: [expect.objectContaining({ status: 'WATCHING', type: 'TV' })],
      total: 2,
      hasMore: false,
      page: 2,
    });
  });

  it('keeps frontend storage contract values stable', async () => {
    const storageContract = await fs.readFile(
      path.resolve(repoRoot, 'frontend/src/shared/contracts/storage.ts'),
      'utf8',
    );

    expect(storageContract).toContain("cachedUser: 'watchlist_cached_user'");
    expect(storageContract).toContain("accessToken: 'accessToken'");
    expect(storageContract).toContain("refreshToken: 'refreshToken'");
    expect(storageContract).toContain("dbName: 'watchlist-manga'");
    expect(storageContract).toContain("dbVersion: 1");
    expect(storageContract).toContain("MANGA: 'manga'");
    expect(storageContract).toContain("READING_PROGRESS: 'reading_progress'");
    expect(storageContract).toContain("dbName: 'watchlist-video'");
    expect(storageContract).toContain("dbVersion: 2");
    expect(storageContract).toContain('chunkSizeBytes: 5 * 1024 * 1024');
    expect(storageContract).toContain("HLS_SEGMENTS: 'hls_segments'");
    expect(storageContract).toContain("WATCH_PROGRESS: 'watch_progress'");
  });
});
