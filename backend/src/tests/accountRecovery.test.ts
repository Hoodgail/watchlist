import { describe, expect, it, vi } from 'vitest';
import { app, authHeader, createTestUser, request } from './helpers.js';
import { prisma } from '../config/database.js';
const mail = vi.hoisted(() => ({
  requireEmailDelivery: vi.fn(),
  sendRecoveryEmail: vi.fn(async () => {}),
}));
vi.mock('../services/emailService.js', () => mail);

describe('account recovery lifecycle', () => {
  it('hashes purpose-specific codes, verifies email, resets once and revokes old sessions', async () => {
    const user = await createTestUser();
    const email = 'recovery@example.com';
    await request(app)
      .post('/api/auth/recovery-email')
      .set(authHeader(user.accessToken))
      .send({ email })
      .expect(200);
    const verification = mail.sendRecoveryEmail.mock.calls.at(-1) as unknown as [
      string,
      string,
      string,
    ];
    expect(verification[0]).toBe(email);
    expect(verification[2]).toBe('verify');
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.recoveryEmailToken).toMatch(/^verify:/);
    expect(stored.recoveryEmailToken).not.toContain(verification[1]);
    await request(app)
      .post('/api/auth/recovery/complete')
      .send({ token: verification[1], newPassword: 'ChangedPassword123!' })
      .expect(401);
    await request(app)
      .post('/api/auth/recovery/verify-email')
      .send({ token: verification[1] })
      .expect(200);
    await request(app).post('/api/auth/recovery/initiate').send({ email }).expect(200);
    const reset = mail.sendRecoveryEmail.mock.calls.at(-1) as unknown as [string, string, string];
    expect(reset[2]).toBe('reset');
    const body = { token: reset[1], newPassword: 'ChangedPassword123!' };
    await request(app).post('/api/auth/recovery/complete').send(body).expect(200);
    await request(app).post('/api/auth/recovery/complete').send(body).expect(401);
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: body.newPassword })
      .expect(200);
  });
});
