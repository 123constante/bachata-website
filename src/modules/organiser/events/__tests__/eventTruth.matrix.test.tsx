// @vitest-environment jsdom
/**
 * Event-truth P1 consistency matrix: every single-word surface reads the ONE
 * mapping (src/lib/eventCategory.ts), for every shape the screens meet:
 *   format (one_off | recurring | course | festival | null)
 *   x stored category (party | class | workshop | masterclass | null)
 *   x has an upcoming date that is not cancelled or not (x locked or not, for the editor).
 * Surfaces: the organiser Type row (value + sublabel), the event page's ended
 * noun (runNoun), the calendar's Parties / Classes tab membership. Mutation proof
 * is in docs/handover/event-truth-p1-ui.md: a surface swapped back to the raw
 * stored value reds the 'workshop' rows here (a stored workshop reads Class).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATEGORY_WORD_LABEL, NOT_SET_LABEL, categoryLabelFor, deriveCategories, wordForStored } from '@/lib/eventCategory';
import { runNoun } from '@/modules/event-page/bento/utils/endedRun';
import { parseCalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { matchesCategory, transformCalendarEvents } from '@/components/calendar/calendarUtils';
import { SHAPES, VENUES, homeOf, programmeOf, shapeByKey, upcomingOf, workspaceOf, type SeriesShape } from '../../__tests__/shapes/shapes';
import { EVERY_UPCOMING_CANCELLED, typeSublabel, type TypeRowState } from '../eventType';
import { NO_SESSION_REASON } from '../reviewModel';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));

import EventEditorPage from '../EventEditorPage';

const FORMATS = ['one_off', 'recurring', 'course', 'festival', null] as const;
const STORED = ['party', 'class', 'workshop', 'masterclass', null] as const;
const GRID = FORMATS.flatMap((f) => STORED.map((s) => [f, s] as const));

/** The one word, spelled out per row so a drift in the lib is caught here too. */
const EXPECTED_WORD: Record<string, string | null> = {
  party: 'night', class: 'class', workshop: 'class', masterclass: 'masterclass', null: null,
};
const expectedWord = (format: string | null, stored: string | null) =>
  format === 'festival' || format === 'course' ? format : EXPECTED_WORD[String(stored)];

describe('the Type row and the ended noun show the one word, for every format x stored category', () => {
  it.each(GRID)('%s + %s', (format, stored) => {
    const word = expectedWord(format, stored);
    expect(wordForStored(format, stored)).toBe(word);
    // Organiser Type row value: the word's label, or Not set.
    expect(categoryLabelFor(format, stored)).toBe(word ? CATEGORY_WORD_LABEL[word as keyof typeof CATEGORY_WORD_LABEL] : NOT_SET_LABEL);
    // Event page ended line: the same word; no word (no session yet) reads as a night.
    expect(runNoun(format, null, stored)).toBe(word ?? 'night');
    // A stored workshop never surfaces as 'workshop' anywhere.
    expect(categoryLabelFor(format, stored)).not.toMatch(/workshop/i);
    expect(runNoun(format, null, stored)).not.toBe('workshop');
  });
});

