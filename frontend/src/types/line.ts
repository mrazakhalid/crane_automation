/**
 * Shared line/task types (mirror of the backend contract).
 *
 * Purpose: One place for the Line/Tank shapes and the generated-task row used
 *   across the Lines admin screen and the manager task generator.
 */

/** Sentinel written into a task field that could not be resolved to a tank. */
export const MISSING = 'missing';

export interface Tank {
  number: number;
  name: string;
  crane: string;
  cranes?: string[];
  transfer?: boolean;
  note?: string;
}

export interface Line {
  id: string;
  name: string;
  cranes: string[];
  tanks: Tank[];
  createdAt: string;
  updatedAt: string;
}

/** Payload for creating a line (no server-assigned fields). */
export interface NewLine {
  name: string;
  cranes: string[];
  tanks: Tank[];
}

/** A generated task row (from decoding a QR recipe against a line). */
export interface GeneratedTask {
  step: number;
  key: string;
  crane_name: string;
  tank_name: string;
  time: number;
  previous_task: number | string;
  next_task: number | string;
  status: number;
}
