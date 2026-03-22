import type { MediaType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { prisma } from '../config/database.js';
import { app, authHeader, createTestUser, request, type TestUser } from './helpers.js';
import { describeDb } from './testSuites.js';

let mediaSourceCounter = 0;

function nextRefId(source = 'test'): string {
  mediaSourceCounter += 1;
  return `${source}:${Date.now()}-${mediaSourceCounter}`;
}

async function seedMediaSource(input: {
  title: string;
  type: MediaType;
  total?: number | null;
  imageUrl?: string | null;
  refId?: string;
}) {
  return prisma.mediaSource.create({
    data: {
      refId: input.refId ?? nextRefId(),
      title: input.title,
      type: input.type,
      total: input.total ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });
}

function createListItem(
  user: TestUser,
  payload: {
    refId: string;
    type: MediaType;
    status: string;
    current?: number;
    notes?: string;
    rating?: number | null;
    platforms?: string[];
    metacritic?: number | null;
    genres?: string[];
    playtimeHours?: number | null;
  },
) {
  return request(app)
    .post('/api/list')
    .set(authHeader(user.accessToken))
    .send({
      refId: payload.refId,
      type: payload.type,
      status: payload.status,
      current: payload.current ?? 0,
      notes: payload.notes,
      rating: payload.rating,
      platforms: payload.platforms,
      metacritic: payload.metacritic,
      genres: payload.genres,
      playtimeHours: payload.playtimeHours,
    });
}

async function createSourceBackedItem(
  user: TestUser,
  source: {
    title: string;
    type: MediaType;
    total?: number | null;
    imageUrl?: string | null;
    refId?: string;
  },
  item: {
    status: string;
    current?: number;
    notes?: string;
    rating?: number | null;
    platforms?: string[];
    metacritic?: number | null;
    genres?: string[];
    playtimeHours?: number | null;
  },
) {
  const mediaSource = await seedMediaSource(source);
  const response = await createListItem(user, {
    refId: mediaSource.refId,
    type: mediaSource.type,
    status: item.status,
    current: item.current,
    notes: item.notes,
    rating: item.rating,
    platforms: item.platforms,
    metacritic: item.metacritic,
    genres: item.genres,
    playtimeHours: item.playtimeHours,
  }).expect(201);

  return { mediaSource, response };
}

describeDb('List Endpoints', () => {
  describe('GET /api/list', () => {
    it('should return empty paginated list for new user', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/list')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
        hasMore: false,
      });
    });

    it('should reject unauthenticated request', async () => {
      await request(app)
        .get('/api/list')
        .expect(401);
    });
  });

  describe('POST /api/list', () => {
    it('should create a TV show item from a source refId', async () => {
      const user = await createTestUser();
      const { mediaSource, response } = await createSourceBackedItem(
        user,
        { title: 'Breaking Bad', type: 'TV', total: 62 },
        { status: 'WATCHING', current: 5 },
      );

      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe(mediaSource.title);
      expect(response.body.type).toBe(mediaSource.type);
      expect(response.body.status).toBe('WATCHING');
      expect(response.body.current).toBe(5);
      expect(response.body.total).toBe(62);
      expect(response.body.refId).toBe(mediaSource.refId);
    });

    it('should create a MOVIE item', async () => {
      const user = await createTestUser();
      const { response } = await createSourceBackedItem(
        user,
        { title: 'Inception', type: 'MOVIE', total: 1 },
        { status: 'COMPLETED', current: 1 },
      );

      expect(response.body.title).toBe('Inception');
      expect(response.body.type).toBe('MOVIE');
      expect(response.body.status).toBe('COMPLETED');
    });

    it('should create an ANIME item', async () => {
      const user = await createTestUser();
      const { response } = await createSourceBackedItem(
        user,
        { title: 'Attack on Titan', type: 'ANIME', total: 87 },
        { status: 'PLAN_TO_WATCH', current: 0 },
      );

      expect(response.body.title).toBe('Attack on Titan');
      expect(response.body.type).toBe('ANIME');
      expect(response.body.status).toBe('PLAN_TO_WATCH');
    });

    it('should create a MANGA item', async () => {
      const user = await createTestUser();
      const { response } = await createSourceBackedItem(
        user,
        { title: 'One Piece', type: 'MANGA' },
        { status: 'READING', current: 1100 },
      );

      expect(response.body.title).toBe('One Piece');
      expect(response.body.type).toBe('MANGA');
      expect(response.body.status).toBe('READING');
      expect(response.body.total).toBeNull();
    });

    it('should create item with notes', async () => {
      const user = await createTestUser();
      const { response } = await createSourceBackedItem(
        user,
        { title: 'Test Show', type: 'TV', total: 10 },
        { status: 'WATCHING', current: 1, notes: 'Great show, highly recommended!' },
      );

      expect(response.body.notes).toBe('Great show, highly recommended!');
    });

    it('should reject invalid media type', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          refId: nextRefId(),
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
          refId: nextRefId(),
          type: 'TV',
          status: 'INVALID_STATUS',
          current: 0,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject missing refId', async () => {
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

      await createSourceBackedItem(user, { title: 'TV Show', type: 'TV' }, { status: 'WATCHING' });
      await createSourceBackedItem(user, { title: 'Manga', type: 'MANGA' }, { status: 'READING' });

      const response = await request(app)
        .get('/api/list?type=MANGA')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].type).toBe('MANGA');
      expect(response.body.total).toBe(1);
    });

    it('should filter by status', async () => {
      const user = await createTestUser();

      await createSourceBackedItem(user, { title: 'Show 1', type: 'TV' }, { status: 'WATCHING' });
      await createSourceBackedItem(user, { title: 'Show 2', type: 'TV' }, { status: 'COMPLETED', current: 10 });

      const response = await request(app)
        .get('/api/list?status=COMPLETED')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].status).toBe('COMPLETED');
    });

    it('should sort by status (default) with WATCHING/READING first', async () => {
      const user = await createTestUser();

      await createSourceBackedItem(user, { title: 'Completed Show', type: 'TV' }, { status: 'COMPLETED', current: 10 });
      await createSourceBackedItem(user, { title: 'Watching Show', type: 'TV' }, { status: 'WATCHING', current: 5 });
      await createSourceBackedItem(user, { title: 'Plan to Watch', type: 'TV' }, { status: 'PLAN_TO_WATCH', current: 0 });

      const response = await request(app)
        .get('/api/list')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.items).toHaveLength(3);
      expect(response.body.items[0].status).toBe('WATCHING');
      expect(response.body.items[1].status).toBe('PLAN_TO_WATCH');
      expect(response.body.items[2].status).toBe('COMPLETED');
    });

    it('should sort by title when sortBy=title', async () => {
      const user = await createTestUser();

      await createSourceBackedItem(user, { title: 'Zebra Show', type: 'TV' }, { status: 'WATCHING' });
      await createSourceBackedItem(user, { title: 'Alpha Show', type: 'TV' }, { status: 'WATCHING' });

      const response = await request(app)
        .get('/api/list?sortBy=title')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0].title).toBe('Alpha Show');
      expect(response.body.items[1].title).toBe('Zebra Show');
    });

    it('should sort by rating when sortBy=rating', async () => {
      const user = await createTestUser();

      await createSourceBackedItem(user, { title: 'Low Rated', type: 'TV' }, { status: 'COMPLETED', current: 10, rating: 3 });
      await createSourceBackedItem(user, { title: 'High Rated', type: 'TV' }, { status: 'COMPLETED', current: 10, rating: 9 });

      const response = await request(app)
        .get('/api/list?sortBy=rating')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      expect(response.body.items[0].title).toBe('High Rated');
      expect(response.body.items[1].title).toBe('Low Rated');
    });
  });

  describe('GET /api/list/:id', () => {
    it('should get a specific item', async () => {
      const user = await createTestUser();
      const { response: createResponse } = await createSourceBackedItem(
        user,
        { title: 'Test Show', type: 'TV', total: 10 },
        { status: 'WATCHING', current: 5 },
      );

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
      const { response: createResponse } = await createSourceBackedItem(
        user1,
        { title: 'User1 Show', type: 'TV' },
        { status: 'WATCHING', current: 0 },
      );

      const itemId = createResponse.body.id;

      await request(app)
        .get(`/api/list/${itemId}`)
        .set(authHeader(user2.accessToken))
        .expect(403);
    });
  });

  describe('PATCH /api/list/:id', () => {
    it('should update item status', async () => {
      const user = await createTestUser();
      const { response: createResponse } = await createSourceBackedItem(
        user,
        { title: 'Test Show', type: 'TV', total: 10 },
        { status: 'WATCHING', current: 5 },
      );

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
      const { response: createResponse } = await createSourceBackedItem(
        user,
        { title: 'Test Show', type: 'TV', total: 10 },
        { status: 'WATCHING', current: 0 },
      );

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
      const { response: createResponse } = await createSourceBackedItem(
        user,
        { title: 'Test Show', type: 'TV' },
        { status: 'WATCHING', current: 0 },
      );

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
      const { response: createResponse } = await createSourceBackedItem(
        user1,
        { title: 'User1 Show', type: 'TV' },
        { status: 'WATCHING', current: 0 },
      );

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
      const { response: createResponse } = await createSourceBackedItem(
        user,
        { title: 'Test Show', type: 'TV' },
        { status: 'WATCHING', current: 0 },
      );

      const itemId = createResponse.body.id;

      await request(app)
        .delete(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .expect(204);

      await request(app)
        .get(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .expect(404);
    });

    it('should not allow deleting other user items', async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const { response: createResponse } = await createSourceBackedItem(
        user1,
        { title: 'User1 Show', type: 'TV' },
        { status: 'WATCHING', current: 0 },
      );

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
      const { response } = await createSourceBackedItem(
        user,
        { title: 'Paused Show', type: 'TV', total: 10 },
        { status: 'PAUSED', current: 5 },
      );

      expect(response.body.status).toBe('PAUSED');
    });

    it('should support DROPPED status', async () => {
      const user = await createTestUser();
      const { response } = await createSourceBackedItem(
        user,
        { title: 'Dropped Show', type: 'TV', total: 10 },
        { status: 'DROPPED', current: 3 },
      );

      expect(response.body.status).toBe('DROPPED');
    });
  });

  describe('Rating functionality', () => {
    it('should create item with rating', async () => {
      const user = await createTestUser();
      const { response } = await createSourceBackedItem(
        user,
        { title: 'Rated Show', type: 'TV', total: 12 },
        { status: 'COMPLETED', current: 12, rating: 8 },
      );

      expect(response.body.rating).toBe(8);
    });

    it('should update item rating', async () => {
      const user = await createTestUser();
      const { response: createResponse } = await createSourceBackedItem(
        user,
        { title: 'Test Show', type: 'TV' },
        { status: 'WATCHING', current: 0 },
      );

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
      const { response } = await createSourceBackedItem(
        user,
        { title: 'Bad Show', type: 'TV' },
        { status: 'DROPPED', current: 1, rating: 0 },
      );

      expect(response.body.rating).toBe(0);
    });

    it('should allow rating of 10', async () => {
      const user = await createTestUser();
      const { response } = await createSourceBackedItem(
        user,
        { title: 'Perfect Show', type: 'TV', total: 24 },
        { status: 'COMPLETED', current: 24, rating: 10 },
      );

      expect(response.body.rating).toBe(10);
    });

    it('should reject rating below 0', async () => {
      const user = await createTestUser();

      await createListItem(user, {
        refId: nextRefId(),
        type: 'TV',
        status: 'WATCHING',
        current: 0,
        rating: -1,
      }).expect(400);
    });

    it('should reject rating above 10', async () => {
      const user = await createTestUser();

      await createListItem(user, {
        refId: nextRefId(),
        type: 'TV',
        status: 'WATCHING',
        current: 0,
        rating: 11,
      }).expect(400);
    });

    it('should allow null rating (clearing rating)', async () => {
      const user = await createTestUser();
      const { response: createResponse } = await createSourceBackedItem(
        user,
        { title: 'Rated Show', type: 'TV', total: 12 },
        { status: 'COMPLETED', current: 12, rating: 8 },
      );

      const itemId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/list/${itemId}`)
        .set(authHeader(user.accessToken))
        .send({ rating: null })
        .expect(200);

      expect(response.body.rating).toBeNull();
    });
  });

  describe('refId and source metadata functionality', () => {
    it('should create item with refId-backed source metadata', async () => {
      const user = await createTestUser();
      const { mediaSource, response } = await createSourceBackedItem(
        user,
        {
          title: 'Breaking Bad',
          type: 'TV',
          total: 62,
          imageUrl: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
          refId: 'tmdb:1396',
        },
        { status: 'WATCHING', current: 5 },
      );

      expect(response.body.refId).toBe(mediaSource.refId);
      expect(response.body.imageUrl).toBe(mediaSource.imageUrl);
      expect(response.body.title).toBe(mediaSource.title);
      expect(response.body.total).toBe(mediaSource.total);
    });

    it('should create manga with mangadex refId', async () => {
      const user = await createTestUser();
      const { mediaSource, response } = await createSourceBackedItem(
        user,
        {
          title: 'One Piece',
          type: 'MANGA',
          refId: 'mangadex:a1c7c817-4e59-43b7-9365-09675a149a6f',
        },
        { status: 'READING', current: 1100 },
      );

      expect(response.body.refId).toBe(mediaSource.refId);
    });

    it('should reject invalid refId format', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          refId: 'invalid-format',
          type: 'TV',
          status: 'WATCHING',
          current: 0,
        })
        .expect(400);
    });

    it('should reject item without refId', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({
          type: 'TV',
          status: 'WATCHING',
          current: 0,
        })
        .expect(400);
    });
  });
});
