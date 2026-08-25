import { describe, expect, it } from 'vitest';
import type { PublicLine } from '../models/line.model.js';
import {
  MAX_TASKS,
  planBatch,
  planBatchByConnection,
  type CraneOwner,
} from '../services/plc/batch.service.js';

/**
 * Unit tests for the pure batch planner: station mapping, write order, NodeId
 * shape, unresolved-key collection, and the array bound. No OPC UA I/O involved.
 */
const line4: PublicLine = {
  id: 'line-4',
  name: 'line4',
  cranes: ['7A'],
  createdAt: '',
  updatedAt: '',
  tanks: [
    { number: 1, name: '1-1A', crane: '7A' },
    { number: 2, name: '1-1B', crane: '7A' },
    { number: 3, name: '1-2', crane: '7A' },
  ],
};

const opts = { namespace: 3, db: 'Line4Data' };

describe('planBatch', () => {
  it('maps each tank to station = tank.number + 1 and carries the dwell time', () => {
    // Recipe from the screenshots: 1-1A=6; 1-1B=3; 1-2=5;
    const { writes, count, missing } = planBatch(line4, '1-1A=6;1-1B=3;1-2=5;', opts);
    expect(count).toBe(3);
    expect(missing).toEqual([]);

    // tasks[1] = 1-1A (tank 1 → station 2), dwell 6.
    // NodeId is 0-based over OPC UA: S7 tasks[1] → "tasks"[0] (bracket outside quotes).
    expect(writes[0]).toEqual({
      nodeId: 'ns=3;s="Line4Data"."tasks"[0]."station"',
      dataType: 'Int16',
      value: 2,
      label: 'tasks[1].station',
    });
    expect(writes[1]).toMatchObject({ value: 6, label: 'tasks[1].dwell_s' });
    // tasks[3] = 1-2 (tank 3 → station 4), dwell 5 → "tasks"[2]
    expect(writes[4]).toEqual({
      nodeId: 'ns=3;s="Line4Data"."tasks"[2]."station"',
      dataType: 'Int16',
      value: 4,
      label: 'tasks[3].station',
    });
    expect(writes[5]).toMatchObject({ value: 5, label: 'tasks[3].dwell_s' });
  });

  it('writes task_count LAST, after every task field', () => {
    const { writes } = planBatch(line4, '1-1A=6;1-1B=3;1-2=5;', opts);
    const last = writes[writes.length - 1]!;
    expect(last).toEqual({
      nodeId: 'ns=3;s="Line4Data"."task_count"',
      dataType: 'Int16',
      value: 3,
      label: 'task_count',
    });
    // 3 tasks × 2 fields + 1 count = 7 writes.
    expect(writes).toHaveLength(7);
  });

  it('preserves task-list order for a non-sequential recipe (crane reverses physically)', () => {
    // Start at tank 3 (station 4), then go back to tank 1 (station 2).
    const { writes } = planBatch(line4, '1-2=5;1-1A=6;', opts);
    expect(writes[0]).toMatchObject({ value: 4, label: 'tasks[1].station' });
    expect(writes[2]).toMatchObject({ value: 2, label: 'tasks[2].station' });
  });

  it('collects unresolved keys in `missing` instead of dropping them silently', () => {
    const { missing, count } = planBatch(line4, '1-1A=6;9-9=3;', opts);
    expect(count).toBe(2);
    expect(missing).toEqual(['9-9']);
  });

  it('rejects an empty recipe', () => {
    expect(() => planBatch(line4, ';;', opts)).toThrow(/no tasks/i);
  });

  it(`rejects more than ${MAX_TASKS} tasks (the PLC array bound)`, () => {
    const tooMany = Array.from({ length: MAX_TASKS + 1 }, (_, i) => `1-1A=${i + 1}`).join(';');
    expect(() => planBatch(line4, tooMany, opts)).toThrow(new RegExp(`at most ${MAX_TASKS}`));
  });
});

