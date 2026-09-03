import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, connectDb } from '../config/db.js';
import { ensureLineIndexes } from '../repositories/line.repository.js';
import { ensurePlcConnectionIndexes } from '../repositories/plc-connection.repository.js';
import { seedPlantLayout } from '../services/seed-plant.js';
import { getPlantView } from '../services/plant-view.service.js';

/**
 * Verifies the plant-view aggregation over the seeded layout. With no PLC
 * connected (the pool is empty in tests), every crane must come back
 * `connected:false` with a null view and an "offline" note — the view must never
 * throw on unreachable PLCs. Also checks Line 4 fans out across both its PLCs.
 */
beforeAll(async () => {
  await connectDb();
  await ensureLineIndexes();
  await ensurePlcConnectionIndexes();
  await seedPlantLayout();
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe('getPlantView', () => {
  it('returns all 5 lines with their ordered tanks', async () => {
    const { lines } = await getPlantView();
    expect(lines).toHaveLength(5);
    const line4 = lines.find((l) => l.lineName === 'line4');
    expect(line4?.tanks[0]).toMatchObject({ number: 1, name: '1-1A', crane: '7A' });
    // tanks stay in ascending station order
    const numbers = line4!.tanks.map((t) => t.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it('marks every crane offline (no PLC connected) without throwing', async () => {
    const { lines } = await getPlantView();
    for (const line of lines) {
      for (const cv of line.cranesView) {
        expect(cv.connected).toBe(false);
        expect(cv.view).toBeNull();
        expect(cv.error).toBe('PLC offline');
      }
    }
  });

  it('fans Line 4 across PLC_4 (6, 7A) and PLC_6 (7B)', async () => {
    const { lines } = await getPlantView();
    const line4 = lines.find((l) => l.lineName === 'line4');
    const cranes = line4!.cranesView.map((c) => c.crane).sort();
    expect(cranes).toEqual(['6', '7A', '7B']);
    const plc6 = line4!.cranesView.find((c) => c.crane === '7B');
    expect(plc6?.plcName).toBe('PLC_6');
  });
});
