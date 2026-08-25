import type Database from 'better-sqlite3';
import type { UserRecord } from '../../models/user.model.js';
import type { UserStore } from '../types.js';

/**
 * SQLite-backed user store.
 *
 * Purpose: Implement the `UserStore` contract against a `users` table using
 *   parameterized statements only (no string-built values → no injection). The
 *   UNIQUE(username) constraint enforces the same guarantee as the Mongo index.
 * Args: db — the open database.
 * Returns: A `UserStore`.
 */
export function sqliteUserStore(db: Database.Database): UserStore {
  const byId = (id: string): UserRecord | null =>
    (db.prepare('SELECT * FROM users WHERE _id = ?').get(id) as UserRecord | undefined) ?? null;

  return {
    async ensureIndexes() {
      // Schema (incl. UNIQUE constraints) is created when the DB is opened.
    },
    async findByUsername(username) {
      return (
        (db.prepare('SELECT * FROM users WHERE username = ?').get(username) as
          | UserRecord
          | undefined) ?? null
      );
    },
    async findById(id) {
      return byId(id);
    },
    async listByRoles(roles) {
      if (roles.length === 0) return [];
      const placeholders = roles.map(() => '?').join(',');
      return db
        .prepare(`SELECT * FROM users WHERE role IN (${placeholders}) ORDER BY createdAt DESC`)
        .all(...roles) as UserRecord[];
    },
    async insertUser(record) {
      db.prepare(
        `INSERT INTO users (_id, username, passwordHash, role, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        record._id,
        record.username,
        record.passwordHash,
        record.role,
        record.createdAt,
        record.updatedAt,
      );
    },
    async updateUser(id, patch) {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (patch.username !== undefined) {
        sets.push('username = ?');
        values.push(patch.username);
      }
      if (patch.passwordHash !== undefined) {
        sets.push('passwordHash = ?');
        values.push(patch.passwordHash);
      }
      sets.push('updatedAt = ?');
      values.push(patch.updatedAt);
      const info = db
        .prepare(`UPDATE users SET ${sets.join(', ')} WHERE _id = ?`)
        .run(...values, id);
      return info.changes === 0 ? null : byId(id);
    },
    async deleteUser(id) {
      return db.prepare('DELETE FROM users WHERE _id = ?').run(id).changes === 1;
    },
  };
}
