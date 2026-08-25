import type { Collection, Db } from 'mongodb';
import type { PlcTagRecord } from '../../models/plc-tag.model.js';
import type { PlcTagStore } from '../types.js';

/**
 * Mongo-backed PLC tag-mapping store.
 *
 * Purpose: Implement the `PlcTagStore` contract against a MongoDB collection.
 *   `label` is unique per connection (compound index).
 * Args: db — the connected database.
 * Returns: A `PlcTagStore`.
 */
export function mongoPlcTagStore(db: Db): PlcTagStore {
  const col = (): Collection<PlcTagRecord> => db.collection<PlcTagRecord>('plc_tags');
  return {
    async ensureIndexes() {
      await col().createIndex({ connectionId: 1, label: 1 }, { unique: true });
    },
    findById: (id) => col().findOne({ _id: id }),
    findByLabel: (connectionId, label) => col().findOne({ connectionId, label }),
    listByConnection: (connectionId) =>
      col().find({ connectionId }).sort({ createdAt: 1 }).toArray(),
    async insert(record) {
      await col().insertOne(record);
    },
    update: (id, patch) =>
      col().findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: 'after' }),
    async delete(id) {
      const result = await col().deleteOne({ _id: id });
      return result.deletedCount === 1;
    },
    async deleteByConnection(connectionId) {
      const result = await col().deleteMany({ connectionId });
      return result.deletedCount ?? 0;
    },
  };
}
