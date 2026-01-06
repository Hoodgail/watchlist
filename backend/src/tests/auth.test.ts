import { describe, it, expect } from 'vitest';
import { request, app, createTestUser, generateUniqueUser, authHeader } from './helpers.js';

describe('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = generateUniqueUser();

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.id).toBeDefined();
      expect(response.body.tokens).toBeDefined();
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      // Password should not be returned
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.passwordHash).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      const userData = generateUniqueUser();
      
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...generateUniqueUser(), email: userData.email })
        .expect(409);

      expect(response.body.error).toBe('Email already registered');
    });

    it('should reject duplicate username', async () => {
      const userData = generateUniqueUser();
      
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...generateUniqueUser(), username: userData.username })
        .expect(409);

      expect(response.body.error).toBe('Username already taken');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'validuser',
          email: 'invalid-email',
          password: 'TestPassword123!',
        })
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'validuser',
          email: 'valid@example.com',
          password: 'short',
        })
        .expect(400);

      expect(response.body.error).toContain('Password');
    });

    it('should reject invalid username characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'invalid user!',
          email: 'valid@example.com',
          password: 'TestPassword123!',
        })
        .expect(400);

      expect(response.body.error).toContain('username');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: user.password,
        })
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(user.email);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should reject invalid password', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should login with case-insensitive email', async () => {
      const user = await createTestUser();
      // Email was stored as lowercase, try logging in with different casing
      const uppercaseEmail = user.email.toUpperCase();

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: uppercaseEmail,
          password: user.password,
        })
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(user.email.toLowerCase());
      expect(response.body.tokens.accessToken).toBeDefined();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      // New tokens should be different
      expect(response.body.refreshToken).not.toBe(user.refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('Invalid refresh token');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const user = await createTestUser();

      await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: user.refreshToken })
        .expect(204);

      // Refresh token should no longer work
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get('/api/auth/me')
        .set(authHeader(user.accessToken))
        .expect(200);

      expect(response.body.id).toBe(user.id);
      expect(response.body.email).toBe(user.email);
      expect(response.body.username).toBe(user.username);
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app)
        .get('/api/auth/me')
        .set(authHeader('invalid-token'))
        .expect(401);
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should logout from all sessions', async () => {
      const user = await createTestUser();

      // Login again to create another session
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      const secondRefreshToken = loginResponse.body.tokens.refreshToken;

      // Logout all
      await request(app)
        .post('/api/auth/logout-all')
        .set(authHeader(user.accessToken))
        .expect(204);

      // Both refresh tokens should be invalid
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: user.refreshToken })
        .expect(401);

      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: secondRefreshToken })
        .expect(401);
    });
  });
});
