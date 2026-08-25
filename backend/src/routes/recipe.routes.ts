import { Router } from 'express';
import {
  deleteRecipeById,
  getRecipeById,
  getRecipes,
  patchRecipe,
  postRecipe,
} from '../controllers/recipe.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createRecipeSchema,
  recipeIdParamSchema,
  updateRecipeSchema,
} from '../schemas/recipe.schema.js';

/**
 * Recipe routes.
 *
 * Purpose: Managers (and super-admins) save reusable QR recipes and load them
 *   from a dropdown on the Process page. `requireAuth` gates everything; the
 *   write routes additionally require the manager/super-admin roles — the same
 *   audience that generates tasks and runs a process.
 */
export const recipeRouter = Router();

const canManage = requireRole('manager', 'super_admin');

recipeRouter.use(requireAuth);

recipeRouter.get('/', getRecipes);
recipeRouter.post('/', canManage, validate({ body: createRecipeSchema }), postRecipe);
recipeRouter.get('/:id', validate({ params: recipeIdParamSchema }), getRecipeById);
recipeRouter.patch(
  '/:id',
  canManage,
  validate({ params: recipeIdParamSchema, body: updateRecipeSchema }),
  patchRecipe,
);
recipeRouter.delete(
  '/:id',
  canManage,
  validate({ params: recipeIdParamSchema }),
  deleteRecipeById,
);
