/**
 * Owner wording decisions (2026-10-23): the gig count shows only from 2 ("Next gig Friday 23 October" for one,
 * " \u00b7 N coming up" for 2+), and the ONE date label the wall and the hub share reads the full weekday and the
 * month ("Friday 23 October", never "Fri"), on the London calendar key.
 */
import { describe, expect, it } from 'vitest';
import type { PersonRole } from '@/lib/searchEntities';
import { hubModel } from '../model';
import { wallDateLabel } from '../../wall/model';

const TODAY = '2026-10-22';

describe('wallDateLabel: full weekday and month', () => {
  it.each([
    ['this month', '2026-10-23', 'Friday 23 October'],
    ['this month, timestamp', '2026-10-23T19:00:00+00', 'Friday 23 October'],
    ['today still shows', '2026-10-22', 'Thursday 22 October'],
    ['next month, single-digit day', '2026-11-06', 'Friday 6 November'],
    ['next year', '2027-01-03', 'Sunday 3 January'],
    ['past', '2026-10-21', null],
    ['garbage', 'soon', null],
    ['null', null, null],
  ])('%s', (_n, raw, want) => {
    expect(wallDateLabel(raw, TODAY)).toBe(want);
  });
});

const gigs = (n: number) => Array.from({ length: n }, (_, i) => ({ event_id: `e${i}`, event_start_time: `2026-${i === 0 ? '10-23' : `11-${String(i + 1).padStart(2, '0')}`}T21:00:00Z` }));
const model = (n: number) => hubModel({
  person: { id: 'p1', name: 'Ana Garcia', avatarUrl: null, city: null, instagramUrl: null, roles: ['dj', 'dancer'] as PersonRole[], heldRoles: ['dj', 'dancer'] as PersonRole[], djPhoto: null },
  dancerRow: null, dj: { dj_name: 'DJ R' }, appearances: gigs(n), opts: { teacherPagesOpen: false }, today: TODAY,
});

describe('DJ gig line: the count only from 2', () => {
  it.each([
    [0, null],
    [1, 'Next gig Friday 23 October'],
    [2, 'Next gig Friday 23 October \u00b7 2 coming up'],
    [5, 'Next gig Friday 23 October \u00b7 5 coming up'],
  ])('%i gigs', (n, want) => {
    const m = model(n);
    const dj = m.hero?.role === 'dj' ? m.hero.line : m.also.find((a) => a.role === 'dj')?.line;
    expect(dj).toBe(want ?? 'No gigs listed right now');
  });
});

describe('DJ hero line: two reserved rows only while a gig line may still grow', () => {
  const djOnly = (n: number | undefined) => hubModel({
    person: { id: 'p1', name: 'Ana Garcia', avatarUrl: null, city: null, instagramUrl: null, roles: ['dj', 'teacher'] as PersonRole[], heldRoles: ['dj', 'teacher'] as PersonRole[], djPhoto: null },
    dancerRow: null, dj: { dj_name: 'DJ R' }, appearances: n === undefined ? undefined : gigs(n), opts: { teacherPagesOpen: false }, today: TODAY,
  });
  it.each([
    ['no gigs (final "No gigs listed right now")', 0, 1],
    ['still checking, no badge hint', undefined, 1],
    ['one gig', 1, 2],
    ['two gigs', 2, 2],
  ])('%s', (_n, n, rows) => {
    const m = djOnly(n);
    expect(m.hero?.role).toBe('dj');
    expect(m.hero?.lineRows).toBe(rows);
  });
});
