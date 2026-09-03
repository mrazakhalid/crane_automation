import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, connectDb } from '../config/db.js';
import { ensureLineIndexes } from '../repositories/line.repository.js';
import { ensurePlcConnectionIndexes } from '../repositories/plc-connection.repository.js';
import * as connRepo from '../repositories/plc-connection.repository.js';
import * as lineRepo from '../repositories/line.repository.js';
import { toPublicLine } from '../models/line.model.js';
import { resolveTank } from '../services/task-generator.js';
import { seedPlantLayout } from '../services/seed-plant.js';

/**
 * Verifies the default plant-layout bootstrap: it seeds the real 5 lines + 6 PLC
 * connections, is idempotent, keeps tank `station = number + 1` consistent with
 * the PLC IOMaps, and binds each PLC's cranes to a subset of its line. Uses the
 * in-memory Mongo driver (same as the other integration tests).
 */
beforeAll(async () => {
  await connectDb();
  await ensureLineIndexes();
  await ensurePlcConnectionIndexes();
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe('seedPlantLayout', () => {
  it('seeds 5 lines and 6 PLC connections on an empty DB', async () => {
    expect(await seedPlantLayout()).toBe(true);
    expect(await lineRepo.listAll()).toHaveLength(5);
    expect(await connRepo.countAll()).toBe(6);
  });

  it('is idempotent — a second run is a no-op', async () => {
    expect(await seedPlantLayout()).toBe(false);
    expect(await lineRepo.listAll()).toHaveLength(5);
    expect(await connRepo.countAll()).toBe(6);
  });

  it('activates exactly one connection (PLC_4, the reference target)', async () => {
    const active = await connRepo.findActive();
    expect(active?.name).toBe('PLC_4');
  });

  it('routes Line 4 across PLC_4 (6, 7A) and PLC_6 (7B)', async () => {
    const line4 = await lineRepo.findByName('line4');
    expect(line4).toBeTruthy();
    const conns = await connRepo.listByLine(line4!._id);
    const byName = Object.fromEntries(conns.map((c) => [c.name, c.cranes]));
    expect(byName.PLC_4).toEqual(['6', '7A']);
    expect(byName.PLC_6).toEqual(['7B']);
  });

  it('keeps every PLC crane a subset of its line, with no crane owned twice', async () => {
    for (const line of await lineRepo.listAll()) {
      const valid = new Set(line.cranes);
      const seen = new Set<string>();
      for (const conn of await connRepo.listByLine(line._id)) {
        for (const c of conn.cranes) {
          expect(valid.has(c)).toBe(true);
          expect(seen.has(c)).toBe(false);
          seen.add(c);
        }
      }
    }
  });

  it('resolves a recipe tank name to the PLC station (number + 1) and crane', async () => {
    const line4 = await lineRepo.findByName('line4');
    const tank = resolveTank(toPublicLine(line4!), '1-1A');
    expect(tank?.number).toBe(1); // station 2 on the PLC (ls_at[2] = 1-1A on crane 7A)
    expect(tank?.crane).toBe('7A');
  });
});
