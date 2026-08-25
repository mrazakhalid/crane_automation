import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { closeDb, connectDb } from '../config/db.js';
import { ensureUserIndexes } from '../repositories/user.repository.js';
import { seedSuperAdmin } from '../services/seed.js';

/**
 * Integration tests for the PLC / OPC UA endpoints.
 *
 * These do not require a live OPC UA server: they cover status, RBAC,
 * validation, and the "not connected" paths. The happy-path round-trip is
 * proven manually against a live OPC UA server (see docs/concepts/plc-opcua.md).
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
  await seedSuperAdmin();
  app = createApp();
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe('plc: status + auth', () => {
  it('401s without a token', async () => {
    const res = await request(app).get('/api/plc/state');
    expect(res.status).toBe(401);
  });

  it('reports disconnected state with configured defaults', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app).get('/api/plc/state').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.connection.state).toBe('disconnected');
    expect(res.body.defaults.endpoint).toMatch(/^opc\.tcp:\/\//);
    expect(res.body.defaults.readNode).toBeTruthy();
    expect(res.body.defaults.securityMode).toBeTruthy();
    expect(res.body.defaults.securityPolicy).toBeTruthy();
  });
});

describe('plc: validation + RBAC', () => {
  it('rejects a malformed endpoint (400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/plc/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'http://not-opc-ua' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown securityMode (enum, 400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/plc/connect')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'opc.tcp://localhost:4840', securityMode: 'Banana' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown field in a command body (strict schema, 400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/plc/command')
      .set('Authorization', `Bearer ${token}`)
      .send({ nodeId: 'ns=1;s=Coil0', dataType: 'Boolean', value: true, hax: 1 });
    expect(res.status).toBe(400);
  });

  it('blocks a manager from connecting or commanding (403) but lets them read state', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'manager', username: 'mgr_plc', password: 'mgr-pass-123' });
    const mgrToken = await tokenFor('mgr_plc', 'mgr-pass-123');

    const connect = await request(app)
      .post('/api/plc/connect')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ endpoint: 'opc.tcp://localhost:4840' });
    expect(connect.status).toBe(403);

    const state = await request(app).get('/api/plc/state').set('Authorization', `Bearer ${mgrToken}`);
    expect(state.status).toBe(200);
  });
});

describe('plc: operations without a connection', () => {
  it('409s when reading with no live connection', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .get('/api/plc/read')
      .query({ nodeId: 'ns=1;s=HR0' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('409s when commanding with no live connection', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/plc/command')
      .set('Authorization', `Bearer ${token}`)
      .send({ nodeId: 'ns=1;s=Coil0', dataType: 'Boolean', value: true });
    expect(res.status).toBe(409);
  });

  it('502s when the endpoint is unreachable', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/plc/connect')
      .set('Authorization', `Bearer ${token}`)
      // Force None security so the test stays hermetic (no PKI/cert side effects),
      // regardless of the deployment's OPCUA_SECURITY_* defaults.
      .send({ endpoint: 'opc.tcp://127.0.0.1:1', securityMode: 'None', securityPolicy: 'None' });
    expect(res.status).toBe(502);
  }, 20_000);
});

describe('plc: crane batch send', () => {
  const validLineId = '11111111-1111-4111-8111-111111111111';

  it('rejects a non-UUID lineId (400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/plc/send-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ lineId: 'not-a-uuid', qr: '1-1A=6;' });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed qr recipe (400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/plc/send-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ lineId: validLineId, qr: 'not a recipe' });
    expect(res.status).toBe(400);
  });

  it('rejects unknown fields (strict schema, 400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/plc/send-batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ lineId: validLineId, qr: '1-1A=6;', hax: 1 });
    expect(res.status).toBe(400);
  });

  it('lets a manager send (not 403) and 404s when the line does not exist', async () => {
    const adminToken = await tokenFor('admin', 'admin');
    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'manager', username: 'mgr_batch', password: 'mgr-pass-123' });
    const mgrToken = await tokenFor('mgr_batch', 'mgr-pass-123');

    const res = await request(app)
      .post('/api/plc/send-batch')
      .set('Authorization', `Bearer ${mgrToken}`)
      .send({ lineId: validLineId, qr: '1-1A=6;' });
    // The line lookup runs before any PLC I/O, so a missing line is a clean 404
    // (and crucially NOT a 403 — managers are allowed to send).
    expect(res.status).toBe(404);
  });

  it('409s on batch-status / batch-ack with no live connection', async () => {
    const token = await tokenFor('admin', 'admin');
    const status = await request(app)
      .get('/api/plc/batch-status')
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(409);

    const ack = await request(app)
      .post('/api/plc/batch-ack')
      .set('Authorization', `Bearer ${token}`);
    expect(ack.status).toBe(409);
  });

  it('409s on crane-view with no live connection', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .get('/api/plc/crane-view')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});
