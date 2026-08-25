/**
 * PLC Manager types (mirror of the backend contract).
 *
 * Purpose: Shapes for saved OPC UA connections + tag mappings used by the PLC
 *   Manager page, its hooks and API wrappers. Kept in sync with
 *   `backend/src/models/plc-connection.model.ts` + `plc-tag.model.ts`.
 */
import { SECURITY_MODES, SECURITY_POLICIES } from './plc.js';

export { SECURITY_MODES, SECURITY_POLICIES };
export type { SecurityMode, SecurityPolicy } from './plc.js';

/** Tag direction: read = monitor (PLC→SW); write = command (SW→PLC). */
export const TAG_DIRECTIONS = ['read', 'write'] as const;
export type TagDirection = (typeof TAG_DIRECTIONS)[number];

/** OPC UA data types a tag can use (write subset; also labels read tags). */
export const TAG_DATA_TYPES = ['Boolean', 'Int16', 'UInt16', 'Int32', 'Float', 'Double'] as const;
export type TagDataType = (typeof TAG_DATA_TYPES)[number];

/** A saved OPC UA connection. */
export interface PlcConnectionConfig {
  id: string;
  name: string;
  endpoint: string;
  securityMode: (typeof SECURITY_MODES)[number];
  securityPolicy: (typeof SECURITY_POLICIES)[number];
  isActive: boolean;
  /** The plant line this PLC serves, or null when unassigned. */
  lineId: string | null;
  /** The cranes (by name) this PLC controls; a line can span several PLCs. */
  cranes: string[];
  createdAt: string;
  updatedAt: string;
}

/** Live lifecycle of a pooled connection (mirrors the backend). */
export type PlcConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Live status of one pooled connection (from GET /plc-connections/status). */
export interface PlcStatus {
  connectionId: string;
  state: PlcConnectionState;
  endpoint: string | null;
  security: string | null;
  lastError: string | null;
}

/** A tag mapping on a connection. */
export interface PlcTagConfig {
  id: string;
  connectionId: string;
  label: string;
  nodeId: string;
  dataType: TagDataType;
  direction: TagDirection;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body for creating/editing a connection. */
export interface ConnectionInput {
  name: string;
  endpoint: string;
  securityMode: (typeof SECURITY_MODES)[number];
  securityPolicy: (typeof SECURITY_POLICIES)[number];
  /** The line this PLC serves (null = unassigned). */
  lineId?: string | null;
  /** The cranes on that line this PLC controls. */
  cranes?: string[];
}

/** Body for creating/editing a tag. */
export interface TagInput {
  label: string;
  nodeId: string;
  dataType: TagDataType;
  direction: TagDirection;
  description?: string;
}
