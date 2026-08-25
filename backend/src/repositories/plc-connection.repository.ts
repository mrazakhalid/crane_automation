import { getStorage } from '../storage/index.js';
import type { PlcConnectionRecord } from '../models/plc-connection.model.js';

/**
 * PLC connection repository facade (data-access layer).
 *
 * Purpose: Stable entry point the services call; forwards to the active storage
 *   driver's `PlcConnectionStore` (Mongo or SQLite), so higher layers never know
 *   which backend is in use.
 */

/** Ensure a unique index/constraint on `name` (idempotent). */
export function ensurePlcConnectionIndexes(): Promise<void> {
  return getStorage().plcConnections.ensureIndexes();
}

/** Find a connection by id. */
export function findById(id: string): Promise<PlcConnectionRecord | null> {
  return getStorage().plcConnections.findById(id);
}

/** Find a connection by name — used for uniqueness checks. */
export function findByName(name: string): Promise<PlcConnectionRecord | null> {
  return getStorage().plcConnections.findByName(name);
}

/** The single active connection (or null). */
export function findActive(): Promise<PlcConnectionRecord | null> {
  return getStorage().plcConnections.findActive();
}

/** List all connections, newest first. */
export function listAll(): Promise<PlcConnectionRecord[]> {
  return getStorage().plcConnections.listAll();
}

/** List connections assigned to a line (for per-line PLC routing). */
export function listByLine(lineId: string): Promise<PlcConnectionRecord[]> {
  return getStorage().plcConnections.listByLine(lineId);
}

/** Count all connections (used to decide whether to seed one). */
export function countAll(): Promise<number> {
  return getStorage().plcConnections.countAll();
}

/** Insert a new connection record. */
export function insert(record: PlcConnectionRecord): Promise<void> {
  return getStorage().plcConnections.insert(record);
}

/** Apply a partial update by id and return the updated record (or null). */
export function update(
  id: string,
  patch: Partial<
    Pick<
      PlcConnectionRecord,
      'name' | 'endpoint' | 'securityMode' | 'securityPolicy' | 'isActive' | 'lineId' | 'cranes'
    >
  > & { updatedAt: string },
): Promise<PlcConnectionRecord | null> {
  return getStorage().plcConnections.update(id, patch);
}

/** Clear `isActive` on every connection. */
export function clearActive(): Promise<void> {
  return getStorage().plcConnections.clearActive();
}

/** Unassign every connection from a line (null lineId + clear cranes). */
export function unassignLine(lineId: string, updatedAt: string): Promise<void> {
  return getStorage().plcConnections.unassignLine(lineId, updatedAt);
}

/** Delete a connection by id. Returns true if a record was removed. */
export function deleteById(id: string): Promise<boolean> {
  return getStorage().plcConnections.delete(id);
}
