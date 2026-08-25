import { Activity, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { nodeIdSchema } from '../schemas/plc.js';
import type { ReadResult, WatchTag } from '../types/plc.js';

/**
 * Live watch table — polls many NodeIds at once (PLC → software).
 *
 * Purpose: See all of a program's values together (e.g. the ledger's count,
 *   running, done, run, reset, target) instead of one at a time. The list is
 *   user-editable and persisted, so it's generic for any PLC.
 * Args: watch — the tags to show; readings — latest value per NodeId; onAdd/onRemove.
 */
export function PlcWatchTable({
  watch,
  readings,
  onAdd,
  onRemove,
}: {
  watch: WatchTag[];
  readings: Record<string, ReadResult | null>;
  onAdd: (label: string, nodeId: string) => void;
  onRemove: (id: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = nodeIdSchema.safeParse(nodeId);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid NodeId');
      return;
    }
    setError(null);
    onAdd(label.trim() || parsed.data, parsed.data);
    setLabel('');
    setNodeId('');
  }

  return (
    <div className="card form">
      <h2 className="form__title">
        <Activity size={16} aria-hidden /> Live read <span className="muted">(PLC → software)</span>
      </h2>

      <div className="plc-watch" aria-live="polite">
        {watch.length === 0 ? (
          <p className="muted">No tags yet — add a NodeId below to watch it live.</p>
        ) : (
          <table className="plc-watch__table">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Value</th>
                <th>Type</th>
                <th>Quality</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {watch.map((t) => {
                const r = readings[t.nodeId];
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="plc-watch__label">{t.label}</div>
                      <div className="plc-watch__node">{t.nodeId}</div>
                    </td>
                    <td className="plc-watch__value">{r ? String(r.value) : '—'}</td>
                    <td className="plc-watch__meta">{r?.dataType ?? '—'}</td>
                    <td className="plc-watch__meta">{r?.statusCode ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => onRemove(t.id)}
                        aria-label={`Remove ${t.label}`}
                      >
                        <X size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <form className="plc-watch__add" onSubmit={add} noValidate>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          aria-label="Tag label"
          autoComplete="off"
        />
        <input
          value={nodeId}
          onChange={(e) => setNodeId(e.target.value)}
          placeholder="ns=2;i=1"
          aria-label="NodeId to watch"
          autoComplete="off"
          spellCheck={false}
        />
        <button className="btn" type="submit">
          <Plus size={16} aria-hidden /> Add
        </button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
