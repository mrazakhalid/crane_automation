import { useState } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronRight, Container, Pencil, Trash2 } from 'lucide-react';
import type { Line, Tank } from '../types/line.js';

/**
 * Presentational card for one saved line — collapsible to keep a long list compact.
 *
 * Purpose: Show a line's name + summary in a header that toggles its crane/tank
 *   detail open/closed (collapsed by default so the user opens only what they
 *   need). Transfer tanks (shared by two cranes) are flagged. When
 *   `onEdit`/`onDelete` are given, per-line actions render in the header.
 * Args: line — the line to render; defaultOpen — start expanded (default false);
 *   onEdit/onDelete — optional action handlers.
 */
export function LineCard({
  line,
  defaultOpen = false,
  onEdit,
  onDelete,
}: {
  line: Line;
  defaultOpen?: boolean;
  onEdit?: (line: Line) => void;
  onDelete?: (line: Line) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `line-body-${line.id}`;

  return (
    <section className="card line-card">
      <header className="line-card__head">
        <h3 className="line-card__title">
          <button
            type="button"
            className="line-card__toggle"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={bodyId}
          >
            {open ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
            <Container size={18} aria-hidden className="line-card__icon" />
            <span className="line-card__name">{line.name}</span>
            <span className="muted line-card__meta">
              {line.cranes.length} cranes · {line.tanks.length} tanks
            </span>
          </button>
        </h3>
        {(onEdit || onDelete) && (
          <div className="line-card__actions">
            {onEdit && (
              <button className="btn btn--sm" onClick={() => onEdit(line)}>
                <Pencil size={14} aria-hidden /> Edit
              </button>
            )}
            {onDelete && (
              <button className="btn btn--sm btn--danger" onClick={() => onDelete(line)}>
                <Trash2 size={14} aria-hidden /> Delete
              </button>
            )}
          </div>
        )}
      </header>

      {open && (
        <div id={bodyId} className="line-card__cranes">
          {line.cranes.map((crane) => (
            <div key={crane} className="crane-col">
              <h4 className="crane-col__name">Crane {crane}</h4>
              <ul className="crane-col__tanks">
                {line.tanks.filter((t) => servedBy(t, crane)).map((t) => (
                  <li key={t.number} className="tank-chip" title={t.note ?? undefined}>
                    <span className="tank-chip__num">{t.number}</span>
                    <span className="tank-chip__name">{t.name}</span>
                    {t.transfer && (
                      <ArrowLeftRight size={13} aria-label="transfer tank" className="tank-chip__xfer" />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Whether a tank is serviced by the given crane (primary or shared transfer). */
function servedBy(tank: Tank, crane: string): boolean {
  return tank.crane === crane || (tank.cranes?.includes(crane) ?? false);
}
