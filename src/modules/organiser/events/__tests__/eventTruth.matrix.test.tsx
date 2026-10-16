// @vitest-environment jsdom
/**
 * Event-truth P1 consistency matrix: every single-word surface reads the ONE
 * mapping (src/lib/eventCategory.ts), for every shape the screens meet:
 *   format (one_off | recurring | course | festival | null)
 *   x stored category (party | class | workshop | masterclass | null)
 *   x has an upcoming date that is not cancelled or not (x locked or not, for the editor).
 * Surfaces: the event page's ended noun (runNoun), the calendar's Parties /
 * Classes tab membership. The organiser editor has no Type row any more (W3, d39). Mutation proof
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
import { EVERY_UPCOMING_CANCELLED, SEED_SESSION } from '../eventType';
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

describe('the lib label and the ended noun show the one word, for every format x stored category', () => {
  it.each(GRID)('%s + %s', (format, stored) => {
    const word = expectedWord(format, stored);
    expect(wordForStored(format, stored)).toBe(word);
    // The lib's label (admin's read-only Event type row): the word's label, or Not set.
    expect(categoryLabelFor(format, stored)).toBe(word ? CATEGORY_WORD_LABEL[word as keyof typeof CATEGORY_WORD_LABEL] : NOT_SET_LABEL);
    // Event page ended line: the same word; no word (no session yet) reads as a night.
    expect(runNoun(format, null, stored)).toBe(word ?? 'night');
    // A stored workshop never surfaces as 'workshop' anywhere.
    expect(categoryLabelFor(format, stored)).not.toMatch(/workshop/i);
    expect(runNoun(format, null, stored)).not.toBe('workshop');
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

describe('calendar tab membership is the SET reading (deriveCategories), for every session set a create can seed', () => {
  // The chips seed class / party sessions (a workshop chip seeds a class titled Workshop); 'workshop'
  // is the legacy item type prod still holds. 'performance' is in neither tab (a show is not a class or a party).
  const sessionSets: Array<string[]> = [['class'], ['party'], ['workshop'], ['class', 'party'], ['party', 'workshop'], ['performance'], []];
  it.each(sessionSets.map((s) => [s.join('+') || '(none)', s] as const))('sessions %s', (_label, types) => {
    const { set } = deriveCategories('recurring', [], types);
    const [item] = transformCalendarEvents([calendarRow(types.map((type) => ({ type })))]);
    expect(matchesCategory(item, 'parties')).toBe(set.includes('party'));
    expect(matchesCategory(item, 'classes')).toBe(set.includes('class'));
  });
  it.each(Object.entries(SEED_SESSION))('the %s chip\'s seed lands the event under the tab its word names', (_chip, seed) => {
    const { set, word } = deriveCategories('recurring', [], [seed.type]);
    const [item] = transformCalendarEvents([calendarRow([{ type: seed.type }])]);
    expect(matchesCategory(item, word === 'night' ? 'parties' : 'classes')).toBe(true);
    expect(set).toEqual(word === 'night' ? ['party'] : ['class']);
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
// ---- the editor, over real series shapes ------------------------------------------------------
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
  return screen.getByTestId('org-event-editor').textContent ?? '';
}

// W3 (owner decision d39): the organiser editor drops the Type row; admin keeps its read-only one.
// No organiser screen names a type word, so the public "Night" can never show there (d45).
describe('the editor shows no Type row, over the real shapes (prod survey) x every stored value', () => {
  it.each(SHAPES.flatMap((s) => STORED.map((stored) => [s.key, stored, s] as const)))('%s, stored %s: no Type row and no type word', async (_key, stored, s) => {
    const text = await openEditor(s, stored);
    expect(screen.queryByTestId('org-row-type')).toBeNull();
    // The public label 'Night' (a word, capitalised), never the stored 'workshop'.
    expect(text).not.toMatch(/workshop/i);
    expect(text).not.toMatch(/\bNight\b/);
  });
  it('live, every upcoming date cancelled: the Schedule card states the fact', async () => {
    await openEditor(shapeByKey('live-norule-cancelled-only'), null);
    expect(screen.getByTestId('org-schedule-none').textContent?.startsWith(EVERY_UPCOMING_CANCELLED)).toBe(true);
  });
});
