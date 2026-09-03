import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CraneView } from '../types/plc.js';

/**
 * Animated gantry-crane visualizer.
 *
 * Purpose: Turn a live `CraneView` snapshot (polled from the PLC) into a simple
 *   moving picture — the trolley glides left↔right between stations and the hoist
 *   raises/lowers — so a manager can watch the run without reading the watch table.
 *   Pure/presentational: all motion comes from the props.
 * Args: view — the latest crane snapshot.
 */

/**
 * Stations in the physical LEFT→RIGHT drawing order (matches the plant layout:
 * Loading, Parking, then the tanks). `idx` is the fixed PLC station number
 * (0=Parking, 1=Loading, 2+=tanks) — only the display order changes here.
 */
const STATIONS = [
  { idx: 1, label: 'Loading', kind: 'load' },
  { idx: 0, label: 'Parking', kind: 'park' },
  { idx: 2, label: '1-1A', kind: 'tank' },
  { idx: 3, label: '1-1B', kind: 'tank' },
  { idx: 4, label: '1-2', kind: 'tank' },
  { idx: 5, label: '1-3', kind: 'tank' },
] as const;

/** Human labels for the state-machine values the FB publishes in `sts_state`. */
const STATE_NAMES: Record<number, string> = {
  0: 'Idle · parked',
  10: 'Travelling to loading',
  20: 'Lowering at loading',
  30: 'Waiting for start button (3 s)',
  40: 'Lifting',
  50: 'Travelling to tank',
  60: 'Dipping into tank',
  70: 'Soaking (dwell)',
  80: 'Lifting out',
  85: 'Returning to parking',
  90: 'Batch complete',
};

/** Cable length (px) per hoist position — drives the vertical animation. */
const HOIST_PX: Record<CraneView['hoist'], number> = { up: 30, mid: 92, moving: 92, down: 150 };

export function CraneVisualizer({ view }: { view: CraneView }) {
  // `view.station` is kept non-null by useCraneView (it holds the last confirmed
  // station while travelling), so the trolley glides rather than snapping home.
  const station = view.station ?? 0;

  // Trolley position follows the DRAWING order, not the raw station number, so it
  // sits over the right box after the Loading/Parking swap above.
  const drawPos = Math.max(0, STATIONS.findIndex((s) => s.idx === station));
  const leftPct = ((drawPos + 0.5) / STATIONS.length) * 100;
  const cablePx = HOIST_PX[view.hoist];
  const travelling = view.moving.fwd || view.moving.rev;

  return (
    <div className="crane-viz">
      <div className="crane-viz__status">
        <span className={`crane-chip crane-chip--state${view.done ? ' is-done' : ''}`}>
          {STATE_NAMES[view.state] ?? `State ${view.state}`}
        </span>
        {view.busy && <span className="crane-chip crane-chip--busy">Running</span>}
        {view.done && <span className="crane-chip crane-chip--done">Done</span>}
        {view.taskCount > 0 && (
          <span className="muted">
            Step {view.step} / {view.taskCount}
          </span>
        )}
      </div>

      <div
        className="crane-frame"
        title="Crane travels East (left) ↔ West (right) along the line; the hoist raises (up) and lowers (down). Plant/pendant directions — a single crane's side view has no North/South."
      >
        <span className="crane-frame__dir crane-frame__dir--w">WEST</span>
        <span className="crane-frame__dir crane-frame__dir--e">EAST</span>
        <span className="crane-frame__dir crane-frame__dir--up">UP</span>
        <span className="crane-frame__dir crane-frame__dir--dn">DOWN</span>
        <div className="crane-viz__stage" role="img" aria-label={`Crane ${STATE_NAMES[view.state] ?? ''}`}>
          <div className="crane-viz__beam" />

        <div className="crane-viz__trolley" style={{ left: `${leftPct}%` }}>
          <div className={`crane-viz__cart${travelling ? ' is-moving' : ''}`}>
            {view.moving.rev && <ChevronLeft size={14} aria-hidden />}
            <span className="crane-viz__cart-body" />
            {view.moving.fwd && <ChevronRight size={14} aria-hidden />}
          </div>
          <div className="crane-viz__cable" style={{ height: cablePx }} />
          <div className="crane-viz__carrier" style={{ top: cablePx + 20 }}>
            {view.moving.down && <ArrowDown size={13} aria-hidden />}
            {view.moving.up && <ArrowUp size={13} aria-hidden />}
          </div>
        </div>

          <div className="crane-viz__stations">
            {STATIONS.map((s) => (
              <div
                key={s.idx}
                className={`crane-station crane-station--${s.kind}${station === s.idx ? ' is-here' : ''}`}
              >
                <span
                  className={`crane-station__switch${view.lsAt[s.idx] ? ' is-on' : ''}`}
                  title={`Limit switch ${s.idx}`}
                  aria-hidden
                />
                <div className="crane-station__box">
                  <span className="crane-station__label">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
