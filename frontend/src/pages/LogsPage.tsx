import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightToLine, ArrowLeftToLine, ScrollText, Trash2 } from 'lucide-react';
import { usePlcLogs } from '../hooks/usePlcLogs.js';

/** HH:MM:SS.mmm for a log timestamp. */
function fmtTime(ts: number): string {
  const d = new Date(ts);
  const t = d.toLocaleTimeString(undefined, { hour12: false });
  return `${t}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

/** Render a logged value compactly. */
function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (Array.isArray(v)) return `[${v.length}]`;
  return String(v);
}

/**
 * PLC I/O Logs page (manager + super-admin).
 *
 * Purpose: A live feed of every OPC UA value the app WROTE to a PLC (recipe task
 *   fields, `cmd_send`, manual commands) and every value READ back (command echoes,
 *   handshake), each tagged with the PLC name — so you can watch exactly what is
 *   sent where and what comes back while a recipe runs. Filter by direction / PLC /
 *   variable; the high-frequency animation poll is excluded server-side.
 */
export function LogsPage() {
  const { entries, error, clear } = usePlcLogs();
  const [dir, setDir] = useState<'all' | 'write' | 'read'>('all');
  const [plc, setPlc] = useState('all');
  const [query, setQuery] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const plcs = useMemo(() => Array.from(new Set(entries.map((e) => e.plc))).sort(), [entries]);
  const rows = useMemo(
    () =>
      entries.filter(
        (e) =>
          (dir === 'all' || e.dir === dir) &&
          (plc === 'all' || e.plc === plc) &&
          (!query || e.variable.toLowerCase().includes(query.toLowerCase())),
      ),
    [entries, dir, plc, query],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [rows.length]);

  return (
    <div className="page">
      <div className="page-body">
        <div className="page-body__inner page-body__inner--wide">
          <p className="eyebrow">Workspace</p>
          <section className="card">
            <h2 className="form__title">
              <ScrollText size={20} aria-hidden /> PLC I/O log
            </h2>
            <p className="muted form__sub">
              Live OPC UA traffic — what the app wrote to each PLC and what came back. The ~1 s
              animation poll is excluded so recipe writes &amp; handshakes stay visible.
            </p>

            <div className="logbar">
              <div className="logbar__group" role="group" aria-label="Direction filter">
                {(['all', 'write', 'read'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`logbar__btn${dir === d ? ' is-active' : ''}`}
                    onClick={() => setDir(d)}
                  >
                    {d === 'all' ? 'All' : d === 'write' ? 'Writes' : 'Reads'}
                  </button>
                ))}
              </div>
              <select className="logbar__select" value={plc} onChange={(e) => setPlc(e.target.value)}>
                <option value="all">All PLCs</option>
                {plcs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                className="logbar__search"
                placeholder="Filter variable…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="button" className="logbar__btn logbar__clear" onClick={() => void clear()}>
                <Trash2 size={14} aria-hidden /> Clear
              </button>
            </div>

            {error && <p className="muted crane-viz__note">{error}</p>}

            <div className="logtable">
              <div className="logrow logrow--head">
                <span>Time</span>
                <span>PLC</span>
                <span>Dir</span>
                <span>Variable</span>
                <span>Value</span>
              </div>
              {rows.length === 0 ? (
                <p className="logtable__empty">
                  No traffic yet. Send a command or run a recipe to a connected PLC.
                </p>
              ) : (
                rows.map((r) => (
                  <div key={r.seq} className={`logrow${r.ok ? '' : ' logrow--err'}`}>
                    <span className="logrow__time">{fmtTime(r.ts)}</span>
                    <span className="logrow__plc">{r.plc}</span>
                    <span className={`logrow__dir logrow__dir--${r.dir}`}>
                      {r.dir === 'write' ? (
                        <>
                          <ArrowRightToLine size={12} aria-hidden /> W
                        </>
                      ) : (
                        <>
                          <ArrowLeftToLine size={12} aria-hidden /> R
                        </>
                      )}
                    </span>
                    <span className="logrow__var">{r.variable}</span>
                    <span className="logrow__val">
                      {r.ok ? fmtValue(r.value) : <span className="logrow__errmsg">{r.error}</span>}
                    </span>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
