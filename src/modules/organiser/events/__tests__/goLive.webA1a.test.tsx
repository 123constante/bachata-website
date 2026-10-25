// @vitest-environment jsdom
/**
 * People arc A-WEB1a: Go live reads the ONE server list (series_go_live_check_v1)
 * and the C14 edit lock (my_profile_progress_v1) on the event screens. Both RPCs
 * are faked at the boundary (not on prod yet). The clock is frozen on Tuesday
 * 20 October 2026 (flows/add fixtures). A1 is on so Go live can send.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, authStatus: 'ready' }) }));
vi.mock('@/modules/organiser/shared/a1Gate', () => ({ A1_APPLIED: true }));

import OneEvent from '../OneEvent';
import Details from '../Details';
import CancelFlow from '@/modules/organiser/flows/cancel';
import ChangeFlow from '@/modules/organiser/flows/change';
import Done from '@/modules/organiser/flows/Done';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { A, AFTER, BEFORE, DRAFT, FROZEN, answer, commandsOf, comingRun, defaultWorld, mount, type World } from '@/modules/organiser/flows/add/__tests__/fixtures';

const WEEKLY_FRIDAY = { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } };
const ORG = 'org00000-0000-4000-8000-000000000001';
const back = (id: string) => `returnTo=${encodeURIComponent(ORG_PATHS.event(id))}`;
const WIZARD = '/account/o/complete';

/** D49: the words, written out here so a change to the one map is red in every render below. */
const SIX: Array<[code: string, section: string, word: string, screen: (id: string) => string]> = [
  ['venue', 'venue', 'Add a venue', (id) => ORG_PATHS.eventDetails(id)],
  ['city', 'venue', 'Add a city', (id) => ORG_PATHS.eventDetails(id)],
  ['upcoming_date', 'dates', 'Add a date', (id) => ORG_PATHS.addEvent(id)],
  ['session', 'programme', 'Add a session with a title, start and end', (id) => ORG_PATHS.eventProgramme(id)],
  ['cover', 'cover', 'Upload a flyer', (id) => ORG_PATHS.cover(id)],
  ['description', 'about', 'Write a description', (id) => `${ORG_PATHS.eventDetails(id)}?edit=about`],
];

type Check = { ready: boolean; event_missing: unknown[]; recommended: unknown[]; profile_rule_applies: boolean; profile_missing: unknown[] };
const READY: Check = { ready: true, event_missing: [], recommended: [], profile_rule_applies: true, profile_missing: [] };
const UNLOCKED = { percent: 100, required_left: 0, publish_ready: true, steps: [], declined: [] };
const LOCKED = { percent: 40, required_left: 4, publish_ready: false, steps: [], declined: [] };

