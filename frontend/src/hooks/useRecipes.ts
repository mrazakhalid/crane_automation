import { useCallback, useEffect, useState } from 'react';
import * as recipesApi from '../api/recipes.js';
import { apiErrorMessage } from '../api/client.js';
import { useToast } from './useToast.js';
import type { NewRecipe, Recipe } from '../types/recipe.js';

/**
 * Saved-recipes data hook.
 *
 * Purpose: Own the recipe list + save/delete actions (optimistic, with toast
 *   feedback) for the Process page's "load a saved recipe" dropdown.
 * Returns: The list, load state, and `reload` / `save` / `remove` actions.
 */
export function useRecipes() {
  const { notify } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecipes(await recipesApi.listRecipes());
    } catch (err) {
      notify(apiErrorMessage(err, 'Failed to load recipes'), 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /** Save a recipe; on success prepend it and return the saved record. */
  const save = useCallback(
    async (input: NewRecipe): Promise<Recipe | null> => {
      try {
        const recipe = await recipesApi.createRecipe(input);
        setRecipes((prev) => [recipe, ...prev]);
        notify(`Recipe "${recipe.name}" saved`, 'success');
        return recipe;
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not save recipe'), 'error');
        return null;
      }
    },
    [notify],
  );

  /** Edit a saved recipe; on success replace it in place and return the record. */
  const update = useCallback(
    async (id: string, patch: Partial<NewRecipe>): Promise<Recipe | null> => {
      try {
        const recipe = await recipesApi.updateRecipe(id, patch);
        setRecipes((prev) => prev.map((r) => (r.id === id ? recipe : r)));
        notify(`Recipe "${recipe.name}" updated`, 'success');
        return recipe;
      } catch (err) {
        notify(apiErrorMessage(err, 'Could not update recipe'), 'error');
        return null;
      }
    },
    [notify],
  );

  /** Delete a recipe; optimistically removes it, restores on failure. */
  const remove = useCallback(
    async (id: string): Promise<void> => {
      const snapshot = recipes;
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      try {
        await recipesApi.deleteRecipe(id);
        notify('Recipe removed', 'success');
      } catch (err) {
        setRecipes(snapshot);
        notify(apiErrorMessage(err, 'Could not delete recipe'), 'error');
      }
    },
    [recipes, notify],
  );

  return { recipes, loading, reload: load, save, update, remove };
}
