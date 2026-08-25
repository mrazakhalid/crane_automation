import { Plus, Trash2 } from 'lucide-react';
import type { TankDraft } from '../hooks/useLineForm.js';

/**
 * Tank-rows editor for the line builder.
 *
 * Purpose: Add/edit/remove tank positions — name, servicing crane, and an
 *   optional "transfer" flag (shared with a second crane). Numbers renumber
 *   automatically. Purely presentational; all state lives in `useLineForm`.
 */
export function TanksEditor({
  tanks,
  cranes,
  onUpdate,
  onRemove,
  onAdd,
}: {
  tanks: TankDraft[];
  cranes: string[];
  onUpdate: (i: number, patch: Partial<TankDraft>) => void;
  onRemove: (i: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="tanks-editor">
      <div className="tanks-editor__head">
        <span>Tanks ({tanks.length})</span>
        <button type="button" className="btn btn--sm" onClick={onAdd} disabled={cranes.length === 0}>
          <Plus size={14} aria-hidden /> Add tank
        </button>
      </div>

      {cranes.length === 0 && <p className="muted">Add a crane first, then add tanks.</p>}

      <ul className="tanks-editor__rows">
        {tanks.map((t, i) => (
          <li key={i} className="tank-row">
            <span className="tank-row__num">{t.number}</span>
            <input
              className="tank-row__name"
              value={t.name}
              placeholder="Tank name e.g. 1-1A"
              aria-label={`Tank ${t.number} name`}
              onChange={(e) => onUpdate(i, { name: e.target.value })}
            />
            <select
              value={t.crane}
              aria-label={`Tank ${t.number} crane`}
              onChange={(e) => onUpdate(i, { crane: e.target.value })}
            >
              {cranes.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <label className="tank-row__xfer">
              <input
                type="checkbox"
                checked={t.transfer}
                onChange={(e) => onUpdate(i, { transfer: e.target.checked })}
              />
              shared
            </label>
            {t.transfer && (
              <select
                value={t.sharedCrane}
                aria-label={`Tank ${t.number} shared crane`}
                onChange={(e) => onUpdate(i, { sharedCrane: e.target.value })}
              >
                <option value="">with…</option>
                {cranes.filter((c) => c !== t.crane).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove tank ${t.number}`}
              onClick={() => onRemove(i)}
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
