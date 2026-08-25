import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';

/**
 * Integration tests for the **sqlite** storage driver — the same API flows the
 * mongo suite exercises, proving the driver swap (via STORAGE_DRIVER) is
 * transparent. The driver + DB path are set before any app module (and thus
 * `config/env.ts`) is imported, then everything is loaded dynamically.
 */
let app: Express;
let closeDb: () => Promise<void>;

// better-sqlite3 is a native module; on a dev machine its compiled binary may
// target Electron's ABI (for the desktop app) rather than this Node's. When that
// mismatch exists, loading it throws ERR_DLOPEN_FAILED. Detect it up front and
// skip this suite gracefully so `npm test` stays green regardless of which ABI
// the `.node` was built for (CI builds it for Node and runs these fully).
let sqliteAvailable = true;
try {
  const { default: Database } = await import('better-sqlite3');
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
}

async function tokenFor(username: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

const line = {
  name: 'line4',
  cranes: ['7A', '7B', '6'],
  tanks: [
    { number: 1, name: '1-1A', crane: '7A' },
    { number: 3, name: '1-2', crane: '7A' },
    { number: 4, name: '1-3', crane: '7A' },
    { number: 6, name: '1-4B', crane: '7A', cranes: ['7A', '7B'], transfer: true },
  ],
};

describe.skipIf(!sqliteAvailable)('sqlite driver: end-to-end', () => {
  beforeAll(async () => {
    process.env.STORAGE_DRIVER = 'sqlite';
    process.env.SQLITE_PATH = ':memory:';

    const db = await import('../config/db.js');
    const { ensureUserIndexes } = await import('../repositories/user.repository.js');
    const { ensureLineIndexes } = await import('../repositories/line.repository.js');
    const { seedSuperAdmin } = await import('../services/seed.js');
    const { createApp } = await import('../app.js');

    await db.connectDb();
    await ensureUserIndexes();
    await ensureLineIndexes();
    await seedSuperAdmin();
    closeDb = db.closeDb;
    app = createApp();
  });

  afterAll(async () => {
    await closeDb?.();
  });

  it('seeds + logs in the super-admin (admin/admin)', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('super_admin');
  });

  it('enforces unique usernames (409) like the mongo driver', async () => {
    const token = await tokenFor('admin', 'admin');
    const body = { role: 'operator', username: 'op_sqlite', password: 'op-pass-123' };
    expect((await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send(body)).status).toBe(201);
    expect((await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send(body)).status).toBe(409);
  });

  it('creates a line (JSON columns round-trip), generates tasks, edits, then deletes it', async () => {
    const token = await tokenFor('admin', 'admin');

    const created = await request(app)
      .post('/api/lines')
      .set('Authorization', `Bearer ${token}`)
      .send(line);
    expect(created.status).toBe(201);
    const id = created.body.line.id as string;
    // Nested tanks (incl. a transfer tank) survive the JSON round-trip.
    expect(created.body.line.tanks[3]).toMatchObject({ name: '1-4B', transfer: true, cranes: ['7A', '7B'] });

    const tasks = await request(app)
      .post(`/api/lines/${id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ qr: '1-1=60;1-2=30;1-3=5;20-1=60' });
    expect(tasks.status).toBe(200);
    expect(tasks.body.tasks[1]).toMatchObject({ tank_name: '1-2', previous_task: 1, next_task: 4 });
    expect(tasks.body.tasks.find((t: { key: string }) => t.key === '20-1').tank_name).toBe('missing');

    const patched = await request(app)
      .patch(`/api/lines/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'line4-edited' });
    expect(patched.status).toBe(200);
    expect(patched.body.line.name).toBe('line4-edited');

    const del = await request(app).delete(`/api/lines/${id}`).set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
    expect((await request(app).get(`/api/lines/${id}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });
});
