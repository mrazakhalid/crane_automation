/**
 * Process domain model — the cross-line split of a recipe and its live run state.
 *
 * Purpose: Single source of truth for the shapes the process planner and run
 *   engine produce. A recipe (flat `key=seconds` list, possibly spanning several
 *   lines) is resolved step-by-step to a tank → line → crane → owning PLC, then
 *   grouped for the summary. No logic lives here.
 */

/** How a recipe step resolved against the saved lines (tank-level resolution). */
export type StepStatus = 'resolved' | 'missing' | 'ambiguous';

/** Where a resolved step lands: its line, tank, crane, and owning PLC (if any). */
export interface StepAssignment {
  lineId: string;
  lineName: string;
  tankNumber: number;
  tankName: string;
  /** Physical station index the crane travels to (`tank.number + 1`). */
  station: number;
  crane: string;
  /** Owning PLC connection id, or null when no PLC is assigned to this crane yet. */
  connectionId: string | null;
  /** Owning PLC name, or null when unrouted. */
  plcName: string | null;
}

/** One recipe step after resolution (kept in recipe order, nothing dropped). */
export interface ResolvedStep {
  /** 1-based position in the recipe — the stable task id used by the run engine. */
  step: number;
  key: string;
  /** Dwell seconds. */
  time: number;
  status: StepStatus;
  /** Present when `status === 'resolved'`. */
  assignment?: StepAssignment;
  /** Present when `status === 'ambiguous'` — the lines whose tanks matched the key. */
  candidateLineIds?: string[];
  candidateLineNames?: string[];
}

/** One task in a crane's ordered chain (a crane runs its tasks strictly in order). */
export interface ChainTask {
  step: number;
  key: string;
  tankName: string;
  station: number;
  time: number;
}

/** A crane and its recipe-ordered tasks (the atomic sequential unit). */
export interface CraneChain {
  crane: string;
  tasks: ChainTask[];
}

/**
 * A PLC and the crane chains it will run. `connectionId`/`plcName` are null when
 * the crane has no PLC assigned yet — the tasks still appear (grouped by line +
 * crane) so the summary is useful even before PLC connections are configured.
 */
export interface PlcGroup {
  connectionId: string | null;
  plcName: string | null;
  lineId: string;
  lineName: string;
  cranes: CraneChain[];
}

/** A recipe fully planned across all lines and PLCs. */
export interface ProcessPlan {
  /** Every recipe step in order, resolved or flagged (for the recipe view). */
  steps: ResolvedStep[];
  /** Resolved tasks grouped by PLC → crane → ordered tasks (the summary view). */
  groups: PlcGroup[];
  /** Steps whose key matched no tank on any line. */
  missing: { step: number; key: string }[];
  /** Steps whose key matched tanks on more than one line and need disambiguation. */
  ambiguous: { step: number; key: string; candidateLineIds: string[]; candidateLineNames: string[] }[];
  /** Resolved steps whose crane has no PLC assigned (config gap, not fatal here). */
  unrouted: { step: number; key: string; lineName: string; crane: string }[];
  /** Tallies for a quick banner. */
  counts: { total: number; routed: number; missing: number; ambiguous: number; unrouted: number };
}

/** Live run state of a single step (derived from elapsed time in the simulation). */
export type RunTaskState = 'idle' | 'in_progress' | 'done';

/** One step's live status within a run. */
export interface RunStep {
  step: number;
  state: RunTaskState;
}

/** The polled snapshot of a running (simulated) process. */
export interface RunStatus {
  runId: string;
  /** True once every crane chain has finished. */
  done: boolean;
  /** Whole-run progress 0..1 (by task count). */
  progress: number;
  /** Per-step live state, keyed by the recipe step number. */
  steps: RunStep[];
}
