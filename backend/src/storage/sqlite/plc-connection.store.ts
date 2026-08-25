import type Database from 'better-sqlite3';
import type {
  PlcConnectionRecord,
  SecurityMode,
  SecurityPolicy,
} from '../../models/plc-connection.model.js';
import type { PlcConnectionStore } from '../types.js';

/** Raw `plc_connections` row shape (isActive stored as 0/1; cranes as JSON text). */
interface PlcConnectionRow {
  _id: string;
  name: string;
  endpoint: string;
  securityMode: string;
  securityPolicy: string;
  isActive: number;
  lineId: string | null;
  cranes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Parse the JSON `cranes` column defensively (bad/empty text → []). */
function parseCranes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** Map a raw row to a domain record (coerce the 0/1 flag + JSON cranes). */
function toRecord(row: PlcConnectionRow): PlcConnectionRecord {
  return {
    _id: row._id,
    name: row.name,
    endpoint: row.endpoint,
    securityMode: row.securityMode as SecurityMode,
    securityPolicy: row.securityPolicy as SecurityPolicy,
    isActive: row.isActive === 1,
    lineId: row.lineId ?? null,
    cranes: parseCranes(row.cranes),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * SQLite-backed PLC connection store.
 *
 * Purpose: Implement the `PlcConnectionStore` contract against a
 *   `plc_connections` table. Schema (incl. UNIQUE on name) is created on open.
 * Args: db — the open database.
 * Returns: A `PlcConnectionStore`.
 */
export function sqlitePlcConnectionStore(db: Database.Database): PlcConnectionStore {
  const byId = (id: string): PlcConnectionRecord | null => {
    const row = db.prepare('SELECT * FROM plc_connections WHERE _id = ?').get(id) as
      | PlcConnectionRow
      | undefined;
    return row ? toRecord(row) : null;
  };

  return {
    async ensureIndexes() {
      // Schema (incl. UNIQUE constraints) is created when the DB is opened.
    },
    async findById(id) {
      return byId(id);
    },
    async findByName(name) {
      const row = db.prepare('SELECT * FROM plc_connections WHERE name = ?').get(name) as
        | PlcConnectionRow
        | undefined;
      return row ? toRecord(row) : null;
    },
    async findActive() {
      const row = db.prepare('SELECT * FROM plc_connections WHERE isActive = 1').get() as
        | PlcConnectionRow
        | undefined;
      return row ? toRecord(row) : null;
    },
    async listAll() {
      const rows = db
        .prepare('SELECT * FROM plc_connections ORDER BY createdAt DESC')
        .all() as PlcConnectionRow[];
      return rows.map(toRecord);
    },
    async listByLine(lineId) {
      const rows = db
        .prepare('SELECT * FROM plc_connections WHERE lineId = ? ORDER BY createdAt DESC')
        .all(lineId) as PlcConnectionRow[];
      return rows.map(toRecord);
    },
    async countAll() {
      const row = db.prepare('SELECT COUNT(*) AS n FROM plc_connections').get() as { n: number };
      return row.n;
    },
    async insert(record) {
      db.prepare(
        `INSERT INTO plc_connections
           (_id, name, endpoint, securityMode, securityPolicy, isActive, lineId, cranes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record._id,
        record.name,
        record.endpoint,
        record.securityMode,
        record.securityPolicy,
        record.isActive ? 1 : 0,
        record.lineId,
        JSON.stringify(record.cranes ?? []),
        record.createdAt,
        record.updatedAt,
      );
    },
    async update(id, patch) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (patch.name !== undefined) {
        sets.push('name = ?');
        values.push(patch.name);
      }
      if (patch.endpoint !== undefined) {
        sets.push('endpoint = ?');
        values.push(patch.endpoint);
      }
      if (patch.securityMode !== undefined) {
        sets.push('securityMode = ?');
        values.push(patch.securityMode);
      }
      if (patch.securityPolicy !== undefined) {
        sets.push('securityPolicy = ?');
        values.push(patch.securityPolicy);
      }
      if (patch.isActive !== undefined) {
        sets.push('isActive = ?');
        values.push(patch.isActive ? 1 : 0);
      }
      if (patch.lineId !== undefined) {
        sets.push('lineId = ?');
        values.push(patch.lineId);
      }
      if (patch.cranes !== undefined) {
        sets.push('cranes = ?');
        values.push(JSON.stringify(patch.cranes));
      }
      sets.push('updatedAt = ?');
      values.push(patch.updatedAt);
      const info = db
        .prepare(`UPDATE plc_connections SET ${sets.join(', ')} WHERE _id = ?`)
        .run(...values, id);
      return info.changes === 0 ? null : byId(id);
    },
    async clearActive() {
      db.prepare('UPDATE plc_connections SET isActive = 0 WHERE isActive = 1').run();
    },
    async unassignLine(lineId, updatedAt) {
      db.prepare(
        "UPDATE plc_connections SET lineId = NULL, cranes = '[]', updatedAt = ? WHERE lineId = ?",
      ).run(updatedAt, lineId);
    },
    async delete(id) {
      return db.prepare('DELETE FROM plc_connections WHERE _id = ?').run(id).changes === 1;
    },
  };
}
