import {
  CheckCircle2,
  Octagon,
  Pencil,
  Plug,
  PlugZap,
  Power,
  RotateCcw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { Spinner } from './Spinner.js';
import type { Line } from '../types/line.js';
import type { PlcConnectionConfig, PlcStatus } from '../types/plc-config.js';

/** Presentational status chip driven by the live pool state. */
function StatusChip({ status }: { status?: PlcStatus }) {
  const state = status?.state ?? 'disconnected';
  const label =
    state === 'connected'
      ? 'Connected'
      : state === 'connecting'
        ? 'Connecting…'
        : state === 'error'
          ? 'Error'
          : 'Disconnected';
  return (
    <span
      className={`status-chip status-chip--${state}`}
      title={state === 'error' ? (status?.lastError ?? 'Connection error') : label}
    >
      <span className="status-chip__dot" aria-hidden /> {label}
    </span>
  );
}

/**
 * List of saved OPC UA connections (super-admin).
 *
 * Purpose: Show each PLC with its endpoint/security, its line + cranes, a LIVE
 *   connection status chip, and Connect/Disconnect plus Activate / Manage tags /
 *   Edit / Delete. Selecting a row opens its tag mappings below.
 */
export function ConnectionList({
  connections,
  lines,
  statuses,
  pendingId,
  loading,
  selectedId,
  onSelect,
  onConnect,
  onDisconnect,
  onActivate,
  onStop,
  onClean,
  onEdit,
  onDelete,
}: {
  connections: PlcConnectionConfig[];
  lines: Line[];
  statuses: Record<string, PlcStatus>;
  pendingId: string | null;
  loading: boolean;
  selectedId: string | null;
  onSelect: (c: PlcConnectionConfig) => void;
  onConnect: (c: PlcConnectionConfig) => void;
  onDisconnect: (c: PlcConnectionConfig) => void;
  onActivate: (c: PlcConnectionConfig) => void;
  onStop: (c: PlcConnectionConfig) => void;
  onClean: (c: PlcConnectionConfig) => void;
  onEdit: (c: PlcConnectionConfig) => void;
  onDelete: (c: PlcConnectionConfig) => void;
}) {
  if (loading) {
    return (
      <div className="card" style={{ display: 'grid', placeItems: 'center', padding: '2rem' }}>
        <Spinner size={24} label="Loading connections" />
      </div>
    );
  }

  if (connections.length === 0) {
    return <p className="muted card">No PLCs yet — add one with “New connection”.</p>;
  }

  const lineName = (id: string | null) => (id ? (lines.find((l) => l.id === id)?.name ?? '—') : null);

  return (
    <ul className="conn-list" aria-label="Saved connections">
      {connections.map((c) => {
        const status = statuses[c.id];
        const connected = status?.state === 'connected';
        const busy = pendingId === c.id;
        return (
          <li key={c.id} className={`conn-card${selectedId === c.id ? ' conn-card--selected' : ''}`}>
            <button
              type="button"
              className="conn-card__main"
              onClick={() => onSelect(c)}
              aria-pressed={selectedId === c.id}
              title="Manage tag mappings"
            >
              <span className="conn-card__head">
                <span className="conn-card__name">{c.name}</span>
                <StatusChip status={status} />
                {c.isActive && (
                  <span className="badge badge--super_admin" title="Legacy default connection">
                    <CheckCircle2 size={12} aria-hidden /> Active
                  </span>
                )}
              </span>
              <span className="conn-card__endpoint muted">{c.endpoint}</span>
              <span className="conn-card__meta muted">
                {c.lineId ? (
                  <>
                    Line: {lineName(c.lineId)}
                    {c.cranes.length > 0 && (
                      <span className="crane-tags">
                        {c.cranes.map((cr) => (
                          <span key={cr} className="crane-tag">
                            {cr}
                          </span>
                        ))}
                      </span>
                    )}
                  </>
                ) : (
                  <em>Unassigned</em>
                )}
              </span>
            </button>
            <div className="conn-card__actions">
              {connected ? (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onDisconnect(c)}
                  disabled={busy}
                  title="Close this PLC's session"
                >
                  {busy ? <Spinner size={14} label="…" /> : <PlugZap size={14} aria-hidden />}{' '}
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={() => onConnect(c)}
                  disabled={busy}
                  title="Open a live session to this PLC"
                >
                  {busy ? <Spinner size={14} label="…" /> : <Plug size={14} aria-hidden />} Connect
                </button>
              )}
              {connected && (
                <>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => onStop(c)}
                    disabled={busy}
                    title="Emergency stop — halt this PLC's cranes immediately"
                  >
                    <Octagon size={14} aria-hidden /> Stop
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => onClean(c)}
                    disabled={busy}
                    title="Send cranes home to Parking and clear the recipe"
                  >
                    <RotateCcw size={14} aria-hidden /> Clean
                  </button>
                </>
              )}
              {!c.isActive && (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onActivate(c)}
                  title="Make this the default (legacy) PLC"
                >
                  <Power size={14} aria-hidden /> Activate
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                onClick={() => onSelect(c)}
                aria-label={`Manage tags for ${c.name}`}
                title="Manage tags"
              >
                <Settings2 size={16} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => onEdit(c)}
                aria-label={`Edit ${c.name}`}
                title="Edit"
              >
                <Pencil size={16} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => onDelete(c)}
                aria-label={`Delete ${c.name}`}
                title="Delete"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
