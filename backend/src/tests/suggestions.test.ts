import { describe, it, expect, beforeAll } from 'vitest';
import { request, app, createTestUser, authHeader, createFollow } from './helpers.js';
import { availableTables } from './setup.js';

/**
 * Suggestions API Tests
 * 
 * These tests require the 'suggestions' table to exist in the database.
 * If the table doesn't exist, all tests will be skipped.
 * 
 * To enable these tests, run database migrations:
 * npx prisma db push
 */
describe('Suggestions Endpoints', () => {
  beforeAll(() => {
    if (!availableTables.suggestions) {
      console.log('\n⚠️  Skipping suggestions tests: suggestions table does not exist in database');
      console.log('   Run "npx prisma db push" to sync the database schema\n');
    }
  });

  describe('POST /api/suggestions/:userId', () => {
    it('should create suggestion when following target user', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      // Sender follows recipient
      await createFollow(sender.accessToken, recipient.id);

      const suggestionData = {
        title: 'Breaking Bad',
        type: 'TV',
        refId: 'tmdb:1396',
        imageUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        message: 'You should watch this!',
      };

      const response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send(suggestionData)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.title).toBe(suggestionData.title);
      expect(response.body.type).toBe(suggestionData.type);
      expect(response.body.refId).toBe(suggestionData.refId);
      expect(response.body.imageUrl).toBe(suggestionData.imageUrl);
      expect(response.body.message).toBe(suggestionData.message);
      expect(response.body.status).toBe('PENDING');
      expect(response.body.fromUser.id).toBe(sender.id);
      expect(response.body.toUser.id).toBe(recipient.id);
    });

    it('should create suggestion without optional fields', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'One Piece',
          type: 'MANGA',
          refId: 'mangadex:a1c7c817-4e59-43b7-9365-09675a149a6f',
        })
        .expect(201);

      expect(response.body.message).toBeNull();
      expect(response.body.imageUrl).toBeNull();
    });

    it('should fail if not following target user (403)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      // Not following recipient

      const response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(403);

      expect(response.body.error).toBe('You must follow this user to send them suggestions');
    });

    it('should fail if suggesting to self (400)', async () => {
      if (!availableTables.suggestions) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .post(`/api/suggestions/${user.id}`)
        .set(authHeader(user.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(400);

      expect(response.body.error).toBe('Cannot suggest media to yourself');
    });

    it('should fail if duplicate pending suggestion exists (409)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const suggestionData = {
        title: 'Breaking Bad',
        type: 'TV',
        refId: 'tmdb:1396',
      };

      // First suggestion succeeds
      await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send(suggestionData)
        .expect(201);

      // Second suggestion with same refId fails
      const response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send(suggestionData)
        .expect(409);

      expect(response.body.error).toBe('You already have a pending suggestion for this media to this user');
    });

    it('should require authentication (401)', async () => {
      if (!availableTables.suggestions) return;
      
      const recipient = await createTestUser();

      await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(401);
    });

    it('should validate required fields (400)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      // Missing title
      let response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();

      // Missing type
      response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          refId: 'tmdb:12345',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();

      // Missing refId
      response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should validate refId format', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'invalid-format',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should fail for non-existent user (404)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();

      await request(app)
        .post('/api/suggestions/00000000-0000-0000-0000-000000000000')
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(404);
    });
  });

  describe('GET /api/suggestions/received', () => {
    it('should return pending suggestions by default', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      // Create a suggestion
      await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Breaking Bad',
          type: 'TV',
          refId: 'tmdb:1396',
        })
        .expect(201);

      const response = await request(app)
        .get('/api/suggestions/received')
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Breaking Bad');
      expect(response.body[0].status).toBe('PENDING');
      expect(response.body[0].fromUser.id).toBe(sender.id);
    });

    it('should filter by status query param', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      // Create first suggestion
      const suggestion1 = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Show 1',
          type: 'TV',
          refId: 'tmdb:111',
        })
        .expect(201);

      // Accept first suggestion
      await request(app)
        .patch(`/api/suggestions/${suggestion1.body.id}/accept`)
        .set(authHeader(recipient.accessToken))
        .expect(200);

      // Create second suggestion (still pending)
      await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Show 2',
          type: 'TV',
          refId: 'tmdb:222',
        })
        .expect(201);

      // Get only accepted suggestions
      const acceptedResponse = await request(app)
        .get('/api/suggestions/received?status=ACCEPTED')
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(acceptedResponse.body).toHaveLength(1);
      expect(acceptedResponse.body[0].title).toBe('Show 1');
      expect(acceptedResponse.body[0].status).toBe('ACCEPTED');

      // Get only pending suggestions
      const pendingResponse = await request(app)
        .get('/api/suggestions/received?status=PENDING')
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(pendingResponse.body).toHaveLength(1);
      expect(pendingResponse.body[0].title).toBe('Show 2');
    });

    it('should include fromUser details', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const response = await request(app)
        .get('/api/suggestions/received')
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(response.body[0].fromUser).toBeDefined();
      expect(response.body[0].fromUser.id).toBe(sender.id);
      expect(response.body[0].fromUser.username).toBe(sender.username);
    });

    it('should return empty array when no suggestions', async () => {
      if (!availableTables.suggestions) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/suggestions/received')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should require authentication', async () => {
      if (!availableTables.suggestions) return;
      
      await request(app)
        .get('/api/suggestions/received')
        .expect(401);
    });
  });

  describe('GET /api/suggestions/sent', () => {
    it('should return all sent suggestions', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient1 = await createTestUser();
      const recipient2 = await createTestUser();

      await createFollow(sender.accessToken, recipient1.id);
      await createFollow(sender.accessToken, recipient2.id);

      // Create suggestions to different users
      await request(app)
        .post(`/api/suggestions/${recipient1.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Show 1',
          type: 'TV',
          refId: 'tmdb:111',
        })
        .expect(201);

      await request(app)
        .post(`/api/suggestions/${recipient2.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Show 2',
          type: 'TV',
          refId: 'tmdb:222',
        })
        .expect(201);

      const response = await request(app)
        .get('/api/suggestions/sent')
        .set(authHeader(sender.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should include toUser details', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const response = await request(app)
        .get('/api/suggestions/sent')
        .set(authHeader(sender.accessToken))
        .expect(200);

      expect(response.body[0].toUser).toBeDefined();
      expect(response.body[0].toUser.id).toBe(recipient.id);
      expect(response.body[0].toUser.username).toBe(recipient.username);
    });

    it('should return empty array when no suggestions sent', async () => {
      if (!availableTables.suggestions) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/suggestions/sent')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should require authentication', async () => {
      if (!availableTables.suggestions) return;
      
      await request(app)
        .get('/api/suggestions/sent')
        .expect(401);
    });
  });

  describe('PATCH /api/suggestions/:id/accept', () => {
    it('should accept suggestion and add media to list', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Breaking Bad',
          type: 'TV',
          refId: 'tmdb:1396',
          imageUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // Accept the suggestion
      const acceptResponse = await request(app)
        .patch(`/api/suggestions/${suggestionId}/accept`)
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(acceptResponse.body.status).toBe('ACCEPTED');

      // Verify media was added to recipient's list
      const listResponse = await request(app)
        .get('/api/list')
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(listResponse.body).toHaveLength(1);
      expect(listResponse.body[0].title).toBe('Breaking Bad');
      expect(listResponse.body[0].refId).toBe('tmdb:1396');
      expect(listResponse.body[0].status).toBe('PLAN_TO_WATCH');
    });

    it('should fail if not the recipient (403)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();
      const other = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // Other user tries to accept
      const response = await request(app)
        .patch(`/api/suggestions/${suggestionId}/accept`)
        .set(authHeader(other.accessToken))
        .expect(403);

      expect(response.body.error).toBe('Only the recipient can accept a suggestion');
    });

    it('should fail if sender tries to accept (403)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // Sender tries to accept their own suggestion
      const response = await request(app)
        .patch(`/api/suggestions/${suggestionId}/accept`)
        .set(authHeader(sender.accessToken))
        .expect(403);

      expect(response.body.error).toBe('Only the recipient can accept a suggestion');
    });

    it('should fail if suggestion not found (404)', async () => {
      if (!availableTables.suggestions) return;
      
      const user = await createTestUser();

      await request(app)
        .patch('/api/suggestions/00000000-0000-0000-0000-000000000000/accept')
        .set(authHeader(user.accessToken))
        .expect(404);
    });

    it('should fail if already accepted (400)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // First accept succeeds
      await request(app)
        .patch(`/api/suggestions/${suggestionId}/accept`)
        .set(authHeader(recipient.accessToken))
        .expect(200);

      // Second accept fails
      const response = await request(app)
        .patch(`/api/suggestions/${suggestionId}/accept`)
        .set(authHeader(recipient.accessToken))
        .expect(400);

      expect(response.body.error).toBe('This suggestion has already been processed');
    });

    it('should fail if already dismissed (400)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // Dismiss the suggestion
      await request(app)
        .patch(`/api/suggestions/${suggestionId}/dismiss`)
        .set(authHeader(recipient.accessToken))
        .expect(200);

      // Try to accept after dismiss
      const response = await request(app)
        .patch(`/api/suggestions/${suggestionId}/accept`)
        .set(authHeader(recipient.accessToken))
        .expect(400);

      expect(response.body.error).toBe('This suggestion has already been processed');
    });

    it('should require authentication', async () => {
      if (!availableTables.suggestions) return;
      
      await request(app)
        .patch('/api/suggestions/00000000-0000-0000-0000-000000000000/accept')
        .expect(401);
    });
  });

  describe('PATCH /api/suggestions/:id/dismiss', () => {
    it('should dismiss suggestion', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      const response = await request(app)
        .patch(`/api/suggestions/${suggestionId}/dismiss`)
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(response.body.status).toBe('DISMISSED');
    });

    it('should fail if not the recipient (403)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();
      const other = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // Other user tries to dismiss
      const response = await request(app)
        .patch(`/api/suggestions/${suggestionId}/dismiss`)
        .set(authHeader(other.accessToken))
        .expect(403);

      expect(response.body.error).toBe('Only the recipient can dismiss a suggestion');
    });

    it('should fail if sender tries to dismiss (403)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // Sender tries to dismiss their own suggestion
      const response = await request(app)
        .patch(`/api/suggestions/${suggestionId}/dismiss`)
        .set(authHeader(sender.accessToken))
        .expect(403);

      expect(response.body.error).toBe('Only the recipient can dismiss a suggestion');
    });

    it('should fail if suggestion not found (404)', async () => {
      if (!availableTables.suggestions) return;
      
      const user = await createTestUser();

      await request(app)
        .patch('/api/suggestions/00000000-0000-0000-0000-000000000000/dismiss')
        .set(authHeader(user.accessToken))
        .expect(404);
    });

    it('should fail if already processed (400)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // First dismiss succeeds
      await request(app)
        .patch(`/api/suggestions/${suggestionId}/dismiss`)
        .set(authHeader(recipient.accessToken))
        .expect(200);

      // Second dismiss fails
      const response = await request(app)
        .patch(`/api/suggestions/${suggestionId}/dismiss`)
        .set(authHeader(recipient.accessToken))
        .expect(400);

      expect(response.body.error).toBe('This suggestion has already been processed');
    });

    it('should require authentication', async () => {
      if (!availableTables.suggestions) return;
      
      await request(app)
        .patch('/api/suggestions/00000000-0000-0000-0000-000000000000/dismiss')
        .expect(401);
    });
  });

  describe('DELETE /api/suggestions/:id', () => {
    it('should delete suggestion if sender', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // Sender deletes the suggestion
      await request(app)
        .delete(`/api/suggestions/${suggestionId}`)
        .set(authHeader(sender.accessToken))
        .expect(204);

      // Verify suggestion is gone
      const receivedResponse = await request(app)
        .get('/api/suggestions/received')
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(receivedResponse.body).toHaveLength(0);
    });

    it('should fail if not the sender (403)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // Recipient tries to delete
      const response = await request(app)
        .delete(`/api/suggestions/${suggestionId}`)
        .set(authHeader(recipient.accessToken))
        .expect(403);

      expect(response.body.error).toBe('Only the sender can delete a suggestion');
    });

    it('should fail if other user tries to delete (403)', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();
      const other = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const createResponse = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      const suggestionId = createResponse.body.id;

      // Other user tries to delete
      const response = await request(app)
        .delete(`/api/suggestions/${suggestionId}`)
        .set(authHeader(other.accessToken))
        .expect(403);

      expect(response.body.error).toBe('Only the sender can delete a suggestion');
    });

    it('should fail if suggestion not found (404)', async () => {
      if (!availableTables.suggestions) return;
      
      const user = await createTestUser();

      await request(app)
        .delete('/api/suggestions/00000000-0000-0000-0000-000000000000')
        .set(authHeader(user.accessToken))
        .expect(404);
    });

    it('should require authentication', async () => {
      if (!availableTables.suggestions) return;
      
      await request(app)
        .delete('/api/suggestions/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });

  describe('Media types', () => {
    it('should support TV suggestions', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Breaking Bad',
          type: 'TV',
          refId: 'tmdb:1396',
        })
        .expect(201);

      expect(response.body.type).toBe('TV');
    });

    it('should support MOVIE suggestions', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Inception',
          type: 'MOVIE',
          refId: 'tmdb:27205',
        })
        .expect(201);

      expect(response.body.type).toBe('MOVIE');
    });

    it('should support ANIME suggestions', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Attack on Titan',
          type: 'ANIME',
          refId: 'tmdb:1429',
        })
        .expect(201);

      expect(response.body.type).toBe('ANIME');
    });

    it('should support MANGA suggestions', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      const response = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'One Piece',
          type: 'MANGA',
          refId: 'mangadex:a1c7c817-4e59-43b7-9365-09675a149a6f',
        })
        .expect(201);

      expect(response.body.type).toBe('MANGA');
    });
  });

  describe('Edge cases', () => {
    it('should allow new pending suggestion after previous one was accepted', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      // Create first suggestion
      const firstSuggestion = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      // Accept it
      await request(app)
        .patch(`/api/suggestions/${firstSuggestion.body.id}/accept`)
        .set(authHeader(recipient.accessToken))
        .expect(200);

      // Create new suggestion for same media should succeed
      const secondSuggestion = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      expect(secondSuggestion.body.id).not.toBe(firstSuggestion.body.id);
    });

    it('should allow new pending suggestion after previous one was dismissed', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      // Create first suggestion
      const firstSuggestion = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      // Dismiss it
      await request(app)
        .patch(`/api/suggestions/${firstSuggestion.body.id}/dismiss`)
        .set(authHeader(recipient.accessToken))
        .expect(200);

      // Create new suggestion for same media should succeed
      const secondSuggestion = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Test Show',
          type: 'TV',
          refId: 'tmdb:12345',
        })
        .expect(201);

      expect(secondSuggestion.body.id).not.toBe(firstSuggestion.body.id);
    });

    it('should handle multiple users sending same media suggestion', async () => {
      if (!availableTables.suggestions) return;
      
      const sender1 = await createTestUser();
      const sender2 = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender1.accessToken, recipient.id);
      await createFollow(sender2.accessToken, recipient.id);

      // Both senders suggest the same media
      const suggestion1 = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender1.accessToken))
        .send({
          title: 'Breaking Bad',
          type: 'TV',
          refId: 'tmdb:1396',
        })
        .expect(201);

      const suggestion2 = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender2.accessToken))
        .send({
          title: 'Breaking Bad',
          type: 'TV',
          refId: 'tmdb:1396',
        })
        .expect(201);

      // Both should exist
      const receivedResponse = await request(app)
        .get('/api/suggestions/received')
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(receivedResponse.body).toHaveLength(2);
      expect(suggestion1.body.id).not.toBe(suggestion2.body.id);
    });

    it('should not add duplicate media to list when accepting', async () => {
      if (!availableTables.suggestions) return;
      
      const sender = await createTestUser();
      const recipient = await createTestUser();

      await createFollow(sender.accessToken, recipient.id);

      // Recipient already has the item in their list
      await request(app)
        .post('/api/list')
        .set(authHeader(recipient.accessToken))
        .send({
          title: 'Breaking Bad',
          type: 'TV',
          status: 'WATCHING',
          current: 10,
          total: 62,
          refId: 'tmdb:1396',
        })
        .expect(201);

      // Create and accept suggestion for the same item
      const suggestion = await request(app)
        .post(`/api/suggestions/${recipient.id}`)
        .set(authHeader(sender.accessToken))
        .send({
          title: 'Breaking Bad',
          type: 'TV',
          refId: 'tmdb:1396',
        })
        .expect(201);

      await request(app)
        .patch(`/api/suggestions/${suggestion.body.id}/accept`)
        .set(authHeader(recipient.accessToken))
        .expect(200);

      // Should still only have one item in list
      const listResponse = await request(app)
        .get('/api/list')
        .set(authHeader(recipient.accessToken))
        .expect(200);

      expect(listResponse.body).toHaveLength(1);
      // Status should remain unchanged (not overwritten to PLAN_TO_WATCH)
      expect(listResponse.body[0].status).toBe('WATCHING');
      expect(listResponse.body[0].current).toBe(10);
    });
  });
});
