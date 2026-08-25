import { env } from '../config/env.js';
import type { Storage } from './types.js';

/**
 * Storage lifecycle + driver selection.
 *
 * Purpose: Own the single active `Storage` for the process and pick the driver
 *   from `STORAGE_DRIVER` at connect time. Only the chosen driver module is
 *   imported (dynamically), so the web build never loads the SQLite native
 *   module and the offline build never needs MongoDB.
 */
let storage: Storage | null = null;

/**
 * Connect the configured storage driver and cache it.
 *
 * Returns: The connected `Storage`.
 * Raises: Any driver connection/setup error (fails fast at boot).
 */
export async function connectStorage(): Promise<Storage> {
  if (storage) return storage;

  if (env.STORAGE_DRIVER === 'sqlite') {
    const { createSqliteStorage } = await import('./sqlite/index.js');
    storage = await createSqliteStorage();
    console.log('🗄️  Storage driver: sqlite');
  } else {
    const { createMongoStorage } = await import('./mongo/index.js');
    storage = await createMongoStorage();
    console.log('🗄️  Storage driver: mongo');
  }
  return storage;
}

/**
 * Get the connected storage.
 *
 * Returns: The active `Storage`.
 * Raises: Error if called before `connectStorage()`.
 */
export function getStorage(): Storage {
  if (!storage) throw new Error('Storage not connected — call connectStorage() first');
  return storage;
}

/** Close the active storage (used on shutdown and in tests). */
export async function closeStorage(): Promise<void> {
  await storage?.close();
  storage = null;
}
