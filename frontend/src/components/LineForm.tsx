import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Spinner } from './Spinner.js';
import { TanksEditor } from './TanksEditor.js';
import { useLineForm } from '../hooks/useLineForm.js';
import type { Line, NewLine } from '../types/line.js';

/**
 * Reusable line builder (create + edit).
 *
 * Purpose: Edit a line's name, its cranes, and its tank layout, then persist via
 *   `onSubmit`. Used inline on the "Add line" tab and inside the edit dialog.
 * Args: initial — a line to edit (omit to start blank); submitLabel — button
 *   text; onSubmit — persists the payload (returns success); onCancel — optional
 *   dismiss (renders a Cancel button); headerSlot — optional extra controls
 *   (e.g. a "Load line4 template" button).
 */
export function LineForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  headerSlot,
}: {
  initial?: Line;
  submitLabel: string;
  onSubmit: (input: NewLine) => Promise<boolean>;
  onCancel?: () => void;
  headerSlot?: React.ReactNode;
}) {
  const f = useLineForm(initial);
  const [craneInput, setCraneInput] = useState('');

  function commitCrane() {
    f.addCrane(craneInput);
    setCraneInput('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await f.submit(onSubmit);
    if (ok && onCancel) onCancel();
  }

  return (
    <form className="line-form" onSubmit={handleSubmit} noValidate>
      {headerSlot}
      <label className="field">
        <span>Line name</span>
        <input
          value={f.name}
          onChange={(e) => f.setName(e.target.value)}
          placeholder="e.g. line4"
          autoComplete="off"
        />
      </label>

      <div className="field">
        <span>Cranes</span>
        <div className="crane-input">
          <input
            value={craneInput}
            onChange={(e) => setCraneInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitCrane();
              }
            }}
            placeholder="e.g. 7A"
            aria-label="New crane code"
          />
          <button type="button" className="btn btn--sm" onClick={commitCrane}>
            <Plus size={14} aria-hidden /> Add crane
          </button>
        </div>
        <div className="crane-chips">
          {f.cranes.map((c) => (
            <span key={c} className="crane-chip">
              {c}
              <button type="button" aria-label={`Remove crane ${c}`} onClick={() => f.removeCrane(c)}>
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      </div>

      <TanksEditor
        tanks={f.tanks}
        cranes={f.cranes}
        onUpdate={f.updateTank}
        onRemove={f.removeTank}
        onAdd={f.addTank}
      />

      {f.error && <p className="form-error" role="alert">{f.error}</p>}

      <div className="modal__actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={f.busy}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn--primary" disabled={f.busy}>
          {f.busy ? <Spinner label="Saving" /> : submitLabel}
        </button>
      </div>
    </form>
  );
}
