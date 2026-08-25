import { ArrowDownToLine, ArrowUpFromLine, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Spinner } from './Spinner.js';
import { tagSchema } from '../schemas/plc-config.js';
import { TAG_DATA_TYPES, TAG_DIRECTIONS } from '../types/plc-config.js';
import type { PlcConnectionConfig, PlcTagConfig, TagInput } from '../types/plc-config.js';

/**
 * Tag-mappings panel for one connection (super-admin).
 *
 * Purpose: List a connection's friendly tag labels (→ NodeIds) split into
 *   monitor (read) and command (write), and add/remove them inline. Operators
 *   later use these labels instead of raw NodeIds.
 * Args: connection — the selected connection; tags/loading; onAdd/onRemove.
 */
export function TagsPanel({
  connection,
  tags,
  loading,
  onAdd,
  onRemove,
}: {
  connection: PlcConnectionConfig;
  tags: PlcTagConfig[];
  loading: boolean;
  onAdd: (input: TagInput) => Promise<boolean>;
  onRemove: (tagId: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [dataType, setDataType] = useState<TagInput['dataType']>('Boolean');
  const [direction, setDirection] = useState<TagInput['direction']>('read');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reads = tags.filter((t) => t.direction === 'read');
  const writes = tags.filter((t) => t.direction === 'write');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = tagSchema.safeParse({ label, nodeId, dataType, direction });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    setError(null);
    setBusy(true);
    const ok = await onAdd(parsed.data);
    setBusy(false);
    if (ok) {
      setLabel('');
      setNodeId('');
    }
  }

  return (
    <section className="card tags-panel" aria-label={`Tags for ${connection.name}`}>
      <h3 className="form__title">Tag mappings — {connection.name}</h3>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: '1.5rem' }}>
          <Spinner size={22} label="Loading tags" />
        </div>
      ) : (
        <div className="tags-grid">
          <TagColumn
            title="Monitor (PLC → software)"
            Icon={ArrowDownToLine}
            tags={reads}
            onRemove={onRemove}
          />
          <TagColumn
            title="Command (software → PLC)"
            Icon={ArrowUpFromLine}
            tags={writes}
            onRemove={onRemove}
          />
        </div>
      )}

      <form className="tag-form" onSubmit={submit} noValidate>
        <div className="form-row">
          <label className="field">
            <span>Label</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. cycle_count"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>NodeId</span>
            <input
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              placeholder={'ns=3;s="PlcData"."run"'}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Direction</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as TagInput['direction'])}
            >
              {TAG_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d === 'read' ? 'Monitor (read)' : 'Command (write)'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Data type</span>
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value as TagInput['dataType'])}
            >
              {TAG_DATA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? <Spinner label="Adding" /> : (
            <>
              <Plus size={16} aria-hidden /> Add tag
            </>
          )}
        </button>
      </form>
    </section>
  );
}

/** One column (monitor or command) of tag rows. */
function TagColumn({
  title,
  Icon,
  tags,
  onRemove,
}: {
  title: string;
  Icon: typeof ArrowDownToLine;
  tags: PlcTagConfig[];
  onRemove: (tagId: string) => void;
}) {
  return (
    <div className="tag-col">
      <h4 className="tag-col__title">
        <Icon size={14} aria-hidden /> {title}
      </h4>
      {tags.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ul className="tag-list">
          {tags.map((t) => (
            <li key={t.id} className="tag-row">
              <span className="tag-row__label">{t.label}</span>
              <code className="tag-row__node">{t.nodeId}</code>
              <span className="badge">{t.dataType}</span>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => onRemove(t.id)}
                aria-label={`Remove ${t.label}`}
                title="Remove tag"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
