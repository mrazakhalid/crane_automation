import {
  ArrowLeftRight,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Factory,
  Minus,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CranePlantView, CraneView, LinePlantView } from '../types/plc.js';
import type { Tank } from '../types/line.js';

/**
 * One plating line rendered as a horizontal track laid out to match the plant
 * drawing (`raza_docs/Plating Line 05-15-2026 Rev 27.vsdx`): the Loading busbar
 * on the far LEFT, then each crane's zone left→right in physical order (the
 * `line.cranes` order — entry crane first), each zone's tanks in station order,
 * and each crane's Parking home at the end of its zone (on 3+ crane lines the
 * entry crane instead parks at the far left by the loading busbar, e.g. 7A).
 *
 * Every cell is filled with the DRAWING'S colour convention (from the Visio
 * legend): Parking = green, Loading/Storage = orange, Spray/Inspection = magenta,
 * Travel Zone = yellow, Drying = cyan, process tank = white. A thin colour bar
 * under each cell shows which crane owns that stretch. Crane avatars float above
 * the rail at their live station and glide on movement.
 */

/** Fixed cell width (px). MUST match `--plant-cell` in index.css for avatar positioning. */
const CELL = 84;

/**
 * The plant drawing's colour convention, taken verbatim from the Visio legend
 * ("Legend For Tanks"). `fill`/`ink`/`border` per space type.
 */
const TYPE_STYLE = {
  park: { fill: '#c5e0b3', ink: '#22350f', border: '#8fbf6e' }, // Parking Station
  load: { fill: '#f4b183', ink: '#5a3113', border: '#d98a4e' }, // Unloading/Loading/Storage
  spray: { fill: '#ff66ff', ink: '#4a0047', border: '#d63fd6' }, // Spray/Inspection (INS-)
  travel: { fill: '#ffff00', ink: '#4a4400', border: '#cccc00' }, // Travel Zones Spray (TRVL-)
  dry: { fill: '#37e8fb', ink: '#053a44', border: '#12bcd0' }, // Drying Station (DRY-)
  tank: { fill: '#ffffff', ink: '#161616', border: '#c9c9c9' }, // process tank
} as const;
type CellType = keyof typeof TYPE_STYLE;

/** Classify a cell into its drawing colour type by kind + name prefix. */
function classify(label: string, kind: Cell['kind']): CellType {
  if (kind === 'park') return 'park';
  if (kind === 'load') return 'load';
  const n = label.toUpperCase();
  if (n.startsWith('TRVL')) return 'travel';
  if (n.startsWith('INS')) return 'spray';
  if (n.startsWith('DRY')) return 'dry';
  if (n.startsWith('LOAD')) return 'load';
  if (n.startsWith('PRK')) return 'park';
  return 'tank';
}

/** State-machine value → short human label (matches the crane sequencer 0..90). */
const STATE_LABELS: Record<number, string> = {
  0: 'Idle',
  10: 'Travelling',
  20: 'Lowering',
  30: 'Waiting',
  40: 'Lifting',
  50: 'To tank',
  60: 'Dipping',
  70: 'Soaking',
  80: 'Lifting out',
  85: 'Returning',
  90: 'Done',
};

/** Distinct avatar colours per crane, by their order in the line. */
const CRANE_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#fb7185'];

interface Cell {
  station: number;
  label: string;
  kind: 'park' | 'load' | 'tank' | 'transfer';
  note?: string;
  /** Owning crane (tank cells only) — used to tint the zone. */
  crane?: string;
  /** True on the first cell of a crane's zone (draws the zone divider + tag). */
  zoneStart?: boolean;
}

/**
 * Build the ordered cells to match the plant drawing, left→right:
 *   LOAD (station 1, far left) → each crane's tanks in `line.cranes` order
 *   (entry crane first; tanks sorted by station within a zone) → PARK (station 0).
 * Stations are line-global (`tank.number + 1`), so crane avatars still locate
 * their cell by station value regardless of visual order.
 */
