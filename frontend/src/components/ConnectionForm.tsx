import { useState } from 'react';
import { Spinner } from './Spinner.js';
import { connectionSchema } from '../schemas/plc-config.js';
import { SECURITY_MODES, SECURITY_POLICIES } from '../types/plc.js';
import type { Line } from '../types/line.js';
import type { ConnectionInput, PlcConnectionConfig } from '../types/plc-config.js';

/**
 * Create/edit form for a saved OPC UA connection (super-admin).
 *
 * Purpose: Capture name + endpoint + security for a PLC AND bind it to a plant
 *   line and the cranes it controls (a line can span several PLCs — cranes are the
 *   assignment unit). Validated for UX before the backend re-checks. Reused
 *   standalone (create) and inside the edit modal.
 * Args: initial — prefill for edit (omit for create); lines — saved lines for the
 *   line/crane pickers; onSubmit — persists and returns success; submitLabel.
 */
export function ConnectionForm({
  initial,
  lines,
  onSubmit,
  submitLabel = 'Save connection',
}: {
  initial?: PlcConnectionConfig;
  lines: Line[];
  onSubmit: (input: ConnectionInput) => Promise<boolean>;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [endpoint, setEndpoint] = useState(initial?.endpoint ?? 'opc.tcp://');
  const [securityMode, setSecurityMode] = useState<ConnectionInput['securityMode']>(
    initial?.securityMode ?? 'None',
  );
  const [securityPolicy, setSecurityPolicy] = useState<ConnectionInput['securityPolicy']>(
    initial?.securityPolicy ?? 'None',
  );
  const [lineId, setLineId] = useState<string>(initial?.lineId ?? '');
  const [cranes, setCranes] = useState<string[]>(initial?.cranes ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedLine = lines.find((l) => l.id === lineId) ?? null;

  function onLineChange(nextId: string) {
    setLineId(nextId);
    // Cranes belong to a line; drop any that aren't on the newly chosen one.
    const valid = new Set(lines.find((l) => l.id === nextId)?.cranes ?? []);
    setCranes((prev) => prev.filter((c) => valid.has(c)));
  }

  function toggleCrane(crane: string) {
    setCranes((prev) => (prev.includes(crane) ? prev.filter((c) => c !== crane) : [...prev, crane]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = connectionSchema.safeParse({
      name,
      endpoint,
      securityMode,
      securityPolicy,
      lineId: lineId || null,
      cranes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    setBusy(true);
    const ok = await onSubmit(parsed.data);
    setBusy(false);
    if (ok && !initial) {
      setName('');
      setEndpoint('opc.tcp://');
      setSecurityMode('None');
      setSecurityPolicy('None');
      setLineId('');
      setCranes([]);
    }
  }

  return (
    <form className="card form" onSubmit={submit} noValidate>
      {!initial && <h2 className="form__title">New PLC connection</h2>}
      <label className="field">
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. PLC_4 (Line 4 cranes 6+7A)"
          autoComplete="off"
        />
      </label>
      <label className="field">
        <span>Endpoint (connection string)</span>
        <input
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder="opc.tcp://192.168.0.214:4840"
          autoComplete="off"
        />
      </label>
      <div className="form-row">
        <label className="field">
          <span>Security</span>
          <select
            value={securityMode}
            onChange={(e) => setSecurityMode(e.target.value as ConnectionInput['securityMode'])}
          >
            {SECURITY_MODES.map((m) => (
              <option key={m} value={m}>
                {m === 'None' ? 'None (plain)' : m}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Policy</span>
          <select
            value={securityPolicy}
            onChange={(e) => setSecurityPolicy(e.target.value as ConnectionInput['securityPolicy'])}
          >
            {SECURITY_POLICIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>Line served</span>
        <select value={lineId} onChange={(e) => onLineChange(e.target.value)}>
          <option value="">— Unassigned —</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      {selectedLine && (
        <fieldset className="field crane-picker">
          <legend>Cranes this PLC controls</legend>
          {selectedLine.cranes.length === 0 ? (
            <p className="muted">This line has no cranes defined.</p>
          ) : (
            <div className="crane-picker__chips">
              {selectedLine.cranes.map((crane) => {
                const on = cranes.includes(crane);
                return (
                  <button
                    key={crane}
                    type="button"
                    className={`chip${on ? ' chip--on' : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleCrane(crane)}
                  >
                    {crane}
                  </button>
                );
              })}
            </div>
          )}
          <p className="muted crane-picker__hint">
            A crane belongs to exactly one PLC on its line; unpicked cranes are served by other PLCs.
          </p>
        </fieldset>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn--primary" type="submit" disabled={busy}>
        {busy ? <Spinner label="Saving" /> : submitLabel}
      </button>
    </form>
  );
}
