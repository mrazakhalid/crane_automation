/**
 * Shared recipe types (mirror of the backend contract).
 *
 * Purpose: One place for the saved-recipe shape used by the Process page's
 *   "load a saved recipe" dropdown and save flow.
 */

/** Per-step line disambiguation: `{ "<stepNumber>": "<lineId>" }`. */
export type StepOverrides = Record<string, string>;

export interface Recipe {
  id: string;
  name: string;
  /** Raw decoded QR text: `key=seconds;key=seconds;…`. */
  qr: string;
  overrides: StepOverrides;
  createdAt: string;
  updatedAt: string;
}

/** Payload for saving a recipe (no server-assigned fields). */
export interface NewRecipe {
  name: string;
  qr: string;
  overrides?: StepOverrides;
}
