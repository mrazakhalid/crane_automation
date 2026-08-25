import { env } from '../config/env.js';
import {
  toPublicPlcConnection,
  type PlcConnectionRecord,
  type PublicPlcConnection,
  type SecurityMode,
  type SecurityPolicy,
} from '../models/plc-connection.model.js';
import { toPublicPlcTag, type PlcTagRecord, type PublicPlcTag } from '../models/plc-tag.model.js';
import * as connRepo from '../repositories/plc-connection.repository.js';
import * as lineRepo from '../repositories/line.repository.js';
import * as tagRepo from '../repositories/plc-tag.repository.js';
import * as plc from './plc/plc.service.js';
import type { PlcStatus } from './plc/opcua-client.js';
import type {
  CreateConnectionInput,
  CreateTagInput,
  UpdateConnectionInput,
  UpdateTagInput,
} from '../schemas/plc-config.schema.js';
import { badRequest, conflict, notFoundError } from '../utils/http-error.js';
import { newId } from '../utils/id.js';

/**
 * PLC Manager service (business-logic layer — ignorant of HTTP and DB driver).
 *
 * Purpose: CRUD for saved OPC UA connections + their tag mappings, so all PLC
 *   configuration lives in the database and is managed by super-admin in the UI
 *   (no `.env`/code change to add or switch a PLC). Exactly one connection is
 *   active; the app auto-connects to it at boot (see plc.service).
 */

/* ------------------------------- Connections ------------------------------ */

/**
 * Validate a PLC's line + crane assignment (the crane-binding rules).
 *
 * Rules (line is the source of truth for valid crane codes):
 *  - cranes without a line are meaningless → 400.
 *  - a null line must carry no cranes → normalized to `[]`.
 *  - the line must exist → 400 (bad reference in the body).
 *  - every crane must be one of the line's cranes → 400.
 *  - a crane maps to exactly ONE PLC within its line — reject a crane already
 *    claimed by another connection on the same line → 409.
 *
 * Args: lineId — the target line (or null); cranes — requested crane codes;
 *   excludeId — a connection id to ignore in the conflict scan (self, on edit).
 * Returns: the normalized `{ lineId, cranes }` to persist.
 * Raises: 400 on a bad line/crane; 409 on a crane already owned by another PLC.
 */
async function resolveAssignment(
  lineId: string | null,
  cranes: string[],
  excludeId?: string,
): Promise<{ lineId: string | null; cranes: string[] }> {
  if (lineId === null) {
    if (cranes.length > 0) {
      throw badRequest('Assign the PLC to a line before assigning it cranes.');
    }
    return { lineId: null, cranes: [] };
  }

  const line = await lineRepo.findById(lineId);
  if (!line) throw badRequest('The chosen line does not exist.');

  const lineCranes = new Set(line.cranes);
  const notInLine = cranes.filter((c) => !lineCranes.has(c));
  if (notInLine.length > 0) {
    throw badRequest(
      `These cranes are not part of line "${line.name}": ${notInLine.join(', ')}. ` +
        `Valid cranes: ${line.cranes.join(', ') || '(none)'}.`,
    );
  }

  // A crane belongs to exactly one PLC within its line.
  const siblings = await connRepo.listByLine(lineId);
  const claimed = new Map<string, string>(); // crane -> owning connection name
  for (const sib of siblings) {
    if (sib._id === excludeId) continue;
    for (const c of sib.cranes) claimed.set(c, sib.name);
  }
  const conflicts = cranes.filter((c) => claimed.has(c));
  if (conflicts.length > 0) {
    const detail = conflicts.map((c) => `${c} (owned by "${claimed.get(c)}")`).join(', ');
    throw conflict(`These cranes are already assigned to another PLC on this line: ${detail}.`);
  }

  return { lineId, cranes };
}

/** List saved connections, newest first; optionally only those on `lineId`. */
export async function listConnections(lineId?: string): Promise<PublicPlcConnection[]> {
  const records = lineId ? await connRepo.listByLine(lineId) : await connRepo.listAll();
  return records.map(toPublicPlcConnection);
}

/**
 * Create a saved connection. The first connection created becomes active.
 *
 * Args: input — validated `{ name, endpoint, securityMode, securityPolicy }`.
 * Returns: The created `PublicPlcConnection`.
 * Raises: 409 if a connection with that name already exists.
 */
export async function createConnection(input: CreateConnectionInput): Promise<PublicPlcConnection> {
  if (await connRepo.findByName(input.name)) {
    throw conflict(`A connection named "${input.name}" already exists`);
  }
  const assignment = await resolveAssignment(input.lineId ?? null, input.cranes ?? []);
  const isFirst = (await connRepo.countAll()) === 0;
  const now = new Date().toISOString();
  const record: PlcConnectionRecord = {
    _id: newId(),
    name: input.name,
    endpoint: input.endpoint,
    securityMode: input.securityMode,
    securityPolicy: input.securityPolicy,
    isActive: isFirst,
    lineId: assignment.lineId,
    cranes: assignment.cranes,
    createdAt: now,
    updatedAt: now,
  };
  await connRepo.insert(record);
  return toPublicPlcConnection(record);
}

