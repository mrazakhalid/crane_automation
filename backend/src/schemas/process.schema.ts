import * as z from 'zod';
import { qrRecipe } from './line.schema.js';
import { overridesSchema } from './recipe.schema.js';

/**
 * Process planning/run request schemas (validation source of truth).
 *
 * Purpose: Bound and sanitize the plan/start/status bodies at the HTTP boundary.
 *   All use `strictObject` to reject unknown fields per the charter, and reuse the
 *   shared `qrRecipe` grammar and `overrides` shape.
 */

/** POST /api/process/plan and /api/process/start — a recipe + optional overrides. */
export const processInputSchema = z.strictObject({
  qr: qrRecipe,
  overrides: overridesSchema.optional(),
});
export type ProcessInput = z.infer<typeof processInputSchema>;

/** Route param: run id (UUID). */
export const runIdParamSchema = z.strictObject({ runId: z.uuid() });
