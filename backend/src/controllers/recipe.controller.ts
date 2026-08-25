import type { NextFunction, Request, Response } from 'express';
import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  listRecipes,
  updateRecipe,
} from '../services/recipe.service.js';
import { badRequest } from '../utils/http-error.js';

/** Read the validated `:id` route param (guards the index-signature type). */
function requireIdParam(req: Request): string {
  const id = req.params.id;
  if (typeof id !== 'string' || id.length === 0) throw badRequest('Missing recipe id');
  return id;
}

/**
 * Recipe controllers (wired behind auth/role middleware).
 */

/** GET /api/recipes — list all recipes. Returns 200 `{ recipes }`. */
export async function getRecipes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ recipes: await listRecipes() });
  } catch (err) {
    next(err);
  }
}

/** POST /api/recipes — save a recipe. Returns 201 `{ recipe }`. */
export async function postRecipe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json({ recipe: await createRecipe(req.body) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/recipes/:id — fetch one recipe. Returns 200 `{ recipe }`. */
export async function getRecipeById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(200).json({ recipe: await getRecipe(requireIdParam(req)) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/recipes/:id — edit a recipe. Returns 200 `{ recipe }`. */
export async function patchRecipe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ recipe: await updateRecipe(requireIdParam(req), req.body) });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/recipes/:id — remove a recipe. Returns 204. */
export async function deleteRecipeById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteRecipe(requireIdParam(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
