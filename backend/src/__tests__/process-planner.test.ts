import { describe, expect, it } from 'vitest';
import type { PublicLine } from '../models/line.model.js';
import type { PlcConnectionRecord } from '../models/plc-connection.model.js';
import { buildPlan } from '../services/process/planner.js';
import { resolveAcrossLines } from '../services/process/resolver.js';

/**
 * Unit tests for the pure cross-line resolver + planner: tank resolution across
 * lines (resolved / missing / ambiguous / override), grouping by PLC → crane,
 * station math, and the unrouted (crane with no PLC) case. No DB or I/O.
 */

const lineA: PublicLine = {
  id: 'LA',
  name: 'lineA',
  cranes: ['a1'],
  createdAt: '',
  updatedAt: '',
  tanks: [
    { number: 1, name: 't-1', crane: 'a1' },
    { number: 4, name: 't-4', crane: 'a1' },
    { number: 2, name: 'dup', crane: 'a1' },
  ],
};

const lineB: PublicLine = {
  id: 'LB',
  name: 'lineB',
  cranes: ['b1'],
  createdAt: '',
  updatedAt: '',
  tanks: [
    { number: 1, name: 't-2', crane: 'b1' },
    { number: 2, name: 'dup', crane: 'b1' },
  ],
};

const lines = [lineA, lineB];

function conn(partial: Partial<PlcConnectionRecord>): PlcConnectionRecord {
  return {
    _id: 'C?',
    name: 'PLC_?',
    endpoint: 'opc.tcp://x:4840',
    securityMode: 'None',
    securityPolicy: 'None',
    isActive: false,
    lineId: null,
    cranes: [],
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

// PLC_A owns crane a1 on lineA. lineB has a connection but owns NO crane → b1 is unrouted.
const connections = [
  conn({ _id: 'CA', name: 'PLC_A', lineId: 'LA', cranes: ['a1'] }),
  conn({ _id: 'CB', name: 'PLC_B', lineId: 'LB', cranes: [] }),
];

describe('resolveAcrossLines', () => {
  it('resolves a key that matches exactly one line', () => {
    const out = resolveAcrossLines(lines, 't-1');
    expect(out.status).toBe('resolved');
    if (out.status === 'resolved') expect(out.line.id).toBe('LA');
  });

  it('returns missing when no line has the tank', () => {
    expect(resolveAcrossLines(lines, 'nope').status).toBe('missing');
  });

  it('returns ambiguous when more than one line matches', () => {
    const out = resolveAcrossLines(lines, 'dup');
    expect(out.status).toBe('ambiguous');
    if (out.status === 'ambiguous') expect(out.candidates.map((c) => c.line.id)).toEqual(['LA', 'LB']);
  });

  it('an override picks the intended line for an ambiguous key', () => {
    const out = resolveAcrossLines(lines, 'dup', 'LB');
    expect(out.status).toBe('resolved');
    if (out.status === 'resolved') expect(out.line.id).toBe('LB');
  });
});

describe('buildPlan', () => {
  it('splits a cross-line recipe and flags missing / ambiguous / unrouted', () => {
    const plan = buildPlan(lines, connections, 't-1=5;t-2=6;dup=7;nope=8');

    expect(plan.counts).toEqual({ total: 4, routed: 1, missing: 1, ambiguous: 1, unrouted: 1 });
    expect(plan.missing).toEqual([{ step: 4, key: 'nope' }]);
    expect(plan.ambiguous[0]).toMatchObject({ step: 3, key: 'dup', candidateLineNames: ['lineA', 'lineB'] });
    expect(plan.unrouted).toEqual([{ step: 2, key: 't-2', lineName: 'lineB', crane: 'b1' }]);

    // Group for the routed PLC_A.
    const plcA = plan.groups.find((g) => g.connectionId === 'CA')!;
    expect(plcA.plcName).toBe('PLC_A');
    expect(plcA.cranes[0]).toMatchObject({ crane: 'a1' });
    // station = tank.number + 1 → t-1 (tank 1) → station 2.
    expect(plcA.cranes[0]!.tasks[0]).toMatchObject({ step: 1, tankName: 't-1', station: 2, time: 5 });

    // Unrouted task still appears in a group with a null PLC.
    const noPlc = plan.groups.find((g) => g.connectionId === null)!;
    expect(noPlc.plcName).toBeNull();
    expect(noPlc.cranes[0]!.tasks[0]).toMatchObject({ step: 2, tankName: 't-2', station: 2 });
  });

  it('keeps a crane’s tasks in recipe order (sequential chain)', () => {
    const plan = buildPlan(lines, connections, 't-4=3;t-1=9');
    const chain = plan.groups.find((g) => g.connectionId === 'CA')!.cranes[0]!;
    expect(chain.tasks.map((t) => t.tankName)).toEqual(['t-4', 't-1']);
  });

  it('an override routes an otherwise-ambiguous step', () => {
    const plan = buildPlan(lines, connections, 'dup=7', { '1': 'LA' });
    expect(plan.counts.ambiguous).toBe(0);
    const chain = plan.groups.find((g) => g.connectionId === 'CA')!.cranes[0]!;
    expect(chain.tasks[0]).toMatchObject({ step: 1, tankName: 'dup' });
  });

  it('400s on an empty recipe', () => {
    expect(() => buildPlan(lines, connections, ';;')).toThrow();
  });
});
