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
      imageUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      total: 62,
    },
  });
}

describeDb('Comments Endpoints', () => {
  describe('POST /api/comments and GET /api/comments/media/:refId', () => {
    it('creates a comment and returns it in media comments', async () => {
      const user = await createTestUser();
      const source = await seedSource('tmdb:1396', 'Breaking Bad');

      const createResponse = await request(app)
        .post('/api/comments')
        .set(authHeader(user.accessToken))
        .send({ content: 'Great pilot episode', refId: source.refId, mediaType: 'TV', isPublic: true })
        .expect(201);

      expect(createResponse.body.content).toBe('Great pilot episode');

      const feedResponse = await request(app)
        .get(`/api/comments/media/${encodeURIComponent(source.refId)}?mediaType=TV`)
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(feedResponse.body.comments).toHaveLength(1);
      expect(feedResponse.body.comments[0].id).toBe(createResponse.body.id);
      expect(feedResponse.body.nextCursor).toBeNull();
    });

    it('hides private comments from unrelated viewers', async () => {
      const author = await createTestUser();
      const viewer = await createTestUser();
      const source = await seedSource('tmdb:1396', 'Breaking Bad');

      await request(app)
        .post('/api/comments')
        .set(authHeader(author.accessToken))
        .send({ content: 'Private note', refId: source.refId, mediaType: 'TV', isPublic: false })
        .expect(201);

      const response = await request(app)
        .get(`/api/comments/media/${encodeURIComponent(source.refId)}?mediaType=TV`)
        .set(authHeader(viewer.accessToken))
        .expect(200);

      expect(response.body.comments).toEqual([]);
    });

    it('shows followed user comments in media comments and friend feed', async () => {
      const author = await createTestUser();
      const viewer = await createTestUser();
      const source = await seedSource('tmdb:1396', 'Breaking Bad');

      await request(app)
        .post(`/api/friends/${author.id}`)
        .set(authHeader(viewer.accessToken))
        .expect(201);

      await request(app)
        .post('/api/comments')
        .set(authHeader(author.accessToken))
        .send({ content: 'Friend review', refId: source.refId, mediaType: 'TV', isPublic: false })
        .expect(201);

      const mediaResponse = await request(app)
        .get(`/api/comments/media/${encodeURIComponent(source.refId)}?mediaType=TV`)
        .set(authHeader(viewer.accessToken))
        .expect(200);

      expect(mediaResponse.body.comments).toHaveLength(1);
      expect(mediaResponse.body.comments[0].content).toBe('Friend review');

      const friendFeedResponse = await request(app)
        .get('/api/comments/feed/friends')
        .set(authHeader(viewer.accessToken))
        .expect(200);

      expect(friendFeedResponse.body.comments).toHaveLength(1);
      expect(friendFeedResponse.body.comments[0].mediaTitle).toBe('Breaking Bad');
    });
  });

  describe('reactions and public feed', () => {
    it('returns reaction counts for a comment', async () => {
      const author = await createTestUser();
      const reactor = await createTestUser();
      const source = await seedSource('tmdb:1396', 'Breaking Bad');

      const createResponse = await request(app)
        .post('/api/comments')
        .set(authHeader(author.accessToken))
        .send({ content: 'Loved this one', refId: source.refId, mediaType: 'TV', isPublic: true })
        .expect(201);

      await request(app)
        .post(`/api/comments/${createResponse.body.id}/reactions`)
        .set(authHeader(reactor.accessToken))
        .send({ reactionType: 'LIKE' })
        .expect(201);

      const commentResponse = await request(app)
        .get(`/api/comments/${createResponse.body.id}`)
        .set(authHeader(author.accessToken))
        .expect(200);

      expect(commentResponse.body.reactionCounts.LIKE).toBe(1);
    });

    it('returns public feed entries with media metadata', async () => {
      const author = await createTestUser();
      const source = await seedSource('tmdb:1396', 'Breaking Bad');

      await request(app)
        .patch('/api/profile/settings/privacy')
        .set(authHeader(author.accessToken))
        .send({ isPublic: true })
        .expect(200);

      await request(app)
        .post('/api/comments')
        .set(authHeader(author.accessToken))
        .send({ content: 'Hot take', refId: source.refId, mediaType: 'TV', isPublic: true })
        .expect(201);

      const response = await request(app)
        .get('/api/comments/feed/public')
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].media.title).toBe('Breaking Bad');
    });
  });

  describe('external comments endpoints', () => {
    it('lists configured providers', async () => {
      const response = await request(app)
        .get('/api/external-comments/providers')
        .expect(200);

      expect(Array.isArray(response.body.providers)).toBe(true);
      expect(response.body.providers.length).toBeGreaterThan(0);
      expect(response.body.providers.some((provider: { name: string }) => provider.name === 'reddit')).toBe(true);
    });

    it('imports an external comment through the comments route', async () => {
      const user = await createTestUser();
      const source = await seedSource('tmdb:1396', 'Breaking Bad');

      const response = await request(app)
        .post('/api/comments/import-external')
        .set(authHeader(user.accessToken))
        .send({
          content: 'External discussion',
          refId: source.refId,
          mediaType: 'TV',
          externalSource: 'reddit',
          externalId: 'abc123',
          externalAuthor: 'reddit-user',
          externalUrl: 'https://example.com/comment/abc123',
        })
        .expect(201);

      expect(response.body.externalSource).toBe('reddit');
      expect(response.body.externalAuthor).toBe('reddit-user');
    });
  });
});
