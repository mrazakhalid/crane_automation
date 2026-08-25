import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { closeDb, connectDb } from '../config/db.js';
import { ensurePlcConnectionIndexes } from '../repositories/plc-connection.repository.js';
import { ensurePlcTagIndexes } from '../repositories/plc-tag.repository.js';
import { ensureUserIndexes } from '../repositories/user.repository.js';
import { seedSuperAdmin } from '../services/seed.js';

/**
 * Integration tests for the PLC Manager (saved connections + tag mappings),
 * including RBAC, strict validation, active-connection semantics, and how the
 * active connection drives GET /api/plc/state. Uses in-memory MongoDB.
 */
let app: Express;

async function tokenFor(username: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

const connPayload = {
  name: 'Sim S7-1500',
  endpoint: 'opc.tcp://192.168.50.1:4840',
  securityMode: 'None',
  securityPolicy: 'None',
};

beforeAll(async () => {
  await connectDb();
  await ensureUserIndexes();
  await ensurePlcConnectionIndexes();
  await ensurePlcTagIndexes();
  await seedSuperAdmin();
  app = createApp();

  // A manager account to prove the super-admin gate.
  const admin = await tokenFor('admin', 'admin');
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${admin}`)
    .send({ role: 'manager', username: 'mgr_plc', password: 'mgr-pass-123' });
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe('plc-connections: CRUD + RBAC', () => {
  it('creates a connection (first one is active) and rejects a duplicate name (409)', async () => {
    const token = await tokenFor('admin', 'admin');
    const created = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send(connPayload);
    expect(created.status).toBe(201);
    expect(created.body.connection.id).toBeTruthy();
    expect(created.body.connection.isActive).toBe(true); // first connection auto-active

    const dupe = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send(connPayload);
    expect(dupe.status).toBe(409);
  });

  it('rejects unknown fields and a bad endpoint (400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const unknown = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'X', hax: true });
    expect(unknown.status).toBe(400);

    const badUrl = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'Y', endpoint: 'http://nope' });
    expect(badUrl.status).toBe(400);
  });

  it('blocks a manager from the whole PLC Manager (403)', async () => {
    const mgr = await tokenFor('mgr_plc', 'mgr-pass-123');
    const list = await request(app)
      .get('/api/plc-connections')
      .set('Authorization', `Bearer ${mgr}`);
    expect(list.status).toBe(403);
    const create = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${mgr}`)
      .send({ ...connPayload, name: 'Nope' });
    expect(create.status).toBe(403);
  });

  it('activating a second connection deactivates the first (single active)', async () => {
    const token = await tokenFor('admin', 'admin');
    const second = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'Second PLC' });
    expect(second.status).toBe(201);
    expect(second.body.connection.isActive).toBe(false); // not the first

    const activated = await request(app)
      .post(`/api/plc-connections/${second.body.connection.id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    expect(activated.status).toBe(200);
    expect(activated.body.connection.isActive).toBe(true);

    const list = await request(app)
      .get('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`);
    const active = list.body.connections.filter((c: { isActive: boolean }) => c.isActive);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(second.body.connection.id);
  });
});

