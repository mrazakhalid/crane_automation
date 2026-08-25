/**
 * Line domain model — the crane/tank layout of a plating line (data shapes only).
 *
 * Purpose: Single source of truth for what a saved line looks like (its cranes
 *   and ordered tank positions) and for the task rows generated when a manager
 *   decodes a QR recipe against a line. No logic lives here.
 */

/** A single tank/position in a line. `crane` is the primary servicing crane; a
 *  transfer tank (shared between two cranes) also carries the full `cranes` set. */
export interface Tank {
  /** 1-based position number within the line. */
  number: number;
  /** Physical tank name, e.g. `1-1A`, `TRVL-4B`. */
  name: string;
  /** Primary crane servicing this tank, e.g. `7A`. */
  crane: string;
  /** All cranes that share this tank (transfer tanks only). */
  cranes?: string[];
  /** True when this is a transfer tank shared between cranes. */
  transfer?: boolean;
  /** Optional human note (e.g. "shared by 7A & 7B"). */
  note?: string;
}

/** Stored line record (as persisted in MongoDB). `_id` mirrors our UUID v7 id. */
export interface LineRecord {
  _id: string;
  name: string;
  cranes: string[];
  tanks: Tank[];
  createdAt: string;
  updatedAt: string;
}

/** Client-safe line shape (`id` instead of `_id`). */
export interface PublicLine {
  id: string;
  name: string;
  cranes: string[];
  tanks: Tank[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A generated task row (computed from a QR recipe — never stored).
 *
 * `previous_task` / `next_task` hold the *tank number* of the neighbouring step
 * (0 at the ends), or the string `MISSING` when that neighbour's key could not
 * be resolved to a tank in the line.
 */
export const MISSING = 'missing' as const;

export interface GeneratedTask {
  /** 1-based order of the task in the recipe. */
  step: number;
  /** Raw QR key this task came from, e.g. `1-2`. */
  key: string;
  crane_name: string | typeof MISSING;
  tank_name: string | typeof MISSING;
  /** Dwell time in seconds. */
  time: number;
  previous_task: number | typeof MISSING;
  next_task: number | typeof MISSING;
  /** Always 0 for now (reserved for future task lifecycle). */
  status: number;
}

/**
 * Strip a stored line down to its client-safe shape.
 *
 * Args: record — a full `LineRecord`.
 * Returns: A `PublicLine` (`id` in place of `_id`).
 */
export function toPublicLine(record: LineRecord): PublicLine {
  return {
    id: record._id,
    name: record.name,
    cranes: record.cranes,
    tanks: record.tanks,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
