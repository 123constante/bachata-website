// @vitest-environment jsdom
/**
 * Event-truth P1 consistency matrix (CLAUDE.md "definition of done", step 2).
 *
 * Every shape = format (one_off / recurring / course / festival) x stored category
 * (party / class / workshop / masterclass / null) x has an upcoming date or not, built
 * from the prod-shape library (shapes.ts) through the real parsers. For each one:
 *   - the organiser Type row (EventEditorPage) reads categoryLabelFor(format, stored),
 *     THE mapping in src/lib/eventCategory.ts, never a copy: a stored workshop is
 *     "Class" and never "Workshop", a party is "Night", a course / festival is its format;
 *   - the Type row's sublabel says what sets it and, with nothing to show, what the person
 *     can do (add a session to a date), and never names a control that is not there;
 *   - the event page's ended noun (runNoun) is the same word;
 *   - an untouched record sends no command on Save.
 * Then the calendar's Parties / Classes tab membership is held against deriveCategories
 * over every session type a programme can carry: the SET reading, which is the only
 * place the set (not the word) is allowed.
 *
 * Mutants this file exists to catch (run against the unfixed tree 2026-10-13, see
 * docs/handover/event-truth-p1-ui.md): the Type row showing the raw stored value
 * survived every green test before this file; it reds "Type row" here on every
 * workshop and party shape.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATEGORY_WORD_LABEL, NOT_SET_LABEL, categoryLabelFor, deriveCategories, setForStored, wordForStored } from '@/lib/eventCategory';
import { matchesCategory, transformCalendarEvents } from '@/components/calendar/calendarUtils';
import { parseCalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { runNoun } from '@/modules/event-page/bento/utils/endedRun';
import { SESSION_TYPES } from '@/modules/organiser/shared/programmeModel';
import { SHAPES, VENUES, homeOf, programmeOf, shapeByKey, upcomingOf, workspaceOf, type SeriesShape } from '../../__tests__/shapes/shapes';
import { EVENT_TYPES, typeSublabel } from '../eventType';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));

import EventEditorPage from '../EventEditorPage';
import NewEventPage from '../NewEventPage';

const FORMATS = ['one_off', 'recurring', 'course', 'festival'] as const;
const STORED = ['party', 'class', 'workshop', 'masterclass', null] as const;

/** A prod shape per format, with and without an upcoming date (a festival with none is a past festival). */
const BASE: Record<(typeof FORMATS)[number], { upcoming: SeriesShape; none: SeriesShape }> = {
  one_off: { upcoming: shapeByKey('live-oneoff-upcoming'), none: shapeByKey('live-oneoff-past') },
  recurring: { upcoming: shapeByKey('live-weekly-until'), none: shapeByKey('live-norule-lapsed') },
  course: { upcoming: shapeByKey('live-course'), none: shapeByKey('ended-course') },
  festival: {
    upcoming: shapeByKey('live-festival'),
    none: { ...shapeByKey('live-festival'), key: 'festival-past', lifecycle: 'ended', endedOn: '2026-09-07', dates: ['2026-09-04', '2026-09-05', '2026-09-06'].map((date) => ({ id: `festival-past-${date}`, date, status: 'scheduled' as const })) },
  },
};

interface Case { key: string; format: (typeof FORMATS)[number]; stored: (typeof STORED)[number]; upcoming: boolean; shape: SeriesShape }
const CASES: Case[] = FORMATS.flatMap((format) => STORED.flatMap((stored) => [true, false].map((upcoming) => {
  const base = upcoming ? BASE[format].upcoming : BASE[format].none;
  // The shape library writes `category ?? 'party'`; a null category needs the raw override below.
  const shape: SeriesShape = { ...base, key: `${format}/${stored ?? 'null'}/${upcoming ? 'upcoming' : 'none'}`, category: stored ?? undefined };
  return { key: shape.key, format, stored, upcoming, shape };
})));

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

