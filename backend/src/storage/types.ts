import type { LineRecord } from '../models/line.model.js';
import type { PlcConnectionRecord } from '../models/plc-connection.model.js';
import type { PlcTagRecord } from '../models/plc-tag.model.js';
import type { RecipeRecord } from '../models/recipe.model.js';
import type { Role, UserRecord } from '../models/user.model.js';

/**
 * Storage driver contracts (data-access layer).
 *
 * Purpose: Define the exact operations each backend (Mongo, SQLite) must
 *   implement. Everything above the repository layer depends only on these
 *   interfaces, so swapping the driver (via STORAGE_DRIVER) changes nothing else.
 */

/** User persistence operations. */
export interface UserStore {
  /** Ensure any indexes/uniqueness constraints exist (idempotent). */
  ensureIndexes(): Promise<void>;
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  listByRoles(roles: Role[]): Promise<UserRecord[]>;
  insertUser(record: UserRecord): Promise<void>;
  updateUser(
    id: string,
    patch: Partial<Pick<UserRecord, 'username' | 'passwordHash'>> & { updatedAt: string },
  ): Promise<UserRecord | null>;
  deleteUser(id: string): Promise<boolean>;
}

/** Line persistence operations. */
export interface LineStore {
  /** Ensure any indexes/uniqueness constraints exist (idempotent). */
  ensureIndexes(): Promise<void>;
  findByName(name: string): Promise<LineRecord | null>;
  findById(id: string): Promise<LineRecord | null>;
  listAll(): Promise<LineRecord[]>;
  insertLine(record: LineRecord): Promise<void>;
  updateLine(
    id: string,
    patch: Partial<Pick<LineRecord, 'name' | 'cranes' | 'tanks'>> & { updatedAt: string },
  ): Promise<LineRecord | null>;
  deleteLine(id: string): Promise<boolean>;
}

/** Saved recipe persistence operations. */
export interface RecipeStore {
  /** Ensure any indexes/uniqueness constraints exist (idempotent). */
  ensureIndexes(): Promise<void>;
  findByName(name: string): Promise<RecipeRecord | null>;
  findById(id: string): Promise<RecipeRecord | null>;
  listAll(): Promise<RecipeRecord[]>;
  insertRecipe(record: RecipeRecord): Promise<void>;
  updateRecipe(
    id: string,
    patch: Partial<Pick<RecipeRecord, 'name' | 'qr' | 'overrides'>> & { updatedAt: string },
  ): Promise<RecipeRecord | null>;
  deleteRecipe(id: string): Promise<boolean>;
}

/** Saved OPC UA connection persistence operations. */
export interface PlcConnectionStore {
  /** Ensure any indexes/uniqueness constraints exist (idempotent). */
  ensureIndexes(): Promise<void>;
  findById(id: string): Promise<PlcConnectionRecord | null>;
  findByName(name: string): Promise<PlcConnectionRecord | null>;
  /** The single active connection the app auto-connects to (or null). */
  findActive(): Promise<PlcConnectionRecord | null>;
  listAll(): Promise<PlcConnectionRecord[]>;
  /** Every connection assigned to a given line (for per-line PLC routing). */
  listByLine(lineId: string): Promise<PlcConnectionRecord[]>;
  countAll(): Promise<number>;
  insert(record: PlcConnectionRecord): Promise<void>;
  update(
    id: string,
    patch: Partial<
      Pick<
        PlcConnectionRecord,
        'name' | 'endpoint' | 'securityMode' | 'securityPolicy' | 'isActive' | 'lineId' | 'cranes'
      >
    > & { updatedAt: string },
  ): Promise<PlcConnectionRecord | null>;
  /** Clear `isActive` on every connection (used before setting a new active). */
  clearActive(): Promise<void>;
  /**
   * Unassign every connection from a line (null its `lineId`, clear `cranes`).
   * Called when a line is deleted so its PLCs are not left dangling.
   */
  unassignLine(lineId: string, updatedAt: string): Promise<void>;
  delete(id: string): Promise<boolean>;
}

/** Tag-mapping persistence operations. */
export interface PlcTagStore {
  /** Ensure any indexes/uniqueness constraints exist (idempotent). */
  ensureIndexes(): Promise<void>;
  findById(id: string): Promise<PlcTagRecord | null>;
  findByLabel(connectionId: string, label: string): Promise<PlcTagRecord | null>;
  listByConnection(connectionId: string): Promise<PlcTagRecord[]>;
  insert(record: PlcTagRecord): Promise<void>;
  update(
    id: string,
    patch: Partial<
      Pick<PlcTagRecord, 'label' | 'nodeId' | 'dataType' | 'direction' | 'description'>
    > & { updatedAt: string },
  ): Promise<PlcTagRecord | null>;
  delete(id: string): Promise<boolean>;
  /** Cascade delete every tag for a connection. Returns the number removed. */
  deleteByConnection(connectionId: string): Promise<number>;
}

/** A connected storage backend: the stores plus a lifecycle close. */
export interface Storage {
  users: UserStore;
  lines: LineStore;
  recipes: RecipeStore;
  plcConnections: PlcConnectionStore;
  plcTags: PlcTagStore;
  close(): Promise<void>;
}

/** Factory each driver module exports to build its connected `Storage`. */
export type StorageFactory = () => Promise<Storage>;
