/**
 * OPC UA I/O log (in-memory ring buffer).
 *
 * Purpose: Record every value WRITTEN to a PLC (recipe task fields, `cmd_send`,
 *   manual commands) and every meaningful value READ back (command echoes,
 *   handshake `sts_*`), so an operator can watch — per PLC — exactly what the app
 *   sent and what came back while a recipe runs. The high-frequency animation poll
 *   (`getCraneView`) opts OUT so it doesn't drown the useful entries.
 *
 * Ephemeral: a bounded ring buffer (oldest dropped); a server restart clears it.
 * Entries store the raw `connectionId`; the HTTP layer resolves it to the PLC's
 * display name so the log reads "PLC_1 · Crane1AData.cmd_send = true".
 */

/** Direction of a logged OPC UA operation. */
export type PlcLogDir = 'write' | 'read';

/** One recorded OPC UA operation. */
export interface PlcLogEntry {
  seq: number;
  ts: number;
  dir: PlcLogDir;
  connectionId: string;
  nodeId: string;
  value: unknown;
  ok: boolean;
  error?: string;
}

/** Max entries kept; oldest are dropped. */
const CAPACITY = 2000;

const buffer: PlcLogEntry[] = [];
let seq = 0;

/**
 * Append one entry. Cheap + synchronous (safe to call on every read/write).
 * Args: partial entry (everything but `seq`/`ts`, which are stamped here).
 */
export function record(entry: Omit<PlcLogEntry, 'seq' | 'ts'>): void {
  seq += 1;
  buffer.push({ ...entry, seq, ts: Date.now() });
  if (buffer.length > CAPACITY) buffer.shift();
}

/**
 * Read recent entries.
 * Args: afterSeq — return only entries newer than this seq (0 = from the tail);
 *   limit — cap the number returned (newest kept).
 * Returns: entries in chronological order, plus the latest `seq` for the next poll.
 */
export function getRecent(afterSeq = 0, limit = 500): { entries: PlcLogEntry[]; lastSeq: number } {
  const filtered = afterSeq > 0 ? buffer.filter((e) => e.seq > afterSeq) : buffer;
  const entries = filtered.slice(-limit);
  return { entries, lastSeq: seq };
}

/** Clear the buffer (used by the "clear log" action and tests). */
export function clear(): void {
  buffer.length = 0;
  seq = 0;
}
