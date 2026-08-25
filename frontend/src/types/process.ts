/**
 * Shared process types (mirror of the backend `process.model`).
 *
 * Purpose: The cross-line split of a recipe (steps + PLC/crane groups + the
 *   missing/ambiguous/unrouted flags) and the live run status the page polls.
 */

/** How a recipe step resolved against the saved lines (tank-level resolution). */
export type StepStatus = 'resolved' | 'missing' | 'ambiguous';

/** Where a resolved step lands: its line, tank, crane, and owning PLC (if any). */
export interface StepAssignment {
  lineId: string;
  lineName: string;
  tankNumber: number;
  tankName: string;
  station: number;
  crane: string;
  connectionId: string | null;
  plcName: string | null;
}

/** One recipe step after resolution (kept in recipe order). */
export interface ResolvedStep {
  step: number;
  key: string;
  time: number;
  status: StepStatus;
  assignment?: StepAssignment;
  candidateLineIds?: string[];
  candidateLineNames?: string[];
}

/** One task in a crane's ordered chain. */
export interface ChainTask {
  step: number;
  key: string;
  tankName: string;
  station: number;
  time: number;
}

/** A crane and its recipe-ordered tasks. */
export interface CraneChain {
  crane: string;
  tasks: ChainTask[];
}

/** A PLC and the crane chains it will run (null PLC = crane not assigned yet). */
export interface PlcGroup {
  connectionId: string | null;
  plcName: string | null;
  lineId: string;
  lineName: string;
  cranes: CraneChain[];
}

/** A recipe fully planned across all lines and PLCs. */
export interface ProcessPlan {
  steps: ResolvedStep[];
  groups: PlcGroup[];
  missing: { step: number; key: string }[];
  ambiguous: { step: number; key: string; candidateLineIds: string[]; candidateLineNames: string[] }[];
  unrouted: { step: number; key: string; lineName: string; crane: string }[];
  counts: { total: number; routed: number; missing: number; ambiguous: number; unrouted: number };
}

/** Live run state of a single step. */
export type RunTaskState = 'idle' | 'in_progress' | 'done';

/** One step's live status within a run. */
export interface RunStep {
  step: number;
  state: RunTaskState;
}

/** The polled snapshot of a running (simulated) process. */
export interface RunStatus {
  runId: string;
  done: boolean;
  progress: number;
  steps: RunStep[];
}
