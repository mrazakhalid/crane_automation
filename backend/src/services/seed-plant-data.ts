import type { Tank } from '../models/line.model.js';

/**
 * Default plant layout — the fixed EPZ plating floor (6 PLCs, 5 lines, 10 cranes).
 *
 * Purpose: Static source of truth for the `seedPlantLayout()` bootstrap so a
 *   fresh database (e.g. the offline desktop's SQLite file) comes pre-populated
 *   with the real lines + PLC connections instead of being empty.
 *
 * Provenance: tank `number`/`name`/`crane` are derived from the per-crane PLC
 *   IOMaps in `plc/<PLC>/IOMap.scl` (so `station = number + 1` matches the PLC), and
 *   the chemistry `note`s from `raza_docs/Plating Line 05-15-2026 Rev 27.vsdx`.
 *   Line 4 matches the proven Line 4 DB verbatim. Lines 1/2/3/5 station order is
 *   the PLC's — physically correct for routing (tanks resolve by name), but the
 *   entry/downstream split should be sanity-checked against the floor plan.
 */
export interface SeedLine {
  name: string;
  cranes: string[];
  tanks: Tank[];
}

export const PLANT_LINES: SeedLine[] = [
  {
    name: 'line1',
    cranes: ['1A', '1B'],
    tanks: [
      { number: 1, name: '2-1A', crane: '1A', note: 'Electro Cleaner' },
      { number: 2, name: '2-1B', crane: '1A', note: 'Electro Cleaner' },
      { number: 3, name: '2-2', crane: '1A', note: 'Electro Rinse' },
      { number: 4, name: 'INS-1A', crane: '1A' },
      { number: 5, name: '2-3', crane: '1A', note: 'Electro Rinse' },
      { number: 6, name: '2-4A', crane: '1A', note: 'HCL Acid' },
      { number: 7, name: '2-4B', crane: '1A', note: 'HCL Acid' },
      { number: 8, name: '2-5', crane: '1A', note: 'Rinse' },
      { number: 9, name: '14-3', crane: '1A', note: 'Electro Polish Rinse' },
      { number: 10, name: 'TRVL-1A', crane: '1A', cranes: ['1A', '1B'], transfer: true, note: 'Transfer tank — shared by 1A & 1B' },
      { number: 11, name: '7-1', crane: '1B', note: 'Citric Passivate' },
      { number: 12, name: '7-2', crane: '1B', note: 'Passivate Rinse' },
      { number: 13, name: '14-2', crane: '1B', note: 'Electro Polish Rinse' },
      { number: 14, name: '14-1', crane: '1B', note: 'Electro Polish' },
    ],
  },
  {
    name: 'line2',
    cranes: ['3', '2'],
    tanks: [
      { number: 1, name: '15-3', crane: '2', note: 'E-Nickel Storage' },
      { number: 2, name: '4-7', crane: '2', note: 'BIG Elec Nickel' },
      { number: 3, name: '4-9', crane: '2', note: 'Rinse' },
      { number: 4, name: 'INS-2A', crane: '2' },
      { number: 5, name: '4-10', crane: '2', note: 'Rinse' },
      { number: 6, name: '4-6A', crane: '2', cranes: ['2', '3'], transfer: true, note: 'Transfer tank — shared by 2 & 3' },
      { number: 7, name: 'DRY-2A', crane: '3' },
      { number: 8, name: '4-8', crane: '3', note: 'Hot Water' },
      { number: 9, name: '4-1', crane: '3', note: 'Zincate' },
      { number: 10, name: '4-2', crane: '3', note: 'Zincate' },
      { number: 11, name: '4-3', crane: '3', note: 'Zincate' },
      { number: 12, name: '4-4', crane: '3', note: 'Zincate Strip' },
      { number: 13, name: '4-5', crane: '3', note: 'Zincate' },
      { number: 14, name: 'INS-2B', crane: '3' },
      { number: 15, name: '4-11', crane: '3', note: 'Rinse' },
      { number: 16, name: '4-6B', crane: '3', note: 'E-Nickel Rinse' },
      { number: 17, name: 'TRVL-2A', crane: '3' },
    ],
  },
  {
    name: 'line3',
    cranes: ['5', '4'],
    tanks: [
      { number: 1, name: '1-16', crane: '4', note: 'Rinse' },
      { number: 2, name: '1-15', crane: '4', note: 'Rinse' },
      { number: 3, name: '1-14', crane: '4', note: 'Rinse' },
      { number: 4, name: '1-13', crane: '4', note: 'Rinse' },
      { number: 5, name: '1-12B', crane: '4', note: 'Deox' },
      { number: 6, name: '1-12A', crane: '4', note: 'Deox' },
      { number: 7, name: 'TRVL-3A', crane: '4' },
      { number: 8, name: '15-2', crane: '4', cranes: ['4', '5'], transfer: true, note: 'Transfer tank — shared by 4 & 5' },
      { number: 9, name: 'DRY-3A', crane: '5' },
      { number: 10, name: '3-4A', crane: '5', note: 'Hot Water Rinse' },
      { number: 11, name: 'INS-3A', crane: '5' },
      { number: 12, name: '6-2', crane: '5', note: 'Rack Stripper' },
      { number: 13, name: '6-1', crane: '5', note: 'Rack Rinse' },
      { number: 14, name: '3-3', crane: '5', note: 'Zincate' },
      { number: 15, name: '3-2', crane: '5', note: 'Hot Water Rinse' },
      { number: 16, name: '3-1B', crane: '5', note: 'Clear Alodine' },
      { number: 17, name: '3-1A', crane: '5', note: 'Clear Alodine' },
      { number: 18, name: 'TRVL-3B', crane: '5' },
    ],
  },
  {
    name: 'line4',
    cranes: ['7A', '7B', '6'],
    tanks: [
      { number: 1, name: '1-1A', crane: '7A', note: 'Cold Etch' },
      { number: 2, name: '1-1B', crane: '7A', note: 'Cold Etch' },
      { number: 3, name: '1-2', crane: '7A', note: 'Rinse' },
      { number: 4, name: '1-3', crane: '7A', note: 'Rinse' },
      { number: 5, name: '1-4A', crane: '7A', note: 'Hot Soap' },
      { number: 6, name: '1-4B', crane: '7A', cranes: ['7A', '7B'], transfer: true, note: 'Transfer tank — shared by 7A & 7B' },
      { number: 7, name: '1-4C', crane: '7B' },
      { number: 8, name: '1-5', crane: '7B', note: 'Hot Etch' },
      { number: 9, name: '1-6', crane: '7B', note: 'Rinse' },
      { number: 10, name: 'TRVL-4B', crane: '7B', cranes: ['7B', '6'], transfer: true, note: 'Transfer tank — shared by 7B & 6' },
      { number: 11, name: '1-7B', crane: '6', note: 'Rinse' },
      { number: 12, name: '1-8', crane: '6', note: 'Rinse' },
      { number: 13, name: '1-9', crane: '6', note: 'Prepolio' },
      { number: 14, name: '1-10A', crane: '6', note: 'Prepolio' },
      { number: 15, name: '1-10B', crane: '6', note: 'Prepolio' },
      { number: 16, name: '1-11', crane: '6', note: 'Rinse' },
      { number: 17, name: 'TRVL-4A', crane: '6' },
    ],
  },
  {
    name: 'line5',
    cranes: ['9', '8'],
    tanks: [
      { number: 1, name: '5-2', crane: '8', note: 'Rinse' },
      { number: 2, name: 'INS-5A', crane: '8' },
      { number: 3, name: '5-3', crane: '8', note: 'H. Anodiz Rinse' },
      { number: 4, name: 'INS-5B', crane: '8' },
      { number: 5, name: '5-1', crane: '8', note: 'Regular Anodize' },
      { number: 6, name: 'INS-5C', crane: '8' },
      { number: 7, name: '5-4', crane: '8', note: 'Deox B.Black' },
      { number: 8, name: '5-5', crane: '8', cranes: ['8', '9'], transfer: true, note: 'Transfer tank — shared by 8 & 9' },
      { number: 9, name: 'DRY-5A', crane: '9' },
      { number: 10, name: '5-12', crane: '9', note: 'Hot Water Rinse' },
      { number: 11, name: 'INS-5E', crane: '9' },
      { number: 12, name: '5-11', crane: '9', note: 'Rinse' },
      { number: 13, name: '5-10', crane: '9', note: 'Rinse' },
      { number: 14, name: '5-9', crane: '9', note: 'Anodize Seal' },
      { number: 15, name: 'INS-5D', crane: '9' },
      { number: 16, name: '5-8', crane: '9', note: 'Black Dye' },
      { number: 17, name: '5-7', crane: '9', note: 'Black Dye' },
      { number: 18, name: '5-6', crane: '9', note: 'Black Dye' },
      { number: 19, name: 'TRVL-5A', crane: '9' },
    ],
  },
];

