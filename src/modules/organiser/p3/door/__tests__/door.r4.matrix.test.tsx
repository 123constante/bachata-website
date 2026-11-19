// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ScannerDeps } from '../camera';

/*
 * Boards R4DoorScan / R4DoorSearch (flag organiserR4): the door screen's R4 look x the prod door
 * list shapes. Prod survey 2026-11-18 (counts only): 3 series have ticket types; ONE has tickets
 * (4: 3 checked in, 1 void, which the list leaves out), the other 2 have none sold; 107 series
 * have no ticket types (the door says nothing sold). 0 door invites, 0 door seats.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
import { Door } from '../DoorScreen';
import { r4ToastText } from '../model';

const row = (id: string, name: string | null, inAt: string | null, q = 1) => ({ ticket_id: id, first_name: name, quantity_in_order: q, ticket_type_name: 'General entry', checked_in_at: inAt });
const PROD_A = { result: 'ok', rows: [row('t1', 'Ana', '2026-11-14T20:12:00Z'), row('t2', 'Tom', '2026-11-14T20:15:00Z'), row('t3', null, '2026-11-14T20:20:00Z', 2)], truncated: false, in_count: 3, total_count: 3 };
const MIXED = { result: 'ok', rows: [row('t1', 'Amira', '2026-11-14T20:12:00Z'), row('t2', 'Zoe', null), row('t3', 'Maya', null)], truncated: false, in_count: 1, total_count: 3 };
const NONE = { result: 'ok', rows: [], truncated: false, in_count: 0, total_count: 0 };
const TRUNC = { ...MIXED, truncated: true };
const NOT_ALLOWED = { result: 'not_allowed', rows: [], truncated: false, in_count: null, total_count: null };
const NO_NIGHT = { result: 'wrong_night', rows: [], truncated: false, in_count: null, total_count: null };

const deps: ScannerDeps = {
  getStream: async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream,
  makeDetector: async () => async () => null,
  every: 50,
};

function show(shortCodes: boolean, r4 = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Door seriesId="ser-1" deps={deps} shortCodes={shortCodes} nightName="Friday Social" r4={r4} /></MemoryRouter>
    </QueryClientProvider>,
  );
}
const answer = (list: unknown, checkIn?: unknown) => rpc.mockImplementation(async (fn: string) => {
  if (fn === 'ticket_door_list_v3') return { data: list, error: null };
  return { data: checkIn ?? null, error: null };
});

beforeEach(() => { rpc.mockReset(); });
afterEach(() => { cleanup(); });

type Want = 'ticks' | 'empty' | 'not_allowed' | 'no_night';
const SHAPES: Array<[string, unknown, Want, string | null]> = [
  ['prod A: all in, a no-name order of 2', PROD_A, 'ticks', '3 of 3 in'],
  ['mixed in / not in', MIXED, 'ticks', '1 of 3 in'],
  ['truncated at 500', TRUNC, 'ticks', '1 of 3 in'],
  ['prod B / C: types, none sold', NONE, 'empty', '0 of 0 in'],
  ['not on the team', NOT_ALLOWED, 'not_allowed', null],
  ['every night ended', NO_NIGHT, 'no_night', null],
];

describe('R4 door: header and Scan', () => {
  it.each(SHAPES)('%s', async (_n, list, want, count) => {
    answer(list);
    show(true);
    expect(screen.getByTestId('door-screen').dataset.look).toBe('r4');
    expect(screen.getByTestId('door-title').textContent).toBe('Friday Social Door');
    expect(screen.getByTestId('door-back').textContent).toContain('Back to the event');
    if (count) await waitFor(() => expect(screen.getAllByTestId('door-count')[0].textContent).toBe(count));
    if (want === 'not_allowed') await screen.findByText('CANNOT CHECK TICKETS');
  });
});

describe('R4 door: Search tab x shape x short codes', () => {
  it.each(SHAPES.flatMap(([n, l, w]) => [true, false].map((sc) => [n, l, w, sc] as const)))('%s, ticks %s', async (_n, list, want, sc) => {
    answer(list);
    show(sc);
    fireEvent.click(screen.getByTestId('door-tab-list'));
    if (want === 'empty') { await screen.findByTestId('door-empty'); return; }
    if (want === 'not_allowed') { await screen.findByText('CANNOT CHECK TICKETS'); return; }
    if (want === 'no_night') { await screen.findByTestId('door-list-no-night'); return; }
    const rows = await screen.findAllByTestId('door-row');
    const d = list as typeof MIXED;
    expect(rows).toHaveLength(d.rows.length);
    expect(screen.getByText('Type a name')).toBeTruthy();
    expect(screen.getAllByTestId('door-row-status')).toHaveLength(d.rows.filter((r) => r.checked_in_at).length);
    // a tick button only on a not-in row, and only with the tick-in flag on
    expect(screen.queryAllByTestId('door-row-checkin')).toHaveLength(sc ? d.rows.filter((r) => !r.checked_in_at).length : 0);
    expect(screen.getByTestId('door-list-how').textContent).toBe(sc ? 'Tap a name to tick them in. A tick cannot be undone here.' : 'To let someone in, scan their code on the Scan tab. This list shows who is in.');
    expect(!!screen.queryByTestId('door-truncated')).toBe(d.truncated);
    if (d === PROD_A) expect(rows[2].textContent).toContain('No name given');
  });

  it('a tick that lets someone in shows the toast, not a result card', async () => {
    answer(MIXED, { result: 'ok', first_name: 'Zoe', ticket_type_name: 'General entry', quantity: 1, in_count: 2, total_count: 3 });
    show(true);
    fireEvent.click(screen.getByTestId('door-tab-list'));
    const btns = await screen.findAllByTestId('door-row-checkin');
    await act(async () => { fireEvent.click(btns[0]); });
    // slice c: the toast after a tick carries Undo, so it is the Undo bar (door.undo.matrix)
    expect((await screen.findByTestId('door-undo-text')).textContent).toContain('Zoe is in. 2 of 3 in.');
    expect(screen.queryByTestId('door-result')).toBeNull();
    expect(rpc.mock.calls.filter(([fn]) => fn === 'ticket_check_in_by_id_v3')).toHaveLength(1);
  });

  it('a tick that is refused still shows its card', async () => {
    answer(MIXED, { result: 'already_in', first_name: 'Zoe', checked_in_at: '2026-11-14T20:12:00Z' });
    show(true);
    fireEvent.click(screen.getByTestId('door-tab-list'));
    const btns = await screen.findAllByTestId('door-row-checkin');
    await act(async () => { fireEvent.click(btns[0]); });
    expect((await screen.findByTestId('door-result')).dataset.state).toBe('already_in');
    expect(screen.queryByTestId('door-toast')).toBeNull();
  });

  it('flag off: the p3 look is exactly as before', async () => {
    answer(MIXED);
    show(true, false);
    expect(screen.getByTestId('door-screen').dataset.look).toBeUndefined();
    expect(screen.getByTestId('door-title').textContent).toBe('Friday Social · Door');
    fireEvent.click(screen.getByTestId('door-tab-list'));
    await screen.findAllByTestId('door-row');
    expect(screen.queryByTestId('door-list-how')).toBeNull();
  });
});

describe('r4ToastText', () => {
  it.each([
    [{ first_name: 'Ana', in_count: 4, total_count: 12 }, 'Ana is in. 4 of 12 in.'],
    [{ first_name: null, in_count: 4, total_count: 12 }, 'They are in. 4 of 12 in.'],
    [{ first_name: 'Ana', in_count: null, total_count: 12 }, 'Ana is in.'],
  ])('%o', (c, want) => {
    expect(r4ToastText({ result: 'ok', ticket_type_name: null, quantity: 1, checked_in_at: null, checked_in_by_first_name: null, ...c })).toBe(want);
  });
});
