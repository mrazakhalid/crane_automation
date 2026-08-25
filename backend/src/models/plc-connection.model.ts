/**
 * PLC connection domain model (data shapes only — no logic).
 *
 * Purpose: Single source of truth for a saved OPC UA server connection —
 *   endpoint + security, managed by super-admin in the UI so switching or adding
 *   a PLC is a data change, never a code/.env change. Exactly one connection is
 *   `isActive`; the app auto-connects to it at boot.
 */

/** OPC UA message security mode (must match one the target server advertises). */
export const SECURITY_MODES = ['None', 'Sign', 'SignAndEncrypt'] as const;
export type SecurityMode = (typeof SECURITY_MODES)[number];

/** OPC UA security policy (must match one the target server advertises). */
export const SECURITY_POLICIES = [
  'None',
  'Basic128Rsa15',
  'Basic256',
  'Basic256Sha256',
  'Aes128_Sha256_RsaOaep',
  'Aes256_Sha256_RsaPss',
] as const;
export type SecurityPolicy = (typeof SECURITY_POLICIES)[number];

/** Stored connection record (as persisted). `_id` mirrors our UUID v7 id. */
export interface PlcConnectionRecord {
  _id: string;
  name: string;
  endpoint: string;
  securityMode: SecurityMode;
  securityPolicy: SecurityPolicy;
  isActive: boolean;
  /**
   * The plant line this PLC serves, or null when unassigned. A line can be served
   * by MORE THAN ONE PLC (e.g. Line 4 = one PLC for cranes 6+7A, another for 7B),
   * so the binding is line + the specific cranes below — not one PLC per line.
   */
  lineId: string | null;
  /**
   * The cranes (by name, matching the line's crane codes) this PLC controls, e.g.
   * `["6","7A"]`. A crane maps to exactly one PLC within its line; a tank's owning
   * PLC is DERIVED from `tank.crane` → the connection whose `cranes` contains it.
   */
  cranes: string[];
  createdAt: string;
  updatedAt: string;
}

/** Client-safe connection shape returned by the API. */
export interface PublicPlcConnection {
  id: string;
  name: string;
  endpoint: string;
  securityMode: SecurityMode;
  securityPolicy: SecurityPolicy;
  isActive: boolean;
  lineId: string | null;
  cranes: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Strip a stored record to its client-safe fields.
 *
 * Args: record — a full `PlcConnectionRecord`.
 * Returns: A `PublicPlcConnection`.
 */
export function toPublicPlcConnection(record: PlcConnectionRecord): PublicPlcConnection {
  return {
    id: record._id,
    name: record.name,
    endpoint: record.endpoint,
    securityMode: record.securityMode,
    securityPolicy: record.securityPolicy,
    isActive: record.isActive,
    // Default for older records persisted before the crane-binding fields existed.
    lineId: record.lineId ?? null,
    cranes: record.cranes ?? [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
