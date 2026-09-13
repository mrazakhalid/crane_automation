import { env } from '../../config/env.js';
import type { PublicLine } from '../../models/line.model.js';
import * as connRepo from '../../repositories/plc-connection.repository.js';
import { HttpError } from '../../utils/http-error.js';
import { getLine } from '../line.service.js';
import { parseQr, resolveTank } from '../task-generator.js';
import { DEFAULT_CONNECTION_ID } from './opcua-client.js';
import type { WriteDataType } from './opcua-client.js';
import { readNode, writeNode } from './plc.service.js';

/**
 * Crane batch service (business logic — HTTP-ignorant).
 *
 * Purpose: Turn a QR recipe into the ordered OPC UA writes that load the PLC's
 *   `Line4Data` task array, then arm the run; plus read the run's handshake
 *   (busy/done/step) and acknowledge completion. The backend is the source of
 *   truth: it re-resolves each tank to a physical station rather than trusting
 *   any client-computed value. See `docs/line4/instructions.md` for the PLC side.
 */

/** The PLC's `tasks` array is `Array[1..20]` — never send more than it can hold. */
export const MAX_TASKS = 20;

/** One planned OPC UA write (nodeId + type + value), with a human label for errors. */
export interface BatchWrite {
  nodeId: string;
  dataType: WriteDataType;
  value: number;
  label: string;
}

/** The result of planning a batch: the ordered writes, the count, and any unresolved keys. */
export interface BatchPlan {
  writes: BatchWrite[];
  count: number;
  /** QR keys that did not resolve to a tank in the line (batch must be rejected if non-empty). */
  missing: string[];
}

/** Namespace/DB used to build the symbolic NodeIds (deployment defaults from env). */
interface NodeOpts {
  namespace: number;
  db: string;
}

const defaultNodeOpts: NodeOpts = {
  namespace: env.OPCUA_BATCH_NAMESPACE,
  db: env.OPCUA_BATCH_DB,
};

/** Build a scalar DB tag NodeId, e.g. `ns=3;s="Line4Data"."task_count"`. */
function scalarNode(tag: string, opts: NodeOpts = defaultNodeOpts): string {
  return `ns=${opts.namespace};s="${opts.db}"."${tag}"`;
}

/**
 * The DB name for a crane's own data block, e.g. `7A` → `Crane7AData`.
 *
 * Each crane on a PLC has an INDEPENDENT DB (task array + handshake + I/O mirror)
 * so cranes run in parallel — matching the per-crane PLC programs in `plc/`.
 */
export function craneDbName(crane: string): string {
  return `Crane${crane.replace(/[^A-Za-z0-9]/g, '')}Data`;
}

/** NodeId options for a crane's own DB, or the env default DB when no crane is given. */
function optsForCrane(crane?: string): NodeOpts {
  return crane ? { namespace: defaultNodeOpts.namespace, db: craneDbName(crane) } : defaultNodeOpts;
}

/**
 * Build a task-array field NodeId for the 1-based task number `taskNo`
 * (S7 `tasks[1..20]`), e.g. `ns=3;s="Line4Data"."tasks"[0]."station"`.
 *
 * Two S7-1500 quirks, both verified live against the sim (see docs/line4):
 *  - the array bracket goes **outside** the quotes: `"tasks"[i]."station"`
 *    (NOT `"tasks[i]"."station"`, which returns BadNodeIdUnknown);
 *  - the server re-bases arrays to **0** over OPC UA, so a `tasks Array[1..20]`
 *    exposes indices `[0..19]` — the OPC UA index is therefore `taskNo - 1`
 *    (OPC UA `[0]` is S7 `tasks[1]`). Getting this wrong shifts every task by one slot.
 */
function taskFieldNode(taskNo: number, field: string, opts: NodeOpts = defaultNodeOpts): string {
  return `ns=${opts.namespace};s="${opts.db}"."tasks"[${taskNo - 1}]."${field}"`;
}

/** One task destined for a PLC's `tasks[]` array (station + dwell). */
interface PlannedTask {
  station: number;
  time: number;
}

/**
 * Build the ordered OPC UA writes for one PLC's task array (pure — no I/O).
 *
 * Args: tasks — the ordered tasks for THIS PLC (renumbered 1..k here); opts —
 *   namespace/DB for the NodeIds.
 * Returns: writes `tasks[1..k].station`/`.dwell_s` then `task_count = k`
 *   (`cmd_send` is armed separately, last, by the caller).
 */
