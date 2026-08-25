import { MongoClient, type Db } from 'mongodb';
import { env } from '../../config/env.js';

/**
 * MongoDB connection lifecycle for the mongo storage driver.
 *
 * Purpose: Own a single MongoClient. When MONGODB_URI is empty in dev/test an
 *   in-memory MongoDB is started so the app runs with zero setup; production
 *   requires a real URI.
 */
export interface MongoConn {
  db: Db;
  close(): Promise<void>;
}

/**
 * Open a MongoDB connection (real or in-memory).
 *
 * Returns: `{ db, close }` — the connected database and a close function.
 * Raises: Error if production is misconfigured (no MONGODB_URI), or any driver
 *   connection error.
 */
export async function openMongo(): Promise<MongoConn> {
  let uri = env.MONGODB_URI;
  let memoryServer: { stop: () => Promise<unknown> } | null = null;

  if (!uri) {
    if (env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI is required in production');
    }
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    uri = server.getUri();
    console.log('🧪 No MONGODB_URI set — started in-memory MongoDB for', env.NODE_ENV);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(env.MONGODB_DB);

  return {
    db,
    close: async () => {
      await client.close();
      await memoryServer?.stop();
    },
  };
}