/**
 * Edit a connection's name/endpoint/security.
 *
 * Args: id — target connection id; input — validated partial fields.
 * Returns: The updated `PublicPlcConnection`.
 * Raises: 404 if absent, 409 if the new name is taken by another connection.
 */
export async function updateConnection(
  id: string,
  input: UpdateConnectionInput,
): Promise<PublicPlcConnection> {
  const existing = await connRepo.findById(id);
  if (!existing) throw notFoundError('Connection not found');

  const patch: Partial<
    Pick<
      PlcConnectionRecord,
      'name' | 'endpoint' | 'securityMode' | 'securityPolicy' | 'lineId' | 'cranes'
    >
  > & { updatedAt: string } = { updatedAt: new Date().toISOString() };

  if (input.name !== undefined && input.name !== existing.name) {
    const clash = await connRepo.findByName(input.name);
    if (clash && clash._id !== id) {
      throw conflict(`A connection named "${input.name}" already exists`);
    }
    patch.name = input.name;
  }
  if (input.endpoint !== undefined) patch.endpoint = input.endpoint;
  if (input.securityMode !== undefined) patch.securityMode = input.securityMode as SecurityMode;
  if (input.securityPolicy !== undefined) {
    patch.securityPolicy = input.securityPolicy as SecurityPolicy;
  }

  // Re-validate the line/crane binding whenever either field is touched.
  if (input.lineId !== undefined || input.cranes !== undefined) {
    const nextLineId = input.lineId !== undefined ? input.lineId : existing.lineId;
    // Changing the line without new cranes clears the old (now-invalid) cranes.
    const nextCranes =
      input.cranes !== undefined
        ? input.cranes
        : input.lineId !== undefined && input.lineId !== existing.lineId
          ? []
          : existing.cranes;
    const assignment = await resolveAssignment(nextLineId, nextCranes, id);
    patch.lineId = assignment.lineId;
    patch.cranes = assignment.cranes;
  }

  const updated = await connRepo.update(id, patch);
  if (!updated) throw notFoundError('Connection not found');
  return toPublicPlcConnection(updated);
}

/**
 * Delete a connection and cascade-delete its tag mappings.
 *
 * Args: id — target connection id.
 * Raises: 404 if the connection does not exist.
 */
export async function deleteConnection(id: string): Promise<void> {
  const existing = await connRepo.findById(id);
  if (!existing) throw notFoundError('Connection not found');
  await tagRepo.deleteByConnection(id);
  await connRepo.deleteById(id);
}

/**
 * Make a connection the single active one (the app connects to the active one).
 *
 * Args: id — target connection id.
 * Returns: The now-active `PublicPlcConnection`.
 * Raises: 404 if the connection does not exist.
 */
export async function activateConnection(id: string): Promise<PublicPlcConnection> {
  const existing = await connRepo.findById(id);
  if (!existing) throw notFoundError('Connection not found');
  await connRepo.clearActive();
  const updated = await connRepo.update(id, { isActive: true, updatedAt: new Date().toISOString() });
  if (!updated) throw notFoundError('Connection not found');
  return toPublicPlcConnection(updated);
}

/** Load a connection record by id or throw 404 (shared by tag operations). */
async function requireConnection(id: string): Promise<PlcConnectionRecord> {
  const record = await connRepo.findById(id);
  if (!record) throw notFoundError('Connection not found');
  return record;
}

/* --------------------------- Live pool connect/status --------------------- */

/** Live status of every pooled connection (for the manager UI's per-row chips). */
export function connectionStatuses(): PlcStatus[] {
  return plc.getPoolStatuses();
}

/**
 * Open a live session to a saved connection (pooled under its own id).
 *
 * Args: id — the saved connection id.
 * Returns: the resulting `PlcStatus`.
 * Raises: 404 if absent; 502 with an actionable message if the PLC is
 *   unreachable or rejects our certificate.
 */
export async function connectConnection(id: string): Promise<PlcStatus> {
  const rec = await requireConnection(id);
  return plc.connectPlc(rec.endpoint, rec.securityMode, rec.securityPolicy, rec._id);
}

/** Close the live session for a saved connection (idempotent). Raises 404 if absent. */
export async function disconnectConnection(id: string): Promise<PlcStatus> {
  await requireConnection(id);
  return plc.disconnectPlc(id);
}

/* ---------------------------------- Tags ---------------------------------- */

