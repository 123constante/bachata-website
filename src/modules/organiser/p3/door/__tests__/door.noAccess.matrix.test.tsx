// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { DoorList } from '../data';
import type { ScannerDeps } from '../camera';
import { P3_PATHS } from '../../shell/paths';

const api = vi.hoisted(() => ({ checkIn: vi.fn(), list: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../data', async (orig) => ({
  ...(await orig<typeof import('../data')>()),
  checkInTicket: (...a: unknown[]) => api.checkIn(...a),
  fetchDoorList: (...a: unknown[]) => api.list(...a),
}));
import { Door } from '../DoorScreen';

const OK: DoorList = {
  result: 'ok', truncated: false, inCount: 1, totalCount: 3, loadedAt: 0,
  rows: [{ ticketId: 't1', firstName: 'Aisha', quantity: 1, typeName: 'Standard', checkedInAt: null }],
};
const REFUSED: DoorList = { ...OK, result: 'not_allowed', rows: [], inCount: null, totalCount: null };
const REFUSED_ZERO: DoorList = { ...REFUSED, totalCount: 0 };
const cam = vi.hoisted(() => ({ code: null as string | null }));
const deps: ScannerDeps = {
  getStream: async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream,
  makeDetector: async () => async () => cam.code,
  every: 5,
};
const NOT_ALLOWED = { result: 'not_allowed', ticket_type_name: null, first_name: null, quantity: null, checked_in_at: null, checked_in_by_first_name: null, in_count: null, total_count: null };

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><Door seriesId="ser-1" deps={deps} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

type Shape = 'list' | 'typed' | 'then_ok' | 'then_network' | 'zero_sold';
const SHAPES: Shape[] = ['list', 'typed', 'then_ok', 'then_network', 'zero_sold'];

beforeEach(() => { api.checkIn.mockReset(); api.list.mockReset(); cam.code = null; });

/** Every control a note may name, and whether it is on screen now. */
function noteNamesOnlyControlsOnScreen(note: string) {
  const buttons = screen.queryAllByRole('button').map((b) => (b.textContent ?? '').toLowerCase());
  if (/check again/i.test(note)) expect(buttons.some((b) => b.includes('check again'))).toBe(true);
  if (/\btype\b/i.test(note)) expect(screen.queryByTestId('door-code-input')).not.toBeNull();
  if (/\bscan\b/i.test(note)) expect(screen.queryByTestId('door-code-input') ?? screen.queryByTestId('door-camera')).not.toBeNull();
}
afterEach(cleanup);

describe.each(['scan', 'list'] as const)('refused card on the %s tab', (tab) => {
  describe.each(SHAPES)('shape %s', (shape) => {
    it('has both controls, honest copy, and a recheck that is one list read', async () => {
      if (shape === 'typed') api.list.mockResolvedValue(OK);
      else api.list.mockResolvedValue(shape === 'zero_sold' ? REFUSED_ZERO : REFUSED);
      show();
      if (shape === 'typed') {
        await screen.findByTestId('door-code-input');
        fireEvent.change(screen.getByTestId('door-code-input'), { target: { value: 'ab'.repeat(32) } });
        api.checkIn.mockResolvedValue(NOT_ALLOWED);
        fireEvent.click(screen.getByTestId('door-code-check'));
        await screen.findByTestId('door-notallowed-back');
      }
      if (tab === 'list') fireEvent.click(screen.getByTestId('door-tab-list'));
      const recheck = await screen.findByTestId('door-act-recheck');
      expect(screen.getByTestId('door-notallowed-back').getAttribute('href')).toBe(P3_PATHS.events);
      expect(document.body.textContent).not.toMatch(/open this screen again/i);
      expect(screen.getByTestId('door-detail').textContent).toMatch(/tap Check again/);
      const checkIns = api.checkIn.mock.calls.length;

      if (shape === 'then_ok') api.list.mockResolvedValue(OK); // typed: the list stays ok, so Check again clears the check-in refusal
      else if (shape === 'then_network') api.list.mockRejectedValue(new Error('offline'));
      api.list.mockClear();
      fireEvent.click(recheck);
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
      expect(api.checkIn.mock.calls.length).toBe(checkIns);
      if (shape === 'then_ok') {
        await waitFor(() => expect(screen.queryByTestId('door-act-recheck')).toBeNull());
        // a list refusal that clears: no check-in note, and the worker stays on the tab they were on (review 1439 r3 F3)
        expect(screen.queryByTestId('door-recheck-note')).toBeNull();
        expect(screen.getByTestId(`door-tab-${tab}`).getAttribute('aria-current')).toBe('page');
      } else if (shape === 'typed') {
        // refusal came from a check-in: a good list read clears it, the code box comes back,
        // and the note names only controls that are on screen (review 1439 r2 A)
        await waitFor(() => expect(screen.queryByTestId('door-act-recheck')).toBeNull());
        expect(screen.getByTestId('door-code-input')).toBeTruthy();
        const note = screen.getByTestId('door-recheck-note').textContent ?? '';
        expect(note).toMatch(/You can check tickets now/);
        expect(note).not.toMatch(/refused when it was checked/);
        noteNamesOnlyControlsOnScreen(note);
      } else {
        await waitFor(() => expect((screen.getByTestId('door-act-recheck') as HTMLButtonElement).disabled).toBe(false));
        expect(screen.getByTestId('door-notallowed-back')).toBeTruthy();
        if (shape === 'then_network') expect(screen.getByRole('alert').textContent).toMatch(/No signal, try again/);
        else expect(screen.queryByRole('alert')).toBeNull();
      }
    });
  });
});

