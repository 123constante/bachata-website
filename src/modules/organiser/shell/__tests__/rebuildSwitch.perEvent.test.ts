// ER-FIX-W2 S1 (F11 + owner decision 2): the switch is PER EVENT, by the event's
// owner page (organiser_ids[1] in SQL, the first id here), and never flashes the
// old screen while the home read loads. RED on the unfixed switch (handover ER-FIX2-S1).
import { describe, expect, it } from 'vitest';
import { rebuildEnabledForEvent, rebuildPending } from '../rebuildSwitch';

describe('per-event switch', () => {
  it.each([
    ['owner page allowlisted: a co-organiser login gets it too', 'own1', ['own1', 'co1'], true],
    ['only the co-organiser page allowlisted: off (all organisers keep one screen set)', 'co1', ['own1', 'co1'], false],
    ['unset is off', undefined, ['own1'], false],
    ['* is every event', '*', ['own1'], true],
    ['* even with no organisers (571 prod events have none)', '*', [], true],
    ['no organisers and a list: off', 'own1', [], false],
  ] as const)('%s', (_n, raw, ids, want) => {
    expect(rebuildEnabledForEvent(raw, ids)).toBe(want);
  });
});

describe('pending while the read loads (no flash)', () => {
  it.each([
    ['a real list, still loading', 'o1', true, true],
    ['a real list, loaded', 'o1', false, false],
    ['unset never waits', undefined, true, false],
    ['* never waits', '*', true, false],
  ] as const)('%s', (_n, raw, loading, want) => {
    expect(rebuildPending(raw, loading)).toBe(want);
  });
});
