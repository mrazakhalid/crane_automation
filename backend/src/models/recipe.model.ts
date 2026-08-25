/**
 * Recipe domain model — a saved, reusable QR recipe (data shapes only, no logic).
 *
 * Purpose: Single source of truth for what a persisted recipe looks like. A recipe
 *   is line-agnostic: it holds the raw `key=seconds;…` QR text plus any per-step
 *   line overrides used to disambiguate tank names that exist on more than one line.
 *   The cross-line planner (services/process) turns a recipe into a routed plan.
 */

/**
 * How a specific recipe step was disambiguated: the 1-based step number (as a
 * string key, since JSON object keys are strings) → the chosen line id. Only
 * steps whose tank name is ambiguous across lines need an entry here.
 */
export type StepOverrides = Record<string, string>;

/** Stored recipe record (as persisted). `_id` mirrors our UUID v7 id. */
export interface RecipeRecord {
  _id: string;
  name: string;
  /** Raw decoded QR text: `key=seconds;key=seconds;…`. */
  qr: string;
  /** Per-step line disambiguation (empty when nothing is ambiguous). */
  overrides: StepOverrides;
  createdAt: string;
  updatedAt: string;
}

/** Client-safe recipe shape (`id` instead of `_id`). */
export interface PublicRecipe {
  id: string;
  name: string;
  qr: string;
  overrides: StepOverrides;
  createdAt: string;
  updatedAt: string;
}

/**
 * Strip a stored recipe down to its client-safe shape.
 *
 * Args: record — a full `RecipeRecord`.
 * Returns: A `PublicRecipe` (`id` in place of `_id`).
 */
export function toPublicRecipe(record: RecipeRecord): PublicRecipe {
  return {
    id: record._id,
    name: record.name,
    qr: record.qr,
    // Default for older records persisted before the field existed.
    overrides: record.overrides ?? {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