/** List a connection's tag mappings. Raises 404 if the connection is absent. */
export async function listTags(connectionId: string): Promise<PublicPlcTag[]> {
  await requireConnection(connectionId);
  const records = await tagRepo.listByConnection(connectionId);
  return records.map(toPublicPlcTag);
}

/**
 * Add a tag mapping to a connection.
 *
 * Args: connectionId — owning connection; input — validated tag fields.
 * Returns: The created `PublicPlcTag`.
 * Raises: 404 if the connection is absent, 409 if the label is already used.
 */
export async function createTag(
  connectionId: string,
  input: CreateTagInput,
): Promise<PublicPlcTag> {
  await requireConnection(connectionId);
  if (await tagRepo.findByLabel(connectionId, input.label)) {
    throw conflict(`A tag labelled "${input.label}" already exists on this connection`);
  }
  const now = new Date().toISOString();
  const record: PlcTagRecord = {
    _id: newId(),
    connectionId,
    label: input.label,
    nodeId: input.nodeId,
    dataType: input.dataType,
    direction: input.direction,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await tagRepo.insert(record);
  return toPublicPlcTag(record);
}

/**
 * Edit a tag mapping.
 *
 * Args: connectionId — owning connection; tagId — target tag; input — partial fields.
 * Returns: The updated `PublicPlcTag`.
 * Raises: 404 if absent, 409 if the new label clashes on the same connection.
 */
export async function updateTag(
  connectionId: string,
  tagId: string,
  input: UpdateTagInput,
): Promise<PublicPlcTag> {
  const existing = await tagRepo.findById(tagId);
  if (!existing || existing.connectionId !== connectionId) throw notFoundError('Tag not found');

  const patch: Partial<
    Pick<PlcTagRecord, 'label' | 'nodeId' | 'dataType' | 'direction' | 'description'>
  > & { updatedAt: string } = { updatedAt: new Date().toISOString() };

  if (input.label !== undefined && input.label !== existing.label) {
    const clash = await tagRepo.findByLabel(connectionId, input.label);
    if (clash && clash._id !== tagId) {
      throw conflict(`A tag labelled "${input.label}" already exists on this connection`);
    }
    patch.label = input.label;
  }
  if (input.nodeId !== undefined) patch.nodeId = input.nodeId;
  if (input.dataType !== undefined) patch.dataType = input.dataType;
  if (input.direction !== undefined) patch.direction = input.direction;
  if (input.description !== undefined) patch.description = input.description ?? null;

  const updated = await tagRepo.update(tagId, patch);
  if (!updated) throw notFoundError('Tag not found');
  return toPublicPlcTag(updated);
}

/**
 * Delete a tag mapping.
 *
 * Args: connectionId — owning connection; tagId — target tag.
 * Raises: 404 if the tag does not exist on that connection.
 */
export async function deleteTag(connectionId: string, tagId: string): Promise<void> {
  const existing = await tagRepo.findById(tagId);
  if (!existing || existing.connectionId !== connectionId) throw notFoundError('Tag not found');
  await tagRepo.deleteById(tagId);
}

/* --------------------------------- Seeding -------------------------------- */

/**
 * Seed one active connection (+ its monitor/command tags) from the `.env`
 * OPC UA defaults, but only when no connections exist yet.
 *
 * Purpose: Preserve the working setup when we move config from `.env` into the
 *   DB — on first boot the current endpoint/NodeIds become the Active connection,
 *   so nothing breaks and the super-admin can edit from the UI thereafter.
 * Returns: `true` if a connection was seeded, `false` if some already existed.
 */
export async function seedConnectionFromEnv(): Promise<boolean> {
  if ((await connRepo.countAll()) > 0) return false;

  const now = new Date().toISOString();
  const connectionId = newId();
  await connRepo.insert({
    _id: connectionId,
    name: 'Default (from .env)',
    endpoint: env.OPCUA_ENDPOINT,
    securityMode: env.OPCUA_SECURITY_MODE,
    securityPolicy: env.OPCUA_SECURITY_POLICY,
    isActive: true,
    lineId: null,
    cranes: [],
    createdAt: now,
    updatedAt: now,
  });

  // Best-effort monitor/command tags from the env NodeId defaults. Types match
  // our POC (a numeric counter to read, a boolean flag to write); editable later.
  await tagRepo.insert({
    _id: newId(),
    connectionId,
    label: 'monitor',
    nodeId: env.OPCUA_READ_NODE,
    dataType: 'Int16',
    direction: 'read',
    description: 'Seeded from OPCUA_READ_NODE',
    createdAt: now,
    updatedAt: now,
  });
  await tagRepo.insert({
    _id: newId(),
    connectionId,
    label: 'command',
    nodeId: env.OPCUA_WRITE_NODE,
    dataType: 'Boolean',
    direction: 'write',
    description: 'Seeded from OPCUA_WRITE_NODE',
    createdAt: now,
    updatedAt: now,
  });
  return true;
}
