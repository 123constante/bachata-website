/**
 * People arc S7 critique: seedPersonSnapshot is the only new code on the /dancers/:id loader's path.
 * Whatever the snapshot read does (answers, fails, never answers), the seed must settle by its
 * deadline, never reject, write the key only on an answer, and leave NO timer behind (a pending
 * timer is work a serverless invocation would otherwise keep alive after the page is sent).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const read = vi.hoisted(() => ({ impl: (): Promise<unknown> => Promise.resolve(null) }));
vi.mock('./reads', () => ({ loadPersonSnapshot: () => read.impl() }));

import { seedPersonSnapshot } from './seedPersonSnapshot';
import { personSnapshotKey } from './usePersonRoles';

const SNAP = { id: 'p1', name: 'Ana', avatarUrl: null, city: null, instagramUrl: null, roles: ['dj', 'dancer'], djPhoto: null };
// S7c: a role read the snapshot swallowed failed: the answer is still worth seeding, but not complete.
const PARTIAL = { ...SNAP, roles: ['dancer'], partial: true };
const DEADLINE = 2500;

const CASES = [
  { name: 'answers in time', impl: () => Promise.resolve(SNAP), seeded: true, value: SNAP, fast: true },
  // Written (better than nothing) but false: the route bounds the edge TTL as for a missed seed.
  { name: 'answers partial (written, not complete)', impl: () => Promise.resolve(PARTIAL), seeded: false, written: true, value: PARTIAL, fast: true },
  { name: 'answers null (no public person)', impl: () => Promise.resolve(null), seeded: true, value: null, fast: true },
  { name: 'read fails', impl: () => Promise.reject(new Error('boom')), seeded: false, value: undefined, fast: true },
  { name: 'never answers (past the deadline)', impl: () => new Promise(() => {}), seeded: false, value: undefined, fast: false },
  {
    name: 'answers after the deadline (late answer dropped)',
    impl: () => new Promise((res) => setTimeout(() => res(SNAP), DEADLINE + 1000)),
    seeded: false,
    value: undefined,
    fast: false,
  },
] as const;

describe('seedPersonSnapshot: settles by its deadline, never rejects, leaves no timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(CASES)('$name: complete $seeded', async (c) => {
    read.impl = c.impl as () => Promise<unknown>;
    const qc = new QueryClient();
    let settled: boolean | 'rejected' | undefined;
    seedPersonSnapshot(qc, 'p1', DEADLINE).then((v) => { settled = v; }, () => { settled = 'rejected'; });

    // A read that answers settles the seed at once and clears the deadline timer with it.
    await vi.advanceTimersByTimeAsync(0);
    if (c.fast) {
      expect(settled).toBe(c.seeded);
      expect(vi.getTimerCount()).toBe(0);
    }
    await vi.advanceTimersByTimeAsync(DEADLINE);
    expect(settled).toBe(c.seeded);
    // Its own deadline timer is gone (the late case's stand-in read keeps one of its own; run it out).
    expect(vi.getTimerCount()).toBe(c.name.startsWith('answers after') ? 1 : 0);
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
    expect(qc.getQueryData(personSnapshotKey('p1'))).toEqual(c.value);
    expect(qc.getQueryState(personSnapshotKey('p1')) !== undefined).toBe('written' in c ? c.written : c.seeded);
    // S7c: a partial answer is written as already stale, so the client hook reads it again after mount.
    if ('written' in c) expect(qc.getQueryState(personSnapshotKey('p1'))?.dataUpdatedAt).toBe(0);
    else if (c.seeded) expect(qc.getQueryState(personSnapshotKey('p1'))?.dataUpdatedAt).toBeGreaterThan(0);
  });
});
