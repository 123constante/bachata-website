// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPES } from './wsFixtures';
import { L } from '../../model';
import { PROGRAMME_WHY } from '../../model/programme';
import { CHANGED_SESSION_REMOVE_CONFIRM } from '../../../events/programmeSeriesModel';

/*
 * W2d through the REAL send paths: session sheet -> data/sessions -> useSendOnce ->
 * runSeriesCommand -> envelope (series.set_program), and -> saveOccurrenceProgramme
 * (organiser_set_occurrence_programme_v1). Only supabase is stood in for.
 */

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';
import { LineupSheet } from '../LineupSheet';

const ROOMS = [{ id: 'r1', name: 'Main room', sort_order: 0 }, { id: 'r2', name: 'Studio', sort_order: 1 }];
beforeEach(() => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is']) chain[m] = () => chain;
  chain.order = async () => ({ data: ROOMS, error: null });
  from.mockReturnValue(chain);
});
afterEach(() => { cleanup(); rpc.mockReset(); });

let qc: QueryClient;
function show() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/p3/events/ser-1']}>
        <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The 2026-10-30 date programme of the weekly shape, as organiser_get_occurrence_programme_v1 sends it. */
const DATE_PROG = {
  occurrence_id: 'o-2026-10-30', series_id: 'ser-1', occurrence_date: '2026-10-30', version: 4, editable: true, not_editable_reason: null,
  sessions: [
    { series_item_id: 'cls', type: 'class', title: 'Bachata class', start_time: '20:00:00', end_time: '21:00:00', ends_next_day: false, level_keys: ['open_level'], removed: false },
    { series_item_id: 'pty', type: 'party', title: 'Night party', start_time: '21:00:00', end_time: '01:00:00', ends_next_day: true, level_keys: [], removed: false },
  ],
  session_people: [
    { series_item_id: 'cls', people: [{ profile_id: 'p-cls-0', display_name: 'Marco & Elena', role: 'teaching' }] },
    { series_item_id: 'pty', people: [{ profile_id: 'p-pty-0', display_name: 'DJ Kizzy', role: 'djing' }, { profile_id: 'p-pty-1', display_name: 'Host Sam', role: 'mc' }] },
  ],
};

function server(over: Partial<Record<string, (args: Record<string, unknown>) => unknown>> = {}, shape: keyof typeof SHAPES = 'weekly') {
  const calls: Array<[string, Record<string, unknown>]> = [];
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    calls.push([name, args]);
    if (over[name]) return over[name]!(args);
    if (name === 'admin_event_workspace_p5') return { data: SHAPES[shape], error: null };
    if (name === 'organiser_get_occurrence_programme_v1') return { data: DATE_PROG, error: null };
    if (name === 'series_command_p5') return { data: { ok: true, new_version: 8 }, error: null };
    if (name === 'organiser_set_occurrence_programme_v1') return { data: { ok: true, changed: true, version: 5, sessions: [] }, error: null };
    if (name === 'organiser_search_people_v1') return { data: [{ id: 'p-new', display_name: 'Maria Lopez', dj_name: null, photo_url: null, city_name: 'Leeds', country_code: 'GB' }], error: null };
    return { data: null, error: null };
  });
  return calls;
}

const envs = (calls: Array<[string, Record<string, unknown>]>) => calls.filter(([n]) => n === 'series_command_p5').map(([, a]) => a.p_envelope as Record<string, unknown>);

async function openFirstSession() {
  await waitFor(() => screen.getAllByTestId('p3-open-session'));
  fireEvent.click(screen.getAllByTestId('p3-open-session')[0]);
  return screen.getByTestId('p3-sheet');
}

