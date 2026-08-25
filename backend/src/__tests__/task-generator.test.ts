import { describe, expect, it } from 'vitest';
import type { PublicLine } from '../models/line.model.js';
import { generateTasks, parseQr, resolveTank } from '../services/task-generator.js';

/**
 * Unit tests for the pure QR → task generator, using a line4-shaped fixture.
 */
const line4: PublicLine = {
  id: 'line-4',
  name: 'line4',
  cranes: ['7A', '7B', '6'],
  createdAt: '',
  updatedAt: '',
  tanks: [
    { number: 1, name: '1-1A', crane: '7A' },
    { number: 2, name: '1-1B', crane: '7A' },
    { number: 3, name: '1-2', crane: '7A' },
    { number: 4, name: '1-3', crane: '7A' },
    { number: 5, name: '1-4A', crane: '7A' },
    { number: 6, name: '1-4B', crane: '7A', cranes: ['7A', '7B'], transfer: true },
    { number: 7, name: '1-4C', crane: '7B' },
    { number: 8, name: '1-5', crane: '7B' },
    { number: 9, name: '1-6', crane: '7B' },
    { number: 10, name: 'TRVL-4B', crane: '7B', cranes: ['7B', '6'], transfer: true },
    { number: 11, name: '1-7b', crane: '6' },
    { number: 12, name: '1-8', crane: '6' },
  ],
};

const SAMPLE_QR = '1-1=60;1-2=30;1-3=5;1-4=30;1-6=60;1-5=30;1-7=60;1-8=30;20-1=60;5-2=130';

describe('parseQr', () => {
  it('parses key=seconds pairs in order and ignores trailing separators', () => {
    expect(parseQr('1-1=60;1-2=30;')).toEqual([
      { key: '1-1', time: 60 },
      { key: '1-2', time: 30 },
    ]);
  });
});

describe('resolveTank', () => {
  it('maps "1-1" to tank 1 (lowest of 1-1A/1-1B)', () => {
    expect(resolveTank(line4, '1-1')?.number).toBe(1);
  });
  it('resolves exact names and the lowercase-suffix tank 1-7b via "1-7"', () => {
    expect(resolveTank(line4, '1-2')?.number).toBe(3);
    expect(resolveTank(line4, '1-7')?.number).toBe(11);
  });
  it('returns null for a key not in the line', () => {
    expect(resolveTank(line4, '20-1')).toBeNull();
  });
});

describe('generateTasks', () => {
  const tasks = generateTasks(line4, SAMPLE_QR);

  it('matches the stated example: task 1-2 → prev tank_1, next tank_4', () => {
    const t = tasks[1]!;
    expect(t.key).toBe('1-2');
    expect(t.tank_name).toBe('1-2');
    expect(t.crane_name).toBe('7A');
    expect(t.time).toBe(30);
    expect(t.previous_task).toBe(1);
    expect(t.next_task).toBe(4);
    expect(t.status).toBe(0);
  });

  it('sets the first task previous_task to 0', () => {
    expect(tasks[0]!.previous_task).toBe(0);
  });

  it('writes "missing" for unresolved keys but keeps them in sequence', () => {
    const missing = tasks.find((t) => t.key === '20-1')!;
    expect(missing.tank_name).toBe('missing');
    expect(missing.crane_name).toBe('missing');
    expect(missing.time).toBe(60);
    // Its neighbour 1-8 (tank 12) is resolvable; the next (5-2) is not.
    expect(missing.previous_task).toBe(12);
    expect(missing.next_task).toBe('missing');
  });

  it('produces one task per QR entry, in order', () => {
    expect(tasks).toHaveLength(10);
    expect(tasks.map((t) => t.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
