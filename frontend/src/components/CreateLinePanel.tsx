import { FileStack } from 'lucide-react';
import { useState } from 'react';
import { LineForm } from './LineForm.js';
import { LINE4_TEMPLATE } from '../data/line4.js';
import type { Line, NewLine } from '../types/line.js';

/** A blank/preset line coerced to the `Line` shape the builder expects. */
function asLine(preset?: NewLine): Line | undefined {
  return preset ? { id: '', createdAt: '', updatedAt: '', ...preset } : undefined;
}

/**
 * Add-line panel (super-admin).
 *
 * Purpose: Build a brand-new line from scratch — name, cranes, and tanks — or
 *   load the fixed line4 layout as a starting point, then save it. Remounts the
 *   builder (via `formKey`) when a preset is loaded so its draft resets.
 * Args: onCreate — persists the new line (returns success).
 */
export function CreateLinePanel({ onCreate }: { onCreate: (input: NewLine) => Promise<boolean> }) {
  const [preset, setPreset] = useState<Line | undefined>(undefined);
  const [formKey, setFormKey] = useState(0);

  function loadTemplate() {
    setPreset(asLine(LINE4_TEMPLATE));
    setFormKey((k) => k + 1);
  }

  return (
    <div className="create-line">
      <div className="page-head">
        <div>
          <h2 className="form__title">Add a line</h2>
          <p className="muted form__sub">
            Define the cranes and tanks, or start from the fixed line4 layout.
          </p>
        </div>
        <button type="button" className="btn" onClick={loadTemplate}>
          <FileStack size={16} aria-hidden /> Load line4 template
        </button>
      </div>

      <div className="card">
        <LineForm key={formKey} initial={preset} submitLabel="Save line" onSubmit={onCreate} />
      </div>
    </div>
  );
}