// review 1439 r2 C: the code that was refused stays on screen; once access is back the same code,
// still held in front of the camera, must check in again (not be swallowed as "already shown").
it('a scanned code refused at check-in scans again after Check again finds access', async () => {
  api.list.mockResolvedValue(OK);
  api.checkIn.mockResolvedValue(NOT_ALLOWED);
  const code = 'cd'.repeat(32);
  cam.code = code;
  show();
  await screen.findByTestId('door-act-recheck');
  expect(api.checkIn).toHaveBeenCalledTimes(1);
  expect(api.checkIn.mock.calls[0][0]).toBe(code);
  api.checkIn.mockResolvedValue({ ...NOT_ALLOWED, result: 'ok', first_name: 'Aisha', quantity: 1, in_count: 2, total_count: 3 });
  fireEvent.click(screen.getByTestId('door-act-recheck'));
  await waitFor(() => expect(api.checkIn).toHaveBeenCalledTimes(2));
  expect(api.checkIn.mock.calls[1][0]).toBe(code);
});

// review 1439 r3 F1, F2, F3: the "Scan or type the code again" note shows only where there is a code box,
// and goes away with the next check-in.
async function typedRefusalThenRecheck(after: DoorList) {
  api.list.mockResolvedValue(OK);
  show();
  await screen.findByTestId('door-code-input');
  fireEvent.change(screen.getByTestId('door-code-input'), { target: { value: 'ab'.repeat(32) } });
  api.checkIn.mockResolvedValue(NOT_ALLOWED);
  fireEvent.click(screen.getByTestId('door-code-check'));
  const recheck = await screen.findByTestId('door-act-recheck');
  api.list.mockResolvedValue(after);
  fireEvent.click(recheck);
  await waitFor(() => expect(screen.queryByTestId('door-act-recheck')).toBeNull());
}

it('the recheck note does not follow the worker to Tonight\'s list', async () => {
  await typedRefusalThenRecheck(OK);
  expect(screen.getByTestId('door-recheck-note').textContent).toMatch(/You can check tickets now/);
  fireEvent.click(screen.getByTestId('door-tab-list'));
  expect(screen.queryByTestId('door-code-input')).toBeNull();
  expect(screen.queryByTestId('door-recheck-note')).toBeNull();
});

it('no recheck note when Check again finds zero sold (no code box to point at)', async () => {
  await typedRefusalThenRecheck({ ...OK, rows: [], inCount: 0, totalCount: 0 });
  await waitFor(() => expect(screen.queryByTestId('door-code-input')).toBeNull());
  expect(screen.queryByTestId('door-recheck-note')).toBeNull();
});

it('the recheck note goes away with the next check-in', async () => {
  await typedRefusalThenRecheck(OK);
  expect(screen.getByTestId('door-recheck-note')).toBeTruthy();
  api.checkIn.mockResolvedValue({ ...NOT_ALLOWED, result: 'ok', first_name: 'Aisha', quantity: 1, in_count: 2, total_count: 3 });
  fireEvent.change(screen.getByTestId('door-code-input'), { target: { value: 'ef'.repeat(32) } });
  fireEvent.click(screen.getByTestId('door-code-check'));
  await waitFor(() => expect(api.checkIn).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByTestId('door-recheck-note')).toBeNull());
});
