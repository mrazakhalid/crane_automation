import { beforeEach, describe, expect, it } from 'vitest';
import { clear, getRecent, record } from '../services/plc/plc-log.js';

describe('plc-log ring buffer', () => {
  beforeEach(() => clear());

  it('records writes and reads with an increasing seq', () => {
    record({ dir: 'write', connectionId: 'c1', nodeId: 'ns=3;s="D"."cmd_send"', value: true, ok: true });
    record({ dir: 'read', connectionId: 'c1', nodeId: 'ns=3;s="D"."sts_step"', value: 2, ok: true });
    const { entries, lastSeq } = getRecent();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.dir).toBe('write');
    expect(entries[0]?.value).toBe(true);
    expect(entries[1]?.seq).toBe(2);
    expect(lastSeq).toBe(2);
  });

  it('only returns entries newer than afterSeq (incremental poll)', () => {
    record({ dir: 'write', connectionId: 'c1', nodeId: 'a', value: 1, ok: true });
    record({ dir: 'write', connectionId: 'c1', nodeId: 'b', value: 2, ok: true });
    const { entries } = getRecent(1);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.nodeId).toBe('b');
  });

  it('drops the oldest beyond capacity but keeps seq monotonic', () => {
    for (let i = 0; i < 2100; i += 1) {
      record({ dir: 'read', connectionId: 'c1', nodeId: `n${i}`, value: i, ok: true });
    }
    const { entries, lastSeq } = getRecent(0, 5000);
    expect(entries.length).toBeLessThanOrEqual(2000);
    expect(lastSeq).toBe(2100);
    // newest entry is the last one recorded
    expect(entries[entries.length - 1]?.nodeId).toBe('n2099');
  });

  it('captures a failed op with its error', () => {
    record({ dir: 'write', connectionId: 'c1', nodeId: 'x', value: 5, ok: false, error: 'Not connected' });
    const { entries } = getRecent();
    expect(entries[0]?.ok).toBe(false);
    expect(entries[0]?.error).toBe('Not connected');
  });
});
