import * as connRepo from '../repositories/plc-connection.repository.js';
import * as lineRepo from '../repositories/line.repository.js';
import { newId } from '../utils/id.js';
import { PLANT_LINES, PLANT_PLCS } from './seed-plant-data.js';

/**
 * Bootstrap the fixed plant layout (idempotent).
 *
 * Purpose: On an empty database, insert the real 5 lines (with their ordered
 *   tanks) and the 6 per-panel PLC connections (bound to their line + cranes,
 *   PLC_4 active). This makes a fresh install — notably the offline desktop's
 *   SQLite file — come pre-populated instead of blank, so the layout survives a
 *   rebuild/reinstall without manual re-entry.
 *
 * Safety: runs on every boot but only writes when there are NO lines yet, so it
 *   never clobbers a plant an operator has since edited. Connections are only
 *   seeded when none exist, so it also won't duplicate the `.env` fallback one.
 *
 * Returns: `true` if the layout was seeded, `false` if lines already existed.
 */
export async function seedPlantLayout(): Promise<boolean> {
  if ((await lineRepo.listAll()).length > 0) return false;

  const now = new Date().toISOString();
  const lineIdByName = new Map<string, string>();

  for (const line of PLANT_LINES) {
    const _id = newId();
    lineIdByName.set(line.name, _id);
    await lineRepo.insertLine({
      _id,
      name: line.name,
      cranes: line.cranes,
      tanks: line.tanks,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Only seed connections if none exist, so we don't collide with a connection
  // already created from the `.env` defaults (seedConnectionFromEnv).
  if ((await connRepo.countAll()) === 0) {
    for (const plc of PLANT_PLCS) {
      await connRepo.insert({
        _id: newId(),
        name: plc.name,
        endpoint: plc.endpoint,
        securityMode: 'None',
        securityPolicy: 'None',
        isActive: plc.active,
        lineId: lineIdByName.get(plc.line) ?? null,
        cranes: plc.cranes,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return true;
}