/** The sentence under the Type row, spelled out per state so a drift in eventType.ts is caught here. */
const CANCELLED_ONLY_SENTENCE = 'Every upcoming date is cancelled. Open one under When and put it back on, then add a session and it is set for you.';
function expectedSublabel(format: string | null, stored: string | null, state: TypeRowState): string {
  if (format === 'festival' || format === 'course') return 'Set by its format.';
  const word = expectedWord(format, stored);
  // The editable sentence promises nothing: the derivation is the union over the series programme
  // and every date (keep-if-agrees), so changing one date's sessions need not move the word.
  if (word) {
    // FIX-7 R3: not editable, so hasSession is over every listed date (the editor's mapping), and a
    // stored word with no session never claims its sessions set it.
    if (state.locked) return state.hasSession ? 'Set by its sessions.' : 'No session on its dates.';
    if (!state.hasUpcoming) {
      if (state.hasSession) return 'Set by its sessions.';
      return state.cancelledOnly ? CANCELLED_ONLY_SENTENCE : 'Add a session once a date is listed under When, and it is set for you.';
    }
    // FIX-6 F-b: a legacy draft keeps a stored category with NO session; the review card says
    // "Add at least one session first.", so the row must not claim its sessions set it.
    return state.hasSession ? 'Set by its sessions across all its dates.' : 'No session yet. Add one to one of its dates and it is set from it.';
  }
  if (state.locked) return 'No session, so not set.';
  // FIX-6 F-c: a session exists but sets no type (a performance): never "add a session".
  if (state.hasUpcoming) return state.hasSession ? 'Its sessions set no type yet. Add a class or a party to one of its dates and it is set for you.' : 'Add a session to one of its dates and it is set for you.';
  // FIX-3 fix 5 (review F8): cancelled upcoming dates exist but none can take a session. When lists them
  // (each opens the date, whose "Put this date back on" is the un-cancel), so that is the step named.
  return state.cancelledOnly ? CANCELLED_ONLY_SENTENCE : 'Add a session once a date is listed under When, and it is set for you.';
}

describe('the Type row sublabel points only at controls that are on the page', () => {
  // hasUpcoming is "an upcoming date that is NOT cancelled": the programme writer refuses a
  // cancelled date (date_cancelled), so a series whose every upcoming date is cancelled has
  // no date to put a session on. cancelledOnly tells that shape from "no upcoming date at all":
  // When lists the cancelled dates, so the row can name the real next step. Every
  // locked x hasUpcoming x cancelledOnly row, including the pair that cannot occur (a listable
  // date AND cancelled-only), which reads as the listable date.
  const states: TypeRowState[] = [false, true].flatMap((locked) => [false, true].flatMap((hasUpcoming) => [false, true].flatMap((cancelledOnly) => [false, true].map((hasSession) => ({ locked, hasUpcoming, cancelledOnly, hasSession })))));
  it.each(GRID.flatMap(([f, s]) => states.map((st) => [f, s, st] as const)))('%s + %s, %o', (format, stored, state) => {
    const text = typeSublabel(format, stored, state);
    expect(text).toBe(expectedSublabel(format, stored, state));
    // Never a session action when no session can be edited; never 'one of its dates' with no date to take one.
    if (state.locked || !state.hasUpcoming) expect(text).not.toMatch(/Change the sessions|across all its dates/);
    if (!state.hasUpcoming) expect(text).not.toMatch(/one of its dates|across all its dates/);
    // Cancelled-only never says "once a date is listed": the dates ARE listed under When.
    if (!state.hasUpcoming && state.cancelledOnly) expect(text).not.toMatch(/once a date is listed/);
    expect(text).not.toMatch(/Change the sessions/);
    // One fact (FIX-6 F-b, F-c): no session never reads "set by its sessions"; a session never reads "add a session".
    if (!state.locked && state.hasUpcoming && !state.hasSession) expect(text).not.toMatch(/Set by its sessions/);
    if (!state.locked && state.hasUpcoming && state.hasSession) expect(text).not.toMatch(/^Add a session/);
  });
  it('the cancelled-only sentence opens with the fact the Schedule card states, from the one shared constant', () => {
    expect(CANCELLED_ONLY_SENTENCE.startsWith(`${EVERY_UPCOMING_CANCELLED}.`)).toBe(true);
    expect(EVERY_UPCOMING_CANCELLED).toBe('Every upcoming date is cancelled');
  });
});

