import { toPublicLine, type PublicLine } from '../../models/line.model.js';
import type { PlcConnectionRecord } from '../../models/plc-connection.model.js';
import type {
  ChainTask,
  PlcGroup,
  ProcessPlan,
  ResolvedStep,
  StepAssignment,
} from '../../models/process.model.js';
import type { StepOverrides } from '../../models/recipe.model.js';
import * as lineRepo from '../../repositories/line.repository.js';
import * as connRepo from '../../repositories/plc-connection.repository.js';
import { HttpError } from '../../utils/http-error.js';
import { parseQr } from '../task-generator.js';
import { resolveAcrossLines } from './resolver.js';

/**
 * Process planner — split a cross-line recipe into per-PLC, per-crane task chains.
 *
 * Purpose: Turn a flat `key=seconds;…` recipe (which may span several lines) into
 *   a routed plan: each step is resolved to a tank → line → crane → owning PLC,
 *   then grouped by PLC and, within a PLC, by crane (each crane's tasks kept in
 *   recipe order — that crane runs them strictly sequentially). Unresolved,
 *   ambiguous, and un-routed steps are surfaced, never silently dropped.
 */

/** A sane upper bound on recipe length (the `qr` string is also length-capped). */
export const MAX_STEPS = 500;

/** The PLC that owns a crane, resolved from a connection's `lineId` + `cranes`. */
interface CraneOwner {
  connectionId: string;
  name: string;
}

/** Build `lineId → (crane → owning PLC)` from every line-assigned connection. */
function ownersByLine(connections: PlcConnectionRecord[]): Map<string, Map<string, CraneOwner>> {
  const map = new Map<string, Map<string, CraneOwner>>();
  for (const conn of connections) {
    if (!conn.lineId) continue;
    let byCrane = map.get(conn.lineId);
    if (!byCrane) {
      byCrane = new Map();
      map.set(conn.lineId, byCrane);
    }
    for (const crane of conn.cranes) {
      byCrane.set(crane, { connectionId: conn._id, name: conn.name });
    }
  }
  return map;
}

/** Accumulator for one display group (PLC or an unassigned crane). */
interface GroupAccum {
  connectionId: string | null;
  plcName: string | null;
  lineId: string;
  lineName: string;
  /** crane → its recipe-ordered tasks. */
  cranes: Map<string, ChainTask[]>;
}

/**
 * Build a process plan from in-memory fixtures (pure — no I/O, unit-testable).
 *
 * Args: lines — every saved line (client-safe shape); connections — every saved
 *   PLC connection; qr — the recipe text; overrides — per-step line picks that
 *   break ambiguities (`{ "<step>": "<lineId>" }`).
 * Returns: A `ProcessPlan` (steps, grouped chains, and missing/ambiguous/unrouted).
 * Raises: 400 if the recipe is empty or exceeds `MAX_STEPS`.
 */
export function buildPlan(
  lines: PublicLine[],
  connections: PlcConnectionRecord[],
  qr: string,
  overrides: StepOverrides = {},
): ProcessPlan {
  const entries = parseQr(qr);
  if (entries.length === 0) throw new HttpError(400, 'The recipe has no tasks.');
  if (entries.length > MAX_STEPS) {
    throw new HttpError(400, `The recipe has ${entries.length} tasks; the maximum is ${MAX_STEPS}.`);
  }

  const owners = ownersByLine(connections);
  const steps: ResolvedStep[] = [];
  const groups = new Map<string, GroupAccum>();
  const missing: ProcessPlan['missing'] = [];
  const ambiguous: ProcessPlan['ambiguous'] = [];
  const unrouted: ProcessPlan['unrouted'] = [];
  let routed = 0;

  entries.forEach((entry, i) => {
    const step = i + 1;
    const outcome = resolveAcrossLines(lines, entry.key, overrides[String(step)]);

    if (outcome.status === 'missing') {
      steps.push({ step, key: entry.key, time: entry.time, status: 'missing' });
      missing.push({ step, key: entry.key });
      return;
    }

    if (outcome.status === 'ambiguous') {
      const candidateLineIds = outcome.candidates.map((c) => c.line.id);
      const candidateLineNames = outcome.candidates.map((c) => c.line.name);
      steps.push({
        step,
        key: entry.key,
        time: entry.time,
        status: 'ambiguous',
        candidateLineIds,
        candidateLineNames,
      });
      ambiguous.push({ step, key: entry.key, candidateLineIds, candidateLineNames });
      return;
    }

    // Resolved: map tank → crane → owning PLC (owner may be absent = unrouted).
    const { line, tank } = outcome;
    const station = tank.number + 1;
    const owner = owners.get(line.id)?.get(tank.crane) ?? null;
    const assignment: StepAssignment = {
      lineId: line.id,
      lineName: line.name,
      tankNumber: tank.number,
      tankName: tank.name,
      station,
      crane: tank.crane,
      connectionId: owner?.connectionId ?? null,
      plcName: owner?.name ?? null,
    };
    steps.push({ step, key: entry.key, time: entry.time, status: 'resolved', assignment });

    if (owner) routed += 1;
    else unrouted.push({ step, key: entry.key, lineName: line.name, crane: tank.crane });

    // Group by PLC when known; otherwise one group per unassigned line+crane.
    const groupKey = owner ? owner.connectionId : `noplc:${line.id}:${tank.crane}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        connectionId: owner?.connectionId ?? null,
        plcName: owner?.name ?? null,
        lineId: line.id,
        lineName: line.name,
        cranes: new Map(),
      };
      groups.set(groupKey, group);
    }
    const task: ChainTask = { step, key: entry.key, tankName: tank.name, station, time: entry.time };
    const list = group.cranes.get(tank.crane) ?? [];
    list.push(task);
    group.cranes.set(tank.crane, list);
  });

  const groupList: PlcGroup[] = [...groups.values()].map((g) => ({
    connectionId: g.connectionId,
    plcName: g.plcName,
    lineId: g.lineId,
    lineName: g.lineName,
    cranes: [...g.cranes.entries()].map(([crane, tasks]) => ({ crane, tasks })),
  }));

  return {
    steps,
    groups: groupList,
    missing,
    ambiguous,
    unrouted,
    counts: {
      total: entries.length,
      routed,
      missing: missing.length,
      ambiguous: ambiguous.length,
      unrouted: unrouted.length,
    },
  };
}

/**
 * Plan a recipe across all saved lines and PLCs (loads data, then `buildPlan`).
 *
 * Args: qr — the recipe text; overrides — per-step line disambiguations.
 * Returns: A `ProcessPlan`.
 * Raises: 400 if the recipe is empty or exceeds `MAX_STEPS`.
 */
export async function planProcess(qr: string, overrides: StepOverrides = {}): Promise<ProcessPlan> {
  const [lineRecords, connections] = await Promise.all([lineRepo.listAll(), connRepo.listAll()]);
  const lines = lineRecords.map(toPublicLine);
  return buildPlan(lines, connections, qr, overrides);
}