function buildTaskWrites(tasks: PlannedTask[], opts: NodeOpts): BatchWrite[] {
  const writes: BatchWrite[] = [];
  tasks.forEach((t, idx) => {
    const i = idx + 1; // tasks[] is 1-based; each PLC's array restarts at 1
    writes.push({ nodeId: taskFieldNode(i, 'station', opts), dataType: 'Int16', value: t.station, label: `tasks[${i}].station` });
    writes.push({ nodeId: taskFieldNode(i, 'dwell_s', opts), dataType: 'Int16', value: t.time, label: `tasks[${i}].dwell_s` });
  });
  writes.push({ nodeId: scalarNode('task_count', opts), dataType: 'Int16', value: tasks.length, label: 'task_count' });
  return writes;
}

/**
 * Plan the OPC UA writes for a QR recipe against a line, as ONE task array (pure).
 *
 * Used for the legacy single-PLC path (a line with no per-crane PLC binding —
 * e.g. the sim). For multi-crane lines see `planBatchByCrane`.
 *
 * Args: line — the saved line; qr — the decoded recipe text; opts — namespace/DB
 *   for NodeId construction (defaults from env).
 * Returns: `{ writes, count, missing }`. `station = tank.number + 1` (Loading = 1,
 *   tanks start at 2; Parking = 0 is the crane's home, never a target).
 * Raises: 400 if the recipe is empty or exceeds `MAX_TASKS`.
 */
export function planBatch(line: PublicLine, qr: string, opts: NodeOpts = defaultNodeOpts): BatchPlan {
  const entries = parseQr(qr);
  if (entries.length === 0) {
    throw new HttpError(400, 'The QR recipe has no tasks.');
  }
  if (entries.length > MAX_TASKS) {
    throw new HttpError(
      400,
      `The recipe has ${entries.length} tasks but the PLC holds at most ${MAX_TASKS}.`,
    );
  }

  const tasks: PlannedTask[] = [];
  const missing: string[] = [];
  entries.forEach((entry) => {
    const tank = resolveTank(line, entry.key);
    if (!tank) {
      missing.push(entry.key);
      return;
    }
    tasks.push({ station: tank.number + 1, time: entry.time });
  });

  return { writes: buildTaskWrites(tasks, opts), count: entries.length, missing };
}

/** A PLC that controls specific cranes on a line (subset of a connection record). */
export interface CraneOwner {
  connectionId: string;
  name: string;
  cranes: string[];
}

/** The per-crane writes + target for one crane in a routed batch. */
export interface CraneBatch {
  /** The PLC session that owns this crane. */
  connectionId: string;
  /** The owning PLC's name (for messages). */
  plcName: string;
  /** The crane code, e.g. `6`, `7A`. */
  crane: string;
  /** The crane's OWN data block, e.g. `Crane6Data`. */
  db: string;
  writes: BatchWrite[];
  count: number;
}

/** A recipe routed to each crane's own DB, plus anything that could not be routed. */
export interface RoutedBatchPlan {
  /** One group per crane that received at least one task. */
  groups: CraneBatch[];
  /** QR keys that resolved to no tank in the line. */
  missing: string[];
  /** Tasks whose tank has no PLC owning its crane (config gap). */
  unrouted: { key: string; crane: string }[];
}

/**
 * Plan a QR recipe PER CRANE (pure — no I/O): split by tank → crane, renumber
 * each crane's tasks from 1, and target each crane's OWN DB (`Crane<ID>Data`).
 *
 * Cranes on the same PLC therefore get INDEPENDENT arrays + handshakes and run in
 * parallel — matching the per-crane PLC programs (`plc/` folders) and the app's
 * per-crane process chains.
 *
 * Args: line — the saved line; qr — the recipe text; owners — the line's PLCs and
 *   the cranes each controls; opts — the OPC UA namespace (the DB is per crane).
 * Returns: `{ groups, missing, unrouted }` — one group per crane that got a task,
 *   preserving recipe order within each crane.
 * Raises: 400 if the recipe is empty, or if any single crane would exceed `MAX_TASKS`.
 */
