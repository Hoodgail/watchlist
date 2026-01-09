import { describe, it, expect, beforeAll } from 'vitest';
import { request, app, createTestUser, authHeader } from './helpers.js';
import { availableTables } from './setup.js';

describe('Watch Progress Endpoints', () => {
  beforeAll(() => {
    if (!availableTables.watchProgress) {
      console.warn('Skipping watch progress tests - table does not exist');
    }
  });

  describe('PUT /api/watch-progress', () => {
    it('should create watch progress for an episode', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const progressData = {
        mediaId: 'hianime:one-piece-100',
        episodeId: 'one-piece-100$episode$1',
        currentTime: 300,
        duration: 1440,
        provider: 'hianime',
      };

      const response = await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send(progressData)
        .expect(200);

      expect(response.body.id).toBeDefined();
      expect(response.body.mediaId).toBe(progressData.mediaId);
      expect(response.body.episodeId).toBe(progressData.episodeId);
      expect(response.body.currentTime).toBe(progressData.currentTime);
      expect(response.body.duration).toBe(progressData.duration);
      expect(response.body.provider).toBe(progressData.provider);
      expect(response.body.completed).toBe(false);
    });

    it('should update existing watch progress (upsert)', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const progressData = {
        mediaId: 'hianime:naruto-100',
        episodeId: 'naruto-100$episode$1',
        currentTime: 100,
        duration: 1440,
        provider: 'hianime',
      };

      // Create initial progress
      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send(progressData)
        .expect(200);

      // Update progress
      const updatedData = {
        ...progressData,
        currentTime: 800,
      };

      const response = await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send(updatedData)
        .expect(200);

      expect(response.body.currentTime).toBe(800);
      expect(response.body.completed).toBe(false);
    });

    it('should mark as completed when near end (95%+)', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const progressData = {
        mediaId: 'flixhq:movie-123',
        episodeId: 'movie-123$episode$1',
        currentTime: 1400,
        duration: 1440,
        provider: 'flixhq',
      };

      const response = await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send(progressData)
        .expect(200);

      expect(response.body.completed).toBe(true);
    });

    it('should reject unauthenticated request', async () => {
      if (!availableTables.watchProgress) return;

      await request(app)
        .put('/api/watch-progress')
        .send({
          mediaId: 'test:123',
          episodeId: 'ep1',
          currentTime: 100,
          duration: 1000,
          provider: 'test',
        })
        .expect(401);
    });

    it('should reject missing mediaId', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          currentTime: 100,
          duration: 1000,
          provider: 'hianime',
        })
        .expect(400);
    });

    it('should reject missing provider', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId: 'test:123',
          currentTime: 100,
          duration: 1000,
        })
        .expect(400);
    });

    it('should reject negative currentTime', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId: 'test:123',
          episodeId: 'ep1',
          currentTime: -10,
          duration: 1000,
          provider: 'hianime',
        })
        .expect(400);
    });

    it('should handle progress without episodeId (for movies)', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const progressData = {
        mediaId: 'flixhq:inception-2010',
        currentTime: 3600,
        duration: 8880,
        provider: 'flixhq',
      };

      const response = await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send(progressData)
        .expect(200);

      expect(response.body.mediaId).toBe(progressData.mediaId);
      expect(response.body.currentTime).toBe(progressData.currentTime);
    });
  });

  describe('GET /api/watch-progress', () => {
    it('should return empty array for new user', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const response = await request(app)
        .get('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return all watch progress for user', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      // Create progress for multiple media
      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId: 'hianime:anime-1',
          episodeId: 'ep1',
          currentTime: 100,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId: 'flixhq:movie-1',
          currentTime: 200,
          duration: 7200,
          provider: 'flixhq',
        })
        .expect(200);

      const response = await request(app)
        .get('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should reject unauthenticated request', async () => {
      if (!availableTables.watchProgress) return;

      await request(app)
        .get('/api/watch-progress')
        .expect(401);
    });

    it('should not return other users progress', async () => {
      if (!availableTables.watchProgress) return;

      const user1 = await createTestUser();
      const user2 = await createTestUser();

      // User1 creates progress
      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user1.accessToken))
        .send({
          mediaId: 'hianime:private-anime',
          episodeId: 'ep1',
          currentTime: 100,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      // User2 should not see User1's progress
      const response = await request(app)
        .get('/api/watch-progress')
        .set(authHeader(user2.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/watch-progress/:mediaId', () => {
    it('should return all progress for a specific media', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();
      const mediaId = 'hianime:one-piece-100';

      // Create progress for multiple episodes
      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId,
          episodeId: 'ep1',
          currentTime: 1400,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId,
          episodeId: 'ep2',
          currentTime: 500,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      // Create progress for different media
      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId: 'hianime:naruto-100',
          episodeId: 'ep1',
          currentTime: 300,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      const response = await request(app)
        .get(`/api/watch-progress/${encodeURIComponent(mediaId)}`)
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((p: { mediaId: string }) => p.mediaId === mediaId)).toBe(true);
    });

    it('should return empty array for media with no progress', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const response = await request(app)
        .get('/api/watch-progress/nonexistent:media')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/watch-progress/:mediaId/:episodeId', () => {
    it('should return progress for a specific episode', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();
      const mediaId = 'hianime:demon-slayer';
      const episodeId = 'ds-ep-5';

      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId,
          episodeId,
          currentTime: 720,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      const response = await request(app)
        .get(`/api/watch-progress/${encodeURIComponent(mediaId)}/${encodeURIComponent(episodeId)}`)
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.mediaId).toBe(mediaId);
      expect(response.body.episodeId).toBe(episodeId);
      expect(response.body.currentTime).toBe(720);
    });

    it('should return 404 for non-existent episode progress', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      await request(app)
        .get('/api/watch-progress/test:media/nonexistent-episode')
        .set(authHeader(user.accessToken))
        .expect(404);
    });
  });

  describe('DELETE /api/watch-progress/:mediaId', () => {
    it('should delete all progress for a media', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();
      const mediaId = 'hianime:bleach-tybw';

      // Create progress for multiple episodes
      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId,
          episodeId: 'ep1',
          currentTime: 100,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId,
          episodeId: 'ep2',
          currentTime: 200,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      // Delete all progress for media
      const deleteResponse = await request(app)
        .delete(`/api/watch-progress/${encodeURIComponent(mediaId)}`)
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(deleteResponse.body.count).toBe(2);

      // Verify deleted
      const getResponse = await request(app)
        .get(`/api/watch-progress/${encodeURIComponent(mediaId)}`)
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(getResponse.body).toEqual([]);
    });

    it('should not delete other users progress', async () => {
      if (!availableTables.watchProgress) return;

      const user1 = await createTestUser();
      const user2 = await createTestUser();
      const mediaId = 'hianime:shared-anime';

      // User1 creates progress
      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user1.accessToken))
        .send({
          mediaId,
          episodeId: 'ep1',
          currentTime: 100,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      // User2 tries to delete User1's progress
      const deleteResponse = await request(app)
        .delete(`/api/watch-progress/${encodeURIComponent(mediaId)}`)
        .set(authHeader(user2.accessToken))
        .expect(200);

      expect(deleteResponse.body.count).toBe(0);

      // User1's progress should still exist
      const getResponse = await request(app)
        .get(`/api/watch-progress/${encodeURIComponent(mediaId)}`)
        .set(authHeader(user1.accessToken))
        .expect(200);

      expect(getResponse.body).toHaveLength(1);
    });
  });

  describe('DELETE /api/watch-progress/:mediaId/:episodeId', () => {
    it('should delete progress for a specific episode', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();
      const mediaId = 'hianime:jjk';
      const episodeId = 'jjk-ep-10';

      // Create progress for multiple episodes
      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId,
          episodeId,
          currentTime: 100,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId,
          episodeId: 'jjk-ep-11',
          currentTime: 200,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      // Delete specific episode progress
      await request(app)
        .delete(`/api/watch-progress/${encodeURIComponent(mediaId)}/${encodeURIComponent(episodeId)}`)
        .set(authHeader(user.accessToken))
        .expect(204);

      // Verify specific episode is deleted
      await request(app)
        .get(`/api/watch-progress/${encodeURIComponent(mediaId)}/${encodeURIComponent(episodeId)}`)
        .set(authHeader(user.accessToken))
        .expect(404);

      // Other episode should still exist
      const getResponse = await request(app)
        .get(`/api/watch-progress/${encodeURIComponent(mediaId)}`)
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(getResponse.body).toHaveLength(1);
      expect(getResponse.body[0].episodeId).toBe('jjk-ep-11');
    });

    it('should reject unauthenticated delete', async () => {
      if (!availableTables.watchProgress) return;

      await request(app)
        .delete('/api/watch-progress/test:media/ep1')
        .expect(401);
    });
  });

  describe('Watch progress with different providers', () => {
    it('should track progress for anime providers', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const providers = ['hianime', 'animepahe', 'gogoanime'];

      for (const provider of providers) {
        const response = await request(app)
          .put('/api/watch-progress')
          .set(authHeader(user.accessToken))
          .send({
            mediaId: `${provider}:test-anime`,
            episodeId: 'ep1',
            currentTime: 500,
            duration: 1440,
            provider,
          })
          .expect(200);

        expect(response.body.provider).toBe(provider);
      }

      const allProgress = await request(app)
        .get('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(allProgress.body).toHaveLength(3);
    });

    it('should track progress for movie providers', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const providers = ['flixhq', 'goku'];

      for (const provider of providers) {
        const response = await request(app)
          .put('/api/watch-progress')
          .set(authHeader(user.accessToken))
          .send({
            mediaId: `${provider}:test-movie`,
            currentTime: 3600,
            duration: 7200,
            provider,
          })
          .expect(200);

        expect(response.body.provider).toBe(provider);
      }

      const allProgress = await request(app)
        .get('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(allProgress.body).toHaveLength(2);
    });
  });

  describe('Progress percentage calculation', () => {
    it('should mark as not completed at 50%', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const response = await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId: 'hianime:test',
          episodeId: 'ep1',
          currentTime: 720,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      expect(response.body.completed).toBe(false);
    });

    it('should mark as not completed at 94%', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const response = await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId: 'hianime:test',
          episodeId: 'ep1',
          currentTime: 1353,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      expect(response.body.completed).toBe(false);
    });

    it('should mark as completed at 95%', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const response = await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId: 'hianime:test',
          episodeId: 'ep1',
          currentTime: 1368,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      expect(response.body.completed).toBe(true);
    });

    it('should mark as completed at 100%', async () => {
      if (!availableTables.watchProgress) return;

      const user = await createTestUser();

      const response = await request(app)
        .put('/api/watch-progress')
        .set(authHeader(user.accessToken))
        .send({
          mediaId: 'hianime:test',
          episodeId: 'ep1',
          currentTime: 1440,
          duration: 1440,
          provider: 'hianime',
        })
        .expect(200);

      expect(response.body.completed).toBe(true);
    });
  });
});
