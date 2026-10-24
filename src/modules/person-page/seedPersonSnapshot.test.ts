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
const DEADLINE = 2500;

const CASES = [
  { name: 'answers in time', impl: () => Promise.resolve(SNAP), seeded: true, value: SNAP, fast: true },
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

  it.each(CASES)('$name: seeded $seeded', async (c) => {
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
    expect(qc.getQueryState(personSnapshotKey('p1')) !== undefined).toBe(c.seeded);
  });
});
