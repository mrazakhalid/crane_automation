import type Database from 'better-sqlite3';
import type { RecipeRecord, StepOverrides } from '../../models/recipe.model.js';
import type { RecipeStore } from '../types.js';

/** Raw `recipes` row shape (`overrides` is stored as JSON text). */
interface RecipeRow {
  _id: string;
  name: string;
  qr: string;
  overrides: string;
  createdAt: string;
  updatedAt: string;
}

/** Map a raw row to a domain `RecipeRecord`, parsing the JSON column. */
function toRecord(row: RecipeRow): RecipeRecord {
  return {
    _id: row._id,
    name: row.name,
    qr: row.qr,
    overrides: JSON.parse(row.overrides) as StepOverrides,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * SQLite-backed recipe store.
 *
 * Purpose: Implement the `RecipeStore` contract against a `recipes` table.
 *   `overrides` is persisted as a JSON text column.
 * Args: db — the open database.
 * Returns: A `RecipeStore`.
 */
export function sqliteRecipeStore(db: Database.Database): RecipeStore {
  const byId = (id: string): RecipeRecord | null => {
    const row = db.prepare('SELECT * FROM recipes WHERE _id = ?').get(id) as RecipeRow | undefined;
    return row ? toRecord(row) : null;
  };

  return {
    async ensureIndexes() {
      // Schema (incl. UNIQUE constraints) is created when the DB is opened.
    },
    async findByName(name) {
      const row = db.prepare('SELECT * FROM recipes WHERE name = ?').get(name) as
        | RecipeRow
        | undefined;
      return row ? toRecord(row) : null;
    },
    async findById(id) {
      return byId(id);
    },
    async listAll() {
      const rows = db.prepare('SELECT * FROM recipes ORDER BY createdAt DESC').all() as RecipeRow[];
      return rows.map(toRecord);
    },
    async insertRecipe(record) {
      db.prepare(
        `INSERT INTO recipes (_id, name, qr, overrides, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        record._id,
        record.name,
        record.qr,
        JSON.stringify(record.overrides),
        record.createdAt,
        record.updatedAt,
      );
    },
    async updateRecipe(id, patch) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (patch.name !== undefined) {
        sets.push('name = ?');
        values.push(patch.name);
      }
      if (patch.qr !== undefined) {
        sets.push('qr = ?');
        values.push(patch.qr);
      }
      if (patch.overrides !== undefined) {
        sets.push('overrides = ?');
        values.push(JSON.stringify(patch.overrides));
      }
      sets.push('updatedAt = ?');
      values.push(patch.updatedAt);
      const info = db
        .prepare(`UPDATE recipes SET ${sets.join(', ')} WHERE _id = ?`)
        .run(...values, id);
      return info.changes === 0 ? null : byId(id);
    },
    async deleteRecipe(id) {
      return db.prepare('DELETE FROM recipes WHERE _id = ?').run(id).changes === 1;
    },
  };
}
