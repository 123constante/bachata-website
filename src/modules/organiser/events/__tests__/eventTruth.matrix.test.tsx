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

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));


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

describe('calendar tab membership is the SET reading (deriveCategories), for every session set an event can carry', () => {
  // The chips seed class / party sessions (a workshop chip seeds a class titled Workshop); 'workshop'
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
