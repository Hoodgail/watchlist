import { describe, expect, it } from 'vitest';
import { prisma } from '../config/database.js';
import { app, authHeader, createTestUser, request } from './helpers.js';
import { describeDb } from './testSuites.js';

describeDb('release regression checks', () => {
  it('keeps aliases from creating duplicate entries in a user list', async () => {
    const user = await createTestUser();
    const source = await prisma.mediaSource.create({
      data: { refId: 'anilist:42', title: 'Fixture', type: 'ANIME' },
    });
    await prisma.mediaSourceAlias.create({
      data: { mediaSourceId: source.id, refId: 'hianime:fixture', provider: 'hianime' },
    });
    const body = { type: 'ANIME', status: 'PLAN_TO_WATCH' };
    await request(app)
      .post('/api/list')
      .set(authHeader(user.accessToken))
      .send({ ...body, refId: source.refId })
      .expect(201);
    await request(app)
      .post('/api/list')
      .set(authHeader(user.accessToken))
      .send({ ...body, refId: 'hianime:fixture' })
      .expect(409);
  });
  it('keeps identical TMDB movie and TV numeric IDs separate', async () => {
    const user = await createTestUser();
    await prisma.mediaSource.createMany({
      data: [
        { refId: 'tmdb:movie/42', title: 'Movie', type: 'MOVIE' },
        { refId: 'tmdb:tv/42', title: 'Series', type: 'TV' },
      ],
    });
    for (const type of ['MOVIE', 'TV'])
      await request(app)
        .post('/api/list')
        .set(authHeader(user.accessToken))
        .send({ refId: 'tmdb:42', type, status: 'PLAN_TO_WATCH' })
        .expect(201);
    expect(await prisma.mediaItem.count({ where: { userId: user.id } })).toBe(2);
  });
  it('does not update a different title through provider-only progress fallback', async () => {
    const user = await createTestUser();
    const source = await prisma.mediaSource.create({
      data: { refId: 'hianime:unrelated', title: 'Unrelated', type: 'ANIME' },
    });
    await request(app)
      .post('/api/list')
      .set(authHeader(user.accessToken))
      .send({ refId: source.refId, type: 'ANIME', status: 'PLAN_TO_WATCH' })
      .expect(201);
    await request(app)
      .put('/api/watch-progress')
      .set(authHeader(user.accessToken))
      .send({
        mediaId: 'hianime:different',
        episodeId: 'ep1',
        currentTime: 100,
        duration: 100,
        provider: 'hianime',
        currentEpisode: 12,
      })
      .expect(200);
    expect((await prisma.mediaItem.findFirst({ where: { userId: user.id } }))?.current).toBe(0);
  });
  it('prevents anonymous shared mapping mutation', async () => {
    await request(app)
      .post('/api/provider-mappings')
      .send({ refId: 'anilist:42', provider: 'hianime', providerId: 'foo', providerTitle: 'Foo' })
      .expect(401);
    await request(app).delete('/api/provider-mappings/anilist%3A42/hianime').expect(401);
  });
  it('lets users choose separate mappings without altering one another', async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const body = {
      refId: 'anilist:42',
      provider: 'hianime',
      providerId: 'foo',
      providerTitle: 'Foo',
    };
    await request(app)
      .post('/api/provider-mappings')
      .set(authHeader(owner.accessToken))
      .send(body)
      .expect(201);
    await request(app)
      .get('/api/provider-mappings/anilist%3A42/hianime')
      .set(authHeader(other.accessToken))
      .expect(404);
    await request(app)
      .delete('/api/provider-mappings/anilist%3A42/hianime')
      .set(authHeader(other.accessToken))
      .expect(404);
    await request(app)
      .post('/api/provider-mappings')
      .set(authHeader(other.accessToken))
      .send({ ...body, providerId: 'other' })
      .expect(201);
    const saved = await request(app)
      .get('/api/provider-mappings/anilist%3A42/hianime')
      .set(authHeader(owner.accessToken))
      .expect(200);
    expect(saved.body.providerId).toBe('foo');
  });
  it('syncs progress through only the current user’s exact playback mapping', async () => {
    const user = await createTestUser();
    const source = await prisma.mediaSource.create({
      data: { refId: 'anilist:84', title: 'Mapped fixture', type: 'ANIME' },
    });
    await request(app)
      .post('/api/list')
      .set(authHeader(user.accessToken))
      .send({ refId: source.refId, type: 'ANIME', status: 'PLAN_TO_WATCH' })
      .expect(201);
    await request(app)
      .post('/api/provider-mappings')
      .set(authHeader(user.accessToken))
      .send({
        refId: source.refId,
        provider: 'hianime',
        providerId: 'exact-show',
        providerTitle: 'Fixture',
      })
      .expect(201);
    await request(app)
      .put('/api/watch-progress')
      .set(authHeader(user.accessToken))
      .send({
        mediaId: 'hianime:exact-show',
        episodeId: 'hianime:exact-show/ep12',
        currentTime: 100,
        duration: 100,
        provider: 'hianime',
        currentEpisode: 12,
      })
      .expect(200);
    expect((await prisma.mediaItem.findFirst({ where: { userId: user.id } }))?.current).toBe(12);
  });
  it('does not let set-password replace an existing password', async () => {
    const user = await createTestUser();
    await request(app)
      .post('/api/auth/password')
      .set(authHeader(user.accessToken))
      .send({ password: 'replacement123' })
      .expect(409);
  });
  it('does not pretend recovery email was sent without SMTP configuration', async () => {
    await request(app)
      .post('/api/auth/recovery/initiate')
      .send({ email: 'person@example.com' })
      .expect(503);
  });
  it('paginates comments by posting order and filters followed authors on the server', async () => {
    const viewer = await createTestUser();
    const followed = await createTestUser();
    await prisma.user.updateMany({
      where: { id: { in: [viewer.id, followed.id] } },
      data: { isPublic: true },
    });
    await prisma.friendship.create({ data: { followerId: viewer.id, followingId: followed.id } });
    await prisma.mediaSource.create({
      data: { refId: 'anilist:99', title: 'Comments', type: 'ANIME' },
    });
    // The newest UUID sorts before the older one: UUID comparisons cannot paginate time.
    const newest = '00000000-0000-4000-8000-000000000001';
    const older = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    await prisma.comment.createMany({
      data: [
        {
          id: newest,
          userId: viewer.id,
          refId: 'anilist:99',
          mediaType: 'ANIME',
          content: 'Newest',
          isPublic: true,
          createdAt: new Date('2026-09-19T12:00:00Z'),
        },
        {
          id: older,
          userId: followed.id,
          refId: 'anilist:99',
          mediaType: 'ANIME',
          content: 'Older',
          isPublic: true,
          createdAt: new Date('2026-09-18T12:00:00Z'),
        },
      ],
    });
    for (const route of [
      '/api/comments/media/anilist%3A99?mediaType=ANIME&',
      '/api/comments/feed/public?',
    ]) {
      const first = await request(app)
        .get(route + 'limit=1')
        .set(authHeader(viewer.accessToken))
        .expect(200);
      expect(first.body.comments.map((c: { id: string }) => c.id)).toEqual([newest]);
      const second = await request(app)
        .get(route + 'limit=1&cursor=' + first.body.nextCursor)
        .set(authHeader(viewer.accessToken))
        .expect(200);
      expect(second.body.comments.map((c: { id: string }) => c.id)).toEqual([older]);
      expect(second.body.nextCursor).toBeNull();
    }
    const friends = await request(app)
      .get('/api/comments/media/anilist%3A99?mediaType=ANIME&friendsOnly=true')
      .set(authHeader(viewer.accessToken))
      .expect(200);
    expect(friends.body.comments.map((c: { id: string }) => c.id)).toEqual([older]);
  });
  it('rejects ordinary users importing arbitrary external identities or launching a fake refresh', async () => {
    const user = await createTestUser();
    await request(app)
      .post('/api/comments/import-external')
      .set(authHeader(user.accessToken))
      .send({})
      .expect(403);
    await request(app)
      .post('/api/external-comments/refresh')
      .set(authHeader(user.accessToken))
      .expect(410);
  });
});
