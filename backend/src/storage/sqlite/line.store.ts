import type Database from 'better-sqlite3';
import type { LineRecord, Tank } from '../../models/line.model.js';
import type { LineStore } from '../types.js';

/** Raw `lines` row shape (cranes/tanks are stored as JSON text). */
interface LineRow {
  _id: string;
  name: string;
  cranes: string;
  tanks: string;
  createdAt: string;
  updatedAt: string;
}

/** Map a raw row to a domain `LineRecord`, parsing the JSON columns. */
function toRecord(row: LineRow): LineRecord {
  return {
    _id: row._id,
    name: row.name,
    cranes: JSON.parse(row.cranes) as string[],
    tanks: JSON.parse(row.tanks) as Tank[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * SQLite-backed line store.
 *
 * Purpose: Implement the `LineStore` contract against a `lines` table. Cranes
 *   and tanks are persisted as JSON text columns, preserving the nested
 *   document shape without a separate table.
 * Args: db — the open database.
 * Returns: A `LineStore`.
 */
export function sqliteLineStore(db: Database.Database): LineStore {
  const byId = (id: string): LineRecord | null => {
    const row = db.prepare('SELECT * FROM lines WHERE _id = ?').get(id) as LineRow | undefined;
    return row ? toRecord(row) : null;
  };

  return {
    async ensureIndexes() {
      // Schema (incl. UNIQUE constraints) is created when the DB is opened.
    },
    async findByName(name) {
      const row = db.prepare('SELECT * FROM lines WHERE name = ?').get(name) as LineRow | undefined;
      return row ? toRecord(row) : null;
    },
    async findById(id) {
      return byId(id);
    },
    async listAll() {
      const rows = db.prepare('SELECT * FROM lines ORDER BY createdAt DESC').all() as LineRow[];
      return rows.map(toRecord);
    },
    async insertLine(record) {
      db.prepare(
        `INSERT INTO lines (_id, name, cranes, tanks, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        record._id,
        record.name,
        JSON.stringify(record.cranes),
        JSON.stringify(record.tanks),
        record.createdAt,
        record.updatedAt,
      );
    },
    async updateLine(id, patch) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (patch.name !== undefined) {
        sets.push('name = ?');
        values.push(patch.name);
      }
      if (patch.cranes !== undefined) {
        sets.push('cranes = ?');
        values.push(JSON.stringify(patch.cranes));
      }
      if (patch.tanks !== undefined) {
        sets.push('tanks = ?');
        values.push(JSON.stringify(patch.tanks));
      }
      sets.push('updatedAt = ?');
      values.push(patch.updatedAt);
      const info = db
        .prepare(`UPDATE lines SET ${sets.join(', ')} WHERE _id = ?`)
        .run(...values, id);
      return info.changes === 0 ? null : byId(id);
    },
    async deleteLine(id) {
      return db.prepare('DELETE FROM lines WHERE _id = ?').run(id).changes === 1;
    },
  };
}
