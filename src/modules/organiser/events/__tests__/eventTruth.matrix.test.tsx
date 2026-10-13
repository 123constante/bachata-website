// @vitest-environment jsdom
/**
 * Event-truth P1 consistency matrix: every single-word surface reads the ONE
 * mapping (src/lib/eventCategory.ts), for every shape the screens meet:
 *   format (one_off | recurring | course | festival | null)
 *   x stored category (party | class | workshop | masterclass | null)
 *   x has an upcoming date or not (x locked or not, for the editor).
 * Surfaces: the organiser Type row (value + sublabel), the event page's ended
 * noun (runNoun), the calendar's Parties / Classes tab membership. Mutation proof
 * is in docs/handover/event-truth-p1-ui.md: a surface swapped back to the raw
 * stored value reds the 'workshop' rows here (a stored workshop reads Class).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATEGORY_WORD_LABEL, NOT_SET_LABEL, deriveCategories, wordForStored } from '@/lib/eventCategory';
import { runNoun } from '@/modules/event-page/bento/utils/endedRun';
import { parseCalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { matchesCategory, transformCalendarEvents } from '@/components/calendar/calendarUtils';
import { SHAPES, VENUES, homeOf, programmeOf, shapeByKey, upcomingOf, workspaceOf, type SeriesShape } from '../../__tests__/shapes/shapes';
import { SEED_SESSION, categoryLabel, typeSublabel } from '../eventType';

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
    expect(categoryLabel(format, stored)).toBe(word ? CATEGORY_WORD_LABEL[word as keyof typeof CATEGORY_WORD_LABEL] : NOT_SET_LABEL);
    // Event page ended line: the same word; no word (no session yet) reads as a night.
    expect(runNoun(format, null, stored)).toBe(word ?? 'night');
    // A stored workshop never surfaces as 'workshop' anywhere.
    expect(categoryLabel(format, stored)).not.toMatch(/workshop/i);
    expect(runNoun(format, null, stored)).not.toBe('workshop');
  });
});

describe('the Type row sublabel points only at controls that are on the page', () => {
  const states = [
    { locked: false, hasUpcoming: true, name: 'editable with an upcoming date' },
    { locked: false, hasUpcoming: false, name: 'editable, no upcoming date' },
    { locked: true, hasUpcoming: false, name: 'locked (ended / archived)' },
    { locked: true, hasUpcoming: true, name: 'locked, upcoming dates listed' },
  ];
  it.each(GRID.flatMap(([f, s]) => states.map((st) => [f, s, st] as const)))('%s + %s, %o', (format, stored, state) => {
    const text = typeSublabel(format, stored, state);
    const word = expectedWord(format, stored);
    if (format === 'festival' || format === 'course') expect(text).toBe('Set by its format.');
    else if (word) expect(text).toBe(state.locked || !state.hasUpcoming ? 'Set by its sessions.' : 'Set by its sessions. Change the sessions on a date and it follows.');
    else if (state.locked) expect(text).toBe('No session, so not set.');
    else expect(text).toBe(state.hasUpcoming ? 'Add a session to one of its dates and it is set for you.' : 'Add a session once a date is listed under When, and it is set for you.');
    // Never 'change the sessions' when no session can be edited; never 'one of its dates' with no upcoming date.
    if (state.locked || !state.hasUpcoming) expect(text).not.toMatch(/Change the sessions/);
    if (!state.hasUpcoming) expect(text).not.toMatch(/one of its dates/);
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
  it.each(Object.entries(SEED_SESSION))('the %s chip\'s seed lands the event under the tab its word names', (chip, seed) => {
    const { set, word } = deriveCategories('recurring', [], [seed.type]);
    const [item] = transformCalendarEvents([calendarRow([{ type: seed.type }])]);
    expect(matchesCategory(item, word === 'night' ? 'parties' : 'classes')).toBe(true);
    expect(set).toEqual(word === 'night' ? ['party'] : ['class']);
    void chip;
  });
  // calendarUtils.ts is on CLAUDE.md's ask-Ricky list, so its own derivation is not changed here:
  // a 'masterclass' or 'social' item counts for a tab there only through the RPC's key_times
  // (the lib puts a masterclass under Classes and a social under Parties). Queued in the handover.
  it.todo('masterclass and social items: the calendar reads key_times for them; parity with the lib needs Ricky\'s call on calendarUtils.ts');
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
  const ended = shapeByKey('ended-picnic'); // ended: locked, 0 upcoming
  const course = shapeByKey('live-course');
  const festival = shapeByKey('live-festival');

  it.each(STORED)('editable with upcoming dates, stored %s', async (stored) => {
    const text = await openEditor(editable, stored);
    expect(text).toBe(`Type${typeSublabel('recurring', stored, { locked: false, hasUpcoming: true })}${categoryLabel('recurring', stored)}`);
    expect(text).not.toMatch(/workshop/i);
  });
  it.each(STORED)('live with no upcoming date, stored %s', async (stored) => {
    const text = await openEditor(lapsed, stored);
    expect(text).toBe(`Type${typeSublabel('recurring', stored, { locked: false, hasUpcoming: false })}${categoryLabel('recurring', stored)}`);
    expect(text).not.toMatch(/one of its dates|Change the sessions/);
  });
  it.each(STORED)('ended (locked), stored %s', async (stored) => {
    const text = await openEditor(ended, stored);
    expect(text).toBe(`Type${typeSublabel('recurring', stored, { locked: true, hasUpcoming: false })}${categoryLabel('recurring', stored)}`);
    expect(text).not.toMatch(/Add a session|Change the sessions/);
  });
  it('a course and a festival are set by their format whatever is stored', async () => {
    expect(await openEditor(course, 'party')).toBe('TypeSet by its format.Course');
    cleanup();
    expect(await openEditor(festival, null)).toBe('TypeSet by its format.Festival');
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
