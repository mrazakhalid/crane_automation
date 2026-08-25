import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '../../config/env.js';

/**
 * SQLite connection + schema for the sqlite storage driver.
 *
 * Purpose: Open the embedded database file (creating its folder as needed) and
 *   apply the idempotent schema. `SQLITE_PATH` chooses the file; empty →
 *   `data/crane.db` under the cwd; `:memory:` gives a hermetic in-memory DB
 *   (used by tests). This driver needs no separate server process.
 */
export function openSqlite(): Database.Database {
  const path = env.SQLITE_PATH || resolve(process.cwd(), 'data', 'crane.db');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}

/** Create the tables + uniqueness constraints if they don't exist. */
function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      _id          TEXT PRIMARY KEY,
      username     TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role         TEXT NOT NULL,
      createdAt    TEXT NOT NULL,
      updatedAt    TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lines (
      _id        TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      cranes     TEXT NOT NULL,
      tanks      TEXT NOT NULL,
      createdAt  TEXT NOT NULL,
      updatedAt  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recipes (
      _id        TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      qr         TEXT NOT NULL,
      overrides  TEXT NOT NULL DEFAULT '{}',
      createdAt  TEXT NOT NULL,
      updatedAt  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plc_connections (
      _id            TEXT PRIMARY KEY,
      name           TEXT NOT NULL UNIQUE,
      endpoint       TEXT NOT NULL,
      securityMode   TEXT NOT NULL,
      securityPolicy TEXT NOT NULL,
      isActive       INTEGER NOT NULL DEFAULT 0,
      lineId         TEXT,
      cranes         TEXT NOT NULL DEFAULT '[]',
      createdAt      TEXT NOT NULL,
      updatedAt      TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plc_tags (
      _id          TEXT PRIMARY KEY,
      connectionId TEXT NOT NULL,
      label        TEXT NOT NULL,
      nodeId       TEXT NOT NULL,
      dataType     TEXT NOT NULL,
      direction    TEXT NOT NULL,
      description  TEXT,
      createdAt    TEXT NOT NULL,
      updatedAt    TEXT NOT NULL,
      UNIQUE (connectionId, label)
    );
  `);

  // Additive column migrations for databases created before a field existed
  // (CREATE TABLE IF NOT EXISTS never alters an existing table).
  addColumnIfMissing(db, 'plc_connections', 'lineId', 'TEXT');
  addColumnIfMissing(db, 'plc_connections', 'cranes', "TEXT NOT NULL DEFAULT '[]'");
  db.exec('CREATE INDEX IF NOT EXISTS idx_plc_connections_lineId ON plc_connections(lineId);');
}

/** Add a column to a table only if it isn't already present (idempotent migration). */
function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}