let world: World;
let check: { data: unknown; error: unknown } | 'pending';
let progress: { data: unknown; error: unknown } | 'pending';
let admin: boolean;
let refusal: unknown;
let wsOver: Record<string, Record<string, unknown>>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  world = defaultWorld();
  // The draft is a WEEKLY event with one dated session, a venue and a flyer: every client-side rule said ready.
  world.occs[DRAFT] = comingRun(1, 3);
  wsOver = { [DRAFT]: { default_venue_id: 'v1', default_cover_image_url: 'https://x/c.jpg' } };
  check = { data: READY, error: null };
  progress = { data: UNLOCKED, error: null };
  admin = false;
  refusal = null;
  answer(rpc, () => world);
  const base = rpc.getMockImplementation() as (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'series_go_live_check_v1') return check === 'pending' ? new Promise(() => {}) : check;
    if (fn === 'my_profile_progress_v1') return progress === 'pending' ? new Promise(() => {}) : progress;
    if (fn === 'admin_is_admin') return { data: admin, error: null };
    if (fn === 'series_command_p5' && refusal) {
      await base(fn, args); // recorded, refused
      return { data: null, error: refusal };
    }
    if (fn !== 'admin_event_workspace_p5') return base(fn, args);
    const id = String(args.p_series_id);
    const s = world.series.find((x) => x.id === id);
    return {
      data: {
        series: {
          series: {
            id, name: s?.name ?? '', slug: null, format: 'recurring', lifecycle_status: s?.lifecycle_status ?? 'live', version: world.seriesVersion,
            default_local_start_time: '20:00:00', default_start_date: '2026-01-02', default_venue_id: null, default_city_id: null, default_ticket_url: null,
            default_cover_image_url: 'https://x/c.jpg', default_duration: null, passes: [], default_description: 'Open social', default_level: null,
            instagram_url: null, default_music_styles: ['Bachata'], gallery: [], video_urls: [], recurrence_rule: WEEKLY_FRIDAY, removed_dates: [],
            organiser_ids: [ORG], ...(wsOver[id] ?? {}),
          },
          program: [],
        },
        occurrences: (world.occs[id] ?? []).map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: o.version, materialised_start_utc: `${o.date}T20:00:00Z` })),
        meta: { has_more: false },
      },
      error: null,
    };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const routes = (
  <>
    <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
    <Route path="/account/o/events/:seriesId/details" element={<Details />} />
    <Route path="/account/o/events/:seriesId/programme" element={<p data-testid="landed" />} />
    <Route path="/account/o/complete" element={<p data-testid="landed" />} />
    <Route path="/account/o/cancel/:seriesId/:occurrenceId" element={<CancelFlow step="confirm" />} />
    <Route path="/account/o/change/:seriesId/:occurrenceId/time" element={<ChangeFlow step="time" />} />
    <Route path="/account/o/done" element={<Done />} />
  </>
);
const seriesCommands = () => commandsOf(rpc).filter((c) => c.fn === 'series_command_p5');
const notReady = (code: string, section: string): Check => ({ ...READY, ready: false, event_missing: [{ code, section }] });

/** D85: a row's words without its leading number (the number is aria-hidden). */
const words = (el: Element): string => [...el.querySelectorAll('span:not([aria-hidden])')].map((s) => s.textContent).join('');