describe('session sheet, Every date (series.set_program)', () => {
  it('untouched: Save is off and says so; nothing is sent', async () => {
    const calls = server();
    show();
    await openFirstSession();
    const save = screen.getByTestId('p3-sess-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.textContent).toBe(L.nothingChanged);
    expect(envs(calls)).toHaveLength(0);
  });

  it('a rename sends ONE set_program with the whole programme against the page version; a retry after a dropped connection reuses the key', async () => {
    let n = 0;
    const calls = server({ series_command_p5: () => { n += 1; if (n === 1) throw new TypeError('Failed to fetch'); return { data: { ok: true, new_version: 8 }, error: null }; } });
    show();
    await openFirstSession();
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'Improvers class' } });
    expect(screen.getByTestId('p3-sess-save').textContent).toBe(L.saveAll);
    await act(async () => { fireEvent.click(screen.getByTestId('p3-sess-save')); });
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    expect(screen.getByTestId('p3-sheet-error').textContent).not.toMatch(/Failed to fetch/);
    await act(async () => { fireEvent.click(screen.getByTestId('p3-sess-save')); });
    await waitFor(() => screen.getByTestId('p3-toast'));
    const e = envs(calls);
    expect(e).toHaveLength(2);
    expect(e[0].idempotency_key).toBe(e[1].idempotency_key);
    expect(e[1]).toMatchObject({ target_id: 'ser-1', expected_version: 7, command: { kind: 'series.set_program' } });
    const items = ((e[1].command as { payload: { days: Array<{ sections: Array<{ items: Array<Record<string, unknown>> }> }> } }).payload.days)
      .flatMap((d) => d.sections.flatMap((s) => s.items));
    expect(items.map((i) => [i.id, i.title])).toEqual([['cls', 'Improvers class'], ['pty', 'Social']]);
    expect(screen.getByTestId('p3-toast').textContent).toContain(L.savedEvery);
  });

  it('a stale page: version_conflict shows the reload words, never the server text', async () => {
    server({ series_command_p5: () => ({ data: null, error: { message: 'version_conflict: expected 7 got 9' } }) });
    show();
    await openFirstSession();
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'X class' } });
    await act(async () => { fireEvent.click(screen.getByTestId('p3-sess-save')); });
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    expect(screen.getByTestId('p3-sheet-error').textContent).not.toMatch(/version_conflict/);
  });

  it('remove from every date goes through the C3 removeall confirm; the per-date-changes refusal is named in plain words', async () => {
    const calls = server({ series_command_p5: () => ({ data: null, error: { message: 'permission_denied: removing the session "Bachata class" would delete its per-date changes' } }) });
    show();
    await openFirstSession();
    fireEvent.click(screen.getByTestId('p3-sess-removeall'));
    expect(screen.getByTestId('p3-sheet').textContent).toContain(L.removeAllTitle('Bachata class'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-removeall-yes')); });
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    expect(screen.getByTestId('p3-sheet-error').textContent).toContain('only an admin can remove it');
    expect(envs(calls)[0]).toMatchObject({ command: { kind: 'series.set_program' } });
  });

  it('room chips show at a venue with 2+ rooms and send venue_room_id with the name', async () => {
    const calls = server();
    show();
    await openFirstSession();
    await waitFor(() => screen.getByTestId('p3-sess-rooms'));
    fireEvent.click(within(screen.getByTestId('p3-sess-rooms')).getByText('Studio'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-sess-save')); });
    await waitFor(() => expect(envs(calls)).toHaveLength(1));
    expect(JSON.stringify(envs(calls)[0])).toContain('"room":"Studio","venue_room_id":"r2"');
  });

  it('line-up: search, add a teacher, save; the mc row is read-only with the shared word', async () => {
    const calls = server();
    show();
    await waitFor(() => screen.getAllByTestId('p3-open-session'));
    fireEvent.click(screen.getAllByTestId('p3-open-session')[1]);
    fireEvent.click(screen.getByTestId('p3-sess-lineup-open'));
    const rows = screen.getAllByTestId('p3-lineup-person');
    expect(rows[1].textContent).toContain('MC');
    expect(within(rows[1]).queryByTestId('p3-lineup-toggle')).toBeNull();
    fireEvent.change(screen.getByTestId('p3-lineup-search'), { target: { value: 'Ma' } });
    await waitFor(() => screen.getByTestId('p3-lineup-result'));
    fireEvent.click(screen.getByTestId('p3-lineup-result'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-lineup-save')); });
    await waitFor(() => expect(envs(calls)).toHaveLength(1));
    const s = JSON.stringify(envs(calls)[0]);
    expect(s).toContain('"profile_id":"p-new","profile_type":"dj","role":"djing"');
    expect(s).toContain('"role":"mc"');
  });

  it('a new session with a name and no time is added (#25)', async () => {
    const calls = server();
    show();
    await waitFor(() => screen.getByTestId('p3-add-session'));
    fireEvent.click(screen.getByTestId('p3-add-session'));
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'Late social' } });
    fireEvent.click(screen.getByTestId('p3-sess-kind-party'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-sess-save')); });
    await waitFor(() => expect(envs(calls)).toHaveLength(1));
    expect(JSON.stringify(envs(calls)[0])).toContain('"title":"Late social","type":"party","start_time":null');
  });
});

describe('session sheet, Just this date (organiser_set_occurrence_programme_v1)', () => {
  it('Not running this date sends the COMPLETE date programme against its version', async () => {
    const calls = server();
    show();
    await openFirstSession();
    fireEvent.click(screen.getByTestId('p3-scope-date'));
    await waitFor(() => screen.getByTestId('p3-sess-notrunning'));
    expect((screen.getByTestId('p3-sess-kind-class') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('p3-why-kind').textContent).toBe(PROGRAMME_WHY.kindOneDate);
    await act(async () => { fireEvent.click(screen.getByTestId('p3-sess-notrunning')); });
    await waitFor(() => screen.getByTestId('p3-toast'));
    const [, args] = calls.find(([n]) => n === 'organiser_set_occurrence_programme_v1')!;
    expect(args.p_occurrence_id).toBe('o-2026-10-30');
    expect(args.p_expected_version).toBe(4);
    expect(args.p_sessions).toEqual([{ ...DATE_PROG.sessions[0], removed: true }, DATE_PROG.sessions[1]]);
  });

  it('a refusal on this date maps to PROGRAMME_COPY words', async () => {
    server({ organiser_set_occurrence_programme_v1: () => ({ data: null, error: { message: 'permission_denied: changing the programme on a past date is admin-only' } }) });
    show();
    await openFirstSession();
    fireEvent.click(screen.getByTestId('p3-scope-date'));
    await waitFor(() => screen.getByTestId('p3-sess-notrunning'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-sess-notrunning')); });
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    expect(screen.getByTestId('p3-sheet-error').textContent).toBe('This date has already happened, so its schedule can no longer be changed.');
  });

  it('the reader says multi-day: every control greyed with the reason', async () => {
    server({ organiser_get_occurrence_programme_v1: () => ({ data: { ...DATE_PROG, editable: false, not_editable_reason: 'multi_day' }, error: null }) });
    show();
    await openFirstSession();
    fireEvent.click(screen.getByTestId('p3-scope-date'));
    await waitFor(() => screen.getByTestId('p3-sess-why'));
    expect(screen.getByTestId('p3-sess-why').textContent).toBe(PROGRAMME_WHY.multiDay);
    expect((screen.getByTestId('p3-sess-notrunning') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('p3-sess-save') as HTMLButtonElement).disabled).toBe(true);
  });
});

/** Refetch every query and let React Query's batched notify reach the screen (it flushes after a tick). */
const refetchAll = () => act(async () => { await qc.refetchQueries(); await new Promise((r) => setTimeout(r, 0)); });
/** The two sends carry the same command: only the version (and so the key) differs. */
const e2cmd = (calls: Array<[string, Record<string, unknown>]>) => JSON.stringify(envs(calls)[0].command) === JSON.stringify(envs(calls)[1].command);
const nameOf = () => (screen.getByTestId('p3-sess-name') as HTMLInputElement).value;
const saveOf = () => screen.getByTestId('p3-sess-save') as HTMLButtonElement;

describe('review r1 #1: typing survives a background refetch of the same stored content', () => {
  it('Just this date: a refetch with the same version keeps the typing; a NEW version keeps it too and says so (W3a nit A)', async () => {
    let version = 4;
    server({ organiser_get_occurrence_programme_v1: () => ({ data: { ...DATE_PROG, version }, error: null }) });
    show();
    await openFirstSession();
    fireEvent.click(screen.getByTestId('p3-scope-date'));
    await waitFor(() => screen.getByTestId('p3-sess-name'));
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'Typed name' } });
    await refetchAll();
    expect(nameOf()).toBe('Typed name');
    expect(saveOf().disabled).toBe(false);
    version = 5;
    await refetchAll();
    await waitFor(() => screen.getByTestId('p3-sess-elsewhere'));
    expect(nameOf()).toBe('Typed name');
    fireEvent.click(screen.getByTestId('p3-sess-start-again'));
    expect(nameOf()).toBe('Bachata class');
  });

  it('Every date: a workspace refetch with the same version keeps the typing', async () => {
    server();
    show();
    await openFirstSession();
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'Typed name' } });
    await refetchAll();
    expect(nameOf()).toBe('Typed name');
  });
});

