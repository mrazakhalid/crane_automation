import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { closeDb, connectDb } from '../config/db.js';
import { ensureUserIndexes } from '../repositories/user.repository.js';
import { seedSuperAdmin } from '../services/seed.js';

/**
 * Integration tests for the auth + RBAC + user-management flows, running against
 * an in-memory MongoDB (started automatically because MONGODB_URI is empty).
 */
let app: Express;

/** Helper: log in and return the bearer token. */
async function tokenFor(username: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

beforeAll(async () => {
  await connectDb();
  await ensureUserIndexes();
  await seedSuperAdmin();
  app = createApp();
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe('auth: login', () => {
  it('logs in the seeded super-admin (admin/admin) and returns a token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('super_admin');
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects a wrong password with 401 and no token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'nope',
    });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('rejects unknown fields in the login body (strict schema)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin', hax: true });
    expect(res.status).toBe(400);
  });
});

describe('auth: session (/me)', () => {
  it('returns the current user for a valid token', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('admin');
  });

  it('401s without a bearer token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('users: RBAC + management (super-admin only)', () => {
  it('blocks non-super-admins from listing users (403)', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'operator', username: 'op_block', password: 'op-pass-123' });
    expect(created.status).toBe(201);

    const opToken = await tokenFor('op_block', 'op-pass-123');
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${opToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a manager with supplied credentials that then work for login', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'manager', username: 'mgr_amy', password: 'mgr-pass-123' });
    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe('manager');
    expect(created.body.user.username).toBe('mgr_amy');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'mgr_amy', password: 'mgr-pass-123' });
    expect(login.status).toBe(200);
  });

  it('lets a super-admin create another super-admin who can log in', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'super_admin', username: 'admin_two', password: 'admin-two-123' });
    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe('super_admin');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin_two', password: 'admin-two-123' });
    expect(login.status).toBe(200);
  });

  it('rejects a duplicate username with 409', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    const body = { role: 'operator', username: 'dupe_user', password: 'dupe-pass-123' };
    const first = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
    expect(first.status).toBe(201);
    const second = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
    expect(second.status).toBe(409);
  });

  it('rejects a too-short username with 400 (bounds enforced)', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'operator', username: 'ab', password: 'valid-pass-1' });
    expect(res.status).toBe(400);
  });

  it('rotates a managed user credentials; old password stops working', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'operator', username: 'op_rotate', password: 'op-pass-123' });
    const username = 'op_rotate';
    const password = 'op-pass-123';
    const id = created.body.user.id;

    const patch = await request(app)
      .patch(`/api/users/${id}/credentials`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'new-password-123' });
    expect(patch.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ username, password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'new-password-123' });
    expect(newLogin.status).toBe(200);
  });

  it('refuses to edit a super-admin through the user routes (403, no IDOR)', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app)
      .patch(`/api/users/${me.body.user.id}/credentials`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'irrelevant-123' });
    expect(res.status).toBe(403);
  });

  it('deletes a managed user (204) and login then fails', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'operator', username: 'op_delete', password: 'op-pass-123' });
    const username = 'op_delete';
    const password = 'op-pass-123';
    const id = created.body.user.id;

    const del = await request(app)
      .delete(`/api/users/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);

    const login = await request(app).post('/api/auth/login').send({ username, password });
    expect(login.status).toBe(401);
  });
});

describe('auth: self-service credential change', () => {
  it('lets a user change their own password and log in with it', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'manager', username: 'mgr_self', password: 'mgr-pass-123' });
    const username = 'mgr_self';

    const token = await tokenFor(username, 'mgr-pass-123');
    const patch = await request(app)
      .patch('/api/auth/me/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'self-chosen-999' });
    expect(patch.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'self-chosen-999' });
    expect(login.status).toBe(200);
  });
});
