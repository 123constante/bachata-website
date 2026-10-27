// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPES } from './wsFixtures';
import { L } from '../../model';
import { PROGRAMME_WHY } from '../../model/programme';

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

const ROOMS = [{ id: 'r1', name: 'Main room', sort_order: 0 }, { id: 'r2', name: 'Studio', sort_order: 1 }];
beforeEach(() => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is']) chain[m] = () => chain;
  chain.order = async () => ({ data: ROOMS, error: null });
  from.mockReturnValue(chain);
});
afterEach(() => { cleanup(); rpc.mockReset(); });

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
    { series_item_id: 'pty', type: 'party', title: 'Social', start_time: '21:00:00', end_time: '01:00:00', ends_next_day: true, level_keys: [], removed: false },
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