export function planBatchByCrane(
  line: PublicLine,
  qr: string,
  owners: CraneOwner[],
  opts: { namespace: number } = { namespace: defaultNodeOpts.namespace },
): RoutedBatchPlan {
  const entries = parseQr(qr);
  if (entries.length === 0) {
    throw new HttpError(400, 'The QR recipe has no tasks.');
  }

  // crane code → the PLC that controls it.
  const craneToOwner = new Map<string, CraneOwner>();
  for (const owner of owners) {
    for (const crane of owner.cranes) craneToOwner.set(crane, owner);
  }

  // Bucket by CRANE, preserving recipe order within each crane.
  const buckets = new Map<string, { owner: CraneOwner; tasks: PlannedTask[] }>();
  const missing: string[] = [];
  const unrouted: { key: string; crane: string }[] = [];

  for (const entry of entries) {
    const tank = resolveTank(line, entry.key);
    if (!tank) {
      missing.push(entry.key);
      continue;
    }
    const owner = craneToOwner.get(tank.crane);
    if (!owner) {
      unrouted.push({ key: entry.key, crane: tank.crane });
      continue;
    }
    const bucket = buckets.get(tank.crane) ?? { owner, tasks: [] };
    bucket.tasks.push({ station: tank.number + 1, time: entry.time });
    buckets.set(tank.crane, bucket);
  }

  const groups: CraneBatch[] = [...buckets.entries()].map(([crane, { owner, tasks }]) => {
    if (tasks.length > MAX_TASKS) {
      throw new HttpError(
        400,
        `Crane "${crane}" would receive ${tasks.length} tasks but its array holds at most ${MAX_TASKS}.`,
      );
    }
    const db = craneDbName(crane);
    return {
      connectionId: owner.connectionId,
      plcName: owner.name,
      crane,
      db,
      writes: buildTaskWrites(tasks, { namespace: opts.namespace, db }),
      count: tasks.length,
    };
  });

  return { groups, missing, unrouted };
}

/** What one crane received in a routed send. */
export interface DispatchResult {
  connectionId: string;
  plcName: string;
  crane: string;
  db: string;
  count: number;
}

/**
 * Send a QR recipe to the line's cranes and arm each run.
 *
 * Routing: if any of the line's PLCs is bound to cranes, the recipe is split by
 * tank → crane and each crane receives ONLY its own tanks (renumbered from 1) into
 * its OWN DB (`Crane<ID>Data`), over that crane's PLC session — so two cranes on
 * one PLC run in parallel. If NO PLC is bound to the line (legacy/sim), the whole
 * recipe is sent to the active connection as a single array on the default DB.
 *
 * Args: lineId — the saved line id; qr — the decoded recipe text.
 * Returns: `{ dispatched, count, busy: true }` — per-crane counts + the total.
 * Raises: 404 if the line is absent; 400 if a tank is not in the line or a tank's
 *   crane has no PLC assigned; 409 if a target PLC is not connected; 502 on write.
 */
export async function sendBatch(
  lineId: string,
  qr: string,
): Promise<{ dispatched: DispatchResult[]; count: number; busy: boolean }> {
  const line = await getLine(lineId); // 404 if the line does not exist
  const owners = (await connRepo.listByLine(lineId)).filter((c) => c.cranes.length > 0);

  // Legacy single-PLC path: no per-crane binding → one array on the active PLC's default DB.
  if (owners.length === 0) {
    const plan = planBatch(line, qr);
    if (plan.missing.length > 0) throw missingTanksError(line.name, plan.missing);
    await dispatchWrites(plan.writes, DEFAULT_CONNECTION_ID, defaultNodeOpts.db);
    return {
      dispatched: [
        { connectionId: DEFAULT_CONNECTION_ID, plcName: line.name, crane: '', db: defaultNodeOpts.db, count: plan.count },
      ],
      count: plan.count,
      busy: true,
    };
  }

  const routed = planBatchByCrane(
    line,
    qr,
    owners.map((c) => ({ connectionId: c._id, name: c.name, cranes: c.cranes })),
  );
  if (routed.missing.length > 0) throw missingTanksError(line.name, routed.missing);
  if (routed.unrouted.length > 0) {
    const detail = routed.unrouted.map((u) => `${u.key} (crane ${u.crane})`).join(', ');
    throw new HttpError(
      400,
      `No PLC is assigned to the crane for these recipe tanks on line "${line.name}": ${detail}. ` +
        `Assign the crane to a PLC in PLC Manager, then re-send.`,
    );
  }

  // Dispatch each crane's slice to its OWN DB (data first, cmd_send last), over its PLC session.
  const dispatched: DispatchResult[] = [];
  for (const group of routed.groups) {
    await dispatchWrites(group.writes, group.connectionId, group.db);
    dispatched.push({
      connectionId: group.connectionId,
      plcName: group.plcName,
      crane: group.crane,
      db: group.db,
      count: group.count,
    });
  }
  const count = dispatched.reduce((sum, d) => sum + d.count, 0);
  return { dispatched, count, busy: true };
}

/** 400 for recipe tanks that resolve to no tank in the line. */
function missingTanksError(lineName: string, missing: string[]): HttpError {
  return new HttpError(
    400,
    `These recipe tanks are not in line "${lineName}": ${missing.join(', ')}. ` +
      `Fix the recipe or the line layout, then re-send.`,
  );
}

