import { describe, it, expect } from 'vitest';
import { request, app, createTestUser, authHeader } from './helpers.js';

describe('Friends Endpoints', () => {
  describe('GET /api/friends', () => {
    it('should return empty list when not following anyone', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/friends')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should reject unauthenticated request', async () => {
      await request(app)
        .get('/api/friends')
        .expect(401);
    });
  });

  describe('POST /api/friends/:userId (follow)', () => {
    it('should follow another user', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const response = await request(app)
        .post(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(201);

      expect(response.body.message).toBe('Successfully followed user');

      // Verify following list
      const followingResponse = await request(app)
        .get('/api/friends')
        .set(authHeader(user1.accessToken))
        .expect(200);

      expect(followingResponse.body).toHaveLength(1);
      expect(followingResponse.body[0].id).toBe(user2.id);
      expect(followingResponse.body[0].username).toBe(user2.username);
    });

    it('should not allow following yourself', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post(`/api/friends/${user.id}`)
        .set(authHeader(user.accessToken))
        .expect(409);

      expect(response.body.error).toBe('Cannot follow yourself');
    });

    it('should not allow following same user twice', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await request(app)
        .post(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(201);

      const response = await request(app)
        .post(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(409);

      expect(response.body.error).toBe('Already following this user');
    });

    it('should return 404 for non-existent user', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/friends/00000000-0000-0000-0000-000000000000')
        .set(authHeader(user.accessToken))
        .expect(404);
    });
  });

  describe('DELETE /api/friends/:userId (unfollow)', () => {
    it('should unfollow a user', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Follow first
      await request(app)
        .post(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(201);

      // Unfollow
      await request(app)
        .delete(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(204);

      // Verify no longer following
      const response = await request(app)
        .get('/api/friends')
        .set(authHeader(user1.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return 404 when not following user', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await request(app)
        .delete(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(404);
    });
  });

  describe('GET /api/friends/followers', () => {
    it('should return list of followers', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // User2 follows User1
      await request(app)
        .post(`/api/friends/${user1.id}`)
        .set(authHeader(user2.accessToken))
        .expect(201);

      // User1 checks followers
      const response = await request(app)
        .get('/api/friends/followers')
        .set(authHeader(user1.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(user2.id);
    });

    it('should return empty list when no followers', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/friends/followers')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/friends/:userId/list', () => {
    it('should view friend list when following', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // User2 adds items to their list
      await request(app)
        .post('/api/list')
        .set(authHeader(user2.accessToken))
        .send({ title: 'Show 1', type: 'TV', status: 'WATCHING', current: 5, total: 10 });

      await request(app)
        .post('/api/list')
        .set(authHeader(user2.accessToken))
        .send({ title: 'Manga 1', type: 'MANGA', status: 'READING', current: 100 });

      // User1 follows User2
      await request(app)
        .post(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(201);

      // User1 views User2's list
      const response = await request(app)
        .get(`/api/friends/${user2.id}/list`)
        .set(authHeader(user1.accessToken))
        .expect(200);

      expect(response.body.id).toBe(user2.id);
      expect(response.body.username).toBe(user2.username);
      expect(response.body.list).toHaveLength(2);
    });

    it('should not allow viewing list without following', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await request(app)
        .get(`/api/friends/${user2.id}/list`)
        .set(authHeader(user1.accessToken))
        .expect(403);
    });
  });

  describe('GET /api/friends/search', () => {
    it('should search users by username', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const response = await request(app)
        .get(`/api/friends/search?q=${user2.username.substring(0, 8)}`)
        .set(authHeader(user1.accessToken))
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      const found = response.body.find((u: { id: string }) => u.id === user2.id);
      expect(found).toBeDefined();
      expect(found.isFollowing).toBe(false);
    });

    it('should not include self in search results', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get(`/api/friends/search?q=${user.username}`)
        .set(authHeader(user.accessToken))
        .expect(200);

      const found = response.body.find((u: { id: string }) => u.id === user.id);
      expect(found).toBeUndefined();
    });

    it('should indicate if already following', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // Follow user2
      await request(app)
        .post(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(201);

      const response = await request(app)
        .get(`/api/friends/search?q=${user2.username.substring(0, 8)}`)
        .set(authHeader(user1.accessToken))
        .expect(200);

      const found = response.body.find((u: { id: string }) => u.id === user2.id);
      expect(found).toBeDefined();
      expect(found.isFollowing).toBe(true);
    });

    it('should require search query', async () => {
      const user = await createTestUser();

      await request(app)
        .get('/api/friends/search')
        .set(authHeader(user.accessToken))
        .expect(400);
    });
  });

  describe('Following statistics', () => {
    it('should return list count and active count for friends', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // User2 adds items
      await request(app)
        .post('/api/list')
        .set(authHeader(user2.accessToken))
        .send({ title: 'Active Show', type: 'TV', status: 'WATCHING', current: 5 });

      await request(app)
        .post('/api/list')
        .set(authHeader(user2.accessToken))
        .send({ title: 'Completed Show', type: 'TV', status: 'COMPLETED', current: 10, total: 10 });

      await request(app)
        .post('/api/list')
        .set(authHeader(user2.accessToken))
        .send({ title: 'Reading Manga', type: 'MANGA', status: 'READING', current: 50 });

      // User1 follows User2
      await request(app)
        .post(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(201);

      // Check following list stats
      const response = await request(app)
        .get('/api/friends')
        .set(authHeader(user1.accessToken))
        .expect(200);

      expect(response.body[0].listCount).toBe(3);
      expect(response.body[0].activeCount).toBe(2); // WATCHING + READING
    });
  });

  describe('Mutual following', () => {
    it('should allow mutual following', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // User1 follows User2
      await request(app)
        .post(`/api/friends/${user2.id}`)
        .set(authHeader(user1.accessToken))
        .expect(201);

      // User2 follows User1
      await request(app)
        .post(`/api/friends/${user1.id}`)
        .set(authHeader(user2.accessToken))
        .expect(201);

      // Both should see each other in following list
      const user1Following = await request(app)
        .get('/api/friends')
        .set(authHeader(user1.accessToken))
        .expect(200);

      const user2Following = await request(app)
        .get('/api/friends')
        .set(authHeader(user2.accessToken))
        .expect(200);

      expect(user1Following.body).toHaveLength(1);
      expect(user1Following.body[0].id).toBe(user2.id);

      expect(user2Following.body).toHaveLength(1);
      expect(user2Following.body[0].id).toBe(user1.id);
    });
  });
});