/** A default OPC UA connection per physical PLC panel, bound to its line + cranes. */
export interface SeedPlc {
  name: string;
  line: string;
  cranes: string[];
  endpoint: string;
  active: boolean;
}

// IPs: PLC_3/4/6 are the confirmed panel addresses; PLC_1/2/5 follow the
// documented `.11X` NIC convention as placeholders (TBD — edit in PLC Manager).
// PLC_4 is the reference/sim target, so it is the single Active connection.
export const PLANT_PLCS: SeedPlc[] = [
  { name: 'PLC_1', line: 'line1', cranes: ['1A', '1B'], endpoint: 'opc.tcp://192.168.0.111:4840', active: false },
  { name: 'PLC_2', line: 'line2', cranes: ['2', '3'], endpoint: 'opc.tcp://192.168.0.112:4840', active: false },
  { name: 'PLC_3', line: 'line3', cranes: ['4', '5'], endpoint: 'opc.tcp://192.168.0.113:4840', active: false },
  { name: 'PLC_4', line: 'line4', cranes: ['6', '7A'], endpoint: 'opc.tcp://192.168.0.114:4840', active: true },
  { name: 'PLC_5', line: 'line5', cranes: ['8', '9'], endpoint: 'opc.tcp://192.168.0.115:4840', active: false },
  { name: 'PLC_6', line: 'line4', cranes: ['7B'], endpoint: 'opc.tcp://192.168.0.116:4840', active: false },
];
