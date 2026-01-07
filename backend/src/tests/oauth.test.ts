import { describe, it, expect, beforeAll } from 'vitest';
import { request, app, createTestUser, authHeader } from './helpers.js';
import { prisma } from '../config/database.js';
import { availableTables } from './setup.js';

/**
 * OAuth API Tests
 * 
 * Some tests require the 'oauth_accounts' table to exist in the database.
 * Tests that don't require the table will run regardless.
 * 
 * To enable all tests, run database migrations:
 * npx prisma db push
 */
describe('OAuth Endpoints', () => {
  beforeAll(() => {
    if (!availableTables.oauthAccounts) {
      console.log('\n⚠️  Some OAuth tests will be skipped: oauth_accounts table does not exist in database');
      console.log('   Run "npx prisma db push" to sync the database schema\n');
    }
  });

  describe('GET /api/auth/oauth/:provider', () => {
    it('should return authorization URL for valid provider (discord)', async () => {
      // Note: This will only work if Discord OAuth is configured
      // In test environment without config, it will return 400
      const response = await request(app)
        .get('/api/auth/oauth/discord')
        .expect((res) => {
          // Accept either 200 (configured) or 400 (not configured)
          if (res.status !== 200 && res.status !== 400) {
            throw new Error(`Expected 200 or 400, got ${res.status}`);
          }
        });

      if (response.status === 200) {
        expect(response.body.authorizationUrl).toBeDefined();
        expect(response.body.authorizationUrl).toContain('discord.com');
      } else {
        // OAuth not configured in test environment
        expect(response.body.error).toContain('Discord OAuth is not configured');
      }
    });

    it('should accept optional state parameter', async () => {
      const response = await request(app)
        .get('/api/auth/oauth/discord?state=mystate123')
        .expect((res) => {
          if (res.status !== 200 && res.status !== 400) {
            throw new Error(`Expected 200 or 400, got ${res.status}`);
          }
        });

      if (response.status === 200) {
        expect(response.body.authorizationUrl).toContain('state=mystate123');
      }
    });

    it('should fail for invalid provider (400)', async () => {
      const response = await request(app)
        .get('/api/auth/oauth/invalidprovider')
        .expect(400);

      expect(response.body.error).toBe('Unknown OAuth provider: invalidprovider');
    });

    it('should fail for empty provider', async () => {
      // This tests the router pattern - empty provider hits a different route
      await request(app)
        .get('/api/auth/oauth/')
        .expect(404);
    });
  });

  describe('GET /api/auth/oauth/:provider/callback', () => {
    // Note: Testing the actual callback flow requires mocking Discord API
    // These tests cover error cases and basic routing

    it('should redirect with error when code parameter is missing', async () => {
      const response = await request(app)
        .get('/api/auth/oauth/discord/callback')
        .expect(302);

      // Should redirect to frontend with error
      expect(response.headers.location).toContain('error=');
      expect(response.headers.location).toContain('No%20authorization%20code%20received');
    });

    it('should handle OAuth error from provider', async () => {
      const response = await request(app)
        .get('/api/auth/oauth/discord/callback?error=access_denied&error_description=User%20denied%20access')
        .expect(302);

      // Should redirect to frontend with the provider's error
      expect(response.headers.location).toContain('error=');
      expect(response.headers.location).toContain('User%20denied%20access');
    });

    it('should handle invalid provider', async () => {
      const response = await request(app)
        .get('/api/auth/oauth/invalidprovider/callback?code=testcode')
        .expect(302);

      // Should redirect with error about invalid provider
      expect(response.headers.location).toContain('error=');
    });
  });

  describe('POST /api/auth/oauth/:provider/link', () => {
    it('should require authentication', async () => {
      await request(app)
        .post('/api/auth/oauth/discord/link')
        .send({ code: 'testcode' })
        .expect(401);
    });

    it('should require code parameter', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/auth/oauth/discord/link')
        .set(authHeader(user.accessToken))
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Authorization code is required');
    });

    it('should fail for invalid provider', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/auth/oauth/invalidprovider/link')
        .set(authHeader(user.accessToken))
        .send({ code: 'testcode' })
        .expect(400);

      expect(response.body.error).toBe('Unknown OAuth provider: invalidprovider');
    });

    // Note: Full linking test requires mocking Discord API
    // The actual exchange of code for tokens is tested via integration tests
  });

  describe('DELETE /api/auth/oauth/:provider/link', () => {
    it('should require authentication', async () => {
      await request(app)
        .delete('/api/auth/oauth/discord/link')
        .expect(401);
    });

    it('should fail if no OAuth linked', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .delete('/api/auth/oauth/discord/link')
        .set(authHeader(user.accessToken))
        .expect(400);

      expect(response.body.error).toBe('No discord account linked');
    });

    it('should successfully unlink when user has password', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      // Manually add OAuth link
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'discord',
          providerId: 'discordid' + Date.now(),
          accessToken: 'fake-token',
        },
      });

      // Unlink should succeed because user has password
      const response = await request(app)
        .delete('/api/auth/oauth/discord/link')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.message).toBe('discord account unlinked successfully');

      // Verify OAuth account is removed
      const oauthAccount = await prisma.oAuthAccount.findFirst({
        where: { userId: user.id, provider: 'discord' },
      });
      expect(oauthAccount).toBeNull();
    });

    it('should fail for invalid provider', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .delete('/api/auth/oauth/invalidprovider/link')
        .set(authHeader(user.accessToken))
        .expect(400);

      expect(response.body.error).toBe('No invalidprovider account linked');
    });
  });

  describe('GET /api/auth/oauth/providers', () => {
    it('should return empty array for user with no OAuth', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/auth/oauth/providers')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.linked).toEqual([]);
      expect(response.body.available).toBeDefined();
      expect(Array.isArray(response.body.available)).toBe(true);
      expect(response.body.available).toContain('discord');
    });

    it('should return linked providers', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      // Manually add OAuth link
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'discord',
          providerId: 'discordid' + Date.now(),
          accessToken: 'fake-token',
        },
      });

      const response = await request(app)
        .get('/api/auth/oauth/providers')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.linked).toHaveLength(1);
      expect(response.body.linked[0].provider).toBe('discord');
      expect(response.body.linked[0].linkedAt).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/auth/oauth/providers')
        .expect(401);
    });
  });

  describe('OAuth-only user scenarios', () => {
    it('should not allow unlinking last OAuth when no password set', async () => {
      if (!availableTables.oauthAccounts) return;
      
      // Create OAuth-only user directly in database
      const user = await prisma.user.create({
        data: {
          username: 'oauthuser' + Date.now(),
          email: `oauthuser${Date.now()}@example.com`,
          // No passwordHash
        },
      });

      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'discord',
          providerId: 'discordid' + Date.now(),
          accessToken: 'fake-token',
        },
      });

      // Create refresh token to get access token
      const { createTokensForUser } = await import('../services/authService.js');
      const tokens = await createTokensForUser(user.id, user.email);

      // Try to unlink should fail
      const response = await request(app)
        .delete('/api/auth/oauth/discord/link')
        .set(authHeader(tokens.accessToken))
        .expect(400);

      expect(response.body.error).toBe('Cannot unlink OAuth provider. You must have a password or another OAuth provider linked.');
    });

    it('should allow unlinking OAuth when another OAuth is linked', async () => {
      if (!availableTables.oauthAccounts) return;
      
      // Create user with two OAuth providers
      const user = await prisma.user.create({
        data: {
          username: 'multioauthuser' + Date.now(),
          email: `multioauth${Date.now()}@example.com`,
          // No passwordHash
        },
      });

      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'discord',
          providerId: 'discordid' + Date.now(),
          accessToken: 'fake-token',
        },
      });

      // Simulate another OAuth provider (e.g., "google" - even though not implemented)
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerId: 'googleid' + Date.now(),
          accessToken: 'fake-token',
        },
      });

      // Create refresh token to get access token
      const { createTokensForUser } = await import('../services/authService.js');
      const tokens = await createTokensForUser(user.id, user.email);

      // Should be able to unlink discord because google is still linked
      const response = await request(app)
        .delete('/api/auth/oauth/discord/link')
        .set(authHeader(tokens.accessToken))
        .expect(200);

      expect(response.body.message).toBe('discord account unlinked successfully');

      // Verify only google remains
      const accounts = await prisma.oAuthAccount.findMany({
        where: { userId: user.id },
      });
      expect(accounts).toHaveLength(1);
      expect(accounts[0].provider).toBe('google');
    });
  });
});