async function openEditor(c: Case) {
  const raw = workspaceOf(c.shape) as { series: { series: Record<string, unknown> } };
  raw.series.series.category = c.stored;
  raw.series.series.type = c.stored;
  rpc.mockImplementation(async (fn: string) => {
    const next = upcomingOf(c.shape).find((d) => d.status !== 'cancelled') ?? upcomingOf(c.shape)[0];
    const answers: Record<string, unknown> = {
      organiser_home_v1: homeOf([c.shape]),
      admin_event_workspace_p5: raw,
      organiser_get_occurrence_programme_v1: next ? programmeOf(c.shape, next) : null,
      get_organiser_venue_options_v1: VENUES,
      event_publish_readiness_v1: { missing: [] },
      series_command_p5: { ok: true, new_version: 6 },
    };
    return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/account/o/events/${c.shape.id}`]}>
        <Routes><Route path="/account/o/events/:seriesId" element={<EventEditorPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const editor = await screen.findByTestId('org-event-editor');
  await vi.waitFor(() => {
    const called = rpc.mock.calls.map(([fn]) => fn);
    expect(called).toContain('organiser_home_v1');
    expect(called).toContain('get_organiser_venue_options_v1');
    expect(screen.queryByText(/Loading the schedule|Checking what it still needs/)).toBeNull();
  });
  await new Promise((r) => setTimeout(r, 0));
  return editor;
}

/** The one label table, spelled out so a drift in the lib itself is caught here too. */
const EXPECTED_LABEL = (format: string, stored: string | null): string => {
  if (format === 'festival') return 'Festival';
  if (format === 'course') return 'Course';
  if (stored === 'party') return 'Night';
  if (stored === 'masterclass') return 'Masterclass';
  if (stored === 'class' || stored === 'workshop') return 'Class';
  return NOT_SET_LABEL;
};

describe.each(CASES.map((c) => [c.key, c] as const))('shape %s', (_key, c) => {
  it('Type row: the shared word, its sublabel, and no command from an untouched record', async () => {
    const editor = await openEditor(c);
    const row = editor.querySelector('[data-testid="org-row-type"]') as HTMLElement;
    expect(row).not.toBeNull();
    const text = row.textContent ?? '';
    const label = EXPECTED_LABEL(c.format, c.stored);
    expect(categoryLabelFor(c.format, c.stored)).toBe(label);
    expect(text.endsWith(label)).toBe(true);
    // Never the raw stored value as a word of its own (a stored workshop or party has its
    // own word), and never the retired copy's text.
    if (c.stored === 'workshop') expect(text).not.toMatch(/workshop/i);
    if (c.stored === 'party') expect(text).not.toMatch(/\bParty\b/);
    expect(text).not.toMatch(/Course or workshop|Chosen when the event was made|ask the .* team/);
    // What sets it, and what to do when nothing does.
    expect(text).toContain(typeSublabel(c.format, c.stored));
    if (c.format === 'festival' || c.format === 'course') expect(text).toContain('Set by its format.');
    else if (c.stored === null) expect(text).toContain('Add a session to one of its dates and it is set for you.');
    else expect(text).toContain('Set by its sessions. Change the sessions on a date and it follows.');
    // The sublabel points at the dates list, which is on this page.
    expect(editor.querySelector('[data-testid="org-dates"], [data-testid="org-dates-none"]')).not.toBeNull();
    // An untouched record sends nothing on Save.
    const action = screen.queryByTestId('org-preview-bar-action') as HTMLButtonElement | null;
    if (action) { expect(action.disabled).toBe(true); action.click(); }
    expect(rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5')).toEqual([]);
  });

  it('the event page ended line uses the same word', () => {
    const word = wordForStored(c.format, c.stored);
    expect(runNoun(c.format, null, c.stored)).toBe(word ?? 'night');
    if (word) expect(CATEGORY_WORD_LABEL[word]).toBe(EXPECTED_LABEL(c.format, c.stored));
    // The SET reading, for tabs only: never the word.
    expect(setForStored(c.stored)).toEqual(deriveCategories(c.format, [], c.stored === 'workshop' ? ['class'] : [c.stored]).set);
  });
});

describe('a stored workshop reads Class on every single-word surface (owner decision 2026-10-12)', () => {
  it.each(['one_off', 'recurring'] as const)('%s', (format) => {
    expect(categoryLabelFor(format, 'workshop')).toBe('Class');
    expect(runNoun(format, null, 'workshop')).toBe('class');
    expect(EVENT_TYPES.find((t) => t.type === 'workshop')?.label).toBe('Workshop');
  });
});

// ---- the calendar tabs: the SET reading over every session type a date can carry ----

const calendarRow = (types: string[], format = 'recurring') => ({
  event_id: '00000000-0000-0000-0000-000000000001', name: 'X', photo_url: [], location: 'V', instance_date: '2026-10-15',
  start_time: '2026-10-15 20:00:00+00', end_time: '2026-10-15 23:00:00+00', is_recurring: false,
  meta_data: { music_styles: [], program: types.map((type) => ({ type, title: type, start: '20:00', end: '21:00' })) },
  key_times: { classes: { active: false, start: '', end: '' }, party: { active: false, start: '', end: '' } },
  type: null, has_party: false, has_class: false, class_start: '', class_end: '', party_start: '', party_end: '',
  city_slug: 'london-gb', cover_image_url: null, occurrence_id: 'occ-1',
  occurrence_starts_at: '2026-10-15T20:00:00+00:00', occurrence_ends_at: '2026-10-15T23:00:00+00:00',
  city_timezone: 'Europe/London', venue_lat: null, venue_lng: null, primary_organiser_name: 'Org',
  is_cancelled: false, cancellation_reason_label: null, original_class_start: null, original_class_end: null,
  original_party_start: null, original_party_end: null, format, category: null, slug: 'x',
});

const tabsOf = (types: string[]) => {
  const [item] = transformCalendarEvents([parseCalendarEventRow(calendarRow(types) as never)]);
  return { parties: matchesCategory(item, 'parties'), classes: matchesCategory(item, 'classes') };
};
const sharedTabsOf = (types: string[]) => {
  const { set } = deriveCategories('recurring', [], types);
  return { parties: set.includes('party'), classes: set.includes('class') };
};

describe('calendar tab membership follows deriveCategories (the SET reading)', () => {
  // The seeds and the session types the organiser programme editor offers.
  const AGREED: string[][] = [
    ...EVENT_TYPES.map((t) => [t.type === 'workshop' ? 'class' : t.type]),
    ['class'], ['party'], ['performance'], ['class', 'party'], ['workshop'], ['class', 'performance'], [],
  ];
  it.each(AGREED.map((types) => [types.join('+') || '(no session)', types] as const))('%s', (_name, types) => {
    expect(tabsOf(types)).toEqual(sharedTabsOf(types));
  });

  it.each(SESSION_TYPES.map((t) => [t] as const))('a lone %s session agrees with the shared rule (or is listed below as known drift)', (type) => {
    if (type === 'masterclass') return; // known drift, pinned below
    expect(tabsOf([type])).toEqual(sharedTabsOf([type]));
  });

  // KNOWN DRIFT, not fixed here: src/components/calendar/calendarUtils.ts keeps its own
  // program-item mapping (party / class / workshop only) and is on the CLAUDE.md
  // "ask Ricky before changing" list. The shared rule lists a masterclass under Classes
  // and a social under Parties. These `it.fails` turn green the moment calendarUtils
  // reads the shared rule: delete them then. Recorded in docs/handover/event-truth-p1-ui.md.
  it.fails('DRIFT: a lone masterclass session is under Classes by the shared rule, not on the calendar', () => {
    expect(sharedTabsOf(['masterclass'])).toEqual({ parties: false, classes: true });
    expect(tabsOf(['masterclass'])).toEqual(sharedTabsOf(['masterclass']));
  });
  it.fails('DRIFT: a lone social session is under Parties by the shared rule, not on the calendar', () => {
    expect(sharedTabsOf(['social'])).toEqual({ parties: true, classes: false });
    expect(tabsOf(['social'])).toEqual(sharedTabsOf(['social']));
  });
});

// ---- the New event chips: always able to seed, disabled only with a reason on screen ----

describe('New event chips', () => {
  const home = () => ({
    today: '2026-10-08',
    organisers: [{ id: 'org1', name: 'Latin Nights', slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [] }],
  });
  function mountNew(handlers: Record<string, () => unknown>) {
    rpc.mockImplementation(async (fn: string) => {
      const h = handlers[fn];
      if (!h) return { data: null, error: { message: `unexpected ${fn}` } };
      try { return { data: await h(), error: null }; } catch (e) { return { data: null, error: e }; }
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/account/o/events/new']}>
          <Routes><Route path="/account/o/events/new" element={<NewEventPage />} /><Route path="*" element={<span />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }
  const chips = () => EVENT_TYPES.map((t) => screen.getByTestId(`org-new-event-type-${t.type}`) as HTMLButtonElement);

  it('every chip is enabled before Create: the first date is always upcoming, so every chip can seed', async () => {
    mountNew({ organiser_home_v1: home });
    await screen.findByTestId('org-new-event-name');
    for (const chip of chips()) expect(chip.disabled).toBe(false);
    expect(screen.getByTestId('org-new-event-type-hint').textContent).toMatch(/first session/);
  });

  it('a chip that could not seed is disabled WITH the reason on screen, and the way on (Open the event)', async () => {
    mountNew({
      organiser_home_v1: home,
      series_command_p5: () => ({ ok: true, new_version: 2 }),
      admin_event_workspace_p5: () => ({ series: { series: { id: 's9', name: 'X', format: 'recurring', category: null, lifecycle_status: 'draft', version: 2 }, program: [] }, occurrences: [{ id: 'o9', occurrence_date: '2026-10-15', lifecycle_status: 'scheduled', version: 1 }] }),
      organiser_get_occurrence_programme_v1: () => ({ occurrence_id: 'o9', series_id: 's9', occurrence_date: '2026-10-15', version: 1, editable: true, not_editable_reason: null, sessions: [], session_people: [] }),
      organiser_set_occurrence_programme_v1: () => { throw { message: 'version_conflict', code: 'P0001' }; },
    });
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'New night' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-workshop'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    const error = await screen.findByTestId('org-new-event-error');
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toMatch(/the first session was not added/);
    expect(error.textContent).toMatch(/Press Create to try again, or open the event and add it on its first date/);
    await waitFor(() => { for (const chip of chips()) expect(chip.disabled).toBe(true); });
    expect(screen.getByTestId('org-new-event-open').textContent).toBe('Open the event');
    expect((screen.getByTestId('org-new-event-create') as HTMLButtonElement).disabled).toBe(false);
  });
});