export function buildCells(line: LinePlantView): Cell[] {
  const byCrane = new Map<string, Tank[]>();
  for (const t of line.tanks) {
    const arr = byCrane.get(t.crane) ?? [];
    arr.push(t);
    byCrane.set(t.crane, arr);
  }
  // Crane order = physical zone order (drawing). Append any stray groups last.
  const craneOrder = [...line.cranes, ...[...byCrane.keys()].filter((c) => !line.cranes.includes(c))];

  // On long (3+ crane) lines the entry crane has its own parking by the loading
  // busbar at the far LEFT (drawing: Line 4's 7A parks at PRK-4C). On 2-crane
  // lines both cranes park at the end of their zone (centre + right exit).
  const entry = craneOrder[0];
  const entryParksLeft = craneOrder.length >= 3;

  const cells: Cell[] = [{ station: 1, label: 'LOAD', kind: 'load' }];
  if (entryParksLeft && entry) {
    cells.push({ station: 0, label: `P·${entry}`, kind: 'park', crane: entry });
  }
  for (const crane of craneOrder) {
    const tanks = (byCrane.get(crane) ?? []).sort((a, b) => a.number - b.number);
    tanks.forEach((t, i) => {
      cells.push({
        station: t.number + 1,
        label: t.name,
        kind: t.transfer ? 'transfer' : 'tank',
        note: t.note,
        crane,
        zoneStart: i === 0,
      });
    });
    // Each crane's home (station 0) sits at the end of its zone — unless it is
    // the entry crane that already parked at the far left.
    if (!(entryParksLeft && crane === entry)) {
      cells.push({ station: 0, label: `P·${crane}`, kind: 'park', crane });
    }
  }
  return cells;
}

/** The crane's live physical station (limit switch), falling back to its task target. */
function craneStation(cv: CranePlantView): number {
  return cv.view?.station ?? cv.currentStation ?? 0;
}

/**
 * Live travel direction from the crane's motor bits. The sequencer sets `mv_fwd`
 * to travel toward HIGHER station numbers, which is the process "forward"
 * direction = **West** (right on the track, per the plant: East=left, West=right).
 * `mv_rev` = East (back toward Loading). `mv_up`/`mv_down` = hoist. Idle → nothing.
 */
function TravelBadge({ moving }: { moving: CraneView['moving'] }): React.JSX.Element | null {
  const bits: React.JSX.Element[] = [];
  if (moving.fwd) bits.push(<span key="w" className="plant-dir plant-dir--ew"><ChevronRight size={12} /> West</span>);
  else if (moving.rev) bits.push(<span key="e" className="plant-dir plant-dir--ew"><ChevronLeft size={12} /> East</span>);
  if (moving.up) bits.push(<span key="u" className="plant-dir plant-dir--ud"><ChevronUp size={12} /> hoist</span>);
  else if (moving.down) bits.push(<span key="d" className="plant-dir plant-dir--ud"><ChevronDown size={12} /> hoist</span>);
  return bits.length ? <span className="plant-travel">{bits}</span> : null;
}

/**
 * Live hoist + limit-switch state. Hoist position comes from `ls_up`/`ls_dip`
 * (exposed as `view.hoist`); the position limit switch is `ls_at[station]` — when
 * `view.station` is non-null the crane is sitting on that station's switch.
 */
function HoistLimit({ view }: { view: CraneView }): React.JSX.Element {
  const hoistLabel =
    view.hoist === 'up' ? 'Up' : view.hoist === 'down' ? 'Down' : view.hoist === 'moving' ? 'Moving' : 'Mid';
  const HoistIcon =
    view.moving.up || view.hoist === 'up'
      ? ChevronUp
      : view.moving.down || view.hoist === 'down'
        ? ChevronDown
        : Minus;
  return (
    <>
      <span className={`plant-hoist plant-hoist--${view.hoist}`} title="Hoist (from ls_up / ls_dip limit switches)">
        <HoistIcon size={12} /> hoist {hoistLabel}
      </span>
      {view.station != null && (
        <span className="plant-ls" title={`Position limit switch made — ls_at[${view.station}]`}>
          <CircleDot size={11} /> LS {view.station}
        </span>
      )}
    </>
  );
}

function CraneReadout({ cv, color }: { cv: CranePlantView; color: string }): React.JSX.Element {
  const state = cv.view ? (STATE_LABELS[cv.view.state] ?? `State ${cv.view.state}`) : null;
  return (
    <div className="plant-readout">
      <span className="plant-readout__chip" style={{ background: color }}>
        {cv.connected ? <Wifi size={12} /> : <WifiOff size={12} />} Crane {cv.crane}
      </span>
      {cv.connected && cv.view ? (
        <span className="plant-readout__text">
          {state}
          {cv.view.taskCount > 0 && <> · step {cv.view.step}/{cv.view.taskCount}</>}
          {cv.currentTank && <> · at <b>{cv.currentTank}</b></>}
          {cv.nextTank && (
            <> <ArrowRight size={12} className="plant-inline-icon" /> next <b>{cv.nextTank}</b></>
          )}
          <TravelBadge moving={cv.view.moving} />
          <HoistLimit view={cv.view} />
        </span>
      ) : (
        <span className="plant-readout__text plant-readout__text--muted">{cv.error ?? 'no signal'}</span>
      )}
    </div>
  );
}