/**
 * A multi-PLC line (like the real Line 4): cranes 6 + 7A on one PLC, crane 7B on
 * another. Routing must split a recipe by tank → crane → PLC and renumber each
 * PLC's tasks from 1.
 */
const multiLine: PublicLine = {
  id: 'line-4-multi',
  name: 'line4-multi',
  cranes: ['6', '7A', '7B'],
  createdAt: '',
  updatedAt: '',
  tanks: [
    { number: 1, name: '1-11', crane: '6' },
    { number: 2, name: '1-9', crane: '6' },
    { number: 3, name: 'A3', crane: '7A' },
    { number: 4, name: 'B4', crane: '7B' },
  ],
};
const owners: CraneOwner[] = [
  { connectionId: 'plc4', name: 'PLC_4', cranes: ['6', '7A'] },
  { connectionId: 'plc6', name: 'PLC_6', cranes: ['7B'] },
];

describe('planBatchByConnection', () => {
  it('splits a recipe across PLCs by crane and renumbers each PLC from 1', () => {
    // Order: 1-11(PLC_4), A3(PLC_4), 1-9(PLC_4), B4(PLC_6).
    const { groups, missing, unrouted } = planBatchByConnection(
      multiLine,
      '1-11=6;A3=3;1-9=4;B4=5;',
      owners,
      opts,
    );
    expect(missing).toEqual([]);
    expect(unrouted).toEqual([]);
    expect(groups).toHaveLength(2);

    const plc4 = groups.find((g) => g.connectionId === 'plc4')!;
    expect(plc4.count).toBe(3);
    // task 1 = 1-11 (station 2), task 2 = A3 (station 4), task 3 = 1-9 (station 3).
    expect(plc4.writes[0]).toMatchObject({ value: 2, label: 'tasks[1].station' });
    expect(plc4.writes[2]).toMatchObject({ value: 4, label: 'tasks[2].station' });
    expect(plc4.writes[4]).toMatchObject({ value: 3, label: 'tasks[3].station' });
    expect(plc4.writes[plc4.writes.length - 1]).toMatchObject({ value: 3, label: 'task_count' });

    const plc6 = groups.find((g) => g.connectionId === 'plc6')!;
    expect(plc6.count).toBe(1);
    // B4 renumbers to tasks[1] on its own PLC (station 5, dwell 5).
    expect(plc6.writes[0]).toMatchObject({ value: 5, label: 'tasks[1].station' });
    expect(plc6.writes[1]).toMatchObject({ value: 5, label: 'tasks[1].dwell_s' });
    expect(plc6.writes[2]).toMatchObject({ value: 1, label: 'task_count' });
  });

  it('collects tasks whose crane has no PLC as `unrouted` (config gap)', () => {
    const partial: CraneOwner[] = [{ connectionId: 'plc4', name: 'PLC_4', cranes: ['6'] }];
    const { groups, unrouted } = planBatchByConnection(multiLine, '1-11=6;A3=3;B4=5;', partial, opts);
    // Only 1-11 (crane 6) routes; A3 (7A) and B4 (7B) are unrouted.
    expect(groups).toHaveLength(1);
    expect(unrouted).toEqual([
      { key: 'A3', crane: '7A' },
      { key: 'B4', crane: '7B' },
    ]);
  });

  it('collects unresolved keys as `missing`', () => {
    const { missing } = planBatchByConnection(multiLine, '1-11=6;9-9=3;', owners, opts);
    expect(missing).toEqual(['9-9']);
  });

  it(`rejects when a single PLC would exceed ${MAX_TASKS} tasks`, () => {
    const tooMany = Array.from({ length: MAX_TASKS + 1 }, (_, i) => `1-11=${i + 1}`).join(';');
    expect(() => planBatchByConnection(multiLine, tooMany, owners, opts)).toThrow(
      new RegExp(`at most ${MAX_TASKS}`),
    );
  });

  it('rejects an empty recipe', () => {
    expect(() => planBatchByConnection(multiLine, ';;', owners, opts)).toThrow(/no tasks/i);
  });
});