describe('review r1 #2: a NEW session needs a name in both scopes', () => {
  for (const scope of ['every', 'date'] as const) {
    it(`${scope}: an empty name sends nothing; its reason shows on Add (W3a nit C), a name clears it`, async () => {
      const calls = server();
      show();
      await waitFor(() => screen.getByTestId('p3-add-session'));
      fireEvent.click(screen.getByTestId('p3-add-session'));
      if (scope === 'date') fireEvent.click(screen.getByTestId('p3-scope-date'));
      await waitFor(() => screen.getByTestId('p3-sess-name'));
      expect(screen.queryByTestId('p3-why-name')).toBeNull();
      await act(async () => { fireEvent.click(saveOf()); });
      expect(screen.getByTestId('p3-why-name').textContent).toBe('Give this session a name.');
      fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: '   ' } });
      await act(async () => { fireEvent.click(saveOf()); });
      expect(screen.getByTestId('p3-why-name').textContent).toBe('Give this session a name.');
      fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'Late social' } });
      expect(saveOf().disabled).toBe(false);
      expect(screen.queryByTestId('p3-why-name')).toBeNull();
      expect(envs(calls)).toHaveLength(0);
    });
  }
});

describe('review r1 #3: the idempotency key belongs to one envelope', () => {
  it('after a definitive refusal the next tap carries a fresh key', async () => {
    let n = 0;
    const calls = server({ series_command_p5: () => { n += 1; return n === 1 ? { data: null, error: { message: 'version_conflict: expected 7 got 9' } } : { data: { ok: true, new_version: 8 }, error: null }; } });
    show();
    await openFirstSession();
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'Improvers class' } });
    await act(async () => { fireEvent.click(saveOf()); });
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    await act(async () => { fireEvent.click(saveOf()); });
    await waitFor(() => screen.getByTestId('p3-toast'));
    const e = envs(calls);
    expect(e).toHaveLength(2);
    expect(e[1].idempotency_key).not.toBe(e[0].idempotency_key);
  });

  // PR #1082 r1 #1: the retry goes against the version the typing BEGAN on, under the same key. If the first
  // send landed, the server replays its stored answer (it looks a key up by actor and key alone); if someone
  // else saved, it is refused (version_conflict) and "Start again" is the way forward, never a write over v9.
  it('a dropped connection then a reload at a NEW version: the retry keeps the version the typing began on, and its key', async () => {
    let n = 0;
    let version = 7;
    const calls = server({
      admin_event_workspace_p5: () => ({ data: { ...SHAPES.weekly, series: { ...SHAPES.weekly.series, series: { ...SHAPES.weekly.series.series, version } } }, error: null }),
      series_command_p5: () => { n += 1; if (n === 1) { version = 9; throw new TypeError('Failed to fetch'); } return { data: { ok: true, new_version: 10 }, error: null }; },
    });
    show();
    await openFirstSession();
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'Improvers class' } });
    await act(async () => { fireEvent.click(saveOf()); });
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    await refetchAll();
    // a new stored version keeps the typing and says so (W3a nit A); the retry builds the same command
    await waitFor(() => screen.getByTestId('p3-sess-elsewhere'));
    expect(nameOf()).toBe('Improvers class');
    await act(async () => { fireEvent.click(saveOf()); });
    await waitFor(() => expect(envs(calls)).toHaveLength(2));
    expect(e2cmd(calls)).toBe(true);
    const e = envs(calls);
    expect(e[0].expected_version).toBe(7);
    expect(e[1].expected_version).toBe(7);
    expect(e[1].idempotency_key).toBe(e[0].idempotency_key);
  });
});

