import { describe, it, expect } from 'vitest';
import { request, app } from './helpers.js';
import { prisma } from '../config/database.js';

describe('Health Check', () => {
  it('should return health status', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });

  it('is unavailable when the provider-identity migration is missing', async () => {
    await prisma.$executeRaw`ALTER TABLE provider_mappings RENAME COLUMN user_id TO pending_user_id`;
    try {
      // This was the old health check: it passed despite the broken list schema.
      await prisma.$queryRaw`SELECT 1`;
      const response = await request(app).get('/api/health').expect(503);
      expect(response.body).toEqual({ status: 'unavailable' });
    } finally {
      await prisma.$executeRaw`ALTER TABLE provider_mappings RENAME COLUMN pending_user_id TO user_id`;
    }
    await request(app).get('/api/health').expect(200);
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/api/unknown-route')
      .expect(404);

    expect(response.body.error).toBe('Not found');
  });
});
