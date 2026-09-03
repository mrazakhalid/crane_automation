/**
 * Recipe text ⇄ Tank/Time rows.
 *
 * Purpose: The backend contract for a recipe is the raw string
 *   `key=seconds;key=seconds;…` (see `parseQr` on the backend). The UI, however,
 *   shows an Excel-like two-column Tank/Time table. These helpers translate
 *   between the two so the raw string stays the single source of truth while the
 *   operator only ever sees/edits tanks and times.
 */

/** One editable row of the recipe table. `time` is kept as text for smooth typing. */
export interface RecipeRow {
  tank: string;
  time: string;
}

/**
 * Parse a raw recipe string into ordered Tank/Time rows.
 *
 * Args: qr — the raw `key=seconds;…` text (whitespace/trailing `;` tolerant).
 * Returns: one row per entry, in recipe order (empty input → no rows).
 */
export function parseRecipe(qr: string): RecipeRow[] {
  return qr
    .split(';')
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0)
    .map((seg) => {
      const eq = seg.indexOf('=');
      const tank = (eq >= 0 ? seg.slice(0, eq) : seg).trim();
      const time = eq >= 0 ? seg.slice(eq + 1).trim() : '';
      return { tank, time };
    });
}

/**
 * Serialize Tank/Time rows back into the raw recipe string the backend expects.
 *
 * Args: rows — the edited table rows.
 * Returns: `tank=seconds;…` with a trailing `;` (blank-tank rows dropped; a blank
 *   time becomes `0`).
 */
export function serializeRecipe(rows: RecipeRow[]): string {
  const parts = rows
    .filter((r) => r.tank.trim().length > 0)
    .map((r) => `${r.tank.trim()}=${r.time.trim() || '0'}`);
  return parts.length ? `${parts.join(';')};` : '';
}
