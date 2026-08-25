import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../app.js';
import { closeDb, connectDb } from '../config/db.js';
import { ensureRecipeIndexes } from '../repositories/recipe.repository.js';
import { ensureUserIndexes } from '../repositories/user.repository.js';
import { seedSuperAdmin } from '../services/seed.js';

/**
 * Integration tests for recipe persistence (in-memory MongoDB): CRUD, RBAC,
 * uniqueness (409), strict-body rejection, and QR validation.
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
  await ensureRecipeIndexes();
  await seedSuperAdmin();
  app = createApp();
  // A manager account — recipes are a manager/super-admin feature.
  const adminToken = await tokenFor('admin', 'admin');
  await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'manager', username: 'mgr_rec', password: 'mgr-pass-123' });
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe('recipes: CRUD + RBAC', () => {
  it('lets a manager save a recipe and rejects a duplicate name (409)', async () => {
    const token = await tokenFor('mgr_rec', 'mgr-pass-123');
    const created = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nickel A', qr: '1-1A=60;5-2=30' });
    expect(created.status).toBe(201);
    expect(created.body.recipe).toMatchObject({ name: 'Nickel A', qr: '1-1A=60;5-2=30' });
    expect(created.body.recipe.id).toBeTruthy();

    const dupe = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nickel A', qr: '1-1A=10' });
    expect(dupe.status).toBe(409);
  });

  it('rejects unknown fields and malformed QR (400)', async () => {
    const token = await tokenFor('mgr_rec', 'mgr-pass-123');
    const unknown = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad', qr: '1-1A=5', hax: true });
    expect(unknown.status).toBe(400);

    const badQr = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad2', qr: 'not-a-recipe' });
    expect(badQr.status).toBe(400);
  });

  it('requires authentication (401 without a token)', async () => {
    const res = await request(app).get('/api/recipes');
    expect(res.status).toBe(401);
  });

  it('lists, fetches, edits, and deletes a recipe', async () => {
    const token = await tokenFor('mgr_rec', 'mgr-pass-123');
    const created = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Edit Me', qr: '1-2=15' });
    const id = created.body.recipe.id as string;

    const list = await request(app).get('/api/recipes').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.recipes.length).toBeGreaterThanOrEqual(1);

    const patched = await request(app)
      .patch(`/api/recipes/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Edited', qr: '1-2=20;1-3=5' });
    expect(patched.status).toBe(200);
    expect(patched.body.recipe).toMatchObject({ name: 'Edited', qr: '1-2=20;1-3=5' });

    const del = await request(app)
      .delete(`/api/recipes/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);

    const got = await request(app).get(`/api/recipes/${id}`).set('Authorization', `Bearer ${token}`);
    expect(got.status).toBe(404);
  });
});