/** Overhang (px) of the crane avatars above the rail (see `.plant-crane` top). */
const AVATAR_OVERHANG = 30;
/** Unscaled rail height (px) — matches `.plant-track__rail` height. */
const RAIL_HEIGHT = 62;

/**
 * Observe an element's content width so the track can scale itself to fit.
 * Returns the live pixel width (0 until first measured).
 */
function useElementWidth<T extends HTMLElement>(ref: React.RefObject<T | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export function PlantLineTrack({
  line,
  maxCells,
}: {
  line: LinePlantView;
  /** Cell count of the widest line in the plant — drives a shared scale so every
   *  line uses the same cell size and the widest one exactly fills the width. */
  maxCells: number;
}): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const trackWidth = useElementWidth(trackRef);
  const cells = buildCells(line);
  // One shared scale for all lines: make the widest line fill the track width,
  // growing on large screens and shrinking on small ones — never a scrollbar.
  const scale = trackWidth > 0 && maxCells > 0 ? trackWidth / (maxCells * CELL) : 1;
  const topPad = Math.ceil(AVATAR_OVERHANG * scale) + 6;
  const trackStyle: React.CSSProperties = {
    paddingTop: topPad,
    height: topPad + RAIL_HEIGHT * scale + 12,
  };
  const colorOf = (crane: string): string =>
    CRANE_COLORS[Math.max(0, line.cranes.indexOf(crane)) % CRANE_COLORS.length] ?? '#f59e0b';
  const anyConnected = line.cranesView.some((c) => c.connected);
  // Stations that are the current task target of some crane (pulse them).
  const activeStations = new Set(
    line.cranesView.map((c) => c.currentStation).filter((s): s is number => s != null),
  );

  return (
    <section className="plant-line">
      <header className="plant-line__head">
        <h3 className="plant-line__name">
          <Factory size={16} /> {line.lineName}
        </h3>
        <span className={`plant-line__status${anyConnected ? ' is-live' : ''}`}>
          {anyConnected ? <><CircleDot size={12} /> LIVE</> : <><WifiOff size={12} /> no signal</>}
        </span>
        <span className="plant-line__axis" title="Crane trolley travel (pendant R-East/R-West): East ← left, West → right">
          <ChevronLeft size={12} /> East
          <span className="plant-line__axis-sep">crane travel</span>
          West <ChevronRight size={12} />
        </span>
        <div className="plant-line__readouts">
          {line.cranesView.map((cv) => (
            <CraneReadout key={cv.crane} cv={cv} color={colorOf(cv.crane)} />
          ))}
        </div>
      </header>

      <div className="plant-track" ref={trackRef} style={trackStyle}>
        <div
          className="plant-track__rail"
          style={{ width: cells.length * CELL, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {cells.map((cell, i) => {
            const zone = cell.crane ? colorOf(cell.crane) : undefined;
            const ty = classify(cell.label, cell.kind);
            const st = TYPE_STYLE[ty];
            return (
              <div
                key={`${cell.kind}:${cell.crane ?? ''}:${cell.station}:${i}`}
                className={`plant-cell plant-cell--${ty}${cell.kind !== 'park' && activeStations.has(cell.station) ? ' is-active' : ''}${cell.zoneStart ? ' is-zone-start' : ''}`}
                style={{ left: i * CELL, background: st.fill, color: st.ink, borderColor: st.border }}
                title={cell.note ? `${cell.label} — ${cell.note}` : cell.label}
              >
                {cell.zoneStart && cell.crane && (
                  <span className="plant-cell__zone" style={{ background: zone }}>{cell.crane}</span>
                )}
                {cell.kind === 'transfer' && (
                  <ArrowLeftRight size={11} className="plant-cell__xfer" aria-label="transfer tank" />
                )}
                <span className="plant-cell__label">{cell.label}</span>
                {cell.note && <span className="plant-cell__note">{cell.note}</span>}
                {zone && <span className="plant-cell__cranebar" style={{ background: zone }} />}
              </div>
            );
          })}
          {line.cranesView.map((cv) => {
            const station = craneStation(cv);
            // Station 0 = home: send the crane to ITS OWN park cell (one per crane);
            // otherwise locate the cell by line-global station value.
            const idx =
              station === 0
                ? cells.findIndex((c) => c.kind === 'park' && c.crane === cv.crane)
                : cells.findIndex((c) => c.station === station);
            if (idx < 0) return null;
            const travelling = cv.connected && cv.view?.station == null;
            return (
              <div
                key={cv.crane}
                className={`plant-crane${cv.connected ? '' : ' is-offline'}${travelling ? ' is-travelling' : ''}`}
                style={{ left: idx * CELL, background: colorOf(cv.crane) }}
                title={`Crane ${cv.crane}`}
              >
                {cv.crane}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