describe('review r1 nits', () => {
  it('#4: a stored person taken off cannot be re-added from the search; the row says to use Keep them on', async () => {
    server({ organiser_search_people_v1: () => ({ data: [{ id: 'p-cls-0', display_name: 'Marco & Elena', dj_name: null, photo_url: null, city_name: 'Leeds', country_code: 'GB' }], error: null }) });
    show();
    await openFirstSession();
    fireEvent.click(screen.getByTestId('p3-sess-lineup-open'));
    fireEvent.click(screen.getAllByTestId('p3-lineup-toggle')[0]);
    fireEvent.change(screen.getByTestId('p3-lineup-search'), { target: { value: 'Marco' } });
    await waitFor(() => screen.getByTestId('p3-lineup-result'));
    const r = screen.getByTestId('p3-lineup-result') as HTMLButtonElement;
    expect(r.disabled).toBe(true);
    expect(r.textContent).toContain(L.useKeepOn);
  });

  it('#5: a performance line-up says who adds performers and the MC; a class line-up does not', () => {
    for (const type of ['performance', 'class']) {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <LineupSheet name="Show" where={L.everyDate} type={type} initial={[]} why={null} busy={false} error={null} onSave={() => undefined} onBack={() => undefined} />
        </QueryClientProvider>,
      );
      const note = screen.queryByTestId('p3-lineup-teamonly');
      if (type === 'performance') expect(note?.textContent).toBe('Performers and the MC are added by the Bachata Calendar team.');
      else expect(note).toBeNull();
      cleanup();
    }
  });

  it('#6: the remove-from-every-date confirm warns about per-date changes before the tap', async () => {
    server();
    show();
    await openFirstSession();
    fireEvent.click(screen.getByTestId('p3-sess-removeall'));
    expect(screen.getByTestId('p3-sheet').textContent).toContain(CHANGED_SESSION_REMOVE_CONFIRM);
    expect(L.removeAllBody(0)).not.toMatch(/\b0 dates/);
  });

  it('#7: typing then switching scope says plainly that it clears, and it does', async () => {
    server();
    show();
    await openFirstSession();
    expect(screen.queryByTestId('p3-sess-scope-clears')).toBeNull();
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'Typed name' } });
    expect(screen.getByTestId('p3-sess-scope-clears').textContent).toBe(L.scopeClears);
    fireEvent.click(screen.getByTestId('p3-scope-date'));
    await waitFor(() => screen.getByTestId('p3-sess-name'));
    expect(nameOf()).toBe('Bachata class');
    expect(screen.queryByTestId('p3-sess-scope-clears')).toBeNull();
  });
});

describe('festival: read-only with "Ask us"', () => {
  it('no session row opens a sheet; the page says who changes the programme', async () => {
    server({}, 'festival');
    show();
    await waitFor(() => screen.getByTestId('p3-sessions-ask'));
    expect(screen.queryAllByTestId('p3-open-session')).toHaveLength(0);
    expect(screen.queryByTestId('p3-add-session')).toBeNull();
    expect(screen.getByTestId('p3-sessions-ask').textContent).toBe(L.festivalAsk);
  });
});