describe('plc-connections: tag mappings', () => {
  /** Create a fresh connection and return its id. */
  async function makeConn(token: string, name: string): Promise<string> {
    const res = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name });
    expect(res.status).toBe(201);
    return res.body.connection.id as string;
  }

  it('adds read/write tags, rejects a duplicate label (409), and lists them', async () => {
    const token = await tokenFor('admin', 'admin');
    const id = await makeConn(token, 'Tagged PLC');

    const read = await request(app)
      .post(`/api/plc-connections/${id}/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'cycle_count', nodeId: 'ns=3;s="PlcData"."cycle_count"', dataType: 'Int16', direction: 'read' });
    expect(read.status).toBe(201);
    expect(read.body.tag.label).toBe('cycle_count');

    const write = await request(app)
      .post(`/api/plc-connections/${id}/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'run', nodeId: 'ns=3;s="PlcData"."run"', dataType: 'Boolean', direction: 'write' });
    expect(write.status).toBe(201);

    const dupe = await request(app)
      .post(`/api/plc-connections/${id}/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'run', nodeId: 'ns=3;s="PlcData"."reset"', dataType: 'Boolean', direction: 'write' });
    expect(dupe.status).toBe(409);

    const list = await request(app)
      .get(`/api/plc-connections/${id}/tags`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.tags).toHaveLength(2);
  });

  it('edits then deletes a tag (204)', async () => {
    const token = await tokenFor('admin', 'admin');
    const id = await makeConn(token, 'Edit Tags PLC');
    const created = await request(app)
      .post(`/api/plc-connections/${id}/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'temp', nodeId: 'ns=2;i=1', dataType: 'Float', direction: 'read' });
    const tagId = created.body.tag.id as string;

    const patched = await request(app)
      .patch(`/api/plc-connections/${id}/tags/${tagId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'temperature' });
    expect(patched.status).toBe(200);
    expect(patched.body.tag.label).toBe('temperature');

    const del = await request(app)
      .delete(`/api/plc-connections/${id}/tags/${tagId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });

  it('deleting a connection cascades its tags', async () => {
    const token = await tokenFor('admin', 'admin');
    const id = await makeConn(token, 'Cascade PLC');
    await request(app)
      .post(`/api/plc-connections/${id}/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'x', nodeId: 'ns=2;i=9', dataType: 'Int16', direction: 'read' });

    const del = await request(app)
      .delete(`/api/plc-connections/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const tags = await request(app)
      .get(`/api/plc-connections/${id}/tags`)
      .set('Authorization', `Bearer ${token}`);
    expect(tags.status).toBe(404); // connection gone
  });
});

describe('plc-connections: line + crane binding (many PLCs per line)', () => {
  /** Create a line with the given cranes (one tank per crane) and return its id. */
  async function makeLine(token: string, name: string, cranes: string[]): Promise<string> {
    const tanks = cranes.map((c, i) => ({ number: i + 1, name: `T-${i + 1}`, crane: c }));
    const res = await request(app)
      .post('/api/lines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, cranes, tanks });
    expect(res.status).toBe(201);
    return res.body.line.id as string;
  }

  it('assigns a PLC to a line + a subset of its cranes', async () => {
    const token = await tokenFor('admin', 'admin');
    const lineId = await makeLine(token, 'bind-line-1', ['6', '7A', '7B']);
    const res = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'PLC bind A', lineId, cranes: ['6', '7A'] });
    expect(res.status).toBe(201);
    expect(res.body.connection.lineId).toBe(lineId);
    expect(res.body.connection.cranes).toEqual(['6', '7A']);
  });

  it('rejects a crane that is not part of the line (400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const lineId = await makeLine(token, 'bind-line-2', ['6', '7A']);
    const res = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'PLC bad crane', lineId, cranes: ['99'] });
    expect(res.status).toBe(400);
  });

  it('rejects cranes given without a line (400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'PLC no line', cranes: ['6'] });
    expect(res.status).toBe(400);
  });

  it('lets a line span two PLCs but rejects a crane already owned by another PLC (409)', async () => {
    const token = await tokenFor('admin', 'admin');
    const lineId = await makeLine(token, 'bind-line-4', ['6', '7A', '7B']);

    const first = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'Line4 PLC_4', lineId, cranes: ['6', '7A'] });
    expect(first.status).toBe(201);

    // Same crane on the same line → conflict.
    const clash = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'Line4 clash', lineId, cranes: ['7A'] });
    expect(clash.status).toBe(409);

    // A *different* crane on the same line → allowed (Line 4 = PLC_4 + PLC_6).
    const second = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'Line4 PLC_6', lineId, cranes: ['7B'] });
    expect(second.status).toBe(201);
  });

  it('filters the connection list by lineId, and rejects a non-UUID lineId (400)', async () => {
    const token = await tokenFor('admin', 'admin');
    const lineId = await makeLine(token, 'bind-line-5', ['8', '9']);
    await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'PLC filter', lineId, cranes: ['8'] });

    const filtered = await request(app)
      .get('/api/plc-connections')
      .query({ lineId })
      .set('Authorization', `Bearer ${token}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.connections.length).toBe(1);
    expect(filtered.body.connections[0].cranes).toEqual(['8']);

    const bad = await request(app)
      .get('/api/plc-connections')
      .query({ lineId: 'not-a-uuid' })
      .set('Authorization', `Bearer ${token}`);
    expect(bad.status).toBe(400);
  });

  it('unassigns a PLC (nulls lineId, clears cranes) when its line is deleted', async () => {
    const token = await tokenFor('admin', 'admin');
    const lineId = await makeLine(token, 'bind-line-6', ['1A', '1B']);
    const conn = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'PLC to orphan', lineId, cranes: ['1A'] });
    const connId = conn.body.connection.id as string;

    const del = await request(app)
      .delete(`/api/lines/${lineId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const list = await request(app)
      .get('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`);
    const orphan = list.body.connections.find((c: { id: string }) => c.id === connId);
    expect(orphan.lineId).toBeNull();
    expect(orphan.cranes).toEqual([]);
  });
});

