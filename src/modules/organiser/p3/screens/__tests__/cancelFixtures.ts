import { SHAPES, TODAY, item, occ, program, wsRaw } from './wsFixtures';
import { parseEventWorkspace, type EventWorkspace } from '../../../events/eventModel';

/**
 * The one-off shapes "Cancel the event" meets (read-only prod survey, 26 Oct 2026, counts
 * only: live one-offs 1 with the date ahead, 10 passed, 0 today, 0 cancelled, 0 with no
 * start; paused 1 ahead; draft 1 ahead, 1 with no date; every one-off holds 0 or 1 date),
 * plus the edge shapes the server rule names (today before / after the start, no start
 * today, 0 and 2 dates). Times: TODAY is 25 Oct 2026, after the clocks go back, so London
 * is UTC. Names are stand-ins.
 */
const PARTY = program([item('pty', 'party', null, '21:00', '02:00', [['DJ Kizzy', 'djing']])]);
const ONE = { name: 'Halloween Party', format: 'one_off', recurrence_rule: null };
const START = '2026-10-25T21:00:00+00:00';

/** 18:00 and 22:00 London on TODAY. */
export const BEFORE_START = new Date('2026-10-25T18:00:00Z');
export const AFTER_START = new Date('2026-10-25T22:00:00Z');

export const ONE_OFF = {
  liveAhead: wsRaw(ONE, PARTY, [occ('2026-10-31', 'scheduled', { materialised_start_utc: '2026-10-31T21:00:00+00:00' })]),
  todayBefore: wsRaw(ONE, PARTY, [occ(TODAY, 'scheduled', { materialised_start_utc: START })]),
  todayAfter: wsRaw(ONE, PARTY, [occ(TODAY, 'scheduled', { materialised_start_utc: START })]),
  passed: wsRaw(ONE, PARTY, [occ('2026-08-01')]),
  cancelled: wsRaw(ONE, PARTY, [occ('2026-10-31', 'cancelled')]),
  hidden: wsRaw({ ...ONE, lifecycle_status: 'paused' }, PARTY, [occ('2026-10-31')]),
  draft: wsRaw({ ...ONE, lifecycle_status: 'draft' }, PARTY, [occ('2026-10-31')]),
  noStart: wsRaw(ONE, PARTY, [occ(TODAY)]),
  zeroDates: wsRaw(ONE, PARTY, []),
  twoDates: wsRaw(ONE, PARTY, [occ('2026-10-31'), occ('2026-11-07')]),
} as const;

export type OneOffKey = keyof typeof ONE_OFF;

/** The other shapes: no Cancel the event row (their dates have their own controls). */
export const OTHER = { weekly: SHAPES.weekly, course: SHAPES.course, monthly: SHAPES.monthly, custom: SHAPES.custom, festival: SHAPES.festival } as const;
export type OtherKey = keyof typeof OTHER;

export const cws = (k: OneOffKey | OtherKey): EventWorkspace =>
  parseEventWorkspace((ONE_OFF as Record<string, unknown>)[k] ?? (OTHER as Record<string, unknown>)[k]);

/** The clock each shape is read at. */
export const NOW: Record<OneOffKey | OtherKey, Date> = {
  liveAhead: BEFORE_START, todayBefore: BEFORE_START, todayAfter: AFTER_START, passed: BEFORE_START,
  cancelled: BEFORE_START, hidden: BEFORE_START, draft: BEFORE_START, noStart: BEFORE_START,
  zeroDates: BEFORE_START, twoDates: BEFORE_START,
  weekly: BEFORE_START, course: BEFORE_START, monthly: BEFORE_START, custom: BEFORE_START, festival: BEFORE_START,
};

export const REASONS = [
  { key: 'weather', label: 'Weather' },
  { key: 'illness', label: 'Illness' },
  { key: 'other', label: 'Other' },
];
