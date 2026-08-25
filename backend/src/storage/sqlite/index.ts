import { openSqlite } from './client.js';
import { sqliteLineStore } from './line.store.js';
import { sqlitePlcConnectionStore } from './plc-connection.store.js';
import { sqlitePlcTagStore } from './plc-tag.store.js';
import { sqliteRecipeStore } from './recipe.store.js';
import { sqliteUserStore } from './user.store.js';
import type { Storage } from '../types.js';

/**
 * Build the connected SQLite storage.
 *
 * Returns: A `Storage` backed by an embedded SQLite database file.
 */
export async function createSqliteStorage(): Promise<Storage> {
  const db = openSqlite();
  return {
    users: sqliteUserStore(db),
    lines: sqliteLineStore(db),
    recipes: sqliteRecipeStore(db),
    plcConnections: sqlitePlcConnectionStore(db),
    plcTags: sqlitePlcTagStore(db),
    close: async () => {
      db.close();
    },
  };
}
