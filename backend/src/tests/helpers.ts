import request from 'supertest';
import app from '../app.js';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

let userCounter = 0;

export function generateUniqueUser() {
  userCounter++;
  const timestamp = Date.now();
  return {
    username: `testuser${timestamp}${userCounter}`,
    email: `test${timestamp}${userCounter}@example.com`,
    password: 'TestPassword123!',
  };
}

export async function createTestUser(userData?: Partial<{ username: string; email: string; password: string }>): Promise<TestUser> {
  const defaultUser = generateUniqueUser();
  const user = { ...defaultUser, ...userData };

  const response = await request(app)
    .post('/api/auth/register')
    .send(user)
    .expect(201);

  return {
    id: response.body.user.id,
    username: response.body.user.username,
    email: response.body.user.email,
    password: user.password,
    accessToken: response.body.tokens.accessToken,
    refreshToken: response.body.tokens.refreshToken,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export { request, app };
