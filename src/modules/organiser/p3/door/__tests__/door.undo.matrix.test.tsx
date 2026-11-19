// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ScannerDeps } from '../camera';

/*
 * Door Undo (organiser R4 slice c, boards 16-17) x every ticket_undo_check_in_v1 answer x both
 * looks x the seat-only door. Prod survey 2026-11-19 (counts only): 4 tickets on one series,
 * 0 undos so far, 0 door seats; the function's live signature is (p_ticket_id, p_event_series_id,
 * p_occurrence_id) and it answers ok + undone true/false, wrong_night, not_allowed, unknown_code
 * and the check-in refusals.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
import { Door } from '../DoorScreen';
import { UNDO_KINDS, undoKindOf, undoText, type UndoKind } from '../model';

const row = (id: string, name: string | null, inAt: string | null) => ({ ticket_id: id, first_name: name, quantity_in_order: 1, ticket_type_name: 'General entry', checked_in_at: inAt });
const LIST = { result: 'ok', rows: [row('t1', 'Amira', '2026-11-14T20:12:00Z'), row('t2', 'Zoe', null)], truncated: false, in_count: 1, total_count: 2 };
const IN = { result: 'ok', first_name: 'Zoe', ticket_type_name: 'General entry', quantity: 1, checked_in_at: '2026-11-19T20:00:00Z', checked_in_by_first_name: null, in_count: 2, total_count: 2 };

const deps: ScannerDeps = {
  getStream: async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream,
  makeDetector: async () => async () => null,
  every: 50,
};

function show(r4: boolean, seatOnly = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Door seriesId="ser-1" deps={deps} shortCodes nightName="Friday Social" r4={r4} seatOnly={seatOnly} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

type Undo = () => Promise<{ data: unknown; error: unknown }>;
function answer(undo: Undo, codeAnswer: unknown = IN) {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'ticket_door_list_v3') return { data: LIST, error: null };
    if (fn === 'ticket_undo_check_in_v1') return undo();
    return { data: fn === 'ticket_check_in_by_id_v3' ? IN : codeAnswer, error: null };
  });
}
const undoCalls = () => rpc.mock.calls.filter((c) => c[0] === 'ticket_undo_check_in_v1');

async function tickZoe() {
  fireEvent.click(screen.getByTestId('door-tab-list'));
  const rows = await screen.findAllByTestId('door-row-checkin');
  fireEvent.click(rows[0]);
  return screen.findByTestId('door-undo-btn');
}

beforeEach(() => { rpc.mockReset(); });
afterEach(() => { cleanup(); });

const ok = (data: unknown): Undo => async () => ({ data, error: null });
const CASES: Array<[UndoKind, Undo]> = [
  ['undone', ok({ result: 'ok', undone: true, first_name: 'Zoe', in_count: 1, total_count: 2 })],
  ['already', ok({ result: 'ok', undone: false, first_name: 'Zoe', in_count: 1, total_count: 2 })],
  ['ended', ok({ result: 'wrong_night', undone: false })],
  ['not_allowed', ok({ result: 'not_allowed', undone: false })],
  ['refused', ok({ result: 'unknown_code', undone: false })],
  ['error', async () => ({ data: null, error: { message: 'fetch failed' } })],
];

describe('undoKindOf / undoText: the one mapping', () => {
  it('maps every answer and every kind has words', () => {
    expect(undoKindOf('ok', true)).toBe('undone');
    expect(undoKindOf('ok', false)).toBe('already');
    expect(undoKindOf('ok', undefined)).toBe('already');
    expect(undoKindOf('wrong_night', false)).toBe('ended');
    expect(undoKindOf('not_allowed', false)).toBe('not_allowed');
    for (const r of ['unknown_code', 'wrong_event', 'not_valid', 'refunded', 'void', 'wrong_day', null]) expect(undoKindOf(r, false)).toBe('refused');
    for (const k of UNDO_KINDS) expect(undoText(k, 'Zoe').length).toBeGreaterThan(5);
    expect(undoText('ended', 'Zoe')).toBe('This night has ended, so it cannot be undone');
    // names only, never money; no mojibake
    for (const k of UNDO_KINDS) expect(undoText(k, null)).not.toMatch(/[\u00a3$\u20ac]|\u00c3|\u00e2\u20ac/);
  });
});

for (const [look, r4, seat] of [['R4', true, false], ['R4 seat-only', true, true], ['old look', false, false]] as const) {
  describe(`door Undo x ${look}`, () => {
    for (const [kind, undo] of CASES) {
      it(`${kind}: says it in plain words`, async () => {
        answer(undo);
        show(r4, seat);
        const btn = await tickZoe();
        expect(btn.textContent).toBe('Undo');
        expect(screen.getByTestId('door-undo-text').textContent).toMatch(/^Zoe is in\./);
        fireEvent.click(btn);
        await waitFor(() => expect(screen.getByTestId('door-undo').getAttribute('data-phase')).toBe(kind));
        expect(screen.getByTestId('door-undo-text').textContent).toBe(undoText(kind, 'Zoe'));
        expect(undoCalls()).toEqual([['ticket_undo_check_in_v1', { p_ticket_id: 't2', p_event_series_id: 'ser-1', p_occurrence_id: null }]]);
        // only an error offers the button again, as Try again
        if (kind === 'error') expect(screen.getByTestId('door-undo-btn').textContent).toBe('Try again');
        else expect(screen.queryByTestId('door-undo-btn')).toBeNull();
      });
    }

    it('undone: the count goes back down and the list is read again', async () => {
      answer(CASES[0][1]);
      show(r4, seat);
      fireEvent.click(await tickZoe());
      await waitFor(() => expect(screen.getByTestId('door-undo').getAttribute('data-phase')).toBe('undone'));
      if (r4) expect(screen.getByTestId('door-count').textContent).toContain('1 of 2 in');
      await waitFor(() => expect(rpc.mock.calls.filter((c) => c[0] === 'ticket_door_list_v3').length).toBeGreaterThan(1));
    });

    it('error then Try again: sends again and lands', async () => {
      let n = 0;
      answer(async () => (n++ === 0 ? { data: null, error: { message: 'offline' } } : { data: { result: 'ok', undone: true }, error: null }));
      show(r4, seat);
      fireEvent.click(await tickZoe());
      fireEvent.click(await screen.findByText('Try again'));
      await waitFor(() => expect(screen.getByTestId('door-undo').getAttribute('data-phase')).toBe('undone'));
      expect(undoCalls().length).toBe(2);
    });

    it('double tap: one call, button disabled while running', async () => {
      let release: (v: { data: unknown; error: null }) => void = () => {};
      answer(() => new Promise((r) => { release = r; }));
      show(r4, seat);
      const btn = await tickZoe();
      fireEvent.click(btn);
      fireEvent.click(btn);
      const running = screen.getByTestId('door-undo-btn') as HTMLButtonElement;
      expect(running.disabled).toBe(true);
      expect(running.textContent).toBe('Undoing\u2026');
      fireEvent.click(running);
      expect(undoCalls().length).toBe(1);
      release({ data: { result: 'ok', undone: true }, error: null });
      await waitFor(() => expect(screen.getByTestId('door-undo').getAttribute('data-phase')).toBe('undone'));
      expect(undoCalls().length).toBe(1);
    });

    it('OK closes it; a typed code that lets someone in has no Undo (no ticket id in the reply)', async () => {
      answer(CASES[0][1]);
      show(r4, seat);
      await tickZoe();
      fireEvent.click(screen.getByTestId('door-undo-close'));
      expect(screen.queryByTestId('door-undo')).toBeNull();
      fireEvent.click(screen.getByTestId('door-tab-scan'));
      // the old look keeps the list answer's card on Scan: Scan next brings the code box back
      const next = screen.queryByTestId('door-act-scan');
      if (next) fireEvent.click(next);
      fireEvent.change(await screen.findByTestId('door-code-input'), { target: { value: 'K7M2QX' } });
      fireEvent.click(screen.getByTestId('door-code-check'));
      await waitFor(() => expect(rpc.mock.calls.some((c) => c[0] === 'ticket_check_in_by_code_v3')).toBe(true));
      fireEvent.click(screen.getByTestId('door-tab-list'));
      expect(screen.queryByTestId('door-undo')).toBeNull();
    });
  });
}
