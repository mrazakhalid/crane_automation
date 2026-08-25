import type { Collection, Db } from 'mongodb';
import type { LineRecord } from '../../models/line.model.js';
import type { LineStore } from '../types.js';

/**
 * Mongo-backed line store.
 *
 * Purpose: Implement the `LineStore` contract against a MongoDB collection.
 * Args: db — the connected database.
 * Returns: A `LineStore`.
 */
export function mongoLineStore(db: Db): LineStore {
  const col = (): Collection<LineRecord> => db.collection<LineRecord>('lines');
  return {
    async ensureIndexes() {
      await col().createIndex({ name: 1 }, { unique: true });
    },
    findByName: (name) => col().findOne({ name }),
    findById: (id) => col().findOne({ _id: id }),
    listAll: () => col().find().sort({ createdAt: -1 }).toArray(),
    async insertLine(record) {
      await col().insertOne(record);
    },
    updateLine: (id, patch) =>
      col().findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: 'after' }),
    async deleteLine(id) {
      const result = await col().deleteOne({ _id: id });
      return result.deletedCount === 1;
    },
  };
}
