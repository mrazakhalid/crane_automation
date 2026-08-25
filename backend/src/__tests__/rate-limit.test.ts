import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { closeDb, connectDb } from '../config/db.js';
import { ensureUserIndexes } from '../repositories/user.repository.js';
import { seedSuperAdmin } from '../services/seed.js';

/**
 * Rate-limiter integration tests. Each test builds its OWN app so the limiter's
 * in-memory counters start clean and cannot leak between assertions.
 */
beforeAll(async () => {
  await connectDb();
  await ensureUserIndexes();
  await seedSuperAdmin();
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe('rate limiting: login', () => {
  it('429s after too many FAILED login attempts, with a JSON error message', async () => {
    const app = createApp();
    // 20 failures are allowed (limit: 20); the 21st is blocked.
    for (let i = 0; i < 20; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/too many login attempts/i);
  });

  it('does not count SUCCESSFUL logins toward the limit', async () => {
    const app = createApp();
    for (let i = 0; i < 25; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin' });
      expect(res.status).toBe(200);
    }
  });
});

describe('rate limiting: live-poll endpoints are exempt', () => {
  it('does not 429 the authenticated live-read poll under sustained requests', async () => {
    const app = createApp();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin' });
    expect(login.status).toBe(200);
    const token = login.body.token as string;

    // The poll path is skipped from the global cap; not connected to a PLC → 409.
    for (let i = 0; i < 40; i++) {
      const res = await request(app)
        .get('/api/plc/read')
        .query({ nodeId: 'ns=2;i=1' })
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).not.toBe(429);
    }
  });
});
