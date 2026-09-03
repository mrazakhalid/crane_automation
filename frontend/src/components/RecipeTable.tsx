import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { parseRecipe, serializeRecipe, type RecipeRow } from '../utils/recipe.js';

/**
 * Excel-like two-column Tank / Time recipe editor.
 *
 * Purpose: Replace the raw `tank=seconds;` textarea with a friendly two-column
 *   grid (Tank | Time) so operators never see the raw syntax. Rows are kept in
 *   local state for smooth typing and serialized back into the raw `qr` string on
 *   every edit — the raw string stays the single source of truth the backend
 *   parses. Re-syncs when `qr` changes from outside (QR decode / load a saved
 *   recipe).
 */
export function RecipeTable({ qr, setQr }: { qr: string; setQr: (v: string) => void }) {
  const [rows, setRows] = useState<RecipeRow[]>(() => parseRecipe(qr));
  const [lastQr, setLastQr] = useState(qr);

  // Adopt an external `qr` change (QR decode, saved-recipe load) during render —
  // the endorsed "adjust state when a prop changes" pattern (no effect needed).
  // Our own edits already match `qr`, so this re-parses only on outside changes.
  if (qr !== lastQr) {
    setLastQr(qr);
    if (serializeRecipe(rows) !== qr) setRows(parseRecipe(qr));
  }

  /** Commit the next rows to local state and up to the raw recipe string. */
  function commit(next: RecipeRow[]): void {
    setRows(next);
    setQr(serializeRecipe(next));
  }

  const setCell = (i: number, patch: Partial<RecipeRow>): void =>
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number): void => commit(rows.filter((_, idx) => idx !== i));
  const addRow = (): void => commit([...rows, { tank: '', time: '' }]);

  return (
    <div className="recipe-table">
      <div className="recipe-table__head">
        <span>Tank</span>
        <span>Time (s)</span>
        <span className="sr-only">Remove</span>
      </div>
      {rows.length === 0 && <p className="recipe-table__empty muted">No tasks yet — add one below.</p>}
      {rows.map((row, i) => (
        <div className="recipe-table__row" key={i}>
          <input
            value={row.tank}
            onChange={(e) => setCell(i, { tank: e.target.value })}
            placeholder="e.g. 2-1A"
            aria-label={`Tank for row ${i + 1}`}
            maxLength={20}
          />
          <input
            type="number"
            min={0}
            max={99999}
            value={row.time}
            onChange={(e) => setCell(i, { time: e.target.value })}
            placeholder="0"
            aria-label={`Time in seconds for row ${i + 1}`}
          />
          <button
            type="button"
            className="btn btn--icon btn--sm"
            onClick={() => removeRow(i)}
            title="Remove this tank"
            aria-label={`Remove row ${i + 1}`}
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn--sm recipe-table__add" onClick={addRow}>
        <Plus size={15} aria-hidden /> Add task
      </button>
    </div>
  );
}
