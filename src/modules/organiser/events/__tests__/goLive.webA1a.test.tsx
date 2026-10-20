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
  ['venue', 'venue', 'A venue', (id) => ORG_PATHS.eventDetails(id)],
  ['city', 'venue', 'A city', (id) => ORG_PATHS.eventDetails(id)],
  ['upcoming_date', 'dates', 'An upcoming date', (id) => ORG_PATHS.addEvent(id)],
  ['session', 'programme', 'At least one session with a title, start and end', (id) => ORG_PATHS.eventProgramme(id)],
  ['cover', 'cover', 'A flyer', (id) => ORG_PATHS.cover(id)],
  ['description', 'about', 'A description', (id) => `${ORG_PATHS.eventDetails(id)}?edit=about`],
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

describe('Go live renders the server list, one label per code (D49)', () => {
  it.each(SIX)('%s: the Go live list says the D49 word and links to its screen, back to this event', async (code, section, word, to) => {
    check = { data: notReady(code, section), error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const item = await screen.findByTestId(`org-life-item-${code}`);
    expect(item.textContent).toBe(word);
    expect(item.getAttribute('href')).toBe(`${to(DRAFT)}${to(DRAFT).includes('?') ? '&' : '?'}${back(DRAFT)}`);
  });

  it.each(SIX)('%s: a readable refusal of the Go live command renders the same word, never a generic error', async (code, section, word) => {
    check = { data: null, error: { message: 'Could not find the function public.series_go_live_check_v1' } };
    const json = JSON.stringify(notReady(code, section));
    refusal = { message: `permission_denied: series.set_lifecycle draft -> live needs a ready series: ${json}`, details: json, code: 'P0001', hint: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    fireEvent.click(await screen.findByTestId('org-life-golive'));
    expect((await screen.findByTestId(`org-life-item-${code}`)).textContent).toBe(word);
    expect(screen.getByTestId('event-step-error').textContent).toBe('Not ready to go live yet.');
    expect(seriesCommands()).toHaveLength(1);
  });

  it('a refusal whose JSON rides only in the message still renders the list', async () => {
    check = { data: null, error: { message: 'boom' } };
    refusal = { message: `permission_denied: series.set_lifecycle draft -> live needs a ready series: ${JSON.stringify(notReady('cover', 'cover'))}`, details: null, code: 'P0001' };
    mount(ORG_PATHS.event(DRAFT), routes);
    fireEvent.click(await screen.findByTestId('org-life-golive'));
    expect((await screen.findByTestId('org-life-item-cover')).textContent).toBe('A flyer');
  });

  it('mutating the one map changes the Go live list AND the refusal render', async () => {
    const { GO_LIVE_LABEL } = await import('@/modules/organiser/shared/goLiveCheck');
    const map = GO_LIVE_LABEL as Record<string, string>;
    const was = map.venue;
    map.venue = 'MUTANT';
    try {
      check = { data: notReady('venue', 'venue'), error: null };
      mount(ORG_PATHS.event(DRAFT), routes);
      expect((await screen.findByTestId('org-life-item-venue')).textContent).toBe('MUTANT');
      cleanup();
      check = { data: null, error: { message: 'x' } };
      const json = JSON.stringify(notReady('venue', 'venue'));
      refusal = { message: `permission_denied: series.set_lifecycle draft -> live needs a ready series: ${json}`, details: json, code: 'P0001' };
      mount(ORG_PATHS.event(DRAFT), routes);
      fireEvent.click(await screen.findByTestId('org-life-golive'));
      expect((await screen.findByTestId('org-life-item-venue')).textContent).toBe('MUTANT');
    } finally {
      map.venue = was;
    }
  });
});

describe('the rule is the server\'s', () => {
  it('a weekly event with one dated session and `session` missing is NOT ready: one tap jumps to the programme, nothing is sent', async () => {
    check = { data: notReady('session', 'programme'), error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    expect(await screen.findByTestId('org-life-list-head')).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-life-golive'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`${ORG_PATHS.eventProgramme(DRAFT)}?${back(DRAFT)}`));
    expect(seriesCommands()).toHaveLength(0);
  });

  it('several missing: the list keeps the server order and the tap goes to the FIRST', async () => {
    check = { data: { ...READY, ready: false, event_missing: [{ code: 'session', section: 'programme' }, { code: 'venue', section: 'venue' }] }, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    await screen.findByTestId('org-life-item-venue');
    const order = [...screen.getByTestId('org-life-list').querySelectorAll('[data-testid^="org-life-item-"]')].map((e) => e.getAttribute('data-testid'));
    expect(order).toEqual(['org-life-item-session', 'org-life-item-venue']);
    fireEvent.click(screen.getByTestId('org-life-golive'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toContain(ORG_PATHS.eventProgramme(DRAFT)));
  });

  it('a recommended ticket link never blocks: it shows as Recommended and Go live sends ONE set_lifecycle live', async () => {
    check = { data: { ...READY, recommended: [{ code: 'ticket_link', section: 'tickets' }] }, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const item = await screen.findByTestId('org-life-item-ticket_link');
    expect(item.textContent).toBe('A ticket linkRecommended');
    expect(screen.queryByTestId('org-life-list-head')).toBeNull();
    fireEvent.click(screen.getByTestId('org-life-golive'));
    await screen.findByTestId('org-done-message');
    expect(seriesCommands().map((c) => c.env.command)).toEqual([{ kind: 'series.set_lifecycle', payload: { to: 'live' } }]);
  });

  it('the profile rule: ONE row "Complete your profile (N left)" to the wizard; with nothing else missing the tap goes there', async () => {
    check = { data: { ...READY, ready: false, profile_missing: [{ area: 'dancer', organiser_id: null, fields: ['photo', 'city'] }, { area: 'organiser', organiser_id: ORG, fields: ['logo'] }] }, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    const row = await screen.findByTestId('org-life-profile');
    expect(row.textContent).toBe('Complete your profile (3 left)');
    expect(row.getAttribute('href')).toBe(`${WIZARD}?${back(DRAFT)}`);
    fireEvent.click(screen.getByTestId('org-life-golive'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`${WIZARD}?${back(DRAFT)}`));
    expect(seriesCommands()).toHaveLength(0);
  });

  it('no profile row when the rule does not apply (an admin)', async () => {
    check = { data: { ...READY, profile_rule_applies: false, profile_missing: [{ area: 'dancer', organiser_id: null, fields: ['photo'] }] }, error: null };
    mount(ORG_PATHS.event(DRAFT), routes);
    await screen.findByTestId('org-life-golive');
    expect(screen.queryByTestId('org-life-profile')).toBeNull();
  });
});

// The controls C14 turns off on One event (series A: live, weekly) and the draft's Go live.
const LOCKED_ON_EVENT = ['org-event-pause', 'org-event-end', 'org-event-day', 'org-event-stop', 'org-coming-sessions'];
const LOCKED_ON_DETAILS = ['org-detail-name', 'org-detail-venue', 'org-detail-time', 'org-detail-music', 'org-detail-tickets', 'org-detail-about',
  'org-detail-programme', 'org-detail-organisers', 'org-detail-cover', 'org-detail-gallery', 'org-detail-videos'];
const REASON = 'Finish your profiles first, 4 left';

const reasonOf = (el: Element) => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent;

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
        expect(el.tagName, id).not.toBe('BUTTON');
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
