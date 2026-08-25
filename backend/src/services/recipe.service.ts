import { toPublicRecipe, type RecipeRecord, type PublicRecipe } from '../models/recipe.model.js';
import * as recipeRepo from '../repositories/recipe.repository.js';
import type { CreateRecipeInput, UpdateRecipeInput } from '../schemas/recipe.schema.js';
import { conflict, notFoundError } from '../utils/http-error.js';
import { newId } from '../utils/id.js';

/**
 * Recipe service (business logic layer).
 *
 * Purpose: Create, list, fetch, edit, and delete saved QR recipes. Ignorant of
 *   HTTP and of the DB driver — controllers pass validated input, repositories
 *   persist it. A recipe is line-agnostic; the cross-line planner interprets it.
 */

/**
 * List every saved recipe (for the "load a saved recipe" dropdown).
 *
 * Returns: All recipes as `PublicRecipe[]`, newest first.
 */
export async function listRecipes(): Promise<PublicRecipe[]> {
  const records = await recipeRepo.listAll();
  return records.map(toPublicRecipe);
}

/**
 * Save a new recipe.
 *
 * Args: input — validated `{ name, qr, overrides? }`.
 * Returns: The created `PublicRecipe`.
 * Raises: 409 if a recipe with that name already exists.
 */
export async function createRecipe(input: CreateRecipeInput): Promise<PublicRecipe> {
  if (await recipeRepo.findByName(input.name)) {
    throw conflict(`A recipe named "${input.name}" already exists`);
  }

  const now = new Date().toISOString();
  const record: RecipeRecord = {
    _id: newId(),
    name: input.name,
    qr: input.qr,
    overrides: input.overrides ?? {},
    createdAt: now,
    updatedAt: now,
  };
  await recipeRepo.insertRecipe(record);
  return toPublicRecipe(record);
}

/** Fetch a single recipe by id. Raises 404 if absent. */
export async function getRecipe(id: string): Promise<PublicRecipe> {
  const record = await recipeRepo.findById(id);
  if (!record) throw notFoundError('Recipe not found');
  return toPublicRecipe(record);
}

/**
 * Edit a recipe's name, qr, and/or overrides.
 *
 * Args: id — target recipe id; input — validated partial `{ name?, qr?, overrides? }`.
 * Returns: The updated `PublicRecipe`.
 * Raises: 404 if absent, 409 if the new name is taken by another recipe.
 */
export async function updateRecipe(id: string, input: UpdateRecipeInput): Promise<PublicRecipe> {
  const existing = await recipeRepo.findById(id);
  if (!existing) throw notFoundError('Recipe not found');

  const patch: Partial<Pick<RecipeRecord, 'name' | 'qr' | 'overrides'>> & { updatedAt: string } = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined && input.name !== existing.name) {
    const clash = await recipeRepo.findByName(input.name);
    if (clash && clash._id !== id) throw conflict(`A recipe named "${input.name}" already exists`);
    patch.name = input.name;
  }
  if (input.qr !== undefined) patch.qr = input.qr;
  if (input.overrides !== undefined) patch.overrides = input.overrides;

  const updated = await recipeRepo.updateRecipe(id, patch);
  if (!updated) throw notFoundError('Recipe not found');
  return toPublicRecipe(updated);
}

/**
 * Delete a recipe.
 *
 * Args: id — target recipe id.
 * Raises: 404 if the recipe does not exist.
 */
export async function deleteRecipe(id: string): Promise<void> {
  if (!(await recipeRepo.deleteRecipe(id))) throw notFoundError('Recipe not found');
}
