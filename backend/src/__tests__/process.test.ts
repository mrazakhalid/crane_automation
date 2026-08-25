import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { closeDb, connectDb } from '../config/db.js';
import { ensureLineIndexes } from '../repositories/line.repository.js';
import { ensurePlcConnectionIndexes } from '../repositories/plc-connection.repository.js';
import { ensureUserIndexes } from '../repositories/user.repository.js';
import { seedSuperAdmin } from '../services/seed.js';

/**
 * Integration tests for the cross-line process flow: plan a recipe against the
 * saved lines, start a live run, poll its status, and stop it.
 */
let app: Express;

async function tokenFor(username: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

beforeAll(async () => {
  await connectDb();
  await ensureUserIndexes();
  await ensureLineIndexes();
  await ensurePlcConnectionIndexes();
  await seedSuperAdmin();
  app = createApp();

  // Seed one line so recipe keys resolve.
  const adminToken = await tokenFor('admin', 'admin');
  await request(app)
    .post('/api/lines')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'lineP',
      cranes: ['7A', '6'],
      tanks: [
        { number: 1, name: '1-1A', crane: '7A' },
        { number: 2, name: '1-2', crane: '7A' },
        { number: 11, name: '1-8', crane: '6' },
      ],
    });
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe('process: plan', () => {
  it('divides a recipe into groups and flags missing keys', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/process/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ qr: '1-1A=6;1-8=4;20-9=5' });
    expect(res.status).toBe(200);

    const { plan } = res.body as { plan: { counts: Record<string, number>; missing: unknown[]; steps: unknown[] } };
    expect(plan.counts.total).toBe(3);
    expect(plan.counts.missing).toBe(1);
    expect(plan.missing).toHaveLength(1);
    expect(plan.steps).toHaveLength(3);
  });

  it('400s on malformed QR and 401s without a token', async () => {
    const token = await tokenFor('admin', 'admin');
    const bad = await request(app)
      .post('/api/process/plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ qr: 'nope' });
    expect(bad.status).toBe(400);

    const noAuth = await request(app).post('/api/process/plan').send({ qr: '1-1A=6' });
    expect(noAuth.status).toBe(401);
  });
});

describe('process: start → status → stop', () => {
  it('starts a run, polls its status, and stops it', async () => {
    const token = await tokenFor('admin', 'admin');
    const start = await request(app)
      .post('/api/process/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ qr: '1-1A=6;1-2=3' });
    expect(start.status).toBe(201);
    const runId = start.body.runId as string;
    expect(runId).toBeTruthy();

    const status = await request(app)
      .get(`/api/process/${runId}/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.status.runId).toBe(runId);
    expect(Array.isArray(status.body.status.steps)).toBe(true);

    const stop = await request(app)
      .post(`/api/process/${runId}/stop`)
      .set('Authorization', `Bearer ${token}`);
    expect(stop.status).toBe(204);

    // After stop the run is gone → 404.
    const after = await request(app)
      .get(`/api/process/${runId}/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(404);
  });
});
