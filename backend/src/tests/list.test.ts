import { describe, it, expect } from 'vitest';
import { request, app, createTestUser, authHeader } from './helpers.js';

describe('List Endpoints', () => {
  describe('GET /api/list', () => {
    it('should return empty list for new user', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/list')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should reject unauthenticated request', async () => {
      await request(app)
        .get('/api/list')
        .expect(401);
    });
  });

  describe('POST /api/list', () => {
    it('should create a TV show item', async () => {
      const user = await createTestUser();

      const mediaItem = {
        title: 'Breaking Bad',
        type: 'TV',
        status: 'WATCHING',
        current: 5,
        total: 62,
      };

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send(mediaItem)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe(mediaItem.title);
      expect(response.body.type).toBe(mediaItem.type);
      expect(response.body.status).toBe(mediaItem.status);
      expect(response.body.current).toBe(mediaItem.current);
      expect(response.body.total).toBe(mediaItem.total);
    });

    it('should create a MOVIE item', async () => {
      const user = await createTestUser();

      const mediaItem = {
        title: 'Inception',
        type: 'MOVIE',
        status: 'COMPLETED',
        current: 1,
        total: 1,
      };

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send(mediaItem)
        .expect(201);

      expect(response.body.type).toBe('MOVIE');
      expect(response.body.status).toBe('COMPLETED');
    });

    it('should create an ANIME item', async () => {
      const user = await createTestUser();

      const mediaItem = {
        title: 'Attack on Titan',
        type: 'ANIME',
        status: 'PLAN_TO_WATCH',
        current: 0,
        total: 87,
      };

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send(mediaItem)
        .expect(201);

      expect(response.body.type).toBe('ANIME');
      expect(response.body.status).toBe('PLAN_TO_WATCH');
    });

    it('should create a MANGA item', async () => {
      const user = await createTestUser();

      const mediaItem = {
        title: 'One Piece',
        type: 'MANGA',
        status: 'READING',
        current: 1100,
        total: null,
      };

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send(mediaItem)
        .expect(201);

      expect(response.body.type).toBe('MANGA');
      expect(response.body.status).toBe('READING');
      expect(response.body.total).toBeNull();
    });

    it('should create item with notes', async () => {
      const user = await createTestUser();

      const mediaItem = {
        title: 'Test Show',
        type: 'TV',
        status: 'WATCHING',
        current: 1,
        total: 10,
        notes: 'Great show, highly recommended!',
      };

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send(mediaItem)
        .expect(201);

      expect(response.body.notes).toBe(mediaItem.notes);
    });

    it('should reject invalid media type', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Test',
          type: 'INVALID',
          status: 'WATCHING',
          current: 0,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject invalid status', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Test',
          type: 'TV',
          status: 'INVALID_STATUS',
          current: 0,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject missing title', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          type: 'TV',
          status: 'WATCHING',
          current: 0,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /api/list with filters', () => {
    it('should filter by type', async () => {
      const user = await createTestUser();

      // Create items of different types
      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'TV Show', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Manga', type: 'MANGA', status: 'READING', current: 0 })
        .expect(201);

      const response = await request(app)
        .get('/api/list?type=MANGA')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].type).toBe('MANGA');
    });

    it('should filter by status', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Show 1', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Show 2', type: 'TV', status: 'COMPLETED', current: 10, total: 10 })
        .expect(201);

      const response = await request(app)
        .get('/api/list?status=COMPLETED')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('COMPLETED');
    });

    it('should sort by status (default) with WATCHING/READING first', async () => {
      const user = await createTestUser();

      // Create items with different statuses
      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Completed Show', type: 'TV', status: 'COMPLETED', current: 10, total: 10 })
        .expect(201);

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Watching Show', type: 'TV', status: 'WATCHING', current: 5, total: 10 })
        .expect(201);

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Plan to Watch', type: 'TV', status: 'PLAN_TO_WATCH', current: 0, total: 10 })
        .expect(201);

      const response = await request(app)
        .get('/api/list')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(3);
      // WATCHING should be first (priority 1)
      expect(response.body[0].status).toBe('WATCHING');
      // PLAN_TO_WATCH should be second (priority 3)
      expect(response.body[1].status).toBe('PLAN_TO_WATCH');
      // COMPLETED should be last (priority 4)
      expect(response.body[2].status).toBe('COMPLETED');
    });

    it('should sort by title when sortBy=title', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Zebra Show', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Alpha Show', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      const response = await request(app)
        .get('/api/list?sortBy=title')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].title).toBe('Alpha Show');
      expect(response.body[1].title).toBe('Zebra Show');
    });

    it('should sort by rating when sortBy=rating', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Low Rated', type: 'TV', status: 'COMPLETED', current: 10, total: 10, rating: 3 })
        .expect(201);

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'High Rated', type: 'TV', status: 'COMPLETED', current: 10, total: 10, rating: 9 })
        .expect(201);

      const response = await request(app)
        .get('/api/list?sortBy=rating')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(2);
      // Higher rating first (descending)
      expect(response.body[0].title).toBe('High Rated');
      expect(response.body[1].title).toBe('Low Rated');
    });
  });

  describe('GET /api/list/:id', () => {
    it('should get a specific item', async () => {
      const user = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Test Show', type: 'TV', status: 'WATCHING', current: 5, total: 10 })
        .expect(201);

      const itemId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.id).toBe(itemId);
      expect(response.body.title).toBe('Test Show');
    });

    it('should return 404 for non-existent item', async () => {
      const user = await createTestUser();

      await request(app)
        .get('/api/list/00000000-0000-0000-0000-000000000000')
        .set(authHeader(user.accessToken))
        .expect(404);
    });

    it('should not allow access to other user items', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user1.accessToken))
        .send({ title: 'User1 Show', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      const itemId = createResponse.body.id;

      // User2 tries to access User1's item
      await request(app)
        .get(`/api/list/${itemId}`)
        .set(authHeader(user2.accessToken))
        .expect(403);
    });
  });

  describe('PATCH /api/list/:id', () => {
    it('should update item status', async () => {
      const user = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Test Show', type: 'TV', status: 'WATCHING', current: 5, total: 10 })
        .expect(201);

      const itemId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .send({ status: 'COMPLETED', current: 10 })
        .expect(200);

      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.current).toBe(10);
    });

    it('should update item progress', async () => {
      const user = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Test Show', type: 'TV', status: 'WATCHING', current: 0, total: 10 })
        .expect(201);

      const itemId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .send({ current: 5 })
        .expect(200);

      expect(response.body.current).toBe(5);
    });

    it('should update item notes', async () => {
      const user = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Test Show', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      const itemId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .send({ notes: 'Updated notes' })
        .expect(200);

      expect(response.body.notes).toBe('Updated notes');
    });

    it('should not allow updating other user items', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user1.accessToken))
        .send({ title: 'User1 Show', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      const itemId = createResponse.body.id;

      await request(app)
        .patch(`/api/list/${itemId}`)
        .set(authHeader(user2.accessToken))
        .send({ status: 'COMPLETED' })
        .expect(403);
    });
  });

  describe('DELETE /api/list/:id', () => {
    it('should delete an item', async () => {
      const user = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Test Show', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      const itemId = createResponse.body.id;

      await request(app)
        .delete(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .expect(204);

      // Verify item is deleted
      await request(app)
        .get(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .expect(404);
    });

    it('should not allow deleting other user items', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user1.accessToken))
        .send({ title: 'User1 Show', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      const itemId = createResponse.body.id;

      await request(app)
        .delete(`/api/list/${itemId}`)
        .set(authHeader(user2.accessToken))
        .expect(403);
    });

    it('should return 404 for non-existent item', async () => {
      const user = await createTestUser();

      await request(app)
        .delete('/api/list/00000000-0000-0000-0000-000000000000')
        .set(authHeader(user.accessToken))
        .expect(404);
    });
  });

  describe('All status types', () => {
    it('should support PAUSED status', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Paused Show', type: 'TV', status: 'PAUSED', current: 5, total: 10 })
        .expect(201);

      expect(response.body.status).toBe('PAUSED');
    });

    it('should support DROPPED status', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Dropped Show', type: 'TV', status: 'DROPPED', current: 3, total: 10 })
        .expect(201);

      expect(response.body.status).toBe('DROPPED');
    });
  });

  describe('Rating functionality', () => {
    it('should create item with rating', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Rated Show',
          type: 'TV',
          status: 'COMPLETED',
          current: 12,
          total: 12,
          rating: 8,
        })
        .expect(201);

      expect(response.body.rating).toBe(8);
    });

    it('should update item rating', async () => {
      const user = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ title: 'Test Show', type: 'TV', status: 'WATCHING', current: 0 })
        .expect(201);

      const itemId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .send({ rating: 9 })
        .expect(200);

      expect(response.body.rating).toBe(9);
    });

    it('should allow rating of 0', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Bad Show',
          type: 'TV',
          status: 'DROPPED',
          current: 1,
          rating: 0,
        })
        .expect(201);

      expect(response.body.rating).toBe(0);
    });

    it('should allow rating of 10', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Perfect Show',
          type: 'TV',
          status: 'COMPLETED',
          current: 24,
          total: 24,
          rating: 10,
        })
        .expect(201);

      expect(response.body.rating).toBe(10);
    });

    it('should reject rating below 0', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Invalid Rating',
          type: 'TV',
          status: 'WATCHING',
          current: 0,
          rating: -1,
        })
        .expect(400);
    });

    it('should reject rating above 10', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Invalid Rating',
          type: 'TV',
          status: 'WATCHING',
          current: 0,
          rating: 11,
        })
        .expect(400);
    });

    it('should allow null rating (clearing rating)', async () => {
      const user = await createTestUser();

      const createResponse = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Rated Show',
          type: 'TV',
          status: 'COMPLETED',
          current: 12,
          total: 12,
          rating: 8,
        })
        .expect(201);

      const itemId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .send({ rating: null })
        .expect(200);

      expect(response.body.rating).toBeNull();
    });
  });

  describe('refId and imageUrl functionality', () => {
    it('should create item with refId and imageUrl', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Breaking Bad',
          type: 'TV',
          status: 'WATCHING',
          current: 5,
          total: 62,
          refId: 'tmdb:1396',
          imageUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
        })
        .expect(201);

      expect(response.body.refId).toBe('tmdb:1396');
      expect(response.body.imageUrl).toBe('https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg');
    });

    it('should create manga with mangadex refId', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'One Piece',
          type: 'MANGA',
          status: 'READING',
          current: 1100,
          refId: 'mangadex:a1c7c817-4e59-43b7-9365-09675a149a6f',
        })
        .expect(201);

      expect(response.body.refId).toBe('mangadex:a1c7c817-4e59-43b7-9365-09675a149a6f');
    });

    it('should reject invalid refId format', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          status: 'WATCHING',
          current: 0,
          refId: 'invalid-format',
        })
        .expect(400);
    });

    it('should allow item without refId', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          title: 'Manual Entry',
          type: 'TV',
          status: 'WATCHING',
          current: 0,
        })
        .expect(201);

      expect(response.body.refId).toBeNull();
    });
  });
});
