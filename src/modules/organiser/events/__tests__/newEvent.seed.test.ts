/**
 * Event-truth P1: the New event chips SEED the first session; nobody is asked what the
 * event IS. These are the pure halves of that flow (NewEventPage.tsx wires them), kept
 * table-driven over the three chips so a mutant in any one of them reds a named test:
 *   seedSessions -> null / seeds nothing      reds "seeds exactly one session" (x3)
 *   firstListedDate -> past or cancelled date  reds the firstListedDate cases
 *   chip -> stored word drifting               reds "the chip's word is the one every screen shows"
 */
import { describe, expect, it } from 'vitest';
import { categoryLabelFor, deriveCategories, storedCategory, wordForStored } from '@/lib/eventCategory';
import { addDaysToKey } from '@/lib/londonDate';
import type { Programme } from '@/modules/organiser/shared/programmeModel';
import type { WorkspaceDate } from '@/modules/organiser/shared/seriesModel';
import { DEFAULT_DURATION_MINUTES, EVENT_TYPES, FIRST_SESSION_HINT, SEED_SESSION, categoryLabel, type NewEventType } from '../eventType';
import { NEW_EVENT_FIRST_DATE_IN_DAYS, NEW_EVENT_START_TIME, firstListedDate, newEventCommands, seedSessions } from '../newEvent';

const TODAY = '2026-10-08';
const CHIPS = EVENT_TYPES.map((t) => t.type);

const date = (id: string, occurrence_date: string, lifecycle_status = 'scheduled'): WorkspaceDate => ({
  id, occurrence_date, lifecycle_status, version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null,
});

const programmeWith = (sessions: Programme['sessions']): Programme => ({
  occurrenceId: 'o1', seriesId: 's1', occurrenceDate: '2026-10-15', version: 2, editable: true, notEditableReason: null, sessions, sessionPeople: [],
});

describe('seedSessions: the chip becomes ONE session on an empty date', () => {
  it.each([
    ['class', { type: 'class', title: 'Class', start_time: '20:00', end_time: '22:00', ends_next_day: false }],
    ['party', { type: 'party', title: 'Party', start_time: '20:00', end_time: '01:00', ends_next_day: true }],
    ['workshop', { type: 'class', title: 'Workshop', start_time: '20:00', end_time: '22:00', ends_next_day: false }],
  ] as const)('the %s chip seeds exactly one session, the create start time plus its default length', (chip, session) => {
    const sent = seedSessions(programmeWith([]), chip);
    expect(sent).toEqual([{ new: true, level_keys: [], ...session }]);
    expect(sent).toHaveLength(1);
  });

  it.each(CHIPS)('the %s chip seeds nothing when the date already holds a session (Create pressed again)', (chip) => {
    const held = programmeWith([{ series_item_id: 'i1', type: 'party', title: 'Party', start_time: '21:00', end_time: '23:30', ends_next_day: false, level_keys: [] } as Programme['sessions'][number]]);
    expect(seedSessions(held, chip)).toBeNull();
  });

  it('every seed is a type organiser_set_occurrence_programme_v1 takes, so no chip can be refused for its type', () => {
    for (const chip of CHIPS) expect(['class', 'party']).toContain(SEED_SESSION[chip].type);
    expect(SEED_SESSION.workshop.type).toBe('class');
  });

  it('the start is the create start time, so the session and the date agree', () => {
    for (const chip of CHIPS) {
      const [s] = seedSessions(programmeWith([]), chip) ?? [];
      expect(s?.start_time).toBe(NEW_EVENT_START_TIME);
      expect(DEFAULT_DURATION_MINUTES[chip]).toBeGreaterThan(0);
    }
  });
});

describe('firstListedDate: the earliest upcoming date that is not cancelled', () => {
  it('skips past dates and cancelled dates, picks the earliest of the rest, whatever the order', () => {
    const dates = [date('late', '2026-10-30'), date('cancelled', '2026-10-09', 'cancelled'), date('first', '2026-10-15'), date('past', '2026-10-01')];
    expect(firstListedDate(dates, TODAY)?.id).toBe('first');
  });
  it('today counts as upcoming (the programme writer refuses only a past date)', () => {
    expect(firstListedDate([date('today', TODAY)], TODAY)?.id).toBe('today');
  });
  it('is null when every date is past or cancelled, or there are none', () => {
    expect(firstListedDate([date('past', '2026-10-01'), date('off', '2026-10-15', 'cancelled')], TODAY)).toBeNull();
    expect(firstListedDate([], TODAY)).toBeNull();
  });
  it("the create's own first date is always upcoming, so a chip on the New event screen can always seed", () => {
    expect(NEW_EVENT_FIRST_DATE_IN_DAYS).toBeGreaterThan(0);
    for (const chip of CHIPS) {
      const { create, schedule } = newEventCommands('X', TODAY, 'org1', 'c1', chip);
      const start = create.payload.default_start_date as string;
      expect(start).toBe(addDaysToKey(TODAY, NEW_EVENT_FIRST_DATE_IN_DAYS));
      expect(start > TODAY).toBe(true);
      expect(firstListedDate([date('d', start)], TODAY)?.id).toBe('d');
      // The schedule lists that same date first (weekly from it, or that one date).
      if (schedule.kind === 'series.add_date') expect(schedule.payload).toEqual({ date: start });
    }
  });
});

describe("the chip's word is the one every screen shows (chip -> seeded session -> derived category -> label)", () => {
  // The server derives event_series_p5.category from the sessions with the SQL twin of
  // deriveCategories/storedCategory; the Type row and the ended line then read that stored
  // value through wordForStored. One mapping: the chip label must survive the round trip.
  it.each([
    ['class', 'class', 'Class', 'class'],
    ['party', 'party', 'Night', 'night'],
    ['workshop', 'class', 'Class', 'class'],
  ] as const)('%s -> stored %s -> Type row %s / ended noun %s', (chip, stored, label, word) => {
    const [seed] = seedSessions(programmeWith([]), chip) ?? [];
    const derived = deriveCategories('recurring', [], [String(seed?.type)]);
    expect(storedCategory(null, derived.set)).toBe(stored);
    expect(categoryLabel('recurring', stored)).toBe(label);
    expect(categoryLabelFor('recurring', stored)).toBe(label);
    expect(wordForStored('recurring', stored)).toBe(word);
  });

  it('no chip is a word of its own: a stored workshop never reads Workshop anywhere', () => {
    for (const f of ['one_off', 'recurring', null]) expect(categoryLabel(f, 'workshop')).toBe('Class');
    expect(EVENT_TYPES.map((t) => t.label)).toEqual(['Class', 'Party', 'Workshop']);
  });

  it('the hints name the first session and a control that exists (Repeats row, sessions on a date), never a category', () => {
    expect(FIRST_SESSION_HINT).toMatch(/first session/);
    for (const t of EVENT_TYPES) {
      expect(t.hint).toMatch(/session/);
      expect(t.hint).not.toMatch(/listed as|category|What is it/i);
    }
    expect(EVENT_TYPES.find((t) => t.type === 'party')?.hint).toMatch(/Repeats/);
    expect(EVENT_TYPES.find((t) => t.type === 'class')?.hint).toMatch(/8 weeks/);
  });

  it('a create carries no category for any chip (the server derives it)', () => {
    for (const chip of CHIPS as NewEventType[]) {
      expect(newEventCommands('X', TODAY, 'org1', 'c1', chip).create.payload).not.toHaveProperty('category');
    }
  });
});
