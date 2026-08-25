import { env } from '../../config/env.js';
import {
  toPublicPlcConnection,
  type PublicPlcConnection,
} from '../../models/plc-connection.model.js';
import { toPublicPlcTag, type PublicPlcTag } from '../../models/plc-tag.model.js';
import * as connRepo from '../../repositories/plc-connection.repository.js';
import * as tagRepo from '../../repositories/plc-tag.repository.js';
import { HttpError } from '../../utils/http-error.js';
import * as opcua from './opcua-client.js';
import { DEFAULT_CONNECTION_ID } from './opcua-client.js';
import type { ReadResult, WriteDataType } from './opcua-client.js';
import type { SecurityModeName, SecurityPolicyName } from './opcua-security.js';

/**
 * PLC service (business-logic layer — ignorant of HTTP and of OPC UA wire detail).
 *
 * Purpose: Orchestrate the OPC UA connection manager and surface friendly,
 *   actionable errors. Default endpoint/nodes now come from the **active saved
 *   connection** (managed by super-admin in the PLC Manager), falling back to the
 *   `.env` defaults when none is configured — so switching a PLC is a data change.
 */

/**
 * Connection status + the active connection's endpoint/nodes for UI pre-fill.
 *
 * Returns: `{ connection, defaults, active, tags }` — live status, the active
 *   connection's defaults (or env fallback), the active `PublicPlcConnection`
 *   (or null), and its tag mappings.
 */
export async function getPlcState(): Promise<{
  connection: ReturnType<typeof opcua.getConnectionStatus>;
  defaults: {
    endpoint: string;
    readNode: string;
    writeNode: string;
    securityMode: SecurityModeName;
    securityPolicy: SecurityPolicyName;
  };
  active: PublicPlcConnection | null;
  tags: PublicPlcTag[];
}> {
  const activeRecord = await connRepo.findActive();
  const tagRecords = activeRecord ? await tagRepo.listByConnection(activeRecord._id) : [];
  const readTag = tagRecords.find((t) => t.direction === 'read');
  const writeTag = tagRecords.find((t) => t.direction === 'write');
  return {
    connection: opcua.getConnectionStatus(),
    defaults: {
      endpoint: activeRecord?.endpoint ?? env.OPCUA_ENDPOINT,
      readNode: readTag?.nodeId ?? env.OPCUA_READ_NODE,
      writeNode: writeTag?.nodeId ?? env.OPCUA_WRITE_NODE,
      securityMode: activeRecord?.securityMode ?? env.OPCUA_SECURITY_MODE,
      securityPolicy: activeRecord?.securityPolicy ?? env.OPCUA_SECURITY_POLICY,
    },
    active: activeRecord ? toPublicPlcConnection(activeRecord) : null,
    tags: tagRecords.map(toPublicPlcTag),
  };
}

/**
 * Auto-connect to the active saved connection at boot (best-effort, non-fatal).
 *
 * Purpose: So a fresh process is immediately live against the configured PLC
 *   without a manual Connect. Logs and swallows failures (a down PLC must not
 *   stop the API from booting).
 */
export async function autoConnectActivePlc(): Promise<void> {
  const active = await connRepo.findActive();
  if (!active) return;
  try {
    await opcua.connect(
      DEFAULT_CONNECTION_ID,
      active.endpoint,
      active.securityMode,
      active.securityPolicy,
    );
    console.log(`🔌 Connected to active PLC "${active.name}" (${active.endpoint})`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  Could not auto-connect to active PLC "${active.name}": ${detail}`);
  }
}

/**
 * Auto-connect every line-assigned PLC at boot, each under its own connection id
 * (best-effort, non-fatal, in parallel).
 *
 * Purpose: A multi-line plant needs all its PLCs live at once. Each connection
 *   with a `lineId` is opened into the pool keyed by its `_id`, so per-line batch
 *   routing (see batch.service) can target the right session. A single down PLC
 *   must not stop the others or block boot — failures are logged and swallowed.
 */
export async function autoConnectAllPlcs(): Promise<void> {
  const assigned = (await connRepo.listAll()).filter((c) => c.lineId !== null);
  if (assigned.length === 0) return;
  await Promise.allSettled(
    assigned.map(async (c) => {
      try {
        await opcua.connect(c._id, c.endpoint, c.securityMode, c.securityPolicy);
        console.log(`🔌 Connected line PLC "${c.name}" (${c.endpoint}) [cranes: ${c.cranes.join(', ')}]`);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️  Could not auto-connect line PLC "${c.name}": ${detail}`);
      }
    }),
  );
}

