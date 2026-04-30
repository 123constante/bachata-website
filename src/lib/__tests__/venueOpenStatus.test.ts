import { describe, expect, it } from 'vitest';
import {
  computeVenueOpenStatus,
  localPartsInTz,
} from '@/lib/venueOpenStatus';

// Frozen "now" anchored in UTC. Europe/London is BST (+01:00) on 2026-04-30.
const at = (iso: string) => new Date(iso);

const standardHours = {
  monday: { open: '19:00', close: '23:00' },
  tuesday: { open: '19:00', close: '23:00' },
  wednesday: { open: '19:00', close: '23:00' },
  thursday: { isOpen: false },
  friday: { open: '19:00', close: '02:00' }, // overnight
  saturday: { open: '12:00', close: '23:30' },
  sunday: { isOpen: false },
};

describe('localPartsInTz', () => {
  it('returns Europe/London weekday + minutes', () => {
    // 2026-04-30 is a Thursday. 14:30 UTC = 15:30 BST in Europe/London.
    const parts = localPartsInTz(at('2026-04-30T14:30:00Z'), 'Europe/London');
    expect(parts.dayIndex).toBe(4); // Thu
    expect(parts.minutes).toBe(15 * 60 + 30);
  });

  it('falls back to Europe/London when tz is null', () => {
    const parts = localPartsInTz(at('2026-04-30T12:00:00Z'), null);
    expect(parts.dayIndex).toBe(4);
    expect(parts.minutes).toBe(13 * 60); // 13:00 BST
  });
});

describe('computeVenueOpenStatus', () => {
  it('returns unknown when hours is null', () => {
    expect(
      computeVenueOpenStatus(null, 'Europe/London', at('2026-04-30T20:00:00Z')),
    ).toEqual({ status: 'unknown' });
  });

  it('returns unknown when hours object is empty', () => {
    expect(
      computeVenueOpenStatus({}, 'Europe/London', at('2026-04-30T20:00:00Z')),
    ).toEqual({ status: 'unknown' });
  });

  it('open: standard slot, well before close', () => {
    // Wednesday 19:30 BST → 18:30 UTC. Slot is 19:00–23:00 → 3.5h until close.
    const r = computeVenueOpenStatus(
      standardHours,
      'Europe/London',
      at('2026-04-29T18:30:00Z'),
    );
    expect(r.status).toBe('open');
    if (r.status === 'open') expect(r.closesAt).toBe('23:00');
  });

  it('closing-soon: standard slot, ≤ 60 min until close', () => {
    // Wednesday 22:30 BST = 21:30 UTC. 30 min until 23:00 close.
    const r = computeVenueOpenStatus(
      standardHours,
      'Europe/London',
      at('2026-04-29T21:30:00Z'),
    );
    expect(r.status).toBe('closing-soon');
    if (r.status === 'closing-soon') expect(r.closesAt).toBe('23:00');
  });

  it('opens-soon: closed but next opening within 4 hours', () => {
    // Wednesday 17:00 BST = 16:00 UTC. Wed opens at 19:00 → 2h.
    const r = computeVenueOpenStatus(
      standardHours,
      'Europe/London',
      at('2026-04-29T16:00:00Z'),
    );
    expect(r.status).toBe('opens-soon');
    if (r.status === 'opens-soon') expect(r.opensAt).toBe('19:00');
  });

  it('closed: closed today, next opening tomorrow', () => {
    // Thursday 20:00 BST = 19:00 UTC. Thu is closed; Fri opens at 19:00.
    const r = computeVenueOpenStatus(
      standardHours,
      'Europe/London',
      at('2026-04-30T19:00:00Z'),
    );
    expect(r.status).toBe('closed');
    if (r.status === 'closed') {
      expect(r.opensAt).toBe('19:00');
      expect(r.opensDayLabel).toBe('tomorrow');
    }
  });

  it('overnight: open past midnight on the prior day slot', () => {
    // Saturday 00:30 BST = 2026-05-02 23:30 UTC (Fri night).
    // Friday slot is 19:00–02:00 — should still be "open".
    const r = computeVenueOpenStatus(
      standardHours,
      'Europe/London',
      at('2026-05-01T23:30:00Z'),
    );
    expect(r.status).toBe('open');
    if (r.status === 'open') expect(r.closesAt).toBe('02:00');
  });

  it('overnight closing-soon: 30 min before 02:00 close', () => {
    // Saturday 01:30 BST = 2026-05-02 00:30 UTC (Sat early hours, prior day open).
    const r = computeVenueOpenStatus(
      standardHours,
      'Europe/London',
      at('2026-05-02T00:30:00Z'),
    );
    expect(r.status).toBe('closing-soon');
  });

  it('honours per-day isOpen=false even when open/close strings are stale', () => {
    const hours = {
      thursday: { isOpen: false, open: '19:00', close: '23:00' },
      friday: { open: '19:00', close: '23:00' },
    };
    // Thursday 20:00 BST = 19:00 UTC. Thu is forced closed; Fri opens 19:00.
    const r = computeVenueOpenStatus(
      hours,
      'Europe/London',
      at('2026-04-30T19:00:00Z'),
    );
    expect(r.status).toBe('closed');
    if (r.status === 'closed') expect(r.opensDayLabel).toBe('tomorrow');
  });

  it('legacy free-text day value falls back to unknown for that day', () => {
    const hours = { thursday: '9-5 weekdays' };
    const r = computeVenueOpenStatus(
      hours,
      'Europe/London',
      at('2026-04-30T12:00:00Z'),
    );
    // No usable open/close → searches forward, none found → closed.
    expect(r.status).toBe('closed');
  });
});
