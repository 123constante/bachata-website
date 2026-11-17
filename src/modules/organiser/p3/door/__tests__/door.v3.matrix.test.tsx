// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ScannerDeps } from '../camera';

/*
 * Festival day tickets slice 2b: the door on the v3 functions (admin 20270323020000_festival_day_tickets_s2a_v1).
 * The RPC layer is faked, not data.ts, so the real names, args and parser are under test.
 * Every v3 refusal is a refusal on the result card (never the green LET IN band), and an
 * answer this screen does not know falls through to the generic refusal.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
import { Door } from '../DoorScreen';
import { checkInById, checkInByCode, checkInTicket, fetchDoorList, parseCheckIn } from '../data';
import { RESULT_TABLE } from '../model';

const TOKEN = 'ab'.repeat(32);
const LIST = { result: 'ok', rows: [{ ticket_id: 't1', first_name: 'Aisha', quantity_in_order: 1, ticket_type_name: 'Saturday', checked_in_at: null, valid_day: '2027-06-12' }], truncated: false, in_count: 0, total_count: 1, door_day: '2027-06-12' };
// a v3 core reply: every key present
const v3 = (result: string) => ({
  result, ticket_type_name: 'Saturday', first_name: 'Maria', quantity: 2, type_quantity_in_order: 2, order_quantity: 2,
  valid_day: '2027-06-12', checked_in_at: null, checked_in_by_first_name: null, in_count: 3, total_count: 9, door_day: '2027-06-13',
});

const deps: ScannerDeps = {
  getStream: async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream,
  makeDetector: async () => async () => null,
  every: 50,
};
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Door seriesId="ser-1" deps={deps} shortCodes /></MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => { rpc.mockReset(); });
afterEach(() => { cleanup(); });

describe('the v3 door functions, with no chosen night (null: the server picks)', () => {
  it.each([
    ['ticket_check_in_v3', () => checkInTicket(TOKEN, 'ser-1'), { p_qr_token: TOKEN, p_event_series_id: 'ser-1', p_occurrence_id: null }],
    ['ticket_check_in_by_code_v3', () => checkInByCode('K7M2QX', 'ser-1'), { p_code: 'K7M2QX', p_event_series_id: 'ser-1', p_occurrence_id: null }],
    ['ticket_check_in_by_id_v3', () => checkInById('t1', 'ser-1'), { p_ticket_id: 't1', p_event_series_id: 'ser-1', p_occurrence_id: null }],
    ['ticket_door_list_v3', () => fetchDoorList('ser-1'), { p_event_series_id: 'ser-1', p_occurrence_id: null }],
  ] as const)('%s', async (fn, call, args) => {
    rpc.mockResolvedValue({ data: fn === 'ticket_door_list_v3' ? LIST : v3('ok'), error: null });
    await call();
    expect(rpc).toHaveBeenCalledWith(fn, args);
  });
});

// v3 result -> what the card shows (state, headline-band, the exact refusal copy)
const REFUSALS: Array<[string, string, string]> = [
  ['wrong_night', 'wrong_night', 'This ticket is for a different night'],
  ['wrong_day', 'wrong_day', 'This ticket is for a different day'],
  ['add_on_not_admission', 'add_on_not_admission', 'This is an add-on, it does not get anyone in'],
  ['unclassified_festival_type', 'unclassified_festival_type', 'This ticket type is not set up for the door yet. Ask the organiser.'],
  ['refunded', 'not_valid', 'This ticket was refunded or cancelled'],
  ['void', 'not_valid', 'This ticket was refunded or cancelled'],
  ['unknown future value', 'unknown_code', 'No ticket matches this code'],
  ['(no result key)', 'unknown_code', 'No ticket matches this code'],
];

describe('parseCheckIn: v3 results', () => {
  it.each(REFUSALS)('%s -> %s', (raw, want) => {
    const c = parseCheckIn(raw === '(no result key)' ? { first_name: 'x' } : v3(raw));
    expect(c.result).toBe(want);
    expect(RESULT_TABLE[c.result].band).not.toBe('ok');
  });
  it('festival pass used today: server answers already_in, shown as ALREADY IN', () => {
    expect(parseCheckIn({ ...v3('already_in'), checked_in_at: '2027-06-13T19:00:00Z' }).result).toBe('already_in');
  });
});

describe('every v3 refusal on the result card (typed code, by id and scanned all share parseCheckIn)', () => {
  it.each(REFUSALS)('%s', async (raw, want, copy) => {
    rpc.mockImplementation(async (fn: string) => ({ data: fn === 'ticket_door_list_v3' ? LIST : v3(raw === '(no result key)' ? undefined as unknown as string : raw), error: null }));
    show();
    fireEvent.change(await screen.findByTestId('door-code-input'), { target: { value: 'K7M2QX' } });
    fireEvent.click(screen.getByTestId('door-code-check'));
    const card = await screen.findByTestId('door-result');
    expect(card.getAttribute('data-state')).toBe(want);
    expect(screen.getByTestId('door-sub').textContent).toBe(copy);
    expect(screen.getByTestId('door-headline').textContent).not.toBe('LET IN');
    expect(card.querySelector('.p3-door-band-ok')).toBeNull();
    expect(rpc).toHaveBeenCalledWith('ticket_check_in_by_code_v3', expect.objectContaining({ p_occurrence_id: null }));
  });
});