describe('plc-connections: per-connection connect / disconnect / status', () => {
  it('lists pool status (array) for super-admin, blocks managers (403)', async () => {
    const token = await tokenFor('admin', 'admin');
    const res = await request(app)
      .get('/api/plc-connections/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.statuses)).toBe(true);

    const mgr = await tokenFor('mgr_plc', 'mgr-pass-123');
    const blocked = await request(app)
      .get('/api/plc-connections/status')
      .set('Authorization', `Bearer ${mgr}`);
    expect(blocked.status).toBe(403);
  });

  it('404s connecting/disconnecting an unknown connection', async () => {
    const token = await tokenFor('admin', 'admin');
    const missing = '99999999-9999-4999-8999-999999999999';
    const conn = await request(app)
      .post(`/api/plc-connections/${missing}/connect`)
      .set('Authorization', `Bearer ${token}`);
    expect(conn.status).toBe(404);
    const disc = await request(app)
      .post(`/api/plc-connections/${missing}/disconnect`)
      .set('Authorization', `Bearer ${token}`);
    expect(disc.status).toBe(404);
  });

  it('disconnect is idempotent on a never-connected PLC (200, disconnected)', async () => {
    const token = await tokenFor('admin', 'admin');
    const created = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'Disc PLC', endpoint: 'opc.tcp://10.0.0.55:4840' });
    const id = created.body.connection.id as string;
    const res = await request(app)
      .post(`/api/plc-connections/${id}/disconnect`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status.state).toBe('disconnected');
  });
});

describe('plc state reflects the active connection', () => {
  it('GET /api/plc/state returns the active connection defaults + tags', async () => {
    const token = await tokenFor('admin', 'admin');
    const create = await request(app)
      .post('/api/plc-connections')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...connPayload, name: 'State PLC', endpoint: 'opc.tcp://10.0.0.9:4840' });
    const id = create.body.connection.id as string;
    await request(app)
      .post(`/api/plc-connections/${id}/activate`)
      .set('Authorization', `Bearer ${token}`);
    await request(app)
      .post(`/api/plc-connections/${id}/tags`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'counter', nodeId: 'ns=3;s="PlcData"."cycle_count"', dataType: 'Int16', direction: 'read' });

    const state = await request(app).get('/api/plc/state').set('Authorization', `Bearer ${token}`);
    expect(state.status).toBe(200);
    expect(state.body.active.id).toBe(id);
    expect(state.body.defaults.endpoint).toBe('opc.tcp://10.0.0.9:4840');
    expect(state.body.defaults.readNode).toBe('ns=3;s="PlcData"."cycle_count"');
    expect(state.body.tags.length).toBeGreaterThanOrEqual(1);
  });
});