/**
 * Connect to an OPC UA endpoint; 502 with an actionable message on failure.
 * Args: endpoint — the `opc.tcp://…` URL; securityMode/securityPolicy — optional
 *   overrides (fall back to the `OPCUA_SECURITY_*` deployment defaults).
 */
export async function connectPlc(
  endpoint: string,
  securityMode?: SecurityModeName,
  securityPolicy?: SecurityPolicyName,
  connectionId: string = DEFAULT_CONNECTION_ID,
): Promise<ReturnType<typeof opcua.getConnectionStatus>> {
  const mode = securityMode ?? env.OPCUA_SECURITY_MODE;
  const policy = securityPolicy ?? env.OPCUA_SECURITY_POLICY;
  try {
    await opcua.connect(connectionId, endpoint, mode, policy);
  } catch (err) {
    throw connectError(endpoint, mode, policy, err);
  }
  return opcua.getConnectionStatus(connectionId);
}

/** Live status of every pooled connection (for the multi-PLC manager UI). */
export function getPoolStatuses(): ReturnType<typeof opcua.getAllStatuses> {
  return opcua.getAllStatuses();
}

/** Turn a raw node-opcua connect failure into a typed, operator-actionable 502. */
function connectError(
  endpoint: string,
  mode: SecurityModeName,
  policy: SecurityPolicyName,
  err: unknown,
): HttpError {
  const detail = err instanceof Error ? err.message : String(err);
  if (/BadSecurityChecksFailed|BadCertificate|certificate/i.test(detail)) {
    return new HttpError(
      502,
      `The PLC rejected our security certificate. On the PLC's OPC UA server, move the ` +
        `Crane Automation client certificate from its "rejected" to its "trusted" store, then ` +
        `retry. Certificate: ${opcua.clientCertificateFile}. Also confirm the PLC clock is set ` +
        `correctly (a wrong clock makes our certificate look "not yet valid"). (${detail})`,
    );
  }
  if (/End ?point must exist/i.test(detail)) {
    return new HttpError(
      502,
      `The PLC does not advertise a ${mode}/${policy} endpoint. Set OPCUA_SECURITY_MODE / ` +
        `OPCUA_SECURITY_POLICY (or the connect request) to a security pair the server offers. (${detail})`,
    );
  }
  return new HttpError(502, `Could not reach the OPC UA server at ${endpoint}. ${detail}`);
}

/** Disconnect one pooled session (safe when already disconnected). */
export async function disconnectPlc(
  connectionId: string = DEFAULT_CONNECTION_ID,
): Promise<ReturnType<typeof opcua.getConnectionStatus>> {
  await opcua.disconnect(connectionId);
  return opcua.getConnectionStatus(connectionId);
}

/** Read one node's value on a connection (default = legacy slot); 409 when not connected. */
export async function readNode(
  nodeId: string,
  connectionId: string = DEFAULT_CONNECTION_ID,
): Promise<ReadResult> {
  try {
    return await opcua.readValue(connectionId, nodeId);
  } catch (err) {
    throw toHttpError(err, nodeId);
  }
}

/** Write one node's value (a "command" to the PLC); 409 when not connected. */
export async function sendCommand(
  nodeId: string,
  dataType: WriteDataType,
  value: boolean | number,
  connectionId: string = DEFAULT_CONNECTION_ID,
): Promise<ReadResult> {
  try {
    await opcua.writeValue(connectionId, nodeId, dataType, value);
  } catch (err) {
    throw toHttpError(err, nodeId);
  }
  // Read the value straight back so the caller can confirm the round-trip.
  return opcua.readValue(connectionId, nodeId);
}

/**
 * Write one node's value without reading it back (fast path for batch sends).
 *
 * Purpose: The batch service writes many task fields per "Send to PLC"; a
 *   round-trip read after each would double the latency. Use this when the
 *   caller does not need the written value echoed. 409 when not connected.
 * Args: nodeId — the target NodeId; dataType — its OPC UA write type; value —
 *   the boolean/number to write.
 */
export async function writeNode(
  nodeId: string,
  dataType: WriteDataType,
  value: boolean | number,
  connectionId: string = DEFAULT_CONNECTION_ID,
): Promise<void> {
  try {
    await opcua.writeValue(connectionId, nodeId, dataType, value);
  } catch (err) {
    throw toHttpError(err, nodeId);
  }
}

/** Map a low-level OPC UA error onto a typed HTTP error with an actionable message. */
function toHttpError(err: unknown, nodeId: string): HttpError {
  const detail = err instanceof Error ? err.message : String(err);
  if (detail.includes('Not connected')) {
    return new HttpError(409, 'Not connected to a PLC — connect to an endpoint first.');
  }
  return new HttpError(502, `PLC operation failed for node "${nodeId}". ${detail}`);
}
