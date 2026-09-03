import { ChevronDown, ChevronUp, CircleDot } from 'lucide-react';
import { PlantLineTrack, buildCells } from './PlantLineTrack.js';
import type { PlantView } from '../types/plc.js';

/**
 * Whole-plant live overview: every line as an animated track with its cranes.
 *
 * Purpose: Presentational — given a polled `PlantView`, render one track per
 *   line plus a small legend. All animation state comes from the props (the
 *   caller polls `/plc/plant-view`); this component holds no timers.
 */
export function PlantVisualizer({ plant }: { plant: PlantView }): React.JSX.Element {
  if (plant.lines.length === 0) {
    return <p className="plant-empty">No lines configured yet. Add lines to see the plant view.</p>;
  }
  // The widest line's cell count drives a shared scale so every line uses the
  // same cell size and the whole plant fits the viewport width without scrolling.
  const maxCells = Math.max(1, ...plant.lines.map((line) => buildCells(line).length));
  return (
    <div className="plant">
      <div className="plant-topbar">
        <div className="plant-legend">
          <span className="plant-legend__item"><i className="plant-swatch" style={{ background: '#ffffff' }} /> Tank</span>
          <span className="plant-legend__item"><i className="plant-swatch" style={{ background: '#f4b183' }} /> Loading / Storage</span>
          <span className="plant-legend__item"><i className="plant-swatch" style={{ background: '#c5e0b3' }} /> Parking</span>
          <span className="plant-legend__item"><i className="plant-swatch" style={{ background: '#ff66ff' }} /> Spray / Inspection</span>
          <span className="plant-legend__item"><i className="plant-swatch" style={{ background: '#ffff00' }} /> Travel Zone</span>
          <span className="plant-legend__item"><i className="plant-swatch" style={{ background: '#37e8fb' }} /> Drying</span>
          <span className="plant-legend__item"><i className="plant-swatch plant-swatch--active" /> Current step</span>
          <span className="plant-legend__item">
            <ChevronUp size={13} /><ChevronDown size={13} /> Hoist up / down
          </span>
          <span className="plant-legend__item">
            <CircleDot size={13} /> Limit switch active
          </span>
        </div>
        <div
          className="plant-compass"
          title="Plant directions. Crane trolley travels East (left) ↔ West (right); the aisle across the lines is North (bottom) ↔ South (top). These are plant/pendant directions — true site north is rotated on the floor plan."
        >
          <span className="plant-compass__lbl plant-compass__n">N</span>
          <span className="plant-compass__lbl plant-compass__e">E</span>
          <span className="plant-compass__lbl plant-compass__s">S</span>
          <span className="plant-compass__lbl plant-compass__w">W</span>
          <span className="plant-compass__rose" aria-hidden="true" />
        </div>
      </div>
      <div
        className="plant-frame"
        title="Plant/pendant directions. Crane trolley travels East (left) ↔ West (right); the cross-aisle between lines is North (bottom) ↔ South (top). True site north is rotated on the floor plan."
      >
        <span className="plant-frame__dir plant-frame__dir--n">NORTH</span>
        <span className="plant-frame__dir plant-frame__dir--s">SOUTH</span>
        <span className="plant-frame__dir plant-frame__dir--w">WEST</span>
        <span className="plant-frame__dir plant-frame__dir--e">EAST</span>
        <div className="plant-frame__inner">
          {[...plant.lines]
            .sort((a, b) => a.lineName.localeCompare(b.lineName, undefined, { numeric: true }))
            .map((line) => (
              <PlantLineTrack key={line.lineId} line={line} maxCells={maxCells} />
            ))}
        </div>
      </div>
    </div>
  );
}
