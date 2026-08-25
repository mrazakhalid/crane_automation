import { LineCard } from './LineCard.js';
import type { Line } from '../types/line.js';

/**
 * Presentational list of saved lines.
 *
 * Purpose: Render the line cards with skeleton and empty states, forwarding the
 *   per-line edit/delete handlers. Data comes from the parent (Lines page).
 * Args: lines — saved lines; loading — skeleton flag; emptyLabel — empty text;
 *   onEdit/onDelete — per-line action handlers.
 */
export function LineList({
  lines,
  loading,
  emptyLabel,
  onEdit,
  onDelete,
}: {
  lines: Line[];
  loading: boolean;
  emptyLabel: string;
  onEdit: (line: Line) => void;
  onDelete: (line: Line) => void;
}) {
  return (
    <div className="line-list">
      {loading && [0, 1].map((i) => <div key={i} className="card skeleton line-skeleton" aria-hidden />)}

      {!loading && lines.length === 0 && <p className="muted empty">{emptyLabel}</p>}

      {!loading &&
        [...lines]
          // Order by name, numeric-aware so line2 sorts before line10.
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
          .map((line) => (
            <LineCard key={line.id} line={line} onEdit={onEdit} onDelete={onDelete} />
          ))}
    </div>
  );
}
