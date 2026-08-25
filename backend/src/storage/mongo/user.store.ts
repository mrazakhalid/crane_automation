import type { Collection, Db } from 'mongodb';
import type { UserRecord } from '../../models/user.model.js';
import type { UserStore } from '../types.js';

/**
 * Mongo-backed user store.
 *
 * Purpose: Implement the `UserStore` contract against a MongoDB collection.
 *   Filters use field equality only (no string-built queries) — no injection
 *   surface.
 * Args: db — the connected database.
 * Returns: A `UserStore`.
 */
export function mongoUserStore(db: Db): UserStore {
  const col = (): Collection<UserRecord> => db.collection<UserRecord>('users');
  return {
    async ensureIndexes() {
      await col().createIndex({ username: 1 }, { unique: true });
    },
    findByUsername: (username) => col().findOne({ username }),
    findById: (id) => col().findOne({ _id: id }),
    listByRoles: (roles) => col().find({ role: { $in: roles } }).sort({ createdAt: -1 }).toArray(),
    async insertUser(record) {
      await col().insertOne(record);
    },
    updateUser: (id, patch) =>
      col().findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: 'after' }),
    async deleteUser(id) {
      const result = await col().deleteOne({ _id: id });
      return result.deletedCount === 1;
    },
  };
}
