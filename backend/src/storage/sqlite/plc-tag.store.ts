import type Database from 'better-sqlite3';
import type { PlcTagRecord, TagDataType, TagDirection } from '../../models/plc-tag.model.js';
import type { PlcTagStore } from '../types.js';

/** Raw `plc_tags` row shape. */
interface PlcTagRow {
  _id: string;
  connectionId: string;
  label: string;
  nodeId: string;
  dataType: string;
  direction: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Map a raw row to a domain record. */
function toRecord(row: PlcTagRow): PlcTagRecord {
  return {
    _id: row._id,
    connectionId: row.connectionId,
    label: row.label,
    nodeId: row.nodeId,
    dataType: row.dataType as TagDataType,
    direction: row.direction as TagDirection,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * SQLite-backed PLC tag-mapping store.
 *
 * Purpose: Implement the `PlcTagStore` contract against a `plc_tags` table.
 *   `(connectionId, label)` is unique (created on open).
 * Args: db — the open database.
 * Returns: A `PlcTagStore`.
 */
export function sqlitePlcTagStore(db: Database.Database): PlcTagStore {
  const byId = (id: string): PlcTagRecord | null => {
    const row = db.prepare('SELECT * FROM plc_tags WHERE _id = ?').get(id) as PlcTagRow | undefined;
    return row ? toRecord(row) : null;
  };

  return {
    async ensureIndexes() {
      // Schema (incl. UNIQUE constraints) is created when the DB is opened.
    },
    async findById(id) {
      return byId(id);
    },
    async findByLabel(connectionId, label) {
      const row = db
        .prepare('SELECT * FROM plc_tags WHERE connectionId = ? AND label = ?')
        .get(connectionId, label) as PlcTagRow | undefined;
      return row ? toRecord(row) : null;
    },
    async listByConnection(connectionId) {
      const rows = db
        .prepare('SELECT * FROM plc_tags WHERE connectionId = ? ORDER BY createdAt ASC')
        .all(connectionId) as PlcTagRow[];
      return rows.map(toRecord);
    },
    async insert(record) {
      db.prepare(
        `INSERT INTO plc_tags
           (_id, connectionId, label, nodeId, dataType, direction, description, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record._id,
        record.connectionId,
        record.label,
        record.nodeId,
        record.dataType,
        record.direction,
        record.description,
        record.createdAt,
        record.updatedAt,
      );
    },
    async update(id, patch) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (patch.label !== undefined) {
        sets.push('label = ?');
        values.push(patch.label);
      }
      if (patch.nodeId !== undefined) {
        sets.push('nodeId = ?');
        values.push(patch.nodeId);
      }
      if (patch.dataType !== undefined) {
        sets.push('dataType = ?');
        values.push(patch.dataType);
      }
      if (patch.direction !== undefined) {
        sets.push('direction = ?');
        values.push(patch.direction);
      }
      if (patch.description !== undefined) {
        sets.push('description = ?');
        values.push(patch.description);
      }
      sets.push('updatedAt = ?');
      values.push(patch.updatedAt);
      const info = db
        .prepare(`UPDATE plc_tags SET ${sets.join(', ')} WHERE _id = ?`)
        .run(...values, id);
      return info.changes === 0 ? null : byId(id);
    },
    async delete(id) {
      return db.prepare('DELETE FROM plc_tags WHERE _id = ?').run(id).changes === 1;
    },
    async deleteByConnection(connectionId) {
      return db.prepare('DELETE FROM plc_tags WHERE connectionId = ?').run(connectionId).changes;
    },
  };
}
