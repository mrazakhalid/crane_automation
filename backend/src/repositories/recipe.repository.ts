import { getStorage } from '../storage/index.js';
import type { RecipeRecord } from '../models/recipe.model.js';

/**
 * Recipe repository facade (data-access layer).
 *
 * Purpose: Stable entry point the services call. It forwards to the active
 *   storage driver's `RecipeStore` (Mongo or SQLite, chosen by `STORAGE_DRIVER`),
 *   so higher layers never know which backend is in use.
 */

/** Ensure a unique index/constraint on `name` (idempotent). */
export function ensureRecipeIndexes(): Promise<void> {
  return getStorage().recipes.ensureIndexes();
}

/** Find a recipe by name — used for uniqueness checks. */
export function findByName(name: string): Promise<RecipeRecord | null> {
  return getStorage().recipes.findByName(name);
}

/** Find a recipe by id. */
export function findById(id: string): Promise<RecipeRecord | null> {
  return getStorage().recipes.findById(id);
}

/** List all recipes, newest first. */
export function listAll(): Promise<RecipeRecord[]> {
  return getStorage().recipes.listAll();
}

/** Insert a new recipe record. */
export function insertRecipe(record: RecipeRecord): Promise<void> {
  return getStorage().recipes.insertRecipe(record);
}

/**
 * Apply a partial update by id and return the updated record.
 *
 * Args: id — target recipe id; patch — fields to set (already validated).
 * Returns: The updated `RecipeRecord`, or null if no recipe matched.
 */
export function updateRecipe(
  id: string,
  patch: Partial<Pick<RecipeRecord, 'name' | 'qr' | 'overrides'>> & { updatedAt: string },
): Promise<RecipeRecord | null> {
  return getStorage().recipes.updateRecipe(id, patch);
}

/** Delete a recipe by id. Returns true if a record was removed. */
export function deleteRecipe(id: string): Promise<boolean> {
  return getStorage().recipes.deleteRecipe(id);
}
