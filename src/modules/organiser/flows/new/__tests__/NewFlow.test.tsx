// @vitest-environment jsdom
/**
 * ER-C7 New event: format x blocker table, no time input, an untouched draft save sends
 * nothing, and Publish is held by the SERVER go-live check as well as the local rules.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { home, rawWorkspace, venues } from '../../../events/__tests__/fixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c-london' }) }));

import NewFlow from '../NewFlow';
import {
  NEW_FORMATS, dateCommands, draftCommand, emptyFinish, finishCommands, firstDateChoices, liveMessage, parseFormat, publishBlock,
  publishReasons, replaceProgramme, ruleSessionsOf, serverReason, sessionsWire, ticketLinkProblem, togglePayment, venueCommands,
  type FinishForm, type FinishInput,
} from '../model';
import { parseGoLiveCheck } from '../goLiveCheck';
import { newSession } from '../../../sessions/sessionsModel';
import { createSeriesCommand } from '../../../shared/selfServeApi';

const organiserPart = (organiserId: string) => createSeriesCommand({}, organiserId).payload;
const DRAFT_KEYS = ['format', 'name', 'timezone', ...Object.keys(organiserPart('x'))].sort();

type Envelope = { target_id: string | null; expected_version: number | null; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> } };
const sent = (): Envelope[] => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5').map(([, a]) => (a as { p_envelope: Envelope }).p_envelope);
const called = (name: string) => rpc.mock.calls.filter(([fn]) => fn === name);

let format = 'recurring';
let ws: Record<string, unknown> = {};
let check: unknown = { ready: true, blockers: [] };
let programmeSessions: unknown[] = [];
let nextVersion = 4;
let occ: unknown[] | undefined;

beforeEach(() => {
  format = 'recurring';
  ws = { format, version: 3, default_cover_image_url: null, default_description: null };
  check = { ready: true, blockers: [] };
  programmeSessions = [];
  nextVersion = 4;
  occ = undefined;
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') return { data: home(), error: null };
    if (fn === 'get_organiser_venue_options_v1') return { data: venues, error: null };
    if (fn === 'admin_event_workspace_p5') return { data: rawWorkspace({ ...ws, format }, occ), error: null };
    if (fn === 'organiser_get_occurrence_programme_v1') {
      return { data: { occurrence_id: 'o1', series_id: 's1', occurrence_date: '2026-10-09', version: 2, editable: true, not_editable_reason: null, sessions: programmeSessions, session_people: [] }, error: null };
    }
    if (fn === 'organiser_set_occurrence_programme_v1') return { data: { ok: true, changed: true, version: 3, sessions: [] }, error: null };
    if (fn === 'series_go_live_check_v1') return { data: check, error: null };
    if (fn === 'series_command_p5') {
      const v = nextVersion;
      nextVersion += 1;
      return { data: { ok: true, new_version: v }, error: null };
    }
    return { data: null, error: { message: 'unexpected ' + fn } };
  });
});
afterEach(cleanup);

function Where() {
  return <span data-testid="where">{useLocation().pathname + useLocation().search}</span>;
}

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/new/what" element={<NewFlow />} />
          <Route path="/account/o/new/name" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/venue" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/date" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/time" element={<NewFlow />} />
          <Route path="/account/o/new/:seriesId/cover" element={<NewFlow />} />
          <Route path="/account/o/done" element={<span data-testid="done-route" />} />
          <Route path="*" element={<span data-testid="elsewhere" />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const where = () => screen.getByTestId('where').textContent;

// ---- the table: formats x blockers --------------------------------------------------------

const GOOD_SESSIONS = [{ kind: 'class', start: '20:00', end: '21:00' }];
const base = (over: Partial<FinishInput['series']> = {}, form: FinishForm = { ...emptyFinish(), payment: ['free'] }, hasFlyer = true, server: FinishInput['server'] = null): FinishInput => ({
  series: { name: 'Friday', format: 'recurring', venueId: 'v1', payment: form.payment, firstDate: { date: '2026-10-09', sessions: GOOD_SESSIONS }, today: '2026-10-08', ...over },
  hasFlyer, form, server,
});

describe('model: formats x blockers', () => {
  const formats = ['recurring', 'one_off'] as const;
  const cases: Array<[string, (f: string) => FinishInput, string | null]> = [
    ['everything set', (f) => base({ format: f }), null],
    ['no name', (f) => base({ format: f, name: '' }), 'Name needed'],
    ['no venue', (f) => base({ format: f, venueId: null }), 'Venue needed'],
    ['no first date', (f) => base({ format: f, firstDate: null }), 'First date needed'],
    ['first date in the past', (f) => base({ format: f, firstDate: { date: '2026-10-01', sessions: GOOD_SESSIONS } }), 'Date in the past'],
    ['no session on the first date', (f) => base({ format: f, firstDate: { date: '2026-10-09', sessions: [] } }), 'Session needed'],
    ['session end equals start', (f) => base({ format: f, firstDate: { date: '2026-10-09', sessions: [{ kind: 'party', start: '20:00', end: '20:00' }] } }), 'Session times invalid'],
    ['no way to pay', (f) => base({ format: f, payment: [] }, emptyFinish()), 'How to pay needed'],
    ['no flyer', (f) => base({ format: f }, undefined, false), 'Flyer needed'],
    ['ticket link ticked, no link', (f) => base({ format: f }, { ...emptyFinish(), payment: ['ticket_link'] }), 'Ticket link needed'],
    ['server says no_payment', (f) => base({ format: f }, undefined, true, { ready: false, blockers: [{ code: 'no_payment' }] }), 'How to pay needed'],
    ['server says no_flyer', (f) => base({ format: f }, undefined, true, { ready: false, blockers: [{ code: 'no_flyer' }] }), 'Flyer needed'],
    ['server says first_date_past', (f) => base({ format: f }, undefined, true, { ready: false, blockers: [{ code: 'first_date_past' }] }), 'Date in the past'],
  ];
  it.each(formats.flatMap((f) => cases.map(([name, build, reason]) => [f, name, build, reason] as const)))(
    '%s: %s', (f, _name, build, reason) => {
      expect(publishBlock(build(f))).toBe(reason);
    },
  );

  it('the local rules and the server both count, with no repeats', () => {
    const input = base({ name: '' }, undefined, true, { ready: false, blockers: [{ code: 'no_payment' }, { code: 'brand_new_code' }] });
    expect(publishReasons(input)).toEqual(['Name needed', 'How to pay needed', 'Brand new code']);
  });

  it('server codes read as the local words', () => {
    expect(serverReason('no_session_first_date')).toBe('Session needed');
    expect(serverReason('bad_session_times')).toBe('Session times invalid');
    expect(serverReason('cover')).toBe('Flyer needed');
  });

  it('parses the server answer tolerantly and never reads "not ready" as ready', () => {
    expect(parseGoLiveCheck({ ready: true, blockers: [] })).toEqual({ ready: true, blockers: [] });
    expect(parseGoLiveCheck({ ready: false, blockers: ['no_payment', { code: 'no_flyer' }, 'no_payment'] }).blockers).toEqual([{ code: 'no_payment' }, { code: 'no_flyer' }]);
    expect(parseGoLiveCheck({ ready: false }).blockers).toEqual([{ code: 'not_ready' }]);
    expect(parseGoLiveCheck(null).ready).toBe(false);
  });
});

describe('model: commands', () => {
  it('offers Weekly and One-off; Course is listed OFF with a reason; a festival is not here', () => {
    expect(NEW_FORMATS.map((f) => f.format)).toEqual(['recurring', 'one_off', 'course']);
    expect(NEW_FORMATS.filter((f) => f.off).map((f) => f.format)).toEqual(['course']);
    for (const bad of ['course', 'festival', '', null, undefined]) expect(parseFormat(bad as string | null)).toBeNull();
  });

  it('the draft carries only name, format, timezone and the organiser', () => {
    const cmd = draftCommand('  Friday Night  ', 'recurring', 'org1');
    expect(Object.keys(cmd.payload).sort()).toEqual(DRAFT_KEYS);
    expect(cmd.payload.name).toBe('Friday Night');
  });

  it.each([['recurring', ['series.upsert', 'series.set_recurrence']], ['one_off', ['series.upsert']]] as const)('the first date of a %s sends %j', (fmt, kinds) => {
    expect(dateCommands(fmt, '2026-10-23').map((c) => c.kind)).toEqual(kinds);
  });

  it('venue is ONE upsert; the days list is 30 long; the Live line has a full weekday', () => {
    expect(venueCommands('v1', 'c1')[0].payload).toEqual({ default_venue_id: 'v1', default_city_id: 'c1' });
    expect(firstDateChoices('2026-10-08')).toHaveLength(30);
    expect(liveMessage('2026-10-23')).toBe('Live - Friday 23 October');
  });

  it('an untouched last step sends no command; a touched one sends ONE upsert, and never a category or a time', () => {
    expect(finishCommands(emptyFinish(), false)).toEqual([]);
    expect(finishCommands({ payment: [], ticketUrl: '', description: '' }, true)).toEqual([]);
    const cmds = finishCommands({ payment: ['ticket_link', 'door'], ticketUrl: ' https://x.example/t ', description: ' Hello ' }, true);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].payload).toEqual({ payment_methods: 'ticket_link,door', default_ticket_url: 'https://x.example/t', default_description: 'Hello' });
    expect(Object.keys(cmds[0].payload)).not.toContain('category');
    expect(Object.keys(cmds[0].payload)).not.toContain('default_local_start_time');
  });

  it('unticking the ticket link clears its address; a link must be https', () => {
    const on = togglePayment({ ...emptyFinish(), ticketUrl: 'https://x.example' }, 'ticket_link');
    expect(togglePayment(on, 'ticket_link').ticketUrl).toBe('');
    expect(ticketLinkProblem({ ...on, ticketUrl: 'not a link' })).toBe('Link must start with https://');
    expect(ticketLinkProblem({ ...on, ticketUrl: 'https://x.example' })).toBeNull();
  });

  it('sessions go as new ones; stored ones are marked removed so a return visit does not double', () => {
    const s = newSession('class', '20:00');
    const wire = sessionsWire([{ ...s, levels: ['beginner'] }]);
    expect(wire[0]).toMatchObject({ new: true, type: 'class', start_time: '20:00', ends_next_day: false, level_keys: ['beginner'] });
    const party = newSession('party', '22:00');
    expect(sessionsWire([{ ...party, end: '02:00' }])[0]).toMatchObject({ type: 'party', ends_next_day: true, level_keys: [] });
    const merged = replaceProgramme([{ series_item_id: 'i1', type: 'class', removed: false }], [s]);
    expect(merged.map((x) => x.removed ?? null)).toEqual([true, null]);
    expect(ruleSessionsOf([{ type: 'class', start_time: '20:00:00', end_time: '21:00' }, { type: 'party', removed: true }])).toEqual([{ kind: 'class', start: '20:00', end: '21:00' }]);
  });
});

// ---- screens ----------------------------------------------------------------------------

describe('screens', () => {
  it('what: Weekly and One-off open the name step; Course is off with its reason and sends nothing', async () => {
    mount('/account/o/new/what');
    expect(await screen.findByTestId('org-new-format-recurring')).toBeTruthy();
    const course = screen.getByTestId('org-new-format-course') as HTMLButtonElement;
    expect(course.disabled).toBe(true);
    expect(screen.getByTestId('org-new-format-course-reason').textContent).toBe('Not available yet');
    fireEvent.click(course);
    expect(where()).toBe('/account/o/new/what');
    fireEvent.click(screen.getByTestId('org-new-format-one_off'));
    await waitFor(() => expect(where()).toBe('/account/o/new/name?format=one_off'));
    expect(sent()).toHaveLength(0);
  });

  it('name: Next is off with a reason, then ONE create, then the venue step', async () => {
    mount('/account/o/new/name?format=recurring');
    const next = (await screen.findByTestId('org-new-next')) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByTestId('org-new-next-reason').textContent).toMatch(/name/);
    fireEvent.change(screen.getByTestId('org-new-name'), { target: { value: 'Friday Night' } });
    await waitFor(() => expect((screen.getByTestId('org-new-next') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('org-new-next'));
    await waitFor(() => expect(where()).toContain('/venue'));
    expect(sent()).toHaveLength(1);
    expect(Object.keys(sent()[0].command.payload).sort()).toEqual(DRAFT_KEYS);
  });

  it('date: a weekly night sends the date then ONE recurrence; a one-off sends the date only; no time is asked', async () => {
    mount('/account/o/new/s1/date');
    fireEvent.click((await screen.findAllByTestId('org-new-date-row'))[1]);
    await waitFor(() => expect(where()).toBe('/account/o/new/s1/time'));
    expect(sent().map((e) => e.command.kind)).toEqual(['series.upsert', 'series.set_recurrence']);
    cleanup();
    rpc.mockClear();
    format = 'one_off';
    mount('/account/o/new/s1/date');
    fireEvent.click((await screen.findAllByTestId('org-new-date-row'))[0]);
    await waitFor(() => expect(where()).toBe('/account/o/new/s1/time'));
    expect(sent().map((e) => e.command.kind)).toEqual(['series.upsert']);
    expect(sent()[0].command.payload).toEqual({ default_start_date: '2026-10-08' });
  });

  it('first session: one party is ready, there is no time input, Next saves the programme (not a series command)', async () => {
    ws = { default_start_date: '2026-10-09' };
    mount('/account/o/new/s1/time');
    const next = (await screen.findByTestId('org-new-next')) as HTMLButtonElement;
    expect(document.querySelector('input[type="time"]')).toBeNull();
    expect(screen.getAllByTestId('org-new-session-row')).toHaveLength(1);
    await waitFor(() => expect(next.disabled).toBe(false));
    fireEvent.click(next);
    await waitFor(() => expect(where()).toBe('/account/o/new/s1/cover'));
    const [, args] = called('organiser_set_occurrence_programme_v1')[0] as [string, { p_occurrence_id: string; p_expected_version: number; p_sessions: Array<Record<string, unknown>> }];
    expect(args.p_occurrence_id).toBe('o1');
    expect(args.p_expected_version).toBe(2);
    expect(args.p_sessions).toHaveLength(1);
    expect(args.p_sessions[0]).toMatchObject({ new: true, type: 'party', start_time: '21:00', end_time: '23:00' });
    expect(sent()).toHaveLength(0);
  });

  it('first session: with no date saved yet Next says so and sends nothing', async () => {
    ws = { default_start_date: null };
    occ = [];
    mount('/account/o/new/s1/time');
    const next = (await screen.findByTestId('org-new-next')) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByTestId('org-new-next-reason').textContent).toBe('Pick the date first');
    expect(called('organiser_set_occurrence_programme_v1')).toHaveLength(0);
  });
});

describe('last step: flyer, how to pay, Publish', () => {
  const ready = () => {
    ws = { default_start_date: '2026-10-09', default_cover_image_url: 'https://cdn.example/f.webp', default_description: null };
    programmeSessions = [{ series_item_id: 'i1', type: 'party', title: 'Party', start_time: '21:00', end_time: '23:30', level_keys: [] }];
  };
  const publishBtn = async () => (await screen.findByTestId('org-new-live')) as HTMLButtonElement;

  it('shows the live preview with the venue, the date and the sessions', async () => {
    ready();
    mount('/account/o/new/s1/cover');
    await publishBtn();
    await waitFor(() => expect(screen.getByTestId('org-new-preview').textContent).toContain('Studio One'));
    expect(screen.getByTestId('org-new-preview').textContent).toContain('Friday 9 October');
    expect(screen.getByTestId('org-new-preview').textContent).toContain('21:00 - 23:30');
  });

  it('Publish is off with a reason until a way to pay is picked, then on', async () => {
    ready();
    mount('/account/o/new/s1/cover');
    const btn = await publishBtn();
    await waitFor(() => expect(screen.getByTestId('org-new-live-reason').textContent).toBe('How to pay needed'));
    expect(btn.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('org-new-pay-door'));
    await waitFor(() => expect((screen.getByTestId('org-new-live') as HTMLButtonElement).disabled).toBe(false));
  });

  it('a missing flyer holds Publish with its reason', async () => {
    ready();
    ws = { ...ws, default_cover_image_url: null };
    mount('/account/o/new/s1/cover');
    fireEvent.click(await screen.findByTestId('org-new-pay-free'));
    await waitFor(() => expect(screen.getByTestId('org-new-live-reason').textContent).toBe('Flyer needed'));
    expect((screen.getByTestId('org-new-live') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Save as draft on an untouched draft sends NO command and goes to Done', async () => {
    ready();
    mount('/account/o/new/s1/cover');
    await publishBtn();
    fireEvent.click(screen.getByTestId('org-new-save-draft'));
    await waitFor(() => expect(where()).toBe('/account/o/done'));
    expect(sent()).toHaveLength(0);
  });

  it('the SERVER check holds a publish the local rules allowed: reason shown, NO lifecycle command', async () => {
    ready();
    check = { ready: false, blockers: [{ code: 'bad_session_times' }] };
    mount('/account/o/new/s1/cover');
    await waitFor(() => expect(called('series_go_live_check_v1')).toHaveLength(1));
    fireEvent.click(await screen.findByTestId('org-new-pay-cash'));
    await waitFor(() => expect(screen.getByTestId('org-new-live-reason').textContent).toBe('Session times invalid'));
    expect((screen.getByTestId('org-new-live') as HTMLButtonElement).disabled).toBe(true);
    expect(sent().filter((e) => e.command.kind === 'series.set_lifecycle')).toHaveLength(0);
  });

  it('when the server only finds a blocker after the save, Publish stops there and says why', async () => {
    ready();
    mount('/account/o/new/s1/cover');
    await waitFor(() => expect(called('series_go_live_check_v1')).toHaveLength(1));
    fireEvent.click(await screen.findByTestId('org-new-pay-door'));
    await waitFor(() => expect((screen.getByTestId('org-new-live') as HTMLButtonElement).disabled).toBe(false));
    check = { ready: false, blockers: [{ code: 'no_payment' }] };
    fireEvent.click(screen.getByTestId('org-new-live'));
    await waitFor(() => expect(screen.getByTestId('org-new-live-reason').textContent).toBe('How to pay needed'));
    expect(sent().map((e) => e.command.kind)).toEqual(['series.upsert']);
    expect(where()).not.toBe('/account/o/done');
  });

  it('Publish saves how to pay, checks the server, then goes live at once', async () => {
    ready();
    mount('/account/o/new/s1/cover');
    fireEvent.click(await screen.findByTestId('org-new-pay-door'));
    fireEvent.click(screen.getByTestId('org-new-pay-cash'));
    await waitFor(() => expect((screen.getByTestId('org-new-live') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('org-new-live'));
    await waitFor(() => expect(where()).toBe('/account/o/done'));
    const calls = sent();
    expect(calls.map((e) => e.command.kind)).toEqual(['series.upsert', 'series.set_lifecycle']);
    expect(calls[0].command.payload).toEqual({ payment_methods: 'door,cash' });
    expect(calls[1].command.payload).toEqual({ to: 'live' });
    expect(calls[1].expected_version).toBeGreaterThan(0);
  });

  it('ticket link ticked: the address is asked for and Publish says so until it is a link', async () => {
    ready();
    mount('/account/o/new/s1/cover');
    fireEvent.click(await screen.findByTestId('org-new-pay-ticket_link'));
    await waitFor(() => expect(screen.getByTestId('org-new-live-reason').textContent).toBe('Ticket link needed'));
    fireEvent.change(screen.getByTestId('org-new-ticket'), { target: { value: 'https://tickets.example/e' } });
    await waitFor(() => expect((screen.getByTestId('org-new-live') as HTMLButtonElement).disabled).toBe(false));
  });
});

describe('source rules', () => {
  const dir = join(__dirname, '..');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
  it('no time input, no category, no SectionLabel or StatusTag in the flow', () => {
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src).not.toMatch(/type=["']time["']|<TimeField|<TimePicker/);
      expect(src).not.toMatch(/SectionLabel|StatusTag/);
      if (f === 'NewFlow.tsx') expect(src).not.toMatch(/default_local_start_time|category:/);
    }
  });
  it('every tap row is at least 44px tall', () => {
    const src = readFileSync(join(dir, 'NewFlow.tsx'), 'utf8');
    for (const m of src.matchAll(/min-h-\[(\d+)px\]/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(44);
  });
});
