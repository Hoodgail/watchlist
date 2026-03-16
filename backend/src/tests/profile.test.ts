import { describe, expect, it } from 'vitest';
import { prisma } from '../config/database.js';
import { authHeader, createTestUser, request, app } from './helpers.js';
import { describeDb } from './testSuites.js';

let sourceCounter = 0;

async function seedSource(refId: string, title: string) {
  sourceCounter += 1;
  return prisma.mediaSource.create({
    data: {
      refId: `${refId}-${sourceCounter}`,
      title,
      type: 'TV',
      total: 62,
    },
  });
}

describeDb('Profile Endpoints', () => {
  describe('GET /api/profile/:username', () => {
    it('returns limited profile for a private user when viewer is not following', async () => {
      const owner = await createTestUser();
      const viewer = await createTestUser();

      const response = await request(app)
        .get(`/api/profile/${owner.username}`)
        .set(authHeader(viewer.accessToken))
        .expect(200);

      expect(response.body.username).toBe(owner.username);
      expect(response.body.isPublic).toBe(false);
      expect(response.body.isOwnProfile).toBe(false);
      expect(response.body.isFollowing).toBe(false);
      expect(response.body.list).toBeUndefined();
    });

    it('returns full profile list for the owner', async () => {
      const owner = await createTestUser();
      const source = await seedSource('tmdb:1396', 'Breaking Bad');

      await request(app)
        .post('/api/list')
        .set(authHeader(owner.accessToken))
        .send({ refId: source.refId, type: 'TV', status: 'WATCHING', current: 5 })
        .expect(201);

      const response = await request(app)
        .get(`/api/profile/${owner.username}`)
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(response.body.isOwnProfile).toBe(true);
      expect(response.body.list).toHaveLength(1);
      expect(response.body.list[0].refId).toBe(source.refId);
    });

    it('returns full profile list for a follower', async () => {
      const owner = await createTestUser();
      const viewer = await createTestUser();
      const source = await seedSource('tmdb:1396', 'Breaking Bad');

      await request(app)
        .post('/api/list')
        .set(authHeader(owner.accessToken))
        .send({ refId: source.refId, type: 'TV', status: 'WATCHING', current: 5 })
        .expect(201);

      await request(app)
        .post(`/api/friends/${owner.id}`)
        .set(authHeader(viewer.accessToken))
        .expect(201);

      const response = await request(app)
        .get(`/api/profile/${owner.username}`)
        .set(authHeader(viewer.accessToken))
        .expect(200);

      expect(response.body.isFollowing).toBe(true);
      expect(response.body.list).toHaveLength(1);
    });
  });

  describe('privacy settings', () => {
    it('updates and returns privacy settings', async () => {
      const user = await createTestUser();

      const updateResponse = await request(app)
        .patch('/api/profile/settings/privacy')
        .set(authHeader(user.accessToken))
        .send({ isPublic: true })
        .expect(200);

      expect(updateResponse.body).toEqual({ isPublic: true });

      const getResponse = await request(app)
        .get('/api/profile/settings/privacy')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(getResponse.body).toEqual({ isPublic: true });
    });
  });
});