describe('Auth /me endpoint with OAuth fields', () => {
  beforeAll(() => {
    if (!availableTables.oauthAccounts) {
      console.log('\n⚠️  Some /me endpoint tests will be skipped: oauth_accounts table does not exist');
    }
  });

  describe('GET /api/auth/me', () => {
    it('should return hasPassword true for password-registered user', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/auth/me')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.hasPassword).toBe(true);
    });

    it('should return oauthProviders as empty array when no OAuth linked', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/auth/me')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.oauthProviders).toBeDefined();
      expect(response.body.oauthProviders).toEqual([]);
    });

    it('should return linked OAuth providers', async () => {
      if (!availableTables.oauthAccounts) return;
      
      const user = await createTestUser();

      // Manually add OAuth link
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'discord',
          providerId: 'discordid' + Date.now(),
          accessToken: 'fake-token',
        },
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.oauthProviders).toHaveLength(1);
      expect(response.body.oauthProviders[0].provider).toBe('discord');
      expect(response.body.oauthProviders[0].linkedAt).toBeDefined();
    });

    it('should return avatarUrl field', async () => {
      if (!availableTables.avatarUrl) return;
      
      const user = await createTestUser();

      // Update user with avatar
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: 'https://example.com/avatar.png' },
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.avatarUrl).toBe('https://example.com/avatar.png');
    });

    it('should return hasPassword false for OAuth-only user', async () => {
      if (!availableTables.oauthAccounts) return;
      
      // Create OAuth-only user
      const user = await prisma.user.create({
        data: {
          username: 'oauthmeuser' + Date.now(),
          email: `oauthme${Date.now()}@example.com`,
          // No passwordHash
        },
      });

      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'discord',
          providerId: 'discordid' + Date.now(),
          accessToken: 'fake-token',
        },
      });

      // Create tokens
      const { createTokensForUser } = await import('../services/authService.js');
      const tokens = await createTokensForUser(user.id, user.email);

      const response = await request(app)
        .get('/api/auth/me')
        .set(authHeader(tokens.accessToken))
        .expect(200);

      expect(response.body.hasPassword).toBe(false);
      expect(response.body.oauthProviders).toHaveLength(1);
      expect(response.body.oauthProviders[0].provider).toBe('discord');
    });
  });
});
