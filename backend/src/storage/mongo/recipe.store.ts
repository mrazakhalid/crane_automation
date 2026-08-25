import type { Collection, Db } from 'mongodb';
import type { RecipeRecord } from '../../models/recipe.model.js';
import type { RecipeStore } from '../types.js';

/**
 * Mongo-backed recipe store.
 *
 * Purpose: Implement the `RecipeStore` contract against a MongoDB collection.
 * Args: db — the connected database.
 * Returns: A `RecipeStore`.
 */
export function mongoRecipeStore(db: Db): RecipeStore {
  const col = (): Collection<RecipeRecord> => db.collection<RecipeRecord>('recipes');
  return {
    async ensureIndexes() {
      await col().createIndex({ name: 1 }, { unique: true });
    },
    findByName: (name) => col().findOne({ name }),
    findById: (id) => col().findOne({ _id: id }),
    listAll: () => col().find().sort({ createdAt: -1 }).toArray(),
    async insertRecipe(record) {
      await col().insertOne(record);
    },
    updateRecipe: (id, patch) =>
      col().findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: 'after' }),
    async deleteRecipe(id) {
      const result = await col().deleteOne({ _id: id });
      return result.deletedCount === 1;
    },
  };
}
