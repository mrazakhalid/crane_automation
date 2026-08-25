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
 * e.g. the sim). For multi-PLC lines see `planBatchByConnection`.
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

/** The per-PLC writes for one connection in a routed batch. */
export interface ConnectionBatch {
  connectionId: string;
  name: string;
  writes: BatchWrite[];
  count: number;
}

/** A recipe routed across the line's PLCs, plus anything that could not be routed. */
export interface RoutedBatchPlan {
  groups: ConnectionBatch[];
  /** QR keys that resolved to no tank in the line. */
  missing: string[];
  /** Tasks whose tank has no PLC owning its crane (config gap). */
  unrouted: { key: string; crane: string }[];
}

/**
 * Plan a QR recipe across the line's PLCs (pure — no I/O), splitting by
 * tank → crane → owning PLC and renumbering each PLC's tasks from 1.
 *
 * Args: line — the saved line; qr — the recipe text; owners — the line's PLCs and
 *   the cranes each controls; opts — namespace/DB for NodeIds.
 * Returns: `{ groups, missing, unrouted }` — one group per PLC that received at
 *   least one task, preserving recipe order within each PLC.
 * Raises: 400 if the recipe is empty, or if any single PLC would receive more than
 *   `MAX_TASKS` tasks (its array bound).
 */
export function planBatchByConnection(
  line: PublicLine,
  qr: string,
  owners: CraneOwner[],
  opts: NodeOpts = defaultNodeOpts,
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
    const bucket = buckets.get(owner.connectionId) ?? { owner, tasks: [] };
    bucket.tasks.push({ station: tank.number + 1, time: entry.time });
    buckets.set(owner.connectionId, bucket);
  }

  const groups: ConnectionBatch[] = [...buckets.values()].map(({ owner, tasks }) => {
    if (tasks.length > MAX_TASKS) {
      throw new HttpError(
        400,
        `PLC "${owner.name}" would receive ${tasks.length} tasks but its array holds at most ${MAX_TASKS}.`,
      );
    }
    return {
      connectionId: owner.connectionId,
      name: owner.name,
      writes: buildTaskWrites(tasks, opts),
      count: tasks.length,
    };
  });

  return { groups, missing, unrouted };
}

/** What one PLC received in a routed send. */
export interface DispatchResult {
  connectionId: string;
  name: string;
  count: number;
}

/**
 * Send a QR recipe to the line's PLC(s) and arm each run.
 *
 * Routing: if any of the line's PLCs is bound to cranes, the recipe is split by
 * tank → crane → PLC and each PLC receives ONLY its own tanks (renumbered from 1),
 * over that PLC's own session. If NO PLC is bound to the line (legacy/sim), the
 * whole recipe is sent to the active connection as a single array — preserving
 * the original single-PLC behaviour.
 *
 * Args: lineId — the saved line id; qr — the decoded recipe text.
 * Returns: `{ dispatched, count, busy: true }` — per-PLC counts + the total.
 * Raises: 404 if the line is absent; 400 if a tank is not in the line or a tank's
 *   crane has no PLC assigned; 409 if a target PLC is not connected; 502 on write.
 */
export async function sendBatch(
  lineId: string,
  qr: string,
): Promise<{ dispatched: DispatchResult[]; count: number; busy: boolean }> {
  const line = await getLine(lineId); // 404 if the line does not exist
  const owners = (await connRepo.listByLine(lineId)).filter((c) => c.cranes.length > 0);

  // Legacy single-PLC path: no per-crane binding → one array on the active PLC.
  if (owners.length === 0) {
    const plan = planBatch(line, qr);
    if (plan.missing.length > 0) throw missingTanksError(line.name, plan.missing);
    await dispatchWrites(plan.writes, DEFAULT_CONNECTION_ID);
    return {
      dispatched: [{ connectionId: DEFAULT_CONNECTION_ID, name: line.name, count: plan.count }],
      count: plan.count,
      busy: true,
    };
  }

  const routed = planBatchByConnection(
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

  // Dispatch each PLC's slice on its own session (data first, cmd_send last).
  const dispatched: DispatchResult[] = [];
  for (const group of routed.groups) {
    await dispatchWrites(group.writes, group.connectionId);
    dispatched.push({ connectionId: group.connectionId, name: group.name, count: group.count });
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
 * Write a PLC's task data, then arm `cmd_send` LAST so the PLC's rising-edge start
 * only fires once every task field and the count are already in place.
 */
async function dispatchWrites(writes: BatchWrite[], connectionId: string): Promise<void> {
  for (const w of writes) {
    await writeNode(w.nodeId, w.dataType, w.value, connectionId);
  }
  await writeNode(scalarNode('cmd_send'), 'Boolean', true, connectionId);
}

/** The PLC's handshake snapshot the UI polls while a batch runs. */
export interface BatchStatus {
  busy: boolean;
  done: boolean;
  step: number;
}

/**
 * Read the crane run's handshake (busy / done / current step) from one PLC.
 *
 * Args: connectionId — which PLC to read (defaults to the legacy active slot).
 * Returns: `{ busy, done, step }` read from `sts_busy` / `sts_done` / `sts_step`.
 * Raises: 409 if not connected; 502 on an OPC UA read failure.
 */
export async function getBatchStatus(
  connectionId: string = DEFAULT_CONNECTION_ID,
): Promise<BatchStatus> {
  const [busy, done, step] = await Promise.all([
    readNode(scalarNode('sts_busy'), connectionId),
    readNode(scalarNode('sts_done'), connectionId),
    readNode(scalarNode('sts_step'), connectionId),
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
 * Args: connectionId — which PLC to acknowledge (defaults to the legacy slot).
 * Returns: the fresh `BatchStatus` after the ack.
 * Raises: 409 if not connected; 502 on an OPC UA failure.
 */
export async function ackBatch(connectionId: string = DEFAULT_CONNECTION_ID): Promise<BatchStatus> {
  await writeNode(scalarNode('cmd_send'), 'Boolean', false, connectionId);
  return getBatchStatus(connectionId);
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
 * Args: connectionId — which PLC/crane to read (defaults to the legacy slot).
 * Returns: a `CraneView`.
 * Raises: 409 if not connected; 502 on an OPC UA read failure.
 */
export async function getCraneView(
  connectionId: string = DEFAULT_CONNECTION_ID,
): Promise<CraneView> {
  const [state, step, busy, done, taskCount, lsDip, lsUp, mvFwd, mvRev, mvUp, mvDown, lsAtRes] =
    await Promise.all([
      readNode(scalarNode('sts_state'), connectionId),
      readNode(scalarNode('sts_step'), connectionId),
      readNode(scalarNode('sts_busy'), connectionId),
      readNode(scalarNode('sts_done'), connectionId),
      readNode(scalarNode('task_count'), connectionId),
      readNode(scalarNode('ls_dip'), connectionId),
      readNode(scalarNode('ls_up'), connectionId),
      readNode(scalarNode('mv_fwd'), connectionId),
      readNode(scalarNode('mv_rev'), connectionId),
      readNode(scalarNode('mv_up'), connectionId),
      readNode(scalarNode('mv_down'), connectionId),
      readNode(scalarNode('ls_at'), connectionId), // whole Bool array in one read
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
