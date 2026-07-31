import { describe, expect, it } from 'vitest';
import { groupByEventId, stableRowKey } from '@/lib/eventListGrouping';

interface Occ {
  id: string;
  occurrenceId?: string | null;
  label: string;
}

const occ = (id: string, occurrenceId: string | null, label: string): Occ => ({
  id,
  occurrenceId,
  label,
});

describe('groupByEventId', () => {
  it('a 2-date run stays as individual single items (below the default threshold of 3)', () => {
    const events = [occ('a', 'a1', 'A #1'), occ('a', 'a2', 'A #2')];
    const groups = groupByEventId(events);
    expect(groups).toEqual([
      { kind: 'single', event: events[0] },
      { kind: 'single', event: events[1] },
    ]);
  });

  it('a 3-date run collapses into one series item (the boundary itself)', () => {
    const events = [occ('a', 'a1', 'A #1'), occ('a', 'a2', 'A #2'), occ('a', 'a3', 'A #3')];
    const groups = groupByEventId(events);
    expect(groups).toEqual([{ kind: 'series', eventId: 'a', dates: events }]);
  });

  it('preserves first-seen order across a mix of singles and a series, soonest first', () => {
    const events = [
      occ('solo1', 's1', 'Solo 1'),
      occ('series', 'r1', 'Series #1'),
      occ('series', 'r2', 'Series #2'),
      occ('series', 'r3', 'Series #3'),
      occ('solo2', 's2', 'Solo 2'),
    ];
    const groups = groupByEventId(events);
    expect(groups.map((g) => (g.kind === 'single' ? g.event.id : g.eventId))).toEqual([
      'solo1',
      'series',
      'solo2',
    ]);
  });

  it('honors a custom threshold', () => {
    const events = [occ('a', 'a1', '1'), occ('a', 'a2', '2')];
    expect(groupByEventId(events, 2)).toEqual([{ kind: 'series', eventId: 'a', dates: events }]);
    expect(groupByEventId(events, 3)).toEqual([
      { kind: 'single', event: events[0] },
      { kind: 'single', event: events[1] },
    ]);
  });
});

describe('stableRowKey', () => {
  it('uses occurrenceId when present', () => {
    expect(stableRowKey('occ-1', 'event-1', 0)).toBe('occ-1');
  });

  it('falls back to a fallbackId+index composite when occurrenceId is null or undefined', () => {
    expect(stableRowKey(null, 'event-1', 0)).toBe('event-1-0');
    expect(stableRowKey(undefined, 'event-1', 2)).toBe('event-1-2');
  });

  it('produces unique keys across multiple null-occurrenceId dates of the same event (the actual bug this guards)', () => {
    const dates = [
      { id: 'event-1', occurrenceId: null as string | null },
      { id: 'event-1', occurrenceId: null as string | null },
      { id: 'event-1', occurrenceId: null as string | null },
    ];
    const keys = dates.map((d, i) => stableRowKey(d.occurrenceId, d.id, i));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
