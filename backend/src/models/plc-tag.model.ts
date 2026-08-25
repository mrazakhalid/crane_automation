/**
 * PLC tag-mapping domain model (data shapes only — no logic).
 *
 * Purpose: Map a friendly `label` (e.g. "cycle_count") to a raw OPC UA `nodeId`
 *   on a specific connection, so operators use human names and never touch raw
 *   NodeIds. A tag is either read (monitor, PLC→SW) or write (command, SW→PLC).
 */

/** Direction of a mapped tag: read = monitor, write = command. */
export const TAG_DIRECTIONS = ['read', 'write'] as const;
export type TagDirection = (typeof TAG_DIRECTIONS)[number];

/** OPC UA data types we support writing (also labels the type of read tags). */
export const TAG_DATA_TYPES = ['Boolean', 'Int16', 'UInt16', 'Int32', 'Float', 'Double'] as const;
export type TagDataType = (typeof TAG_DATA_TYPES)[number];

/** Stored tag record (as persisted). `_id` mirrors our UUID v7 id. */
export interface PlcTagRecord {
  _id: string;
  connectionId: string;
  label: string;
  nodeId: string;
  dataType: TagDataType;
  direction: TagDirection;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Client-safe tag shape returned by the API. */
export interface PublicPlcTag {
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

/**
 * Strip a stored record to its client-safe fields.
 *
 * Args: record — a full `PlcTagRecord`.
 * Returns: A `PublicPlcTag`.
 */
export function toPublicPlcTag(record: PlcTagRecord): PublicPlcTag {
  return {
    id: record._id,
    connectionId: record.connectionId,
    label: record.label,
    nodeId: record.nodeId,
    dataType: record.dataType,
    direction: record.direction,
    description: record.description,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
