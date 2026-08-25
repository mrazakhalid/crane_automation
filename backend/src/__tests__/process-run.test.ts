import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainTask, ProcessPlan } from '../models/process.model.js';
import { _clearRuns, getRunStatus, startRun, stopRun } from '../services/process/run-engine.js';

/**
 * Unit tests for the simulated run engine. Time is mocked (fake timers) so the
 * derived per-task states are deterministic. Covers sequential-within-a-crane +
 * parallel-across-cranes scheduling, completion, and stop/reset.
 */

const task = (step: number, time: number): ChainTask => ({
  step,
  key: `k${step}`,
  tankName: `t${step}`,
  station: step + 1,
  time,
});

/** PLC_A runs a1: two sequential tasks (2s, 3s). PLC_B runs b1: one 4s task (parallel). */
const plan: ProcessPlan = {
  steps: [],
  groups: [
    {
      connectionId: 'CA',
      plcName: 'PLC_A',
      lineId: 'LA',
      lineName: 'lineA',
      cranes: [{ crane: 'a1', tasks: [task(1, 2), task(2, 3)] }],
    },
    {
      connectionId: 'CB',
      plcName: 'PLC_B',
      lineId: 'LB',
      lineName: 'lineB',
      cranes: [{ crane: 'b1', tasks: [task(3, 4)] }],
    },
  ],
  missing: [],
  ambiguous: [],
  unrouted: [],
  counts: { total: 3, routed: 3, missing: 0, ambiguous: 0, unrouted: 0 },
};

/** Convenience: the state of a given step in the current status snapshot. */
function stateOfStep(runId: string, step: number): string {
  return getRunStatus(runId).steps.find((s) => s.step === step)!.state;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  _clearRuns();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('run-engine', () => {
  it('starts a1.task1 and b1.task3 together, with a1.task2 waiting (parallel chains)', () => {
    const runId = startRun(plan);
    expect(stateOfStep(runId, 1)).toBe('in_progress'); // a1 first
    expect(stateOfStep(runId, 2)).toBe('idle'); // a1 second, blocked by first
    expect(stateOfStep(runId, 3)).toBe('in_progress'); // b1, runs in parallel
    expect(getRunStatus(runId).done).toBe(false);
  });

  it('advances a1 to its second task once the first finishes', () => {
    const runId = startRun(plan);
    vi.advanceTimersByTime(2500); // past a1.task1 (2s), still inside b1.task3 (4s)
    expect(stateOfStep(runId, 1)).toBe('done');
    expect(stateOfStep(runId, 2)).toBe('in_progress');
    expect(stateOfStep(runId, 3)).toBe('in_progress');
  });

  it('reports done and full progress once the longest chain finishes', () => {
    const runId = startRun(plan);
    vi.advanceTimersByTime(5000); // a1 chain = 2+3 = 5s (the longest)
    const status = getRunStatus(runId);
    expect(status.steps.every((s) => s.state === 'done')).toBe(true);
    expect(status.done).toBe(true);
    expect(status.progress).toBe(1);
  });

  it('stop removes the run so a later status read 404s', () => {
    const runId = startRun(plan);
    expect(stopRun(runId)).toBe(true);
    expect(() => getRunStatus(runId)).toThrow();
  });
});
