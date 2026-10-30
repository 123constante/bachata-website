// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPES } from './wsFixtures';
import { L } from '../../model';

/*
 * The W2d round-2 carry-over nits (W3a brief, scope IN 4), each pinned by a test that was red
 * on the unfixed code: (A) someone else's save keeps the typing and says so; (B) a session no
 * organiser role can join offers no Teacher / DJ toggle; (C) "Give this session a name." waits
 * for the field to be touched or a save.
 */

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';
import { LineupSheet } from '../LineupSheet';

afterEach(() => { cleanup(); rpc.mockReset(); });

let qc: QueryClient;
let version = 7;
let envs: Array<Record<string, unknown>> = [];
function show() {
  envs = [];
  version = 7;
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is']) chain[m] = () => chain;
  chain.order = async () => ({ data: [], error: null });
  from.mockReturnValue(chain);
  const calls: string[] = [];
  rpc.mockImplementation(async (name: string, args?: { p_envelope?: Record<string, unknown> }) => {
    calls.push(name);
    if (name === 'series_command_p5' && args?.p_envelope) envs.push(args.p_envelope);
    if (name === 'admin_event_workspace_p5') {
      const raw = structuredClone(SHAPES.weekly) as { series: { series: Record<string, unknown> } };
      raw.series.series.version = version;
      return { data: raw, error: null };
    }
    return { data: null, error: null };
  });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/account/p3/events/ser-1']}>
        <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return calls;
}

describe('W2d nit A: another save keeps the typing', () => {
  it('a new stored version keeps the typed name and shows the reload copy', async () => {
    const calls = show();
    await waitFor(() => screen.getAllByTestId('p3-open-session'));
    fireEvent.click(screen.getAllByTestId('p3-open-session')[0]);
    const sheet = screen.getByTestId('p3-sheet');
    fireEvent.change(within(sheet).getByTestId('p3-sess-name'), { target: { value: 'My new name' } });
    version = 8;
    await act(async () => { await qc.invalidateQueries({ queryKey: ['org-event-workspace', 'ser-1'] }); });
    await waitFor(() => expect(calls.filter((c) => c === 'admin_event_workspace_p5').length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByTestId('p3-sess-elsewhere').textContent).toContain(L.changedElsewhere));
    expect((screen.getByTestId('p3-sess-name') as HTMLInputElement).value).toBe('My new name');
    // starting again takes the stored values and drops the note
    fireEvent.click(screen.getByTestId('p3-sess-start-again'));
    expect((screen.getByTestId('p3-sess-name') as HTMLInputElement).value).not.toBe('My new name');
    expect(screen.queryByTestId('p3-sess-elsewhere')).toBeNull();
  });

  it('r1 #1 (PR #1082): saving after another save goes against the version the typing started on, so it is refused', async () => {
    show();
    await waitFor(() => screen.getAllByTestId('p3-open-session'));
    fireEvent.click(screen.getAllByTestId('p3-open-session')[0]);
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'My new name' } });
    version = 8;
    await act(async () => { await qc.invalidateQueries({ queryKey: ['org-event-workspace', 'ser-1'] }); });
    await waitFor(() => screen.getByTestId('p3-sess-elsewhere'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-sess-save')); });
    await waitFor(() => expect(envs).toHaveLength(1));
    expect(envs[0].expected_version).toBe(7);
  });

  it('a refetch of the SAME version shows no note', async () => {
    show();
    await waitFor(() => screen.getAllByTestId('p3-open-session'));
    fireEvent.click(screen.getAllByTestId('p3-open-session')[0]);
    fireEvent.change(screen.getByTestId('p3-sess-name'), { target: { value: 'Typed' } });
    await act(async () => { await qc.invalidateQueries({ queryKey: ['org-event-workspace', 'ser-1'] }); });
    expect((screen.getByTestId('p3-sess-name') as HTMLInputElement).value).toBe('Typed');
    expect(screen.queryByTestId('p3-sess-elsewhere')).toBeNull();
  });
});

describe('W2d nit B: no organiser role, no role toggle', () => {
  const lineup = (type: string) => render(
    <QueryClientProvider client={new QueryClient()}>
      <LineupSheet name="Show" where="Every date" type={type} initial={[]} why={null} busy={false} error={null} onSave={() => {}} onBack={() => {}} />
    </QueryClientProvider>,
  );
  it.each([['performance'], ['show'], ['workshop'], ['competition']])('%s: no Teacher / DJ toggle and no search; the reason shows', (type) => {
    lineup(type);
    expect(screen.queryByTestId('p3-lineup-role-teaching')).toBeNull();
    expect(screen.queryByTestId('p3-lineup-role-djing')).toBeNull();
    expect(screen.queryByTestId('p3-lineup-search')).toBeNull();
    expect(screen.getByTestId('p3-lineup-teamonly')).toBeTruthy();
  });
  it.each([['class'], ['party'], ['masterclass']])('%s: the toggle and the search stay', (type) => {
    lineup(type);
    expect(screen.getByTestId('p3-lineup-role-teaching')).toBeTruthy();
    expect(screen.getByTestId('p3-lineup-search')).toBeTruthy();
  });
});

describe('W2d nit C: the name reason waits for a touch or a save', () => {
  it('a new session shows no name reason until the field is left empty or Add is pressed', async () => {
    const calls = show();
    await waitFor(() => screen.getByTestId('p3-add-session'));
    fireEvent.click(screen.getByTestId('p3-add-session'));
    expect(screen.queryByTestId('p3-why-name')).toBeNull();
    fireEvent.click(screen.getByTestId('p3-sess-save'));
    expect(screen.getByTestId('p3-why-name')).toBeTruthy();
    expect(calls.filter((c) => c === 'series_command_p5')).toHaveLength(0);
  });
  it('leaving the empty field shows it too', async () => {
    show();
    await waitFor(() => screen.getByTestId('p3-add-session'));
    fireEvent.click(screen.getByTestId('p3-add-session'));
    fireEvent.blur(screen.getByTestId('p3-sess-name'));
    expect(screen.getByTestId('p3-why-name')).toBeTruthy();
  });
});