/**
 * Write a crane's task data to its DB, then arm `cmd_send` LAST so the PLC's
 * rising-edge start only fires once every task field and the count are in place.
 *
 * Args: writes — the task writes (already targeting `db`); connectionId — the PLC
 *   session; db — the crane's DB name (so `cmd_send` is armed on the right DB).
 */
async function dispatchWrites(writes: BatchWrite[], connectionId: string, db: string): Promise<void> {
  for (const w of writes) {
    await writeNode(w.nodeId, w.dataType, w.value, connectionId);
  }
  await writeNode(
    scalarNode('cmd_send', { namespace: defaultNodeOpts.namespace, db }),
    'Boolean',
    true,
    connectionId,
  );
}

/**
 * Emergency-STOP one or more cranes (immediate hold).
 *
 * Purpose: Write `cmd_stop = TRUE` to each crane's DB; the sequencer honours it at
 *   the top of every scan — all motors off, latched in the STOPPED state. It does
 *   NOT clear the recipe (use `cleanCranes` to home + wipe).
 * Args: connectionId — the PLC session; cranes — crane codes to stop (empty → the
 *   env default DB, for a legacy single-DB connection).
 * Raises: 409 if not connected; 502 on an OPC UA write failure.
 */
export async function stopCranes(connectionId: string, cranes: string[]): Promise<void> {
  const targets = cranes.length > 0 ? cranes : [undefined];
  for (const crane of targets) {
    await writeNode(scalarNode('cmd_stop', optsForCrane(crane)), 'Boolean', true, connectionId);
  }
}

/**
 * CLEAN / reset one or more cranes to their home + a blank recipe.
 *
 * Purpose: Clear any stop, then arm `cmd_reset = TRUE`; the sequencer lifts the
 *   hoist clear, travels to Parking, wipes the recipe (task_count, sts flags, cmd_send),
 *   and returns to IDLE — "as if no recipe was ever sent, crane back home."
 * Args: connectionId — the PLC session; cranes — crane codes to clean (empty → the
 *   env default DB).
 * Raises: 409 if not connected; 502 on an OPC UA write failure.
 */
export async function cleanCranes(connectionId: string, cranes: string[]): Promise<void> {
  const targets = cranes.length > 0 ? cranes : [undefined];
  for (const crane of targets) {
    const opts = optsForCrane(crane);
    await writeNode(scalarNode('cmd_stop', opts), 'Boolean', false, connectionId);
    await writeNode(scalarNode('cmd_reset', opts), 'Boolean', true, connectionId);
  }
}

/** The PLC's handshake snapshot the UI polls while a batch runs. */
export interface BatchStatus {
  busy: boolean;
  done: boolean;
  step: number;
}

/**
 * Read a crane run's handshake (busy / done / current step) from one PLC.
 *
 * Args: connectionId — which PLC to read (defaults to the legacy active slot);
 *   crane — which crane's DB (`Crane<ID>Data`); omitted → the env default DB.
 * Returns: `{ busy, done, step }` read from `sts_busy` / `sts_done` / `sts_step`.
 * Raises: 409 if not connected; 502 on an OPC UA read failure.
 */
export async function getBatchStatus(
  connectionId: string = DEFAULT_CONNECTION_ID,
  crane?: string,
): Promise<BatchStatus> {
  const opts = optsForCrane(crane);
  const [busy, done, step] = await Promise.all([
    readNode(scalarNode('sts_busy', opts), connectionId),
    readNode(scalarNode('sts_done', opts), connectionId),
    readNode(scalarNode('sts_step', opts), connectionId),
  ]);
  return {
    busy: Boolean(busy.value),
    done: Boolean(done.value),
    step: Number(step.value ?? 0),
  };
}

/**
 * Acknowledge a completed batch by clearing `cmd_send` (the PLC clears `sts_done`
 * and returns to idle, ready for the next recipe).
 *
 * Args: connectionId — which PLC to acknowledge (defaults to the legacy slot);
 *   crane — which crane's DB (omitted → the env default DB).
 * Returns: the fresh `BatchStatus` after the ack.
 * Raises: 409 if not connected; 502 on an OPC UA failure.
 */
export async function ackBatch(
  connectionId: string = DEFAULT_CONNECTION_ID,
  crane?: string,
): Promise<BatchStatus> {
  await writeNode(scalarNode('cmd_send', optsForCrane(crane)), 'Boolean', false, connectionId);
  return getBatchStatus(connectionId, crane);
}

