import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { closeDb, connectDb } from '../config/db.js';
import { ensureLineIndexes } from '../repositories/line.repository.js';
import { ensureUserIndexes } from '../repositories/user.repository.js';
import { seedSuperAdmin } from '../services/seed.js';

/**
 * Integration tests for the Line + task-generation flows (in-memory MongoDB).
 */
let app: Express;

async function tokenFor(username: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

/** Minimal line4 payload (enough tanks to exercise the sample QR). */
const line4Payload = {
  name: 'line4',
  cranes: ['7A', '7B', '6'],
  tanks: [
    { number: 1, name: '1-1A', crane: '7A' },
    { number: 2, name: '1-1B', crane: '7A' },
    { number: 3, name: '1-2', crane: '7A' },
    { number: 4, name: '1-3', crane: '7A' },
    { number: 5, name: '1-4A', crane: '7A' },
    { number: 6, name: '1-4B', crane: '7A', cranes: ['7A', '7B'], transfer: true },
    { number: 7, name: '1-4C', crane: '7B' },
    { number: 8, name: '1-5', crane: '7B' },
    { number: 9, name: '1-6', crane: '7B' },
    { number: 11, name: '1-7b', crane: '6' },
    { number: 12, name: '1-8', crane: '6' },
  ],
};

beforeAll(async () => {
  await connectDb();
  await ensureUserIndexes();
  await ensureLineIndexes();
  await seedSuperAdmin();
  app = createApp();
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe('lines: creation + RBAC', () => {
  it('lets a super-admin create line4 and rejects a duplicate name (409)', async () => {
    const token = await tokenFor('admin', 'admin');
    const created = await request(app)
      .post('/api/lines')
      .set('Authorization', `Bearer ${token}`)
      .send(line4Payload);
    expect(created.status).toBe(201);
    expect(created.body.line.name).toBe('line4');
    expect(created.body.line.id).toBeTruthy();

    const dupe = await request(app)
      .post('/api/lines')
      .set('Authorization', `Bearer ${token}`)
      .send(line4Payload);
    expect(dupe.status).toBe(409);
  });

  it('blocks non-super-admins from creating a line (403) but lets them list', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'manager', username: 'mgr_lines', password: 'mgr-pass-123' });
    const mgrToken = await tokenFor('mgr_lines', 'mgr-pass-123');

    const blocked = await request(app)
      .post('/api/lines')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ ...line4Payload, name: 'line5' });
    expect(blocked.status).toBe(403);

    const list = await request(app).get('/api/lines').set('Authorization', `Bearer ${mgrToken}`);
    expect(list.status).toBe(200);
    expect(list.body.lines.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects unknown fields in the body (strict schema)', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/lines')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...line4Payload, name: 'line6', hax: true });
    expect(res.status).toBe(400);
  });
});

describe('lines: edit + delete (super-admin only)', () => {
  /** Create a throwaway line and return its id. */
  async function makeLine(token: string, name: string): Promise<string> {
    const res = await request(app)
      .post('/api/lines')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...line4Payload, name });
    expect(res.status).toBe(201);
    return res.body.line.id as string;
  }

  it('edits a line name + tanks (200) and persists the change', async () => {
    const token = await tokenFor('admin', 'admin');
    const id = await makeLine(token, 'line-edit');

    const patched = await request(app)
      .patch(`/api/lines/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'line-edited', tanks: [{ number: 1, name: 'X-1', crane: '7A' }] });
    expect(patched.status).toBe(200);
    expect(patched.body.line.name).toBe('line-edited');
    expect(patched.body.line.tanks).toHaveLength(1);

    const got = await request(app).get(`/api/lines/${id}`).set('Authorization', `Bearer ${token}`);
    expect(got.body.line.name).toBe('line-edited');
  });

  it('rejects renaming onto another line’s name (409)', async () => {
    const token = await tokenFor('admin', 'admin');
    await makeLine(token, 'line-a');
    const idB = await makeLine(token, 'line-b');
    const res = await request(app)
      .patch(`/api/lines/${idB}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'line-a' });
    expect(res.status).toBe(409);
  });

  it('blocks non-super-admins from editing/deleting (403)', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    const id = await makeLine(adminToken, 'line-guard');
    const mgrToken = await tokenFor('mgr_lines', 'mgr-pass-123');

    const edit = await request(app)
      .patch(`/api/lines/${id}`)
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ name: 'nope' });
    expect(edit.status).toBe(403);

    const del = await request(app)
      .delete(`/api/lines/${id}`)
      .set('Authorization', `Bearer ${mgrToken}`);
    expect(del.status).toBe(403);
  });

  it('deletes a line (204); fetching it afterwards 404s', async () => {
    const token = await tokenFor('admin', 'admin');
    const id = await makeLine(token, 'line-del');

    const del = await request(app).delete(`/api/lines/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const got = await request(app).get(`/api/lines/${id}`).set('Authorization', `Bearer ${token}`);
    expect(got.status).toBe(404);
  });
});

describe('lines: task generation from a QR recipe', () => {
  it('generates the task list, matching the 1-2 example and marking missing keys', async () => {
    const token = await tokenFor('admin', 'admin');
    const list = await request(app).get('/api/lines').set('Authorization', `Bearer ${token}`);
    const line = list.body.lines.find((l: { name: string }) => l.name === 'line4');

    const res = await request(app)
      .post(`/api/lines/${line.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ qr: '1-1=60;1-2=30;1-3=5;1-8=30;20-1=60' });
    expect(res.status).toBe(200);

    const tasks = res.body.tasks as Array<Record<string, unknown>>;
    expect(tasks).toHaveLength(5);
    expect(tasks[1]).toMatchObject({
      key: '1-2',
      tank_name: '1-2',
      crane_name: '7A',
      previous_task: 1,
      next_task: 4,
      status: 0,
    });
    const missing = tasks.find((t) => t.key === '20-1')!;
    expect(missing.tank_name).toBe('missing');
    expect(missing.crane_name).toBe('missing');
  });

  it('400s on malformed QR data', async () => {
    const token = await tokenFor('admin', 'admin');
    const list = await request(app).get('/api/lines').set('Authorization', `Bearer ${token}`);
    const line = list.body.lines.find((l: { name: string }) => l.name === 'line4');

    const res = await request(app)
      .post(`/api/lines/${line.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ qr: 'not-a-recipe' });
    expect(res.status).toBe(400);
  });
});