/** The calendar row get_calendar_events_v2 returns for one date whose only sessions are `program` (key_times quiet). */
const calendarRow = (program: Array<{ type: string }>, format = 'recurring') => parseCalendarEventRow({
  event_id: 'e1', name: 'X', photo_url: [], location: 'V', instance_date: '2026-10-15',
  start_time: '2026-10-15 20:00:00+00', end_time: '2026-10-15 22:00:00+00', is_recurring: false,
  meta_data: { music_styles: [], program: program.map((p) => ({ ...p, title: 'S', start: '20:00', end: '22:00' })) },
  key_times: { classes: { active: false, start: '', end: '' }, party: { active: false, start: '', end: '' } },
  type: 'class', has_party: false, has_class: false, class_start: '', class_end: '', party_start: '', party_end: '',
  city_slug: 'london-gb', cover_image_url: null, occurrence_id: 'occ-1',
  occurrence_starts_at: '2026-10-15T20:00:00+00:00', occurrence_ends_at: '2026-10-15T22:00:00+00:00',
  city_timezone: 'Europe/London', venue_lat: 51.5, venue_lng: -0.1, primary_organiser_name: 'Org',
  is_cancelled: false, cancellation_reason_label: null, original_class_start: null, original_class_end: null,
  original_party_start: null, original_party_end: null, format, category: null, slug: 'x',
} as never);

describe('calendar tab membership is the SET reading (deriveCategories), for every session set an organiser can add', () => {
  // The organiser adds class / party sessions on the draft (the create seeds none, W1); 'workshop'
  // is the legacy item type prod still holds. 'performance' is in neither tab (a show is not a class or a party).
  const sessionSets: Array<string[]> = [['class'], ['party'], ['workshop'], ['class', 'party'], ['party', 'workshop'], ['performance'], []];
  it.each(sessionSets.map((s) => [s.join('+') || '(none)', s] as const))('sessions %s', (_label, types) => {
    const { set } = deriveCategories('recurring', [], types);
    const [item] = transformCalendarEvents([calendarRow(types.map((type) => ({ type })))]);
    expect(matchesCategory(item, 'parties')).toBe(set.includes('party'));
    expect(matchesCategory(item, 'classes')).toBe(set.includes('class'));
  });
  // FIX-6 F-f. calendarUtils.ts is on CLAUDE.md's ask-Ricky list, so the READER is pinned here, not
  // changed: from a date's programme alone (key_times quiet) it lists a 'masterclass' item under NO
  // tab and a 'social' item under NO tab, while the lib (and the CI #70 guard, held to the lib by
  // scripts/fixtures/event-truth-parity.json, whose cases are checked below) puts a masterclass under
  // Classes and a social under Parties. Each row reds when EITHER side moves: the reader gaining the
  // synonym, or the lib / guard dropping it. Queued: docs/event-truth-table.md, "Reader vs lib".
  const corpus = (JSON.parse(readFileSync(resolve(__dirname, '../../../../../scripts/fixtures/event-truth-parity.json'), 'utf8')) as {
    cases: Array<{ sectionKinds: unknown[]; itemTypes: unknown[]; addedSessions: unknown[]; expect: { set: string[] } }>;
  }).cases;
  it.each([
    ['masterclass', { parties: false, classes: false }, ['class', 'masterclass']],
    ['social', { parties: false, classes: false }, ['party']],
  ] as const)('a %s item: the reader lists it under %o; the lib and guard derive %o (known divergence)', (type, reader, libSet) => {
    const [item] = transformCalendarEvents([calendarRow([{ type }])]);
    expect({ parties: matchesCategory(item, 'parties'), classes: matchesCategory(item, 'classes') }).toEqual(reader);
    expect(deriveCategories('recurring', [], [type]).set).toEqual(libSet);
    // The guard's side: the shared corpus holds this exact item-only case with the lib's set.
    const guardCase = corpus.find((c) => c.sectionKinds.length === 0 && c.addedSessions.length === 0 && JSON.stringify(c.itemTypes) === JSON.stringify([type]));
    expect(guardCase?.expect.set).toEqual(libSet);
    // The divergence itself: the reader's tabs are not the lib's set.
    const lib: readonly string[] = libSet;
    expect(reader.parties === lib.includes('party') && reader.classes === lib.includes('class')).toBe(false);
  });
});

// ---- the rendered Type row, over real series shapes ----------------------------------------------

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

