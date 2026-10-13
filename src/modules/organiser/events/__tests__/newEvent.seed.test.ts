/**
 * Event-truth P1: the New event chips SEED the first session; nothing sends a category.
 * Mutation proof (handover docs/handover/event-truth-p1-ui.md): seedSessions returning
 * null / an empty list reds every case in 'seedSessions'; firstListedDate picking a past
 * or cancelled date reds 'firstListedDate'.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Programme } from '@/modules/organiser/shared/programmeModel';
import { upcomingDates, type WorkspaceDate } from '@/modules/organiser/shared/seriesModel';
import { NEW_EVENT_START_TIME, firstListedDate, seedSessions } from '../newEvent';
import { EVENT_TYPES, SEED_SESSION } from '../eventType';

// The shared helper, spied: "the first listed date" is ONE reading (seriesModel's upcomingDates,
// the editor's), never a second sort of its own (review A, FIX-2).
vi.mock('@/modules/organiser/shared/seriesModel', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/modules/organiser/shared/seriesModel')>();
  return { ...real, upcomingDates: vi.fn(real.upcomingDates) };
});

const emptyProgramme = (over: Partial<Programme> = {}): Programme => ({
  occurrenceId: 'o1', seriesId: 's1', occurrenceDate: '2026-10-15', version: 2, editable: true, notEditableReason: null,
  sessions: [], sessionPeople: [], ...over,
});
const date = (id: string, occurrence_date: string, lifecycle_status = 'scheduled'): WorkspaceDate => ({
  id, occurrence_date, lifecycle_status, version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null,
});

describe('seedSessions: the one session each chip puts on the first date', () => {
  it.each([
    ['class', { type: 'class', title: 'Class', start_time: '20:00', end_time: '22:00', ends_next_day: false }],
    ['party', { type: 'party', title: 'Party', start_time: '20:00', end_time: '01:00', ends_next_day: true }],
    ['workshop', { type: 'class', title: 'Workshop', start_time: '20:00', end_time: '22:00', ends_next_day: false }],
  ] as const)('%s -> exactly one new session, the create\'s start time plus its default length', (chip, session) => {
    expect(seedSessions(emptyProgramme(), chip)).toEqual([{ new: true, level_keys: [], ...session }]);
  });

  it('every chip has a seed, and the seed uses a type the programme writer takes (class | party)', () => {
    for (const t of EVENT_TYPES) {
      expect(['class', 'party']).toContain(SEED_SESSION[t.type].type);
      const [only] = seedSessions(emptyProgramme(), t.type) ?? [];
      expect(only).toMatchObject({ new: true, start_time: NEW_EVENT_START_TIME });
    }
  });

  it('never seeds twice: a date that already holds a session gets nothing (Create pressed again after a lost reply)', () => {
    const held = emptyProgramme({ sessions: [{ added_session_id: 'a1', type: 'party', title: 'Party', start_time: '21:00', end_time: '01:00', ends_next_day: true, level_keys: [] }] });
    for (const t of EVENT_TYPES) expect(seedSessions(held, t.type)).toBeNull();
  });
});

describe('firstListedDate: the earliest upcoming date that is not cancelled', () => {
  const today = '2026-10-08';
  it('skips past and cancelled dates, in any order the API returns them', () => {
    const dates = [date('o3', '2026-10-23'), date('o0', '2026-10-02'), date('o2', '2026-10-16'), date('oc', '2026-10-09', 'cancelled')];
    expect(firstListedDate(dates, today)?.id).toBe('o2');
  });
  it('today counts as upcoming (the writer refuses only a past date)', () => {
    expect(firstListedDate([date('t', today), date('n', '2026-10-15')], today)?.id).toBe('t');
  });
  it('reads the dates through the shared upcomingDates (the same London date the editor uses), not a copy', () => {
    vi.mocked(upcomingDates).mockClear();
    const dates = [date('o3', '2026-10-23'), date('o2', '2026-10-16'), date('oc', '2026-10-09', 'cancelled')];
    expect(firstListedDate(dates, today)?.id).toBe('o2');
    expect(upcomingDates).toHaveBeenCalledTimes(1);
    expect(upcomingDates).toHaveBeenCalledWith(dates, today);
  });
  it.each([
    ['no dates', []],
    ['only past dates', [date('p', '2026-10-01')]],
    ['only cancelled dates', [date('c', '2026-10-15', 'cancelled')]],
  ])('%s -> null, so the create says the session was not added instead of seeding nowhere', (_label, dates) => {
    expect(firstListedDate(dates, today)).toBeNull();
  });
});
