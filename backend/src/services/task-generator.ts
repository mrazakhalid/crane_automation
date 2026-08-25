import { MISSING, type GeneratedTask, type PublicLine, type Tank } from '../models/line.model.js';

/**
 * Task generator — turn a decoded QR recipe into an ordered task list.
 *
 * Purpose: Pure, side-effect-free logic (easy to unit-test) that maps each
 *   `key=seconds` entry of a QR recipe onto a tank of the given line and links
 *   the tasks by their neighbours. Unresolvable keys keep their place in the
 *   sequence with `MISSING` crane/tank so nothing silently drops.
 */

/** One raw `key=seconds` pair parsed from the QR string. */
interface QrEntry {
  key: string;
  time: number;
}

/**
 * Parse a raw QR string (`key=seconds;key=seconds;…`) into ordered entries.
 *
 * Args: qr — the decoded QR text.
 * Returns: Ordered `{ key, time }` pairs (empty/blank segments skipped).
 */
export function parseQr(qr: string): QrEntry[] {
  return qr
    .split(';')
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 0)
    .map((seg) => {
      const eq = seg.indexOf('=');
      const key = seg.slice(0, eq).trim();
      const time = Number.parseInt(seg.slice(eq + 1).trim(), 10);
      return { key, time: Number.isFinite(time) ? time : 0 };
    })
    .filter((e) => e.key.length > 0);
}

/** Normalize a key/name for matching: lowercase, trim, drop a trailing A/B/C… after a digit. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/(\d)[a-z]$/, '$1');
}

/**
 * Resolve a QR key to a tank in the line.
 *
 * Args: line — the saved line; key — a QR key such as `1-2`.
 * Returns: The matching `Tank`, or null when no tank matches. An exact
 *   (case-insensitive) name match wins; otherwise the lowest-numbered tank
 *   whose normalized name equals the normalized key (so `1-1` → tank 1).
 */
export function resolveTank(line: PublicLine, key: string): Tank | null {
  const wanted = key.trim().toLowerCase();
  const exact = line.tanks.find((t) => t.name.trim().toLowerCase() === wanted);
  if (exact) return exact;

  const nKey = normalize(key);
  const matches = line.tanks.filter((t) => normalize(t.name) === nKey);
  if (matches.length === 0) return null;
  return matches.reduce((lo, t) => (t.number < lo.number ? t : lo));
}

/** Display name for a tank's crane(s): "7A / 7B" for transfer tanks, else "7A". */
function craneLabel(tank: Tank): string {
  return tank.transfer && tank.cranes?.length ? tank.cranes.join(' / ') : tank.crane;
}

/**
 * Generate the ordered task list for a QR recipe against a line.
 *
 * Args: line — the saved line; qr — the decoded QR text.
 * Returns: One `GeneratedTask` per QR entry, in order. `previous_task` /
 *   `next_task` hold the neighbour's tank number (0 at the ends, `MISSING`
 *   when the neighbour's key is unresolved); `status` is always 0.
 */
export function generateTasks(line: PublicLine, qr: string): GeneratedTask[] {
  const entries = parseQr(qr);
  const tanks = entries.map((e) => resolveTank(line, e.key));

  /** Neighbour reference: 0 at an edge, the tank number, or MISSING if unresolved. */
  const ref = (i: number): number | typeof MISSING => {
    if (i < 0 || i >= tanks.length) return 0;
    return tanks[i] ? tanks[i]!.number : MISSING;
  };

  return entries.map((entry, i) => {
    const tank = tanks[i];
    return {
      step: i + 1,
      key: entry.key,
      crane_name: tank ? craneLabel(tank) : MISSING,
      tank_name: tank ? tank.name : MISSING,
      time: entry.time,
      previous_task: ref(i - 1),
      next_task: ref(i + 1),
      status: 0,
    };
  });
}