async function openEditor(s: SeriesShape, stored: string | null) {
  const raw = workspaceOf(s) as { series: { series: { category: string | null } } };
  raw.series.series.category = stored;
  rpc.mockImplementation(async (fn: string) => {
    const next = upcomingOf(s).find((d) => d.status !== 'cancelled') ?? upcomingOf(s)[0];
    const answers: Record<string, unknown> = {
      organiser_home_v1: homeOf([s]),
      admin_event_workspace_p5: raw,
      organiser_get_occurrence_programme_v1: next ? programmeOf(s, next) : null,
      get_organiser_venue_options_v1: VENUES,
      event_publish_readiness_v1: { missing: [] },
      series_command_p5: { ok: true, new_version: 6 },
    };
    return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/account/o/events/${s.id}`]}>
        <Routes><Route path="/account/o/events/:seriesId" element={<EventEditorPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByTestId('org-event-editor');
  return screen.getByTestId('org-row-type').textContent ?? '';
}

describe('the rendered Type row, over the real shapes (prod survey) x every stored value', () => {
  const editable = shapeByKey('live-weekly-until'); // live, 6 upcoming
  const lapsed = shapeByKey('live-norule-lapsed'); // live, 0 upcoming
  const cancelledOnly = shapeByKey('live-norule-cancelled-only'); // live, 2 upcoming, BOTH cancelled (1 live prod series today)
  const ended = shapeByKey('ended-picnic'); // ended: locked, 0 upcoming
  const course = shapeByKey('live-course');
  const festival = shapeByKey('live-festival');

  it.each(STORED)('editable with upcoming dates, stored %s', async (stored) => {
    const text = await openEditor(editable, stored);
    expect(text).toBe(`Type${expectedSublabel('recurring', stored, { locked: false, hasUpcoming: true, cancelledOnly: false, hasSession: true })}${categoryLabelFor('recurring', stored)}`);
    expect(text).not.toMatch(/workshop/i);
  });
  it.each(STORED)('live with no upcoming date, stored %s', async (stored) => {
    const text = await openEditor(lapsed, stored);
    // Not editable: hasSession is over every listed date, and this shape runs a series programme (FIX-7 R3).
    expect(text).toBe(`Type${expectedSublabel('recurring', stored, { locked: false, hasUpcoming: false, cancelledOnly: false, hasSession: lapsed.seriesProgramme })}${categoryLabelFor('recurring', stored)}`);
    expect(text).not.toMatch(/one of its dates|Change the sessions|across all its dates|Every upcoming date is cancelled/);
  });
  // Every upcoming date cancelled: the dates are listed, but the writer refuses each one
  // (date_cancelled), so the row must not send the organiser to change or add a session on them,
  // nor say "once a date is listed" while When lists them (review F8). The step it names is on
  // screen: cancelled date rows under When (each opens the date and its "Put this date back on"),
  // and the Schedule card states the same fact in the same words (one constant, never two copies).
  it.each(STORED)('live, every upcoming date cancelled, stored %s', async (stored) => {
    const text = await openEditor(cancelledOnly, stored);
    expect(text).toBe(`Type${expectedSublabel('recurring', stored, { locked: false, hasUpcoming: false, cancelledOnly: true, hasSession: cancelledOnly.seriesProgramme })}${categoryLabelFor('recurring', stored)}`);
    expect(text).not.toMatch(/one of its dates|Change the sessions|across all its dates|once a date is listed/);
    const rows = within(screen.getByTestId('org-group-when')).getAllByTestId('org-date-row');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.textContent).toContain('Cancelled');
    expect(screen.getByTestId('org-schedule-none').textContent?.startsWith(EVERY_UPCOMING_CANCELLED)).toBe(true);
    if (stored === null) expect(text).toContain(`${EVERY_UPCOMING_CANCELLED}. Open one under When`);
  });
  it.each(STORED)('ended (locked), stored %s', async (stored) => {
    const text = await openEditor(ended, stored);
    expect(text).toBe(`Type${expectedSublabel('recurring', stored, { locked: true, hasUpcoming: false, cancelledOnly: false, hasSession: ended.seriesProgramme })}${categoryLabelFor('recurring', stored)}`);
    expect(text).not.toMatch(/Add a session|Change the sessions/);
  });
  // FIX-7 R3: ended with a stored word and NO session on any date never claims "Set by its sessions".
  it.each(STORED)('ended (locked) with no session on any date, stored %s', async (stored) => {
    const text = await openEditor({ ...ended, seriesProgramme: false }, stored);
    expect(text).toBe(`Type${expectedSublabel('recurring', stored, { locked: true, hasUpcoming: false, cancelledOnly: false, hasSession: false })}${categoryLabelFor('recurring', stored)}`);
    expect(text).not.toMatch(/Set by its sessions|Add a session/);
  });
  it('a course and a festival are set by their format whatever is stored', async () => {
    expect(await openEditor(course, 'party')).toBe('TypeSet by its format.Course');
    cleanup();
    expect(await openEditor(festival, null)).toBe('TypeSet by its format.Festival');
  });
  // FIX-6 F-b: the snapshot drafts (a stored category, no session on any date; 4 such drafts on prod
  // 2026-10-13) read the review card's fact on the Type row too, from the one sessionDates mapping.
  it.each(['draft-norule-one', 'draft-weekly-first-off'])('%s: the Type row and the review card state the same "no session" fact', async (key) => {
    const s = shapeByKey(key);
    const text = await openEditor(s, 'class');
    await waitFor(() => expect(screen.getByTestId('org-event-review-blocked').textContent).toContain(NO_SESSION_REASON));
    expect(text).toBe('TypeNo session yet. Add one to one of its dates and it is set from it.Class');
    expect(text).not.toMatch(/Set by its sessions/);
  });
  // FIX-6 F-c: the only session on a date is a performance (no genre): the mirror stays null, the
  // review card counts a session, and the row must not say "add a session".
  it('a series whose only session sets no type says so, never "add a session"', async () => {
    const s = { ...shapeByKey('draft-norule-one') };
    const raw = workspaceOf(s) as { series: { series: { category: string | null } }; occurrences: Array<{ added_sessions_count: number }> };
    raw.occurrences[0].added_sessions_count = 1;
    raw.series.series.category = null;
    rpc.mockImplementation(async (fn: string) => {
      const answers: Record<string, unknown> = {
        organiser_home_v1: homeOf([s]), admin_event_workspace_p5: raw, organiser_get_occurrence_programme_v1: programmeOf(s, upcomingOf(s)[0]),
        get_organiser_venue_options_v1: VENUES, event_publish_readiness_v1: { missing: [] },
      };
      return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/account/o/events/${s.id}`]}>
          <Routes><Route path="/account/o/events/:seriesId" element={<EventEditorPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByTestId('org-event-editor');
    const text = screen.getByTestId('org-row-type').textContent ?? '';
    expect(text).toBe(`TypeIts sessions set no type yet. Add a class or a party to one of its dates and it is set for you.${NOT_SET_LABEL}`);
    // The card has finished checking (readiness answered) and counts the session.
    await waitFor(() => expect(screen.queryByTestId('org-event-review-blocked')?.textContent ?? '').not.toMatch(/Checking/));
    expect(screen.queryByTestId('org-event-review-blocked')?.textContent ?? '').not.toContain(NO_SESSION_REASON);
  });
  it('every shape renders a Type row with one of the five labels or Not set, never the raw stored value', async () => {
    const labels = new Set([...Object.values(CATEGORY_WORD_LABEL), NOT_SET_LABEL]);
    for (const s of SHAPES) {
      const text = await openEditor(s, 'workshop');
      expect([...labels].some((l) => text.endsWith(l)), `${s.key}: ${text}`).toBe(true);
      expect(text).not.toMatch(/workshop/i);
      cleanup();
    }
  });
});