describe('Go live renders the server list, one label per code (D49)', () => {
  it.each(SIX)('%s: the Go live list says the D49 word and links to its screen, back to this event', async (code, section, word, to) => {
    check = { data: notReady(code, section), error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const item = await screen.findByTestId(`org-life-item-${code}`);
    expect(words(item)).toBe(word);
    expect(item.getAttribute('href')).toBe(`${to(DRAFT)}${to(DRAFT).includes('?') ? '&' : '?'}${back(DRAFT)}`);
  });

  it.each(SIX)('%s: a readable refusal of the Go live command renders the same word, never a generic error', async (code, section, word) => {
    check = { data: null, error: { message: 'Could not find the function public.series_go_live_check_v1' } };
    const json = JSON.stringify(notReady(code, section));
    refusal = { message: `permission_denied: series.set_lifecycle draft -> live needs a ready series: ${json}`, details: json, code: 'P0001', hint: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    fireEvent.click(await screen.findByTestId('org-life-golive'));
    expect(words(await screen.findByTestId(`org-life-item-${code}`))).toBe(word);
    expect(screen.getByTestId('event-step-error').textContent).toBe('Not ready to go live yet.');
    expect(seriesCommands()).toHaveLength(1);
  });

  it('a refusal whose JSON rides only in the message still renders the list', async () => {
    check = { data: null, error: { message: 'boom' } };
    refusal = { message: `permission_denied: series.set_lifecycle draft -> live needs a ready series: ${JSON.stringify(notReady('cover', 'cover'))}`, details: null, code: 'P0001' };
    mount(ORG_PATHS.event(DRAFT), routes);
    fireEvent.click(await screen.findByTestId('org-life-golive'));
    expect(words(await screen.findByTestId('org-life-item-cover'))).toBe('Upload a flyer');
  });

  it('mutating the one map changes the Go live list AND the refusal render', async () => {
    // The one map is GO_LIVE_BLOCKERS (W2 walk fix 5); GO_LIVE_LABEL is derived from it.
    const { GO_LIVE_BLOCKERS } = await import('@/modules/organiser/shared/goLiveKeys');
    const venue = GO_LIVE_BLOCKERS.venue as { label: string };
    const was = venue.label;
    venue.label = 'MUTANT';
    try {
      check = { data: notReady('venue', 'venue'), error: null };
      mount(ORG_PATHS.event(DRAFT), routes);
      expect(words(await screen.findByTestId('org-life-item-venue'))).toBe('MUTANT');
      cleanup();
      check = { data: null, error: { message: 'x' } };
      const json = JSON.stringify(notReady('venue', 'venue'));
      refusal = { message: `permission_denied: series.set_lifecycle draft -> live needs a ready series: ${json}`, details: json, code: 'P0001' };
      mount(ORG_PATHS.event(DRAFT), routes);
      fireEvent.click(await screen.findByTestId('org-life-golive'));
      expect(words(await screen.findByTestId('org-life-item-venue'))).toBe('MUTANT');
    } finally {
      venue.label = was;
    }
  });
});

/**
 * D55 (release A): ALL nine event_missing codes, in the server's order, each with
 * its plain label and a link that lands on a screen showing the control it
 * names (owner rule: no text points at a control that is not on screen).
 */
const NINE: Array<[code: string, section: string, word: string, to: (id: string) => string, control: string]> = [
  ['venue', 'venue', 'Add a venue', (id) => ORG_PATHS.eventDetails(id), 'org-detail-venue'],
  ['city', 'venue', 'Add a city', (id) => ORG_PATHS.eventDetails(id), 'org-detail-venue'],
  ['upcoming_date', 'dates', 'Add a date', (id) => ORG_PATHS.addEvent(id), 'landed-dates'],
  ['session', 'programme', 'Add a session with a title, start and end', (id) => ORG_PATHS.eventProgramme(id), 'landed'],
  ['cover', 'cover', 'Upload a flyer', (id) => ORG_PATHS.cover(id), 'landed-cover'],
  ['description', 'about', 'Write a description', (id) => `${ORG_PATHS.eventDetails(id)}?edit=about`, 'org-detail-input'],
  ['name', 'basics', 'Add an event name', (id) => ORG_PATHS.eventDetails(id), 'org-detail-name'],
  ['country', 'venue', 'Pick a city with a country', (id) => ORG_PATHS.eventDetails(id), 'org-detail-venue'],
  ['organiser', 'organisers', 'Link an active organiser', (id) => ORG_PATHS.eventOrganisers(id), 'landed-organisers'],
];
const nineRoutes = (
  <>
    {routes}
    <Route path="/account/o/add/:seriesId" element={<p data-testid="landed-dates" />} />
    <Route path="/account/o/cover/:seriesId" element={<p data-testid="landed-cover" />} />
    <Route path="/account/o/events/:seriesId/organisers" element={<p data-testid="landed-organisers" />} />
  </>
);

describe('D55: every event_missing code has a label and a link to a screen that shows its control', () => {
  it('the table is the server order, nine codes', () => {
    expect(NINE.map(([code, section]) => `${code}/${section}`)).toEqual([
      'venue/venue', 'city/venue', 'upcoming_date/dates', 'session/programme', 'cover/cover',
      'description/about', 'name/basics', 'country/venue', 'organiser/organisers',
    ]);
  });

  it.each(NINE)('%s: label, link back to this event, and the control is on the screen it opens', async (code, section, word, to, control) => {
    check = { data: notReady(code, section), error: null };
    mount(ORG_PATHS.event(DRAFT), nineRoutes);
    const item = await screen.findByTestId(`org-life-item-${code}`);
    expect(words(item)).toBe(word);
    expect(item.getAttribute('href')).toBe(`${to(DRAFT)}${to(DRAFT).includes('?') ? '&' : '?'}${back(DRAFT)}`);
    fireEvent.click(item);
    expect(await screen.findByTestId(control)).toBeTruthy();
  });

  it('all nine at once keep the server order on screen', async () => {
    check = { data: { ...READY, ready: false, event_missing: NINE.map(([code, section]) => ({ code, section })) }, error: null };
    mount(ORG_PATHS.event(DRAFT), nineRoutes);
    await screen.findByTestId('org-life-item-organiser');
    const shown = Array.from(document.querySelectorAll('[data-testid^="org-life-item-"]'))
      .map((n) => n.getAttribute('data-testid')!.replace('org-life-item-', '')).filter((c) => !c.endsWith('-n'));
    expect(shown).toEqual(NINE.map(([code]) => code));
  });

  it('an unknown code (and an unknown section) shows the generic line, no link, never blank or the raw code', async () => {
    check = { data: notReady('zz_new_rule', 'zz_section'), error: null };
    mount(ORG_PATHS.event(DRAFT), nineRoutes);
    const item = await screen.findByTestId('org-life-item-zz_new_rule');
    expect(words(item)).toBe('Something else on the event');
    expect(words(item)).not.toContain('zz_');
    expect(item.getAttribute('href')).toBeNull();
  });
});

describe('the rule is the server\'s', () => {
  it('a weekly event with one dated session and `session` missing is NOT ready: Go live is off, nothing is sent, the row links to the programme', async () => {
    check = { data: notReady('session', 'programme'), error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    expect(await screen.findByTestId('org-life-list-head')).toBeTruthy();
    const btn = screen.getByTestId('org-life-golive');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(reasonOf(btn)).toBe('Finish the 1 thing above first');
    fireEvent.click(btn);
    expect(seriesCommands()).toHaveLength(0);
    fireEvent.click(screen.getByTestId('org-life-item-session'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`${ORG_PATHS.eventProgramme(DRAFT)}?${back(DRAFT)}`));
  });

  it('several missing: the list keeps the server order and the count says how many', async () => {
    check = { data: { ...READY, ready: false, event_missing: [{ code: 'session', section: 'programme' }, { code: 'venue', section: 'venue' }] }, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    await screen.findByTestId('org-life-item-venue');
    const order = [...screen.getByTestId('org-life-list').querySelectorAll('[data-testid^="org-life-item-"]')].map((e) => e.getAttribute('data-testid'));
    expect(order.filter((t) => !t!.endsWith('-n'))).toEqual(['org-life-item-session', 'org-life-item-venue']);
    expect(screen.getByTestId('org-life-count').textContent).toBe('2 things left');
    expect(reasonOf(screen.getByTestId('org-life-golive'))).toBe('Finish the 2 things above first');
  });

  it('a recommended ticket link never blocks: it sits under Optional (numbered on its own), and Go live sends ONE set_lifecycle live', async () => {
    check = { data: { ...READY, recommended: [{ code: 'ticket_link', section: 'tickets' }] }, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const item = await screen.findByTestId('org-life-item-ticket_link');
    expect(words(item)).toBe('Add a ticket link');
    expect(screen.getByTestId('org-life-item-ticket_link-n').textContent).toBe('1'); // optional rows are numbered on their own
    expect(screen.getByTestId('org-life-optional-head').textContent).toBe('Optional');
    expect(screen.getByTestId('org-life-list-head').textContent).toBe('Ready to go live');
    expect(screen.queryByTestId('org-life-count')).toBeNull();
    fireEvent.click(screen.getByTestId('org-life-golive'));
    await screen.findByTestId('org-done-message');
    expect(seriesCommands().map((c) => c.env.command)).toEqual([{ kind: 'series.set_lifecycle', payload: { to: 'live' } }]);
  });

  it('the profile rule: ONE row "Finish your profile (N left)" to the wizard; it counts as one thing and Go live is off', async () => {
    check = { data: { ...READY, ready: false, profile_missing: [{ area: 'dancer', organiser_id: null, fields: ['photo', 'city'] }, { area: 'organiser', organiser_id: ORG, fields: ['logo'] }] }, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const row = await screen.findByTestId('org-life-profile');
    expect(words(row)).toBe('Finish your profile (3 answers left)');
    // The wizard opens ON the incomplete page (RELEASE-A-WEB finding 3).
    expect(row.getAttribute('href')).toBe(`${WIZARD}?o=${ORG}&${back(DRAFT)}`);
    expect(screen.getByTestId('org-life-count').textContent).toBe('1 thing left');
    const btn = screen.getByTestId('org-life-golive');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(btn);
    expect(seriesCommands()).toHaveLength(0);
  });

  it('no profile row when the rule does not apply (an admin)', async () => {
    check = { data: { ...READY, profile_rule_applies: false, profile_missing: [{ area: 'dancer', organiser_id: null, fields: ['photo'] }] }, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    await screen.findByTestId('org-life-golive');
    expect(screen.queryByTestId('org-life-profile')).toBeNull();
  });
});

const REASON_LOCKED = 'Finish your profiles first, 4 answers left';
const reasonOf = (el: Element) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent;
/** D82: every state x heading / count / rows / button / reason. */
const PROFILE = [{ area: 'dancer', organiser_id: null, fields: ['photo', 'city'] }];
const STATES: Array<[name: string, data: Check, locked: boolean, heading: string, count: string | null, rows: number, enabled: boolean, reason: string | null]> = [
  ['event items only', notReady('venue', 'venue'), false, 'Before you go live', '1 thing left', 1, false, 'Finish the 1 thing above first'],
  ['profile only', { ...READY, ready: false, profile_missing: PROFILE }, false, 'Before you go live', '1 thing left', 1, false, 'Finish the 1 thing above first'],
  ['both', { ...READY, ready: false, event_missing: [{ code: 'venue', section: 'venue' }, { code: 'cover', section: 'cover' }], profile_missing: PROFILE }, false, 'Before you go live', '3 things left', 3, false, 'Finish the 3 things above first'],
  ['recommended only', { ...READY, recommended: [{ code: 'ticket_link', section: 'tickets' }] }, false, 'Ready to go live', null, 0, true, null],
  ['N = 0 ready', READY, false, '', null, 0, true, null],
  ['locked', notReady('venue', 'venue'), true, 'Before you go live', '1 thing left', 1, false, REASON_LOCKED],
];
describe('D82: the Go live card, every state', () => {
  it.each(STATES)('%s', async (_n, data, locked, heading, count, rows, enabled, reason) => {
    check = { data, error: null };
    if (locked) progress = { data: LOCKED, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const btn = await screen.findByTestId('org-life-golive');
    await waitFor(() => expect(btn.getAttribute('aria-disabled') === 'true').toBe(!enabled));
    if (heading) expect(screen.getByTestId('org-life-list-head').textContent).toBe(heading); else expect(screen.queryByTestId('org-life-list-head')).toBeNull();
    expect(screen.queryByTestId('org-life-count')?.textContent ?? null).toBe(count);
    // The count equals the required rows shown (one number each, 1..N in order).
    const nums = [...document.querySelectorAll('[data-testid="org-life-list"] ol:first-of-type [data-testid$="-n"]')].map((n) => n.textContent);
    expect(nums).toEqual(Array.from({ length: rows }, (_, i) => String(i + 1)));
    expect(btn.tagName).toBe('BUTTON');
    if (reason) expect(reasonOf(btn)).toBe(reason);
  });

  it('a rejected Go live (server refusal) shows the same card: count, rows, button off', async () => {
    check = { data: null, error: { message: 'x' } };
    const json = JSON.stringify({ ...notReady('venue', 'venue'), event_missing: [{ code: 'venue', section: 'venue' }, { code: 'cover', section: 'cover' }] });
    refusal = { message: `permission_denied: series.set_lifecycle draft -> live needs a ready series: ${json}`, details: json, code: 'P0001' };
    mount(ORG_PATHS.event(DRAFT), routes);
    fireEvent.click(await screen.findByTestId('org-life-golive'));
    expect((await screen.findByTestId('org-life-count')).textContent).toBe('2 things left');
    expect(screen.getByTestId('org-life-golive').getAttribute('aria-disabled')).toBe('true');
  });

  it('every code the parser accepts has an action label (none falls back to the generic line)', async () => {
    const { GO_LIVE_LABEL, goLiveLabel, UNKNOWN_ITEM_LABEL } = await import('@/modules/organiser/shared/goLiveCheck');
    // W2 walk fix 5: every prod code (incl. the ones the server added later) has words.
    const LATER = ['no_session_first_date', 'first_date_past', 'bad_session_times', 'no_payment', 'no_flyer'];
    const codes = [...SIX.map(([c]) => c), ...NINE.map(([c]) => c), 'ticket_link', ...LATER];
    for (const code of codes) {
      expect(GO_LIVE_LABEL[code], code).toBeTruthy();
      expect(goLiveLabel(code), code).not.toBe(UNKNOWN_ITEM_LABEL);
      expect(goLiveLabel(code), code).toMatch(/^(Add|Upload|Write|Pick|Link|Give|Move|Fix|Say) /);
    }
    expect(Object.keys(GO_LIVE_LABEL).sort()).toEqual([...new Set(codes)].sort());
  });
});

// The controls C14 turns off on One event (series A: live, weekly) and the draft's Go live.
const LOCKED_ON_EVENT = ['org-event-pause', 'org-event-end', 'org-event-day', 'org-event-stop', 'org-coming-sessions'];
const LOCKED_ON_DETAILS = ['org-detail-name', 'org-detail-venue', 'org-detail-time', 'org-detail-music', 'org-detail-tickets', 'org-detail-about',
  'org-detail-programme', 'org-detail-organisers', 'org-detail-cover', 'org-detail-gallery', 'org-detail-videos'];
const REASON = 'Finish your profiles first, 4 answers left';

describe('C14 edit lock', () => {
  it.each([
    ['One event', ORG_PATHS.event(A), LOCKED_ON_EVENT],
    ['the draft', ORG_PATHS.event(DRAFT), ['org-life-golive']],
    ['Details', ORG_PATHS.eventDetails(A), LOCKED_ON_DETAILS],
  ])('%s: every locked control is off and shows the reason, with the link to the wizard', async (_n, path, ids) => {
    progress = { data: LOCKED, error: null };
    mount(path, routes);
    await waitFor(() => expect(document.querySelectorAll('[data-locked="true"]').length).toBeGreaterThan(0));
    for (const id of ids) {
      for (const el of screen.getAllByTestId(id)) {
        expect(el.getAttribute('data-locked'), id).toBe('true');
        if (id === 'org-life-golive') expect(el.getAttribute('aria-disabled'), id).toBe('true'); else expect(el.tagName, id).not.toBe('BUTTON');
        expect(el.getAttribute('href'), id).toBeNull();
        expect(reasonOf(el), id).toBe(REASON);
      }
    }
    // Nothing points at a locked control without saying why.
    for (const el of document.querySelectorAll('[data-locked="true"]')) expect(reasonOf(el)).toBe(REASON);
    const links = [...document.querySelectorAll('a[href]')].filter((a) => a.textContent === 'Complete your profile');
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a.getAttribute('href')).toContain(WIZARD);
  });

  it('the event items under a locked Go live carry no links (they would open locked screens)', async () => {
    progress = { data: LOCKED, error: null };
    check = { data: notReady('cover', 'cover'), error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const item = await screen.findByTestId('org-life-item-cover');
    expect(item.getAttribute('href')).toBeNull();
    expect(screen.queryByTestId('org-life-profile')).toBeNull();
  });

  it('a locked step reached by its URL says why instead of opening', async () => {
    progress = { data: LOCKED, error: null };
    mount(`${ORG_PATHS.event(A)}?do=pause`, routes);
    expect((await screen.findByTestId('org-event-step-locked-note-reason')).textContent).toBe(REASON);
  });

  it('a locked ?edit= link shows the rows with the reason, not the edit screen', async () => {
    progress = { data: LOCKED, error: null };
    mount(`${ORG_PATHS.eventDetails(A)}?edit=about`, routes);
    expect((await screen.findByTestId('org-detail-lock-reason')).textContent).toBe(REASON);
  });

  it('change one date and cancel a date stay open: their links stay links', async () => {
    progress = { data: LOCKED, error: null };
    mount(ORG_PATHS.event(A), routes);
    await waitFor(() => expect(document.querySelectorAll('[data-locked="true"]').length).toBeGreaterThan(0));
    for (const el of screen.getAllByTestId('org-coming-date')) expect(el.getAttribute('href')).toMatch(/\/account\/o\/change\//);
  });

  it('cancel a date sends its ONE command while locked', async () => {
    progress = { data: LOCKED, error: null };
    mount(ORG_PATHS.cancelDate(A, AFTER), routes);
    fireEvent.click(await screen.findByTestId('cancel-send'));
    await screen.findByTestId('org-done-message');
    expect(commandsOf(rpc).map((c) => c.env.command.kind)).toEqual(['occurrence.cancel']);
  });

  it('change one date\'s time sends its ONE command while locked', async () => {
    progress = { data: LOCKED, error: null };
    mount(ORG_PATHS.changeTime(A, BEFORE), routes);
    const input = (await screen.findByTestId('change-time-input')) as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('20:00'));
    fireEvent.change(input, { target: { value: '21:30' } });
    fireEvent.click(screen.getByTestId('change-save'));
    await waitFor(() => expect(commandsOf(rpc)).toHaveLength(1));
    expect(commandsOf(rpc)[0].fn).toBe('occurrence_command_p5');
  });

  it('an admin is never locked', async () => {
    progress = { data: LOCKED, error: null };
    admin = true;
    mount(ORG_PATHS.event(A), routes);
    await screen.findByTestId('org-event-pause');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelectorAll('[data-locked="true"]')).toHaveLength(0);
    expect(screen.getByTestId('org-event-pause').getAttribute('href')).toBeTruthy();
  });
});

describe('loading or an error of either RPC never locks and never crashes', () => {
  it.each([
    ['progress loading', () => { progress = 'pending'; }],
    ['progress error', () => { progress = { data: null, error: { message: 'Could not find the function public.my_profile_progress_v1' } }; }],
    ['progress bad shape', () => { progress = { data: { percent: 'x' }, error: null }; }],
  ])('%s: One event stays unlocked', async (_n, set) => {
    set();
    mount(ORG_PATHS.event(A), routes);
    await screen.findByTestId('org-event-pause');
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelectorAll('[data-locked="true"]')).toHaveLength(0);
  });

  it.each([
    ['check loading', () => { check = 'pending'; }],
    ['check error', () => { check = { data: null, error: { message: 'Could not find the function public.series_go_live_check_v1' } }; }],
    ['check bad shape', () => { check = { data: { ready: 'yes' }, error: null }; }],
  ])('%s: Go live still sends and the server decides', async (_n, set) => {
    set();
    mount(ORG_PATHS.event(DRAFT), routes);
    fireEvent.click(await screen.findByTestId('org-life-golive'));
    await screen.findByTestId('org-done-message');
    expect(seriesCommands()).toHaveLength(1);
  });
});

describe('D85: the card is a numbered to-do, and on a draft it leads the screen', () => {
  const FIRST = Node.DOCUMENT_POSITION_FOLLOWING;
  it('numbers 1..N for the required rows, no checkbox or radio role, no circle icon', async () => {
    check = { data: { ...READY, ready: false, event_missing: [{ code: 'venue', section: 'venue' }, { code: 'cover', section: 'cover' }], recommended: [{ code: 'ticket_link', section: 'tickets' }], profile_missing: PROFILE }, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const card = await screen.findByTestId('org-life-list');
    await waitFor(() => expect(card.querySelectorAll('[data-testid$="-n"]').length).toBeGreaterThan(2));
    const required = [...card.querySelectorAll('ol:first-of-type [data-testid$="-n"]')].map((n) => n.textContent);
    expect(required).toEqual(['1', '2', '3']);
    expect(card.querySelector('[role="checkbox"], [role="radio"], [role="switch"], input, svg.lucide-circle, svg.lucide-circle-check, svg.lucide-square')).toBeNull();
    // the whole row is the link, with a trailing chevron
    const row = screen.getByTestId('org-life-item-venue');
    expect(row.tagName).toBe('A');
    expect(row.querySelector('svg.lucide-chevron-right')).not.toBeNull();
  });

  it('a draft shows the card BEFORE the dates', async () => {
    check = { data: notReady('venue', 'venue'), error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const card = await screen.findByTestId('org-life');
    const dates = await screen.findByTestId('org-coming');
    expect(card.compareDocumentPosition(dates) & FIRST).toBeTruthy();
  });

  it('a live event keeps the card AFTER the dates', async () => {
    mount(ORG_PATHS.event(A), routes);
    const dates = await screen.findByTestId('org-coming');
    const card = await screen.findByTestId('org-life');
    expect(dates.compareDocumentPosition(card) & FIRST).toBeTruthy();
  });
});
