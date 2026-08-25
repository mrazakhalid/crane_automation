import type { NewRecipe, Recipe } from '../types/recipe.js';
import { apiClient } from './client.js';

/**
 * Recipe API wrappers.
 *
 * Purpose: Typed calls to the `/recipes` endpoints — list saved recipes for the
 *   dropdown, save a new one, edit, and delete (managers + super-admins).
 */

/** GET /recipes — list all saved recipes, newest first. */
export async function listRecipes(): Promise<Recipe[]> {
  const { data } = await apiClient.get<{ recipes: Recipe[] }>('/recipes');
  return data.recipes;
}

/** POST /recipes — save a new recipe. */
export async function createRecipe(input: NewRecipe): Promise<Recipe> {
  const { data } = await apiClient.post<{ recipe: Recipe }>('/recipes', input);
  return data.recipe;
}

/** PATCH /recipes/:id — edit a saved recipe. */
export async function updateRecipe(id: string, patch: Partial<NewRecipe>): Promise<Recipe> {
  const { data } = await apiClient.patch<{ recipe: Recipe }>(`/recipes/${id}`, patch);
  return data.recipe;
}

/** DELETE /recipes/:id — remove a saved recipe. */
export async function deleteRecipe(id: string): Promise<void> {
  await apiClient.delete(`/recipes/${id}`);
}