/**
 * Read one loaded task's target station from a crane's DB.
 *
 * Purpose: Let the plant view resolve "current tank / next tank" — the crane's
 *   `sts_step` indexes into its loaded `tasks[]`, so reading `tasks[step].station`
 *   (then mapping station → tank via the line) shows what the recipe is doing now.
 * Args: connectionId — the PLC session; crane — the crane's DB (omitted → env
 *   default DB); taskNo — 1-based task index (`tasks[1..count]`).
 * Returns: the station number, or 0 if the slot is empty/unreadable.
 * Raises: 409 if not connected; 502 on an OPC UA read failure.
 */
export async function readTaskStation(
  connectionId: string,
  crane: string | undefined,
  taskNo: number,
): Promise<number> {
  // Part of the ~1 Hz plant/crane poll → don't log (log = false).
  const res = await readNode(taskFieldNode(taskNo, 'station', optsForCrane(crane)), connectionId, false);
  return Number(res.value ?? 0);
}

/** Vertical hoist position derived from the limit switches / motor bits. */
export type HoistPosition = 'up' | 'down' | 'moving' | 'mid';

/** A live snapshot of the crane for the visualizer (all derived from PLC tags). */
export interface CraneView {
  /** State-machine value (0 IDLE, 10 GO_LOAD … 90 DONE). */
  state: number;
  /** Current task index 1..count (0 when idle). */
  step: number;
  busy: boolean;
  done: boolean;
  taskCount: number;
  /** Station the crane is over (first made limit switch), or null while travelling. */
  station: number | null;
  /** Each station's limit switch (`ls_at[i]`). Index = station number. */
  lsAt: boolean[];
  /** Hoist height for the animation. */
  hoist: HoistPosition;
  /** Live motor outputs (for direction hints). */
  moving: { fwd: boolean; rev: boolean; up: boolean; down: boolean };
}

/**
 * Read a live crane snapshot for the visualizer (one OPC UA round of reads).
 *
 * Purpose: Give the Crane View page everything it needs to animate the gantry —
 *   horizontal station (from `ls_at`), vertical hoist (from `ls_up`/`ls_dip`/`mv_*`),
 *   and the run status — in a single call. The whole `ls_at` array is read as one node.
 * Args: connectionId — which PLC to read (defaults to the legacy slot); crane —
 *   which crane's DB (`Crane<ID>Data`); omitted → the env default DB.
 * Returns: a `CraneView`.
 * Raises: 409 if not connected; 502 on an OPC UA read failure.
 */
export async function getCraneView(
  connectionId: string = DEFAULT_CONNECTION_ID,
  crane?: string,
): Promise<CraneView> {
  const o = optsForCrane(crane);
  // This is the ~1 Hz animation poll — pass `log = false` so it doesn't flood the
  // PLC I/O log (writes + command/handshake reads stay logged).
  const poll = (nodeId: string) => readNode(nodeId, connectionId, false);
  const [state, step, busy, done, taskCount, lsDip, lsUp, mvFwd, mvRev, mvUp, mvDown, lsAtRes] =
    await Promise.all([
      poll(scalarNode('sts_state', o)),
      poll(scalarNode('sts_step', o)),
      poll(scalarNode('sts_busy', o)),
      poll(scalarNode('sts_done', o)),
      poll(scalarNode('task_count', o)),
      poll(scalarNode('ls_dip', o)),
      poll(scalarNode('ls_up', o)),
      poll(scalarNode('mv_fwd', o)),
      poll(scalarNode('mv_rev', o)),
      poll(scalarNode('mv_up', o)),
      poll(scalarNode('mv_down', o)),
      poll(scalarNode('ls_at', o)), // whole Bool array in one read
    ]);

  const rawLsAt = lsAtRes.value as unknown;
  const lsAt = Array.isArray(rawLsAt) ? rawLsAt.map(Boolean) : [];
  const stationIdx = lsAt.findIndex((v) => v);
  const dip = Boolean(lsDip.value);
  const up = Boolean(lsUp.value);
  const mvU = Boolean(mvUp.value);
  const mvD = Boolean(mvDown.value);
  const hoist: HoistPosition = dip ? 'down' : up ? 'up' : mvU || mvD ? 'moving' : 'mid';

  return {
    state: Number(state.value ?? 0),
    step: Number(step.value ?? 0),
    busy: Boolean(busy.value),
    done: Boolean(done.value),
    taskCount: Number(taskCount.value ?? 0),
    station: stationIdx >= 0 ? stationIdx : null,
    lsAt,
    hoist,
    moving: { fwd: Boolean(mvFwd.value), rev: Boolean(mvRev.value), up: mvU, down: mvD },
  };
}
