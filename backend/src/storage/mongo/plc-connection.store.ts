import type { Collection, Db } from 'mongodb';
import type { PlcConnectionRecord } from '../../models/plc-connection.model.js';
import type { PlcConnectionStore } from '../types.js';

/**
 * Mongo-backed PLC connection store.
 *
 * Purpose: Implement the `PlcConnectionStore` contract against a MongoDB
 *   collection. Filters use field equality only (no string-built queries).
 * Args: db — the connected database.
 * Returns: A `PlcConnectionStore`.
 */
export function mongoPlcConnectionStore(db: Db): PlcConnectionStore {
  const col = (): Collection<PlcConnectionRecord> =>
    db.collection<PlcConnectionRecord>('plc_connections');
  return {
    async ensureIndexes() {
      await col().createIndex({ name: 1 }, { unique: true });
      await col().createIndex({ lineId: 1 });
    },
    findById: (id) => col().findOne({ _id: id }),
    findByName: (name) => col().findOne({ name }),
    findActive: () => col().findOne({ isActive: true }),
    listAll: () => col().find().sort({ createdAt: -1 }).toArray(),
    listByLine: (lineId) => col().find({ lineId }).sort({ createdAt: -1 }).toArray(),
    countAll: () => col().countDocuments(),
    async insert(record) {
      await col().insertOne(record);
    },
    update: (id, patch) =>
      col().findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: 'after' }),
    async clearActive() {
      await col().updateMany({ isActive: true }, { $set: { isActive: false } });
    },
    async unassignLine(lineId, updatedAt) {
      await col().updateMany({ lineId }, { $set: { lineId: null, cranes: [], updatedAt } });
    },
    async delete(id) {
      const result = await col().deleteOne({ _id: id });
      return result.deletedCount === 1;
    },
  };
}
