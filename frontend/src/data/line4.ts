import type { NewLine } from '../types/line.js';

/**
 * Fixed layout for **line4**, taken from the panel drawings (source of truth).
 *
 * Purpose: The canonical crane/tank layout — 3 cranes (7A, 7B, 6) and 17 tank
 *   positions. Each tank belongs to exactly ONE crane (the one whose PLC reads its
 *   limit switch), so every tank maps to a single crane → PLC for batch routing:
 *   7A + 6 are on PLC_4, 7B is on PLC_6. Transfer tanks (`TRVL-*`) are flagged but
 *   are still owned by one crane per the drawings. Posting this creates the line.
 */
export const LINE4_TEMPLATE: NewLine = {
  name: 'line4',
  cranes: ['7A', '7B', '6'],
  tanks: [
    // Crane 7A (PLC_4)
    { number: 1, name: '1-1A', crane: '7A' },
    { number: 2, name: '1-1B', crane: '7A' },
    { number: 3, name: '1-2', crane: '7A' },
    { number: 4, name: '1-3', crane: '7A' },
    { number: 5, name: '1-4A', crane: '7A' },
    { number: 6, name: '1-4B', crane: '7A' },
    // Crane 7B (PLC_6)
    { number: 7, name: '1-4C', crane: '7B' },
    { number: 8, name: '1-5', crane: '7B' },
    { number: 9, name: '1-6', crane: '7B' },
    { number: 10, name: 'TRVL-4B', crane: '7B', transfer: true },
    // Crane 6 (PLC_4)
    { number: 11, name: '1-7B', crane: '6' },
    { number: 12, name: '1-8', crane: '6' },
    { number: 13, name: '1-9', crane: '6' },
    { number: 14, name: '1-10A', crane: '6' },
    { number: 15, name: '1-10B', crane: '6' },
    { number: 16, name: '1-11', crane: '6' },
    { number: 17, name: 'TRVL-4A', crane: '6', transfer: true },
  ],
};
