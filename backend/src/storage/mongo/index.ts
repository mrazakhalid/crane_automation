import { openMongo } from './client.js';
import { mongoLineStore } from './line.store.js';
import { mongoPlcConnectionStore } from './plc-connection.store.js';
import { mongoPlcTagStore } from './plc-tag.store.js';
import { mongoRecipeStore } from './recipe.store.js';
import { mongoUserStore } from './user.store.js';
import type { Storage } from '../types.js';

/**
 * Build the connected Mongo storage.
 *
 * Returns: A `Storage` backed by MongoDB (real or in-memory).
 */
export async function createMongoStorage(): Promise<Storage> {
  const conn = await openMongo();
  return {
    users: mongoUserStore(conn.db),
    lines: mongoLineStore(conn.db),
    recipes: mongoRecipeStore(conn.db),
    plcConnections: mongoPlcConnectionStore(conn.db),
    plcTags: mongoPlcTagStore(conn.db),
    close: conn.close,
  };
}
