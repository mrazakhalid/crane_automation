import { AttributeIds, DataType, OPCUAClient, StatusCodes } from 'node-opcua';
import type { ClientSession, DataValue } from 'node-opcua';
import { env } from '../../config/env.js';
import { clientCertificateFile, securityOptions } from './opcua-security.js';
import type { SecurityModeName, SecurityPolicyName } from './opcua-security.js';

/** Path to our client's own certificate — surface it so the PLC can trust it. */
export { clientCertificateFile };

/**
 * OPC UA connection pool (the external-system "data layer" — HTTP-ignorant).
 *
 * Purpose: Own a *pool* of live OPC UA client/sessions keyed by a caller-chosen
 *   connection id, and expose connect, disconnect, status, read and write per id.
 *   One backend can therefore hold many simultaneous sessions — one per PLC, each
 *   on its own IP — which is what a multi-line plant needs. This module is
 *   protocol-only: it knows nothing about the server on the other end, so the same
 *   code talks to OpenPLC v4 and a Siemens S7-1500 alike; only the endpoint URL +
 *   NodeIds (chosen at runtime) differ.
 *
 * OPC UA itself imposes no client-side cap: each entry is an independent TCP
 * connection to a different endpoint, so connecting N PLCs at N IPs is normal.
 */

/** Lifecycle of a single pooled connection. */
export type PlcConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Data types we allow writing (a safe subset of the OPC UA `DataType` enum). */
export type WriteDataType = 'Boolean' | 'Int16' | 'UInt16' | 'Int32' | 'Float' | 'Double';

/** A single read result, flattened for JSON transport. */
export interface ReadResult {
  value: boolean | number | string | null;
  dataType: string;
  statusCode: string;
  serverTimestamp: string | null;
}

/** Client-safe status of one pooled connection (never throws to build). */
export interface PlcStatus {
  connectionId: string;
  state: PlcConnectionState;
  endpoint: string | null;
  security: string | null;
  lastError: string | null;
}

/**
 * Reserved connection id for the legacy single-PLC flows (the manual PLC page +
 * boot auto-connect of the active saved connection). Pre-pool behaviour is exactly
 * "everything shares one slot"; keeping that slot under a fixed id preserves it
 * while the pool gains the ability to hold additional per-line connections.
 */
export const DEFAULT_CONNECTION_ID = 'default';

/**
 * One pool entry. `client`/`session` are null while connecting or after an error,
 * so `state`/`endpoint`/`security`/`lastError` are tracked alongside them and a
 * status can always be reported even when no live session exists.
 */
interface PoolEntry {
  client: OPCUAClient | null;
  session: ClientSession | null;
  endpoint: string;
  security: string;
  state: PlcConnectionState;
  lastError: string | null;
}

const pool = new Map<string, PoolEntry>();

/** Build the client-safe status snapshot for a pool entry (or a disconnected one). */
function statusOf(connectionId: string, entry: PoolEntry | undefined): PlcStatus {
  if (!entry) {
    return { connectionId, state: 'disconnected', endpoint: null, security: null, lastError: null };
  }
  return {
    connectionId,
    state: entry.state,
    endpoint: entry.endpoint,
    security: entry.security,
    lastError: entry.lastError,
  };
}

/** Current status of one connection (never throws). */
export function getConnectionStatus(connectionId: string = DEFAULT_CONNECTION_ID): PlcStatus {
  return statusOf(connectionId, pool.get(connectionId));
}

/** Snapshot of every pooled connection (for the multi-PLC UI). */
export function getAllStatuses(): PlcStatus[] {
  return [...pool.entries()].map(([id, entry]) => statusOf(id, entry));
}

/**
 * Open a session to an OPC UA endpoint under `connectionId`, replacing only the
 * entry with that same id (other pooled connections stay live).
 *
 * Args: connectionId — the pool key (defaults to the legacy single slot);
 *   endpoint — an `opc.tcp://host:port` URL; securityMode/securityPolicy — the
 *   security to request (defaults to the `OPCUA_SECURITY_*` env config). Session
 *   identity is Anonymous.
 * Raises: the underlying node-opcua error if the server is unreachable or rejects
 *   our certificate (server must trust our client cert for secured endpoints). On
 *   failure the entry is left in `error` state with `lastError` set.
 */
export async function connect(
  connectionId: string,
  endpoint: string,
  securityMode: SecurityModeName = env.OPCUA_SECURITY_MODE,
  securityPolicy: SecurityPolicyName = env.OPCUA_SECURITY_POLICY,
): Promise<void> {
  await disconnect(connectionId); // reconnect semantics for THIS id only
  const security = `${securityMode}/${securityPolicy}`;
  const entry: PoolEntry = {
    client: null,
    session: null,
    endpoint,
    security,
    state: 'connecting',
    lastError: null,
  };
  pool.set(connectionId, entry);

  const client = OPCUAClient.create({
    applicationName: 'CraneAutomationClient',
    endpointMustExist: false,
    connectionStrategy: { maxRetry: 1, initialDelay: 500, maxDelay: 1500 },
    ...(await securityOptions(securityMode, securityPolicy)),
  });
  try {
    await client.connect(endpoint);
    const session = await client.createSession();
    entry.client = client;
    entry.session = session;
    entry.state = 'connected';
  } catch (err) {
    entry.state = 'error';
    entry.lastError = err instanceof Error ? err.message : String(err);
    await client.disconnect().catch(() => undefined);
    throw err;
  }
}

/** Tear down one connection's session + client (idempotent, never throws). */
export async function disconnect(connectionId: string = DEFAULT_CONNECTION_ID): Promise<void> {
  const entry = pool.get(connectionId);
  pool.delete(connectionId);
  if (!entry) return;
  await entry.session?.close().catch(() => undefined);
  await entry.client?.disconnect().catch(() => undefined);
}

/** Tear down every pooled connection (for graceful shutdown; never throws). */
export async function disconnectAll(): Promise<void> {
  await Promise.all([...pool.keys()].map((id) => disconnect(id)));
}

/** The live session for `connectionId`, or throw a "Not connected" error naming it. */
function requireSession(connectionId: string): ClientSession {
  const session = pool.get(connectionId)?.session;
  if (!session) throw new Error(`Not connected to a PLC (connection "${connectionId}")`);
  return session;
}

/** Read a node's Value attribute on `connectionId`. Raises if that id is not connected. */
export async function readValue(
  connectionId: string,
  nodeId: string,
): Promise<ReadResult> {
  const session = requireSession(connectionId);
  const dv: DataValue = await session.read({ nodeId, attributeId: AttributeIds.Value });
  const dt = dv.value.dataType;
  return {
    value: (dv.value.value ?? null) as ReadResult['value'],
    dataType: typeof dt === 'number' ? (DataType[dt] ?? String(dt)) : String(dt),
    statusCode: dv.statusCode.name,
    serverTimestamp: dv.serverTimestamp?.toISOString() ?? null,
  };
}

/** Write a node's Value on `connectionId`. Raises if not connected or the write is rejected. */
export async function writeValue(
  connectionId: string,
  nodeId: string,
  dataType: WriteDataType,
  value: boolean | number,
): Promise<void> {
  const session = requireSession(connectionId);
  const statusCode = await session.write({
    nodeId,
    attributeId: AttributeIds.Value,
    value: { value: { dataType: DataType[dataType], value } },
  });
  if (statusCode.value !== StatusCodes.Good.value) {
    throw new Error(`PLC rejected the write: ${statusCode.name}`);
  }
}
