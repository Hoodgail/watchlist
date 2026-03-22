import { describe, expect, it } from 'vitest';
import { prisma } from '../config/database.js';
import { authHeader, createTestUser, request, app } from './helpers.js';
import { describeDb } from './testSuites.js';

let sourceCounter = 0;

async function seedMediaSource(input: {
  refId: string;
  title: string;
  type: 'TV' | 'MOVIE' | 'ANIME' | 'MANGA';
  imageUrl?: string | null;
  total?: number | null;
}) {
  sourceCounter += 1;

  return prisma.mediaSource.create({
    data: {
      refId: `${input.refId}-${sourceCounter}`,
      title: input.title,
      type: input.type,
      imageUrl: input.imageUrl ?? null,
      total: input.total ?? null,
    },
  });
}

async function createCollection(ownerToken: string, input?: { title?: string; description?: string; isPublic?: boolean }) {
  const response = await request(app)
    .post('/api/collections')
    .set(authHeader(ownerToken))
    .send({
      title: input?.title ?? 'Collection Alpha',
      description: input?.description,
      isPublic: input?.isPublic ?? false,
    })
    .expect(201);

  return response.body;
}

describeDb('Collections Endpoints', () => {
  describe('collection CRUD and detail', () => {
    it('creates, updates, reads, and deletes a collection', async () => {
      const owner = await createTestUser();

      const created = await createCollection(owner.accessToken, {
        title: 'Favorites',
        description: 'Top picks',
        isPublic: false,
      });

      expect(created.title).toBe('Favorites');
      expect(created.description).toBe('Top picks');
      expect(created.itemCount).toBe(0);
      expect(created.starCount).toBe(0);

      const updated = await request(app)
        .patch(`/api/collections/${created.id}`)
        .set(authHeader(owner.accessToken))
        .send({ title: 'All-Time Favorites', isPublic: true })
        .expect(200);

      expect(updated.body.title).toBe('All-Time Favorites');
      expect(updated.body.isPublic).toBe(true);

      const detail = await request(app)
        .get(`/api/collections/${created.id}`)
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(detail.body.myRole).toBe('OWNER');
      expect(detail.body.isStarred).toBe(false);
      expect(detail.body.items).toEqual([]);
      expect(detail.body.members).toEqual([]);

      await request(app)
        .delete(`/api/collections/${created.id}`)
        .set(authHeader(owner.accessToken))
        .expect(204);

      await request(app)
        .get(`/api/collections/${created.id}`)
        .set(authHeader(owner.accessToken))
        .expect(404);
    });

    it('lists public collections and hides private collections from unrelated users', async () => {
      const owner = await createTestUser();
      const stranger = await createTestUser();
      const publicCollection = await createCollection(owner.accessToken, { title: 'Public Picks', isPublic: true });
      const privateCollection = await createCollection(owner.accessToken, { title: 'Secret Picks', isPublic: false });

      const publicResponse = await request(app)
        .get('/api/collections/public?search=Public')
        .expect(200);

      expect(publicResponse.body.collections).toHaveLength(1);
      expect(publicResponse.body.collections[0].id).toBe(publicCollection.id);

      const publicDetail = await request(app)
        .get(`/api/collections/${publicCollection.id}`)
        .expect(200);

      expect(publicDetail.body.myRole).toBeNull();
      expect(publicDetail.body.isPublic).toBe(true);

      await request(app)
        .get(`/api/collections/${privateCollection.id}`)
        .set(authHeader(stranger.accessToken))
        .expect(403);
    });

    it('returns owned and member collections from my collections', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const owned = await createCollection(owner.accessToken, { title: 'Owned Collection' });
      const shared = await createCollection(owner.accessToken, { title: 'Shared Collection' });

      await request(app)
        .post(`/api/collections/${shared.id}/members`)
        .set(authHeader(owner.accessToken))
        .send({ username: member.username, role: 'EDITOR' })
        .expect(201);

      const response = await request(app)
        .get('/api/collections')
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((collection: { myRole: string }) => collection.myRole === 'OWNER')).toBe(true);

      const memberCollections = await request(app)
        .get('/api/collections')
        .set(authHeader(member.accessToken))
        .expect(200);

      expect(memberCollections.body).toHaveLength(1);
      expect(memberCollections.body[0].id).toBe(shared.id);
      expect(memberCollections.body[0].myRole).toBe('EDITOR');
      expect(memberCollections.body[0].title).toBe('Shared Collection');
      expect(memberCollections.body[0].id).not.toBe(owned.id);
    });
  });

  describe('collection items and ordering', () => {
    it('adds, updates, reorders, and removes items', async () => {
      const owner = await createTestUser();
      const collection = await createCollection(owner.accessToken, { title: 'Queue' });
      const sourceA = await seedMediaSource({ refId: 'tmdb:queue-a', title: 'Item A', type: 'TV' });
      const sourceB = await seedMediaSource({ refId: 'tmdb:queue-b', title: 'Item B', type: 'TV' });

      const firstItem = await request(app)
        .post(`/api/collections/${collection.id}/items`)
        .set(authHeader(owner.accessToken))
        .send({ refId: sourceA.refId, type: 'TV', note: 'Start here' })
        .expect(201);

      const secondItem = await request(app)
        .post(`/api/collections/${collection.id}/items`)
        .set(authHeader(owner.accessToken))
        .send({ refId: sourceB.refId, type: 'TV' })
        .expect(201);

      expect(firstItem.body.title).toBe('Item A');
      expect(secondItem.body.orderIndex).toBe(1);

      const updated = await request(app)
        .patch(`/api/collections/${collection.id}/items/${secondItem.body.id}`)
        .set(authHeader(owner.accessToken))
        .send({ note: 'Watch next', orderIndex: 0 })
        .expect(200);

      expect(updated.body.note).toBe('Watch next');

      const reordered = await request(app)
        .patch(`/api/collections/${collection.id}/items/reorder`)
        .set(authHeader(owner.accessToken))
        .send({
          items: [
            { id: firstItem.body.id, orderIndex: 1 },
            { id: secondItem.body.id, orderIndex: 0 },
          ],
        })
        .expect(200);

      expect(reordered.body[0].id).toBe(secondItem.body.id);
      expect(reordered.body[1].id).toBe(firstItem.body.id);

      const detail = await request(app)
        .get(`/api/collections/${collection.id}`)
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(detail.body.items[0].id).toBe(secondItem.body.id);
      expect(detail.body.items[1].id).toBe(firstItem.body.id);
      expect(detail.body.itemCount).toBe(2);

      await request(app)
        .delete(`/api/collections/${collection.id}/items/${firstItem.body.id}`)
        .set(authHeader(owner.accessToken))
        .expect(204);

      const afterDelete = await request(app)
        .get(`/api/collections/${collection.id}`)
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(afterDelete.body.items).toHaveLength(1);
      expect(afterDelete.body.items[0].id).toBe(secondItem.body.id);
    });
  });

  describe('members and permissions', () => {
    it('adds, lists, updates, and removes members', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const collection = await createCollection(owner.accessToken, { title: 'Shared Space' });

      const createdMember = await request(app)
        .post(`/api/collections/${collection.id}/members`)
        .set(authHeader(owner.accessToken))
        .send({ username: member.username, role: 'VIEWER' })
        .expect(201);

      expect(createdMember.body.user.id).toBe(member.id);
      expect(createdMember.body.role).toBe('VIEWER');

      const members = await request(app)
        .get(`/api/collections/${collection.id}/members`)
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(members.body).toHaveLength(1);
      expect(members.body[0].id).toBe(createdMember.body.id);

      const updated = await request(app)
        .patch(`/api/collections/${collection.id}/members/${member.id}`)
        .set(authHeader(owner.accessToken))
        .send({ role: 'EDITOR' })
        .expect(200);

      expect(updated.body.role).toBe('EDITOR');

      const detail = await request(app)
        .get(`/api/collections/${collection.id}`)
        .set(authHeader(member.accessToken))
        .expect(200);

      expect(detail.body.myRole).toBe('EDITOR');

      await request(app)
        .delete(`/api/collections/${collection.id}/members/${member.id}`)
        .set(authHeader(owner.accessToken))
        .expect(204);

      const afterRemove = await request(app)
        .get(`/api/collections/${collection.id}/members`)
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(afterRemove.body).toHaveLength(0);
    });

    it('allows a member to leave but blocks the owner from leaving', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const collection = await createCollection(owner.accessToken, { title: 'Leave Test' });

      await request(app)
        .post(`/api/collections/${collection.id}/members`)
        .set(authHeader(owner.accessToken))
        .send({ username: member.username, role: 'VIEWER' })
        .expect(201);

      await request(app)
        .post(`/api/collections/${collection.id}/leave`)
        .set(authHeader(member.accessToken))
        .expect(204);

      await request(app)
        .post(`/api/collections/${collection.id}/leave`)
        .set(authHeader(owner.accessToken))
        .expect(400);
    });
  });

  describe('invites and joining', () => {
    it('creates, lists, joins, and revokes invites', async () => {
      const owner = await createTestUser();
      const invitee = await createTestUser();
      const collection = await createCollection(owner.accessToken, { title: 'Invites' });

      const invite = await request(app)
        .post(`/api/collections/${collection.id}/invites`)
        .set(authHeader(owner.accessToken))
        .send({ role: 'VIEWER', maxUses: 2, expiresInDays: 7 })
        .expect(201);

      expect(invite.body.token).toBeDefined();
      expect(invite.body.role).toBe('VIEWER');

      const invites = await request(app)
        .get(`/api/collections/${collection.id}/invites`)
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(invites.body).toHaveLength(1);
      expect(invites.body[0].id).toBe(invite.body.id);

      const join = await request(app)
        .post(`/api/collections/join/${invite.body.token}`)
        .set(authHeader(invitee.accessToken))
        .expect(201);

      expect(join.body.collectionId).toBe(collection.id);
      expect(join.body.role).toBe('VIEWER');

      const members = await request(app)
        .get(`/api/collections/${collection.id}/members`)
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(members.body).toHaveLength(1);
      expect(members.body[0].user.id).toBe(invitee.id);

      await request(app)
        .delete(`/api/collections/${collection.id}/invites/${invite.body.id}`)
        .set(authHeader(owner.accessToken))
        .expect(204);

      const afterRevoke = await request(app)
        .get(`/api/collections/${collection.id}/invites`)
        .set(authHeader(owner.accessToken))
        .expect(200);

      expect(afterRevoke.body).toHaveLength(0);
    });
  });

  describe('stars', () => {
    it('stars, lists, and unstars a collection', async () => {
      const owner = await createTestUser();
      const viewer = await createTestUser();
      const collection = await createCollection(owner.accessToken, { title: 'Starred Thing', isPublic: true });

      await request(app)
        .post(`/api/collections/${collection.id}/star`)
        .set(authHeader(viewer.accessToken))
        .expect(201);

      const starredCollections = await request(app)
        .get('/api/collections/starred')
        .set(authHeader(viewer.accessToken))
        .expect(200);

      expect(starredCollections.body).toHaveLength(1);
      expect(starredCollections.body[0].id).toBe(collection.id);

      const detail = await request(app)
        .get(`/api/collections/${collection.id}`)
        .set(authHeader(viewer.accessToken))
        .expect(200);

      expect(detail.body.isStarred).toBe(true);
      expect(detail.body.starCount).toBe(1);

      await request(app)
        .delete(`/api/collections/${collection.id}/star`)
        .set(authHeader(viewer.accessToken))
        .expect(204);

      const afterUnstar = await request(app)
        .get(`/api/collections/${collection.id}`)
        .set(authHeader(viewer.accessToken))
        .expect(200);

      expect(afterUnstar.body.isStarred).toBe(false);
      expect(afterUnstar.body.starCount).toBe(0);
    });
  });

  describe('collection comments', () => {
    it('creates and lists comments for a public collection', async () => {
      const owner = await createTestUser();
      const collection = await createCollection(owner.accessToken, { isPublic: true });

      const createResponse = await request(app)
        .post(`/api/collections/${collection.id}/comments`)
        .set(authHeader(owner.accessToken))
        .send({ content: 'First collection note' })
        .expect(201);

      expect(createResponse.body.content).toBe('First collection note');
      expect(createResponse.body.author.id).toBe(owner.id);

      const listResponse = await request(app)
        .get(`/api/collections/${collection.id}/comments`)
        .expect(200);

      expect(listResponse.body.comments).toHaveLength(1);
      expect(listResponse.body.comments[0].id).toBe(createResponse.body.id);
      expect(listResponse.body.total).toBe(1);
      expect(listResponse.body.page).toBe(1);
    });

    it('blocks unrelated users from viewing private collection comments', async () => {
      const owner = await createTestUser();
      const stranger = await createTestUser();
      const collection = await createCollection(owner.accessToken, { isPublic: false });

      await request(app)
        .post(`/api/collections/${collection.id}/comments`)
        .set(authHeader(owner.accessToken))
        .send({ content: 'Private discussion' })
        .expect(201);

      await request(app)
        .get(`/api/collections/${collection.id}/comments`)
        .set(authHeader(stranger.accessToken))
        .expect(403);
    });

    it('allows members to view and add comments on private collections', async () => {
      const owner = await createTestUser();
      const member = await createTestUser();
      const collection = await createCollection(owner.accessToken, { isPublic: false });

      await request(app)
        .post(`/api/collections/${collection.id}/members`)
        .set(authHeader(owner.accessToken))
        .send({ username: member.username, role: 'VIEWER' })
        .expect(201);

      await request(app)
        .post(`/api/collections/${collection.id}/comments`)
        .set(authHeader(member.accessToken))
        .send({ content: 'Member comment' })
        .expect(201);

      const response = await request(app)
        .get(`/api/collections/${collection.id}/comments`)
        .set(authHeader(member.accessToken))
        .expect(200);

      expect(response.body.comments).toHaveLength(1);
      expect(response.body.comments[0].content).toBe('Member comment');
    });

    it('blocks unrelated users from commenting on private collections', async () => {
      const owner = await createTestUser();
      const stranger = await createTestUser();
      const collection = await createCollection(owner.accessToken, { isPublic: false });

      await request(app)
        .post(`/api/collections/${collection.id}/comments`)
        .set(authHeader(stranger.accessToken))
        .send({ content: 'Not allowed' })
        .expect(403);
    });

    it('only allows the author to update a collection comment', async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const collection = await createCollection(owner.accessToken, { isPublic: true });

      const comment = await request(app)
        .post(`/api/collections/${collection.id}/comments`)
        .set(authHeader(owner.accessToken))
        .send({ content: 'Original comment' })
        .expect(201);

      await request(app)
        .patch(`/api/collections/${collection.id}/comments/${comment.body.id}`)
        .set(authHeader(otherUser.accessToken))
        .send({ content: 'Hijacked comment' })
        .expect(403);

      const updateResponse = await request(app)
        .patch(`/api/collections/${collection.id}/comments/${comment.body.id}`)
        .set(authHeader(owner.accessToken))
        .send({ content: 'Updated comment' })
        .expect(200);

      expect(updateResponse.body.content).toBe('Updated comment');
    });

    it('only allows the author to delete a collection comment', async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const collection = await createCollection(owner.accessToken, { isPublic: true });

      const comment = await request(app)
        .post(`/api/collections/${collection.id}/comments`)
        .set(authHeader(owner.accessToken))
        .send({ content: 'Delete me' })
        .expect(201);

      await request(app)
        .delete(`/api/collections/${collection.id}/comments/${comment.body.id}`)
        .set(authHeader(otherUser.accessToken))
        .expect(403);

      await request(app)
        .delete(`/api/collections/${collection.id}/comments/${comment.body.id}`)
        .set(authHeader(owner.accessToken))
        .expect(204);

      const listResponse = await request(app)
        .get(`/api/collections/${collection.id}/comments`)
        .expect(200);

      expect(listResponse.body.comments).toHaveLength(0);
    });
  });
});
