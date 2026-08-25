import { getStorage } from '../storage/index.js';
import type { PlcTagRecord } from '../models/plc-tag.model.js';

/**
 * PLC tag repository facade (data-access layer).
 *
 * Purpose: Stable entry point the services call; forwards to the active storage
 *   driver's `PlcTagStore` (Mongo or SQLite), so higher layers never know which
 *   backend is in use.
 */

/** Ensure the unique `(connectionId, label)` index (idempotent). */
export function ensurePlcTagIndexes(): Promise<void> {
  return getStorage().plcTags.ensureIndexes();
}

/** Find a tag by id. */
export function findById(id: string): Promise<PlcTagRecord | null> {
  return getStorage().plcTags.findById(id);
}

/** Find a tag by its label within a connection — used for uniqueness + lookup. */
export function findByLabel(connectionId: string, label: string): Promise<PlcTagRecord | null> {
  return getStorage().plcTags.findByLabel(connectionId, label);
}

/** List all tags for a connection, oldest first. */
export function listByConnection(connectionId: string): Promise<PlcTagRecord[]> {
  return getStorage().plcTags.listByConnection(connectionId);
}

/** Insert a new tag record. */
export function insert(record: PlcTagRecord): Promise<void> {
  return getStorage().plcTags.insert(record);
}

/** Apply a partial update by id and return the updated record (or null). */
export function update(
  id: string,
  patch: Partial<
    Pick<PlcTagRecord, 'label' | 'nodeId' | 'dataType' | 'direction' | 'description'>
  > & { updatedAt: string },
): Promise<PlcTagRecord | null> {
  return getStorage().plcTags.update(id, patch);
}

/** Delete a tag by id. Returns true if a record was removed. */
export function deleteById(id: string): Promise<boolean> {
  return getStorage().plcTags.delete(id);
}

/** Cascade delete every tag for a connection. Returns the number removed. */
export function deleteByConnection(connectionId: string): Promise<number> {
  return getStorage().plcTags.deleteByConnection(connectionId);
}
