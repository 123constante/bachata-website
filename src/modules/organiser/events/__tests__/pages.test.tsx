// @vitest-environment jsdom
/**
 * W2 screens: the events list, the name-only create, and the event editor
 * (every row's edit path, the 30-date cap UI, the preview bar, save failure).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TODAY, home, programme, rawWorkspace, venues } from './fixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
// Mutable: the FIX-3 freeze test rolls London midnight over between two presses of Create.
const londonToday = vi.hoisted(() => ({ value: '2026-10-08' }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => londonToday.value }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c-edinburgh' }) }));
// The ONE first-date helper (FIX-3 fix 6), spied: the editor's `next` and the create's seed date must both read it.
vi.mock('@/modules/organiser/shared/seriesModel', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/modules/organiser/shared/seriesModel')>();
  return { ...real, firstListedDate: vi.fn(real.firstListedDate) };
});

import { firstListedDate } from '@/modules/organiser/shared/seriesModel';
import EventsPage from '../index';
import NewEventPage from '../NewEventPage';
import EventEditorPage from '../EventEditorPage';
import { LIVE_NOTE } from '../../ui';
import { CHIPS_LOCKED_HINT, EVENT_TYPES, unconfirmedExitNote } from '../eventType';

type Handler = (args: Record<string, unknown>) => unknown;
let handlers: Record<string, Handler>;
const commands = () => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5').map(([, a]) => (a as { p_envelope: { command: { kind: string; payload: Record<string, unknown> }; expected_version?: number; idempotency_key?: string; target_id?: string } }).p_envelope);

beforeEach(() => {
  let workspace = rawWorkspace();
  handlers = {
    organiser_home_v1: () => home(),
    admin_event_workspace_p5: () => workspace,
    organiser_get_occurrence_programme_v1: () => programme,
    get_organiser_venue_options_v1: () => venues,
    series_command_p5: () => ({ ok: true, new_version: 4 }),
  };
  (globalThis as { setWorkspace?: (w: ReturnType<typeof rawWorkspace>) => void }).setWorkspace = (w) => { workspace = w; };
  londonToday.value = '2026-10-08';
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    const h = handlers[fn];
    if (!h) return { data: null, error: { message: `unexpected ${fn}` } };
    try { return { data: await h(args), error: null }; } catch (e) { return { data: null, error: e }; }
  });
});
afterEach(cleanup);

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/events" element={<EventsPage />} />
          <Route path="/account/o/events/new" element={<NewEventPage />} />
          <Route path="/account/o/events/:seriesId" element={<EventEditorPage />} />
          <Route path="*" element={<span />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

const editor = async () => {
  mount('/account/o/events/s1');
  return screen.findByTestId('org-event-editor');
};
const save = () => fireEvent.click(screen.getByTestId('org-preview-bar-action'));
const sheet = () => screen.getByTestId('org-editor-sheet');

describe('events list', () => {
  it('lists each series with Live/Draft, the next date and the venue', async () => {
    mount('/account/o/events');
    const rows = await screen.findAllByTestId('org-event-row');
    expect(rows.map((r) => r.getAttribute('data-series-id'))).toEqual(['s2', 's1']);
    const live = rows[1];
    expect(within(live).getByTestId('org-event-row-status').textContent).toBe('Live');
    expect(within(live).getByTestId('org-event-row-venue').textContent).toContain('Studio One');
    expect(within(rows[0]).getByTestId('org-event-row-status').textContent).toBe('Draft');
    expect(within(rows[0]).getByTestId('org-event-row-venue').textContent).toBe('No upcoming dates');
    expect(live.getAttribute('href')).toBe('/account/o/events/s1');
  });

  it('shows the empty state with the one New event button', async () => {
    handlers.organiser_home_v1 = () => home([]);
    mount('/account/o/events');
    expect(await screen.findByTestId('org-events-empty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-events-new'));
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/new');
  });

  it('shows an error state with retry', async () => {
    handlers.organiser_home_v1 = () => { throw { message: 'boom' }; };
    mount('/account/o/events');
    expect(await screen.findByTestId('org-events-error')).toBeTruthy();
  });
});

describe('new event (name only)', () => {
  it('creates the draft with defaults at once, lists the first 8 dates, then opens the editor', async () => {
    mount('/account/o/events/new');
    const name = await screen.findByTestId('org-new-event-name');
    fireEvent.change(name, { target: { value: 'Tuesday Class' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-class'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    const [create, rule] = commands();
    expect(create.command.kind).toBe('series.upsert');
    expect(create.command.payload).toMatchObject({
      name: 'Tuesday Class', format: 'recurring', default_duration_minutes: 120,
      default_start_date: '2026-10-15', timezone: 'Europe/London', default_city_id: 'c1',
    });
    expect(Object.keys(create.command.payload)).not.toContain('default_venue_id');
    // Category is derived from the sessions on the server (event-truth P2): never sent.
    expect(Object.keys(create.command.payload)).not.toContain('category');
    expect(rule.command).toEqual({ kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [4], end: { kind: 'until_date', date: '2026-12-03' } } });
    expect(rule.expected_version).toBe(4);
  });

  it('a party starts as ONE date (no weekly rule), with its own duration', async () => {
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'Saturday Party' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    const [create, date] = commands();
    expect(create.command.payload).toMatchObject({ format: 'recurring', default_duration_minutes: 300 });
    expect(create.command.payload).not.toHaveProperty('category');
    expect(date.command).toEqual({ kind: 'series.add_date', payload: { date: '2026-10-15' } });
    expect(commands()).toHaveLength(2);
  });

  it('asks for the first session before creating', async () => {
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).toMatch(/Choose the first session/);
    expect(commands()).toHaveLength(0);
  });

  it('a refused weekly rule is shown, not swallowed, and the event can be opened', async () => {
    let n = 0;
    handlers.series_command_p5 = () => {
      n += 1;
      if (n === 1) return { ok: true, new_version: 4 };
      throw { message: 'invalid_payload: rule refused', code: 'P0001' };
    };
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'Tuesday Class' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-class'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).toMatch(/saved as a draft, but its weekly dates were not listed/);
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/new');
    fireEvent.click(screen.getByTestId('org-new-event-open'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
  });

  // The chip seeds ONE session on the first upcoming date (organiser_set_occurrence_programme_v1
  // writes date-only sessions; the server derives the category from them). Table-driven over
  // the three chips; the fixture's o0 is in the past, so o1 (9 Oct) is the first upcoming date.
  const setCalls = () => rpc.mock.calls.filter(([fn]) => fn === 'organiser_set_occurrence_programme_v1').map(([, a]) => a as { p_occurrence_id: string; p_expected_version: number; p_sessions: Record<string, unknown>[] });
  it.each([
    ['class', { type: 'class', title: 'Class', start_time: '20:00', end_time: '22:00', ends_next_day: false }],
    ['party', { type: 'party', title: 'Party', start_time: '20:00', end_time: '01:00', ends_next_day: true }],
    ['workshop', { type: 'class', title: 'Workshop', start_time: '20:00', end_time: '22:00', ends_next_day: false }],
  ] as const)('the %s chip seeds one session on the first upcoming date', async (chip, session) => {
    handlers.organiser_get_occurrence_programme_v1 = () => ({ ...programme, sessions: [], session_people: [] });
    handlers.organiser_set_occurrence_programme_v1 = () => ({ ok: true, changed: true, version: 3, sessions: [] });
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'New night' } });
    fireEvent.click(screen.getByTestId(`org-new-event-type-${chip}`));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    expect(setCalls()).toHaveLength(1);
    const [call] = setCalls();
    expect(call.p_occurrence_id).toBe('o1');
    expect(call.p_expected_version).toBe(2);
    expect(call.p_sessions).toEqual([{ new: true, level_keys: [], ...session }]);
  });

  it('a first date that already holds a session gets no second one (Create pressed again)', async () => {
    handlers.organiser_set_occurrence_programme_v1 = () => ({ ok: true, changed: true, version: 3, sessions: [] });
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'New night' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    expect(setCalls()).toHaveLength(0);
  });

  it('a refused first session is shown, not swallowed, and the event can be opened', async () => {
    handlers.organiser_get_occurrence_programme_v1 = () => ({ ...programme, sessions: [], session_people: [] });
    handlers.organiser_set_occurrence_programme_v1 = () => { throw { message: 'permission_denied: programme edit on a cancelled date is not allowed', code: 'P0001' }; };
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'New night' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-class'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    const error = (await screen.findByTestId('org-new-event-error')).textContent ?? '';
    expect(error).toMatch(/saved as a draft, but the first session was not added/);
    expect(error).toMatch(/This date is cancelled/);
    expect(error).not.toMatch(/permission_denied/);
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/new');
    // The event exists with this chip: the chips lock, and the hint says why and what to do.
    for (const chip of ['class', 'party', 'workshop']) expect((screen.getByTestId(`org-new-event-type-${chip}`) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-new-event-type-hint').textContent).toBe(CHIPS_LOCKED_HINT);
    fireEvent.click(screen.getByTestId('org-new-event-open'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
  });

  // Review A (FIX-2): once the event exists, the chosen type is the one its first session carries.
  // A retry whose create REPLAY fails must not unlock the chips: a different chip would seed a
  // different session under the same idempotency keys on an event that already exists.
  it('a failed create replay keeps the chips locked and retries the ORIGINAL type', async () => {
    let n = 0;
    handlers.series_command_p5 = () => {
      n += 1;
      if (n === 1) return { ok: true, new_version: 4 }; // the create
      if (n === 2) throw { message: 'invalid_payload: rule refused', code: 'P0001' }; // its date: the chips lock
      throw new TypeError('fetch failed'); // every later create replay: the network is gone
    };
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'Saturday Party' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).toMatch(/date was not listed/);
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('org-new-event-error').textContent).toMatch(/could not confirm the save/));
    for (const chip of ['class', 'party', 'workshop']) expect((screen.getByTestId(`org-new-event-type-${chip}`) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-new-event-type-hint').textContent).toBe(CHIPS_LOCKED_HINT);
    // The hint says "open the event", so that control stays on screen, and it works: the event exists.
    expect((screen.getByTestId('org-new-event-open') as HTMLButtonElement).disabled).toBe(false);
    // Picking another chip does nothing; the next Create replays the PARTY create (300 min), never a class one.
    fireEvent.click(screen.getByTestId('org-new-event-type-class'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(commands()).toHaveLength(4));
    const creates = commands().filter((c) => c.command.kind === 'series.upsert');
    expect(creates).toHaveLength(3);
    for (const c of creates) expect(c.command.payload).toMatchObject({ default_duration_minutes: 300 });
  });

  // FIX-3 (review F3, F4, F6, F7, F10): while the FIRST create is in flight the hint says so (the
  // event is not made yet), Open is ABSENT (the event may not exist), Create spins. FIX-4 F3 + F9:
  // once the create is CONFIRMED but its date and first session still run, Open stays ABSENT (a tap
  // would race the schedule) and the hint says "finishing", never "press Create" (Create is busy).
  // When the run ends (here: its date is refused) Open mounts BELOW Create, enabled. The held calls
  // are released and the follow-up awaited, so nothing runs into the next test's mockReset.
  it('while the first create is in flight: chips disabled with the creating hint, no Open; confirmed but still running: no Open, the finishing hint; idle: Open below Create, enabled', async () => {
    const gates: Array<() => void> = [];
    let n = 0;
    handlers.series_command_p5 = () => {
      n += 1;
      if (n === 1) return new Promise((resolve) => gates.push(() => resolve({ ok: true, new_version: 4 }))); // the create
      if (n === 2) return new Promise((_resolve, reject) => gates.push(() => reject({ message: 'invalid_payload: rule refused', code: 'P0001' }))); // its date
      return { ok: true, new_version: 4 };
    };
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'Saturday Party' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    for (const chip of ['class', 'party', 'workshop']) expect((screen.getByTestId(`org-new-event-type-${chip}`) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('org-new-event-open')).toBeNull();
    const create = screen.getByTestId('org-new-event-create') as HTMLButtonElement;
    fireEvent.click(create);
    await waitFor(() => expect(gates).toHaveLength(1));
    expect(create.getAttribute('aria-busy')).toBe('true');
    for (const chip of ['class', 'party', 'workshop']) expect((screen.getByTestId(`org-new-event-type-${chip}`) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-new-event-type-hint').textContent).toBe('Creating your event\u2026');
    expect(screen.queryByTestId('org-new-event-open')).toBeNull();
    gates[0]();
    await waitFor(() => expect(gates).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId('org-new-event-type-hint').textContent).toBe('Finishing your event\u2026'));
    expect(create.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByTestId('org-new-event-open')).toBeNull();
    gates[1]();
    const open = await screen.findByTestId('org-new-event-open') as HTMLButtonElement;
    expect(create.getAttribute('aria-busy')).toBeNull();
    expect(open.disabled).toBe(false);
    expect(create.compareDocumentPosition(open) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('org-new-event-type-hint').textContent).toBe(CHIPS_LOCKED_HINT);
    fireEvent.click(open);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
  });

  // FIX-3 (review F1 + F2): the create is frozen the moment it is SENT. A lost reply may have saved
  // the event server-side, so the name, the three chips and the organiser chips stay disabled for
  // the life of the page, and every later press sends the IDENTICAL create (same name, organiser,
  // city, start date, duration, key) and the schedule computed at the first press: nothing is re-read.
  const twoOrganisers = () => {
    const base = home();
    handlers.organiser_home_v1 = () => ({ ...base, organisers: [base.organisers[0], { ...base.organisers[0], id: 'org2', name: 'Salsa Crew', city_id: 'c2' }] });
  };
  const organiserChips = () => screen.getAllByTestId('org-new-event-organiser') as HTMLButtonElement[];
  it('a lost create reply freezes name, chips and organiser; the retry sends the identical create even after London midnight and another chip', async () => {
    twoOrganisers();
    let n = 0;
    handlers.series_command_p5 = () => {
      n += 1;
      if (n <= 2) throw new TypeError('fetch failed'); // the create's reply is lost, twice
      return { ok: true, new_version: 4 };
    };
    const client = mount('/account/o/events/new');
    const name = await screen.findByTestId('org-new-event-name') as HTMLTextAreaElement;
    fireEvent.change(name, { target: { value: 'Saturday Party' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    expect(organiserChips().map((o) => o.disabled)).toEqual([false, false]);
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).toMatch(/could not confirm the save/);
    // Frozen, with the reason on screen; the event may not exist, so nothing offers to open it.
    expect(name.disabled).toBe(true);
    for (const chip of ['class', 'party', 'workshop']) expect((screen.getByTestId(`org-new-event-type-${chip}`) as HTMLButtonElement).disabled).toBe(true);
    expect(organiserChips().map((o) => o.disabled)).toEqual([true, true]);
    expect(screen.getByTestId('org-new-event-type-hint').textContent).toBe('Not confirmed yet. Press Create to finish: nothing is made twice.');
    expect(screen.queryByTestId('org-new-event-open')).toBeNull();
    // London midnight passes, and the person tries another chip and another organiser (both disabled).
    // The page re-reads the London date only when it renders: Home is refetched with the new
    // date, so the form really holds 9 Oct before the next press.
    londonToday.value = '2026-10-09';
    const homeBefore = handlers.organiser_home_v1;
    handlers.organiser_home_v1 = (a) => ({ ...(homeBefore(a) as object), today: '2026-10-09' });
    await act(async () => { await client.invalidateQueries(); });
    fireEvent.click(screen.getByTestId('org-new-event-type-class'));
    fireEvent.click(organiserChips()[1]);
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(commands()).toHaveLength(2));
    const [first, second] = commands();
    expect(first.command.payload).toMatchObject({ name: 'Saturday Party', default_duration_minutes: 300, default_start_date: '2026-10-15', default_city_id: 'c1' });
    expect(second).toEqual(first);
    expect(screen.getByTestId('org-new-event-type-hint').textContent).toBe('Not confirmed yet. Press Create to finish: nothing is made twice.');
    // The third press is confirmed: the same create again, then the schedule computed at the FIRST press.
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    const [, , third, schedule] = commands();
    expect(third).toEqual(first);
    expect(schedule.command).toEqual({ kind: 'series.add_date', payload: { date: '2026-10-15' } });
    expect(commands()).toHaveLength(4);
  });

  it('a REFUSED first create (nothing saved) leaves name, chips and organiser open; the retry may change them, under the same key', async () => {
    twoOrganisers();
    let n = 0;
    handlers.series_command_p5 = () => {
      n += 1;
      if (n === 1) throw { message: 'permission_denied: series.upsert (create) needs a live organiser', code: 'P0001' };
      return { ok: true, new_version: 4 };
    };
    mount('/account/o/events/new');
    const name = await screen.findByTestId('org-new-event-name') as HTMLTextAreaElement;
    fireEvent.change(name, { target: { value: 'Saturday Party' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await screen.findByTestId('org-new-event-error');
    expect(name.disabled).toBe(false);
    for (const chip of ['class', 'party', 'workshop']) expect((screen.getByTestId(`org-new-event-type-${chip}`) as HTMLButtonElement).disabled).toBe(false);
    expect(organiserChips().map((o) => o.disabled)).toEqual([false, false]);
    expect(screen.getByTestId('org-new-event-type-hint').textContent).toBe(EVENT_TYPES.find((t) => t.type === 'party')?.hint);
    expect(screen.queryByTestId('org-new-event-open')).toBeNull();
    fireEvent.change(name, { target: { value: 'Thursday Class' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-class'));
    fireEvent.click(organiserChips()[1]);
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    const [refused, retried] = commands().filter((c) => c.command.kind === 'series.upsert');
    expect(refused.command.payload).toMatchObject({ name: 'Saturday Party', default_duration_minutes: 300, default_city_id: 'c1' });
    expect(retried.command.payload).toMatchObject({ name: 'Thursday Class', default_duration_minutes: 120, default_city_id: 'c2' });
    // Key handling is unchanged: one key per write for the life of the page.
    expect(retried.idempotency_key).toBe(refused.idempotency_key);
    expect(retried.target_id).toBe(refused.target_id);
  });

  // FIX-4 F1 (data integrity): the form reopens only when nothing can have been saved -- the press
  // that failed was the FIRST send and the server refused it, with no earlier send unconfirmed. A
  // coded error on a RESEND (JWT expiry PGRST301, timeout 57014, 40001) proves nothing about the
  // earlier send, which may have saved the event: the form stays frozen and the next press sends
  // the byte-equal create (the server replays a stored create under its key without comparing it).
  // Each step is one series_command_p5 call: 'lost' = no reply, 'ok', or a coded refusal.
  type Step = 'lost' | 'ok' | { message: string; code: string };
  const coded = (code: string): Step => ({ message: `${code}: refused`, code });
  it.each([
    ['(a) lost reply, then the retry gets PGRST301', ['lost', coded('PGRST301')], 2, true],
    ['(a) lost reply, then the retry gets 57014', ['lost', coded('57014')], 2, true],
    ['(a) lost reply, then the retry gets 40001', ['lost', coded('40001')], 2, true],
    ['(b) the first press refused with a code: nothing saved', [coded('P0001')], 1, false],
    ['(b) the first press refused with PGRST301: nothing saved', [coded('PGRST301')], 1, false],
    ['(c) first refused, second lost, third coded', [coded('P0001'), 'lost', coded('PGRST301')], 3, true],
    ['(d) confirmed, its date refused, the replay refused with a code', ['ok', coded('P0001'), coded('57014')], 2, true],
  ] as Array<[string, Step[], number, boolean]>)('%s', async (_n, script, presses, frozen) => {
    twoOrganisers();
    let i = 0;
    handlers.series_command_p5 = () => {
      const step = script[i++] ?? 'ok';
      if (step === 'ok') return { ok: true, new_version: 4 };
      if (step === 'lost') throw new TypeError('fetch failed');
      throw step;
    };
    const client = mount('/account/o/events/new');
    const name = await screen.findByTestId('org-new-event-name') as HTMLTextAreaElement;
    const create = screen.getByTestId('org-new-event-create') as HTMLButtonElement;
    const creates = () => commands().filter((c) => c.command.kind === 'series.upsert');
    for (let p = 1; p <= presses; p += 1) {
      // Whatever is still open, the person changes before each press.
      if (!name.disabled) fireEvent.change(name, { target: { value: `Night ${p}` } });
      fireEvent.click(screen.getByTestId(`org-new-event-type-${p % 2 ? 'party' : 'class'}`));
      const before = creates().length;
      fireEvent.click(create);
      await waitFor(() => expect(creates().length).toBe(before + 1));
      await waitFor(() => expect(create.getAttribute('aria-busy')).toBeNull());
    }
    await screen.findByTestId('org-new-event-error');
    expect(name.disabled).toBe(frozen);
    for (const chip of ['class', 'party', 'workshop']) expect((screen.getByTestId(`org-new-event-type-${chip}`) as HTMLButtonElement).disabled).toBe(frozen);
    expect(organiserChips().map((o) => o.disabled)).toEqual([frozen, frozen]);
    if (!frozen) return;
    // Frozen: another chip and organiser do nothing, and the next press resends the last create byte for byte.
    const last = creates()[creates().length - 1];
    // London midnight passes (Home refetched with the new date): a create recomputed from the
    // form would start a day later, so only the kept create can be byte-equal.
    londonToday.value = '2026-10-09';
    const homeBefore = handlers.organiser_home_v1;
    handlers.organiser_home_v1 = (a) => ({ ...(homeBefore(a) as object), today: '2026-10-09' });
    await act(async () => { await client.invalidateQueries(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    fireEvent.click(screen.getByTestId('org-new-event-type-workshop'));
    fireEvent.click(organiserChips()[1]);
    fireEvent.click(create);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    const resent = creates()[creates().length - 1];
    expect(creates()).toHaveLength(presses + 1);
    expect(JSON.stringify(resent)).toBe(JSON.stringify(last));
  });

  // FIX-4 F2: Home refetches on focus; a failed refetch must not swap the form for the error state
  // once Home has loaded: the unmount would lose the sent create, its key and series id, and the
  // next Create would make a second event. The error state shows only when there is nothing to show.
  it('a failed Home refetch after a lost-reply send keeps the form mounted; the next press sends the SAME key and series id', async () => {
    let n = 0;
    handlers.series_command_p5 = () => {
      n += 1;
      if (n === 1) throw new TypeError('fetch failed');
      return { ok: true, new_version: 4 };
    };
    const client = mount('/account/o/events/new');
    const name = await screen.findByTestId('org-new-event-name') as HTMLTextAreaElement;
    fireEvent.change(name, { target: { value: 'Saturday Party' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).toMatch(/could not confirm the save/);
    handlers.organiser_home_v1 = () => { throw { message: 'JWT expired', code: 'PGRST301' }; };
    await act(async () => { await client.invalidateQueries(); });
    // React Query notifies subscribers on a later macrotask: let the page re-render with the error.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(client.getQueryCache().findAll().some((q) => q.state.status === 'error' && q.state.data !== undefined)).toBe(true);
    expect(screen.getByTestId('org-new-event-form')).toBeTruthy();
    expect((screen.getByTestId('org-new-event-name') as HTMLTextAreaElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    const [first, second] = commands();
    expect(second.idempotency_key).toBe(first.idempotency_key);
    expect(second.target_id).toBe(first.target_id);
    expect(second).toEqual(first);
  });

  it('Home that never loaded still shows the error state with retry', async () => {
    handlers.organiser_home_v1 = () => { throw { message: 'JWT expired', code: 'PGRST301' }; };
    mount('/account/o/events/new');
    await waitFor(() => expect(screen.queryByTestId('org-new-event-form')).toBeNull());
    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeTruthy();
  });

  // FIX-4 F5: the organiser becomes blocked (a Home refetch) while a create is sent but not
  // confirmed: Create is disabled, the chips frozen. The one exit is the shell's back link, so a
  // note under the block names it as it reads. Before a send there is nothing to find; once the
  // create is confirmed Open the event is the way on. One row per phase.
  it.each([
    ['open: nothing sent', [] as Step[], 0, false],
    ['sent: a lost reply', ['lost'] as Step[], 1, true],
    ['made: its date refused', ['ok', coded('P0001')] as Step[], 1, false],
  ])('blocked after a Home refetch, %s', async (_n, script, presses, note) => {
    let i = 0;
    handlers.series_command_p5 = () => {
      const step = script[i++] ?? 'ok';
      if (step === 'ok') return { ok: true, new_version: 4 };
      if (step === 'lost') throw new TypeError('fetch failed');
      throw step;
    };
    const client = mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'Saturday Party' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    const create = screen.getByTestId('org-new-event-create') as HTMLButtonElement;
    for (let p = 0; p < presses; p += 1) {
      fireEvent.click(create);
      await screen.findByTestId('org-new-event-error');
      await waitFor(() => expect(create.getAttribute('aria-busy')).toBeNull());
    }
    const base = home();
    handlers.organiser_home_v1 = () => ({ ...base, organisers: [{ ...base.organisers[0], lifecycle_status: 'pending_review' }] });
    await act(async () => { await client.invalidateQueries(); });
    await screen.findByTestId('org-new-event-block');
    expect(create.disabled).toBe(true);
    const shown = screen.queryByTestId('org-new-event-unconfirmed-exit');
    if (!note) { expect(shown).toBeNull(); return; }
    const back = screen.getByTestId('org-back');
    expect(shown?.textContent).toBe(unconfirmedExitNote(back.textContent ?? ''));
    expect(shown?.textContent).toContain(`use ${back.textContent} at the top`);
  });

  // FIX-3 (review F11): the unsaved-changes guard contradicts "saved as a draft" once the event
  // exists. It stays ON while the create is not confirmed (the draft may not exist) and goes OFF
  // the moment the create is confirmed, whatever later step fails.
  it('the leave guard stays on while the create is not confirmed, and goes off once the event is made', async () => {
    let n = 0;
    handlers.series_command_p5 = () => {
      n += 1;
      if (n === 1) throw new TypeError('fetch failed'); // lost reply
      if (n === 3) throw { message: 'invalid_payload: rule refused', code: 'P0001' }; // the date, after the confirmed create
      return { ok: true, new_version: 4 };
    };
    const asks = () => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; };
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'Saturday Party' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    expect(asks()).toBe(true);
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).toMatch(/could not confirm the save/);
    expect(asks()).toBe(true);
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('org-new-event-error').textContent).toMatch(/date was not listed/));
    expect(asks()).toBe(false);
    expect(screen.getByTestId('org-new-event-type-hint').textContent).toBe(CHIPS_LOCKED_HINT);
  });

  // FIX-3 fix 6 (review F9): the editor's `next` and the create's seed date are ONE helper
  // (seriesModel.firstListedDate); a cancelled first date is skipped identically in both.
  it('the editor\'s next date and the create\'s seed date skip a cancelled date through the one shared helper', async () => {
    const dates = [
      { id: 'o2', occurrence_date: '2026-10-16', lifecycle_status: 'scheduled', version: 1 },
      { id: 'o1', occurrence_date: '2026-10-09', lifecycle_status: 'cancelled', version: 1 },
      { id: 'o0', occurrence_date: '2026-10-02', lifecycle_status: 'scheduled', version: 1 },
    ];
    (globalThis as { setWorkspace?: (w: ReturnType<typeof rawWorkspace>) => void }).setWorkspace!(rawWorkspace({}, dates));
    vi.mocked(firstListedDate).mockClear();
    await editor();
    // The card's date is its section label, outside the org-schedule box.
    await waitFor(() => expect(screen.getByTestId('org-schedule').closest('section')?.textContent).toContain('16 Oct'));
    expect(firstListedDate).toHaveBeenCalled();
    const nextResults = vi.mocked(firstListedDate).mock.results;
    expect((nextResults[nextResults.length - 1]?.value as { id?: string } | null)?.id).toBe('o2');
    cleanup();
    vi.mocked(firstListedDate).mockClear();
    handlers.organiser_get_occurrence_programme_v1 = () => ({ ...programme, occurrence_id: 'o2', occurrence_date: '2026-10-16', sessions: [], session_people: [] });
    handlers.organiser_set_occurrence_programme_v1 = () => ({ ok: true, changed: true, version: 3, sessions: [] });
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'New night' } });
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    expect(setCalls().map((c) => c.p_occurrence_id)).toEqual(['o2']);
    expect(firstListedDate).toHaveBeenCalledTimes(1);
    expect((vi.mocked(firstListedDate).mock.results[0]?.value as { id?: string } | null)?.id).toBe('o2');
  });

  it('asks for a name instead of sending a blank one', async () => {
    mount('/account/o/events/new');
    fireEvent.click(await screen.findByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).toBe('Give your event a name.');
    expect(commands()).toHaveLength(0);
  });

  // Two prod users run several organisers. The public page's Create event passes
  // ?o=<organiser id> (useOrganiserChoice's shape): that organiser is preselected,
  // so the draft lands on the page the person came from.
  it.each([
    ['?o=org2 picks the second organiser', '?o=org2', 'org2'],
    ['no ?o keeps the default (the live one)', '', 'org1'],
    ['an ?o that is not one of mine is ignored', '?o=someone-else', 'org1'],
  ])('%s', async (_n, query, expected) => {
    const base = home();
    handlers.organiser_home_v1 = () => ({ ...base, organisers: [base.organisers[0], { ...base.organisers[0], id: 'org2', name: 'Salsa Crew', city_id: 'c2' }] });
    mount(`/account/o/events/new${query}`);
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'Tuesday Class' } });
    const chosen = screen.getAllByTestId('org-new-event-organiser').find((b) => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true');
    expect(chosen?.textContent).toBe(expected === 'org2' ? 'Salsa Crew' : 'Latin Nights');
    fireEvent.click(screen.getByTestId('org-new-event-type-party'));
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(commands().length).toBeGreaterThan(0));
    // Nothing else: the create flow still only creates a DRAFT (series.upsert, no publish).
    expect(commands()[0].command.kind).toBe('series.upsert');
    expect(JSON.stringify(commands()[0])).toContain(expected === 'org2' ? '"c2"' : '"c1"');
  });

  it('shows the plain server message when the create is refused', async () => {
    handlers.series_command_p5 = () => { throw { message: 'permission_denied: series.upsert (create) needs a live organiser', code: 'P0001' }; };
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).not.toMatch(/permission_denied/);
  });
});

describe('event editor', () => {
  it('shows only the owner-ticked rows, in order', async () => {
    const el = await editor();
    const text = el.textContent ?? '';
    for (const word of ['price', 'Price', 'capacity', 'Capacity', 'approval', 'Approval', 'Timezone', 'Instagram', 'Level', 'Start time', 'Duration']) {
      expect(text).not.toContain(word);
    }
    const ids = [...el.querySelectorAll('[data-testid^="org-row-"], [data-testid="org-event-name"], [data-testid="org-cover"], [data-testid="org-schedule"], [data-testid="org-styles"], [data-testid="org-dates"]')]
      .map((n) => n.getAttribute('data-testid'))
      .filter((id) => !id?.endsWith('-value') && !id?.endsWith('-open'));
    expect(ids).toEqual([
      // Owner-approved order (2026-10-08): what it is, when, where, what people see, programme, links, who runs it.
      'org-event-name', 'org-cover', 'org-row-gallery', 'org-row-type', 'org-row-starts', 'org-row-repeats', 'org-row-until', 'org-dates',
      'org-row-venue', 'org-row-description', 'org-styles', 'org-row-video', 'org-schedule', 'org-row-ticket',
      'org-row-organisers',
    ]);
  });

  it('the schedule card shows the next date\u2019s sessions with their people, read-only, and opens the date', async () => {
    await editor();
    const rows = await screen.findAllByTestId('org-schedule-session');
    expect(rows[0].textContent).toContain('Class: Beginners');
    expect(rows[0].textContent).toContain('Ana Ruiz, Cleo Park');
    expect(rows[0].textContent).toContain('20:00\u201321:00');
    expect(rows[1].textContent).toContain('DJ Sol');
    fireEvent.click(rows[0]);
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/s1/dates/o1');
  });

  it('shows the organisers of the event', async () => {
    await editor();
    await waitFor(() => expect(screen.getByTestId('org-row-organisers-value').textContent).toBe('Latin Nights'));
  });

  it('lists upcoming dates and keeps past dates collapsed', async () => {
    await editor();
    const dates = screen.getAllByTestId('org-date-row').map((r) => r.getAttribute('data-date'));
    expect(dates).toEqual(['2026-10-09', '2026-10-16']);
    fireEvent.click(screen.getByTestId('org-dates-past-toggle'));
    expect(await screen.findByTestId('org-dates-past')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('org-date-row')[0]);
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/s1/dates/o1');
  });

  it('nothing unsaved: a slim bar (one line + the disabled button); an edit brings the public card, ONE primary and the live note', async () => {
    await editor();
    expect(screen.getByTestId('org-preview-bar').getAttribute('data-compact')).toBe('true');
    expect(screen.getByTestId('org-preview-bar-summary').textContent).toBe('All changes saved');
    expect(screen.queryByTestId('org-card-preview')).toBeNull();
    expect((screen.getByTestId('org-preview-bar-action') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: 'Friday Party!' } });
    const bar = screen.getByTestId('org-preview-bar');
    expect(within(bar).getByTestId('org-card-preview').textContent).toContain('Friday Party');
    expect(within(bar).getByTestId('org-card-preview').textContent).toContain('Fri 9 Oct');
    expect(bar.textContent).toContain(LIVE_NOTE);
    expect((screen.getByTestId('org-preview-bar-action') as HTMLButtonElement).disabled).toBe(false);
    expect(document.querySelectorAll('.bg-\\[var\\(--btn\\)\\]:not([aria-label])').length).toBe(1);
  });

  it('a draft event shows no live note', async () => {
    handlers.admin_event_workspace_p5 = () => rawWorkspace({ lifecycle_status: 'draft' });
    await editor();
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: 'Friday Party!' } });
    expect(screen.getByTestId('org-preview-bar').textContent).not.toContain(LIVE_NOTE);
  });

  it('name: edits in the big title, previews, and saves only the name', async () => {
    await editor();
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: 'Friday Fiesta' } });
    expect(screen.getByTestId('org-card-preview').textContent).toContain('Friday Fiesta');
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0]).toMatchObject({ expected_version: 3, command: { kind: 'series.upsert', payload: { name: 'Friday Fiesta' } } });
  });

  it('description and ticket link: edited in the sheet and saved', async () => {
    await editor();
    fireEvent.click(screen.getByTestId('org-row-description'));
    fireEvent.change(await screen.findByTestId('org-description-input'), { target: { value: 'Beginners welcome' } });
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    fireEvent.click(screen.getByTestId('org-row-ticket'));
    fireEvent.change(await screen.findByTestId('org-ticket-input'), { target: { value: 'https://tickets.example/x' } });
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_description: 'Beginners welcome', default_ticket_url: 'https://tickets.example/x' });
  });

  it('place: the sheet has a search view; picking sets the venue and its city', async () => {
    await editor();
    await waitFor(() => expect(screen.getByTestId('org-row-venue-value').textContent).toBe('Studio One'));
    fireEvent.click(screen.getByTestId('org-row-venue'));
    fireEvent.click(await screen.findByTestId('org-venue-search-open'));
    fireEvent.change(await screen.findByTestId('org-venue-query'), { target: { value: 'salsa' } });
    const results = within(sheet()).getAllByTestId('org-venue-result');
    expect(results).toHaveLength(1);
    fireEvent.click(results[0]);
    expect(await screen.findByTestId('org-sheet-venue')).toBeTruthy();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_venue_id: 'v2', default_city_id: 'c-edinburgh' });
  });

  it('music styles: tap chips', async () => {
    await editor();
    const chips = screen.getAllByTestId('org-style-chip');
    const salsa = chips.find((c) => c.textContent?.includes('Salsa') && !c.textContent.includes('Bachata'))!;
    fireEvent.click(salsa);
    expect(salsa.getAttribute('aria-pressed')).toBe('true');
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_music_styles: ['Bachata', 'Salsa'] });
  });

  it('gallery and video: summary rows open the sheet; remove a photo, add a video', async () => {
    await editor();
    expect(screen.getByTestId('org-row-gallery-value').textContent).toBe('1 photo');
    fireEvent.click(screen.getByTestId('org-row-gallery'));
    fireEvent.click(await screen.findByTestId('org-gallery-remove'));
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    fireEvent.click(screen.getByTestId('org-row-video'));
    fireEvent.change(await screen.findByTestId('org-video-input'), { target: { value: 'https://youtu.be/abc' } });
    fireEvent.click(screen.getByTestId('org-video-add'));
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_gallery: [], default_video_urls: ['https://youtu.be/abc'] });
  });

  it('removing a photo fades and collapses the tile before it unmounts; Done mid-fade still saves it', async () => {
    await editor();
    fireEvent.click(screen.getByTestId('org-row-gallery'));
    const tile = await screen.findByTestId('org-gallery-tile');
    expect(tile.getAttribute('data-state')).toBe('open');
    fireEvent.click(screen.getByTestId('org-gallery-remove'));
    // Still drawn while it leaves (no instant jump), and its button is off.
    expect(screen.getByTestId('org-gallery-tile').getAttribute('data-state')).toBe('closing');
    expect((screen.getByTestId('org-gallery-remove') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-gallery-tile').style.height).toBe('0px');
    expect(screen.getByTestId('org-gallery-tile').style.opacity).toBe('0');
    await waitFor(() => expect(screen.queryByTestId('org-gallery-tile')).toBeNull());
    expect(screen.getByTestId('org-sheet-gallery').textContent).toContain('No photos yet');
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    expect(screen.getByTestId('org-row-gallery-value').textContent).not.toBe('1 photo');
  });

  it('a video removed and the sheet closed mid-fade is still gone from the save', async () => {
    await editor();
    fireEvent.click(screen.getByTestId('org-row-video'));
    fireEvent.change(await screen.findByTestId('org-video-input'), { target: { value: 'https://youtu.be/abc' } });
    fireEvent.click(screen.getByTestId('org-video-add'));
    fireEvent.change(screen.getByTestId('org-video-input'), { target: { value: 'https://youtu.be/def' } });
    fireEvent.click(screen.getByTestId('org-video-add'));
    await waitFor(() => expect(screen.getAllByTestId('org-video-row')).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId('org-video-remove')[0]);
    expect(screen.getAllByTestId('org-video-row')[0].getAttribute('data-state')).toBe('closing');
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_video_urls: ['https://youtu.be/def'] });
  });

  it('dates: Listed until shows the cap, offers only choices within 30, and Extend adds the next 8', async () => {
    await editor();
    expect(screen.getByTestId('org-row-until').textContent).toContain('Listed until Fri 27 Nov');
    expect(screen.getByTestId('org-row-until').textContent).toContain('Up to 30 upcoming dates');
    fireEvent.click(screen.getByTestId('org-row-until-open'));
    const choices = within(await screen.findByTestId('org-sheet-until')).getAllByTestId('org-until-choice');
    expect(choices.map((c) => c.textContent?.match(/^\d+/)?.[0])).toEqual(['4', '8', '12', '16', '26', '30']);
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    fireEvent.click(screen.getByTestId('org-extend'));
    expect(screen.getByTestId('org-row-until').textContent).toContain('Listed until Fri 22 Jan');
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command).toEqual({ kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2027-01-22' } } });
  });

  it('Extend is off at 30 upcoming dates', async () => {
    handlers.admin_event_workspace_p5 = () => rawWorkspace({ recurrence_rule: { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2027-04-30' } } });
    await editor();
    expect((screen.getByTestId('org-extend') as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts on + repeats: moving the start re-picks an end inside the cap; one date stops repeating (a draft)', async () => {
    // A live repeating event cannot become one date (the server's format/recurrence check): see the F4 matrix (4b).
    handlers.admin_event_workspace_p5 = () => rawWorkspace({ lifecycle_status: 'draft' });
    await editor();
    fireEvent.click(screen.getByTestId('org-row-starts'));
    fireEvent.change(await screen.findByTestId('org-starts-input'), { target: { value: '2026-10-13' } });
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    expect(screen.getByTestId('org-row-repeats-value').textContent).toBe('Every Tuesday');
    fireEvent.click(screen.getByTestId('org-row-repeats'));
    fireEvent.click(await screen.findByTestId('org-shape-single'));
    // Dates would go: the sheet says how many and asks for the tick first (walk bug 7).
    const confirm = await screen.findByTestId('org-one-date-confirm');
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('org-one-date-consequence').textContent).toMatch(/\d+ other dates? listed now go off/);
    fireEvent.click(screen.getByTestId('org-one-date-ack'));
    fireEvent.click(confirm);
    expect(screen.getByTestId('org-row-repeats-value').textContent).toBe('One date');
    // The card says the pending choice, not the old run.
    expect(screen.getByTestId('org-row-until').textContent).toMatch(/^Only .*Save to take off the other/);
    expect(screen.getByTestId('org-date-card').textContent).not.toMatch(/Listed until|Up to 30/);
    save();
    await waitFor(() => expect(commands().length).toBeGreaterThanOrEqual(2));
    expect(commands().map((c) => c.command.kind)).toEqual(['series.upsert', 'series.stop_repeating', 'series.add_date']);
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_start_date: '2026-10-13' });
    expect(commands()[1].expected_version).toBe(4);
  });

  it('G1: a draft shows what it still needs, then sends for review and reads In review', async () => {
    let status = 'draft';
    let missing: string[] = ['venue'];
    let added = 0;
    let cover: string | null = null;
    handlers.admin_event_workspace_p5 = () => rawWorkspace({ lifecycle_status: status, default_cover_image_url: cover }, [
      { id: 'o2', occurrence_date: '2026-10-16', lifecycle_status: 'scheduled', version: 1 },
      { id: 'o1', occurrence_date: '2026-10-09', lifecycle_status: 'scheduled', version: 1, added_sessions_count: added },
    ]);
    handlers.event_publish_readiness_v1 = () => ({ ok: missing.length === 0, missing });
    handlers.series_command_p5 = () => { status = 'pending_review'; return { ok: true, new_version: 4 }; };
    await editor();
    const send = await screen.findByTestId('org-event-review-send');
    await waitFor(() => expect(screen.getByTestId('org-event-review-blocked').textContent).toMatch(/To send it, add a venue/));
    expect((send as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    missing = [];
    // Owner, 2026-10-08: no session on any upcoming date -> still off, with the reason.
    await editor();
    const noSession = await screen.findByTestId('org-event-review-send');
    await waitFor(() => expect(screen.getByTestId('org-event-review-blocked').textContent).toBe('Add at least one session first. Add a cover image first.'));
    expect((noSession as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    added = 1;
    // Owner, 2026-10-08: a session but no cover image -> still off, with that reason.
    await editor();
    const noCover = await screen.findByTestId('org-event-review-send');
    await waitFor(() => expect(screen.getByTestId('org-event-review-blocked').textContent).toBe('Add a cover image first.'));
    expect((noCover as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    cover = 'https://cdn.example/poster.webp';
    await editor();
    const ready = await screen.findByTestId('org-event-review-send');
    await waitFor(() => expect((ready as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(ready);
    fireEvent.click(await screen.findByTestId('org-event-review-yes'));
    await waitFor(() => expect(commands().map((c) => c.command)).toEqual([{ kind: 'series.set_lifecycle', payload: { to: 'pending_review' } }]));
    await waitFor(() => expect(screen.getByTestId('org-event-status').textContent).toBe('In review'));
    expect(screen.getByTestId('org-event-review-sentence').textContent).toMatch(/checking it/);
    expect(screen.queryByTestId('org-event-review-send')).toBeNull();
  });

  it('6: a junk ticket link is refused in its sheet (Done disabled, reason shown), not at Save', async () => {
    await editor();
    fireEvent.click(screen.getByTestId('org-row-ticket'));
    fireEvent.change(await screen.findByTestId('org-ticket-input'), { target: { value: 'tickets dot com' } });
    expect(screen.getByTestId('org-ticket-problem').textContent).toMatch(/full address starting with https/);
    expect((screen.getByTestId('org-sheet-done') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('org-ticket-input'), { target: { value: 'https://tix.example/a' } });
    expect(screen.queryByTestId('org-ticket-problem')).toBeNull();
    expect((screen.getByTestId('org-sheet-done') as HTMLButtonElement).disabled).toBe(false);
  });

  it('11: the description sheet counts toward its 4,000 limit', async () => {
    await editor();
    fireEvent.click(screen.getByTestId('org-row-description'));
    fireEvent.change(await screen.findByTestId('org-description-input'), { target: { value: 'abc' } });
    expect(screen.getByTestId('org-description-count').textContent).toBe('3 of 4,000 characters');
  });

  it('a failed save shakes and shows the plain message; the edit stays', async () => {
    handlers.series_command_p5 = () => { throw { message: 'version_conflict: stale', code: 'P0001' }; };
    await editor();
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: 'Friday Fiesta' } });
    save();
    const msg = await screen.findByTestId('org-save-error');
    expect(msg.textContent).not.toMatch(/version_conflict/);
    expect(msg.textContent!.length).toBeGreaterThan(10);
    expect((screen.getByTestId('org-event-name') as HTMLInputElement).value).toBe('Friday Fiesta');
  });

  it('reads the current value before overwriting: a field changed elsewhere is not overwritten', async () => {
    await editor();
    fireEvent.click(screen.getByTestId('org-row-description'));
    fireEvent.change(await screen.findByTestId('org-description-input'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    (globalThis as { setWorkspace?: (w: ReturnType<typeof rawWorkspace>) => void }).setWorkspace!(rawWorkspace({ default_description: 'Theirs', version: 5 }));
    save();
    expect((await screen.findByTestId('org-save-error')).textContent).toMatch(/Someone else changed the description/);
    expect(commands()).toHaveLength(0);
  });

  it('asks before leaving with unsaved changes', async () => {
    await editor();
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: 'Changed' } });
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('loading shows skeleton rows; a load failure shows retry', async () => {
    handlers.admin_event_workspace_p5 = () => { throw { message: 'permission_denied' }; };
    mount('/account/o/events/s1');
    expect(screen.getByTestId('org-editor-loading')).toBeTruthy();
    expect(await screen.findByTestId('org-editor-error')).toBeTruthy();
  });

  it('someone else\'s event: the refusal says there is no access, not "check your connection" (walk 7b)', async () => {
    handlers.admin_event_workspace_p5 = () => { throw { message: 'permission_denied', code: 'P0001' }; };
    mount('/account/o/events/s1');
    const err = await screen.findByTestId('org-editor-error');
    expect(err.textContent).toMatch(/do not have access to this event/i);
    expect(err.textContent).not.toMatch(/connection/i);
    expect(screen.queryByTestId('org-editor-error-retry')).toBeNull();
  });

  it('a network failure still offers the retry with the connection copy', async () => {
    handlers.admin_event_workspace_p5 = () => { throw new TypeError('Failed to fetch'); };
    mount('/account/o/events/s1');
    const err = await screen.findByTestId('org-editor-error');
    expect(err.textContent).toMatch(/connection/i);
    expect(screen.getByTestId('org-editor-error-retry')).toBeTruthy();
  });
});

void TODAY;
