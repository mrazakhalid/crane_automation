import { getStorage } from '../storage/index.js';
import type { LineRecord } from '../models/line.model.js';

/**
 * Line repository facade (data-access layer).
 *
 * Purpose: Stable entry point the services call. It forwards to the active
 *   storage driver's `LineStore` (Mongo or SQLite, chosen by `STORAGE_DRIVER`),
 *   so higher layers never know which backend is in use.
 */

/** Ensure a unique index/constraint on `name` (idempotent). */
export function ensureLineIndexes(): Promise<void> {
  return getStorage().lines.ensureIndexes();
}

/** Find a line by name — used for uniqueness checks. */
export function findByName(name: string): Promise<LineRecord | null> {
  return getStorage().lines.findByName(name);
}

/** Find a line by id. */
export function findById(id: string): Promise<LineRecord | null> {
  return getStorage().lines.findById(id);
}

/** List all lines, newest first. */
export function listAll(): Promise<LineRecord[]> {
  return getStorage().lines.listAll();
}

/** Insert a new line record. */
export function insertLine(record: LineRecord): Promise<void> {
  return getStorage().lines.insertLine(record);
}

/**
 * Apply a partial update by id and return the updated record.
 *
 * Args: id — target line id; patch — fields to set (already validated).
 * Returns: The updated `LineRecord`, or null if no line matched.
 */
export function updateLine(
  id: string,
  patch: Partial<Pick<LineRecord, 'name' | 'cranes' | 'tanks'>> & { updatedAt: string },
): Promise<LineRecord | null> {
  return getStorage().lines.updateLine(id, patch);
}

/** Delete a line by id. Returns true if a record was removed. */
export function deleteLine(id: string): Promise<boolean> {
  return getStorage().lines.deleteLine(id);
}
