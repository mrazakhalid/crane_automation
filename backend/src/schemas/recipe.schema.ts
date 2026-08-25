import * as z from 'zod';
import { qrRecipe } from './line.schema.js';

/**
 * Recipe request schemas (validation source of truth).
 *
 * Purpose: Bound and sanitize every client body at the HTTP boundary. All use
 *   `strictObject` to reject unknown fields per the charter. The `qr` rule is
 *   reused from `line.schema` so recipes and task-generation share one grammar.
 */

/** A recipe name — human-friendly, unique, short. */
const recipeName = z
  .string()
  .trim()
  .min(1, 'Recipe name is required')
  .max(60, 'Recipe name must be at most 60 characters')
  .regex(/^[a-zA-Z0-9 _.-]+$/, 'Recipe name: letters, numbers, space, . _ -');

/**
 * Per-step line overrides: `{ "<stepNumber>": "<lineId>" }`. Keys are 1-based
 * step numbers (as strings); values are line UUIDs. Optional and defaults to {}.
 * Exported so the process plan/start routes share one rule with recipes.
 */
export const overridesSchema = z.record(
  z.string().regex(/^\d+$/, 'Override key must be a step number'),
  z.uuid('Override value must be a line id'),
);

/** POST /api/recipes — save a new recipe. */
export const createRecipeSchema = z.strictObject({
  name: recipeName,
  qr: qrRecipe,
  overrides: overridesSchema.optional(),
});
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

/**
 * PATCH /api/recipes/:id — edit a recipe. All fields optional, but at least one
 * must be present; unknown fields are still rejected.
 */
export const updateRecipeSchema = z
  .strictObject({
    name: recipeName.optional(),
    qr: qrRecipe.optional(),
    overrides: overridesSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.qr !== undefined || v.overrides !== undefined, {
    message: 'Provide a name, qr, or overrides to update',
  });
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

/** Route param: recipe id (UUID). */
export const recipeIdParamSchema = z.strictObject({ id: z.uuid() });
