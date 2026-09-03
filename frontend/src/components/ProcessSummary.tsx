import { CheckCircle2, Circle, Cpu, Loader, Play, SendHorizontal, ServerOff, Square } from 'lucide-react';
import { Spinner } from './Spinner.js';
import type { ProcessPlan, RunStatus, RunTaskState } from '../types/process.js';

/** Live-state icon for one task cell. */
function StateIcon({ state }: { state: RunTaskState }) {
  if (state === 'done') return <CheckCircle2 size={16} className="tstate tstate--done" aria-label="done" />;
  if (state === 'in_progress')
    return <Loader size={16} className="tstate tstate--run" aria-label="in progress" />;
  return <Circle size={16} className="tstate tstate--idle" aria-label="idle" />;
}

/**
 * Process summary + live run view.
 *
 * Purpose: The heart of the Process page — show which PLC receives which tasks
 *   (grouped by PLC → crane, in run order), the tally banner, and, once started,
 *   each task's live status (idle → in-progress → done) with an overall progress
 *   bar. Start/Stop drive the simulated run.
 */
export function ProcessSummary({
  plan,
  status,
  running,
  starting,
  sending,
  stateForStep,
  onSendToPlc,
  onStart,
  onStop,
}: {
  plan: ProcessPlan;
  status: RunStatus | null;
  running: boolean;
  starting: boolean;
  sending: boolean;
  stateForStep: (step: number) => RunTaskState;
  onSendToPlc: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const { counts, groups } = plan;
  const pct = Math.round((status?.progress ?? 0) * 100);
  const canSend = groups.some((g) => g.connectionId);

  return (
    <div className="process-summary">
      <section className="card process-banner">
        <div className="process-banner__counts">
          <span className="chip">{counts.total} tasks</span>
          <span className="chip chip--ok">{counts.routed} routed</span>
          {counts.unrouted > 0 && <span className="chip chip--warn">{counts.unrouted} no PLC</span>}
          {counts.ambiguous > 0 && <span className="chip chip--warn">{counts.ambiguous} to decide</span>}
          {counts.missing > 0 && <span className="chip chip--bad">{counts.missing} missing</span>}
        </div>
        <div className="process-banner__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={onSendToPlc}
            disabled={sending || !canSend}
            title={canSend ? 'Write the tasks to the real PLC(s) and run — watch it on the Plant view' : 'No crane on these tasks is assigned to a connected PLC'}
          >
            {sending ? <Spinner label="Sending" /> : (<><SendHorizontal size={16} aria-hidden /> Send to PLC</>)}
          </button>
          {running ? (
            <button type="button" className="btn btn--danger" onClick={onStop}>
              <Square size={16} aria-hidden /> Stop preview
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={onStart}
              disabled={starting || groups.length === 0}
              title="Timed preview only — does NOT touch the PLC"
            >
              {starting ? <Spinner label="Starting" /> : (<><Play size={16} aria-hidden /> Preview (sim)</>)}
            </button>
          )}
        </div>
      </section>

      {status && (
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress__bar" style={{ width: `${pct}%` }} />
          <span className="progress__label">{status.done ? 'Complete' : `${pct}%`}</span>
        </div>
      )}

      <div className="plc-grid">
        {groups.map((g) => (
          <section key={g.connectionId ?? `${g.lineId}:${g.cranes[0]?.crane}`} className="card plc-card">
            <header className="plc-card__head">
              {g.plcName ? <Cpu size={18} aria-hidden /> : <ServerOff size={18} aria-hidden />}
              <span className="plc-card__name">{g.plcName ?? 'PLC not assigned'}</span>
              <span className="muted plc-card__line">{g.lineName}</span>
            </header>
            {g.cranes.map((chain) => (
              <div key={chain.crane} className="chain">
                <div className="chain__crane">Crane {chain.crane}</div>
                <div className="chain__cols" aria-hidden>
                  <span>Tank</span>
                  <span>Time</span>
                </div>
                <ol className="chain__tasks">
                  {chain.tasks.map((t) => (
                    <li key={t.step} className={`chain__task chain__task--${stateForStep(t.step)}`}>
                      <StateIcon state={stateForStep(t.step)} />
                      <span className="chain__tank">{t.tankName}</span>
                      {/* Station hidden for now (t.station) — show Tank + Time only. */}
                      <span className="muted chain__meta">{t.time}s</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
