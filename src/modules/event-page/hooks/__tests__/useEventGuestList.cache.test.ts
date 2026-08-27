import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  entryStatus,
  eventGuestListQueryKey,
  hasSpotAvailable,
  mergeEntry,
  removeEntry,
  type EventGuestList,
  type GuestListEntry,
} from '../useEventGuestList';

/**
 * The guest-list cache counters after P6.
 *
 * These are the rules the public page's headline number depends on, and every one of them
 * was violated by the pre-P6 incremental counter (`count: prev.count + 1` on every merge):
 * a waitlist arrival bumped the active count, and a promotion — which arrives as an UPDATE
 * that changes a status without changing the array length — moved nothing at all.
 */

const EVENT_ID = 'e181d89b-bc7a-4770-940b-8f92b610e339';

const baseList = (over: Partial<EventGuestList> = {}): EventGuestList => ({
  enabled: true,
  count: 1,
  entries: [{ id: 'a', first_name: 'Ada', created_at: '2026-08-01T20:00:00Z', status: 'active' }],
  config: {
    cutoff_time: '',
    discount_until: '',
    description: '',
    regular_party_price: null,
    guest_list_party_price: null,
    regular_class_party_price: null,
    guest_list_class_party_price: null,
  },
  cutoff_passed: false,
  active_count: 1,
  waitlist_count: 0,
  capacity_max: null,
  waitlist_enabled: true,
  spots_left: null,
  ...over,
});

let qc: QueryClient;
const seed = (list: EventGuestList) => {
  qc.setQueryData(eventGuestListQueryKey(EVENT_ID), list);
};
const read = (): EventGuestList =>
  qc.getQueryData<EventGuestList>(eventGuestListQueryKey(EVENT_ID))!;

const entry = (over: Partial<GuestListEntry> & { first_name: string }): GuestListEntry => ({
  created_at: '2026-08-01T21:00:00Z',
  ...over,
});

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('guest list cache counters', () => {
  it('an ACTIVE arrival bumps the active count and the headline', () => {
    seed(baseList());
    mergeEntry(qc, EVENT_ID, entry({ id: 'b', first_name: 'Bea', status: 'active' }));
    const list = read();
    expect(list.active_count).toBe(2);
    expect(list.count).toBe(2);
    expect(list.waitlist_count).toBe(0);
  });

  it('a WAITLIST arrival does NOT bump the active count', () => {
    // The plan's own verify line: "second browser's waitlist INSERT doesn't bump the
    // first's count".
    seed(baseList());
    mergeEntry(qc, EVENT_ID, entry({ id: 'c', first_name: 'Cyd', status: 'waitlist' }));
    const list = read();
    expect(list.active_count).toBe(1);
    expect(list.count).toBe(1);
    expect(list.waitlist_count).toBe(1);
    expect(list.entries).toHaveLength(2);
  });

  it('a PROMOTION arriving as an UPDATE moves both counters without changing length', () => {
    seed(
      baseList({
        entries: [
          { id: 'a', first_name: 'Ada', created_at: '2026-08-01T20:00:00Z', status: 'active' },
          { id: 'c', first_name: 'Cyd', created_at: '2026-08-01T21:00:00Z', status: 'waitlist' },
        ],
        count: 1,
        active_count: 1,
        waitlist_count: 1,
      }),
    );
    // Same row, same name, status flipped — exactly what _promote_waitlist_v1 emits.
    mergeEntry(qc, EVENT_ID, entry({ id: 'c', first_name: 'Cyd', status: 'active' }));
    const list = read();
    expect(list.entries).toHaveLength(2);
    expect(list.active_count).toBe(2);
    expect(list.count).toBe(2);
    expect(list.waitlist_count).toBe(0);
  });

  it('an own-echo of an unchanged row is a no-op', () => {
    seed(baseList());
    const before = read();
    mergeEntry(qc, EVENT_ID, entry({ id: 'a', first_name: 'ADA', status: 'active' }));
    expect(read()).toBe(before);
  });

  it('upgrades a pending row in place and keeps the id it is given', () => {
    seed(
      baseList({
        entries: [
          { id: 'pending-1', first_name: 'Ada', created_at: '2026-08-01T20:00:00Z', status: 'active', pending: true },
        ],
      }),
    );
    mergeEntry(qc, EVENT_ID, entry({ id: 'real-1', first_name: 'Ada', status: 'active' }));
    const list = read();
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0].id).toBe('real-1');
    expect(list.entries[0].pending).toBeFalsy();
    expect(list.active_count).toBe(1);
  });

  it('spots_left tracks active arrivals and rollbacks, and never goes negative', () => {
    seed(baseList({ capacity_max: 3, spots_left: 2 }));
    mergeEntry(qc, EVENT_ID, entry({ id: 'b', first_name: 'Bea', status: 'active' }));
    expect(read().spots_left).toBe(1);

    // A waitlist arrival consumes no slot.
    mergeEntry(qc, EVENT_ID, entry({ id: 'c', first_name: 'Cyd', status: 'waitlist' }));
    expect(read().spots_left).toBe(1);

    // Rolling the active row back returns the slot.
    removeEntry(qc, EVENT_ID, 'b');
    expect(read().spots_left).toBe(2);
    expect(read().active_count).toBe(1);
    expect(read().waitlist_count).toBe(1);
  });

  it('leaves spots_left null on an uncapped event', () => {
    seed(baseList());
    mergeEntry(qc, EVENT_ID, entry({ id: 'b', first_name: 'Bea', status: 'active' }));
    expect(read().spots_left).toBeNull();
    expect(read().capacity_max).toBeNull();
  });

  it('treats a status-less entry as active', () => {
    // Pre-P6 payloads carry no status; the page must not silently drop those dancers out
    // of the headline count.
    seed(baseList({ entries: [], count: 0, active_count: 0 }));
    mergeEntry(qc, EVENT_ID, entry({ id: 'x', first_name: 'Xen' }));
    expect(read().active_count).toBe(1);
    expect(entryStatus({ first_name: 'Xen', created_at: '' })).toBe('active');
  });

  it('removeEntry no-ops on an id it does not hold', () => {
    seed(baseList());
    const before = read();
    removeEntry(qc, EVENT_ID, 'nope');
    expect(read()).toBe(before);
  });
});

describe('hasSpotAvailable', () => {
  it('is true when uncapped or when spots remain, false when the door is full', () => {
    expect(hasSpotAvailable(undefined)).toBe(true);
    expect(hasSpotAvailable(baseList({ spots_left: null }))).toBe(true);
    expect(hasSpotAvailable(baseList({ capacity_max: 3, spots_left: 1 }))).toBe(true);
    expect(hasSpotAvailable(baseList({ capacity_max: 3, spots_left: 0 }))).toBe(false);
  });
});
