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
const deps: ScannerDeps = {
  getStream: async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream,
  makeDetector: async () => async () => null,
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

beforeEach(() => { api.checkIn.mockReset(); api.list.mockReset(); });
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

      if (shape === 'then_ok') api.list.mockResolvedValue(OK); // typed: the list is already ok, so recheck clears the card
      else if (shape === 'then_network') api.list.mockRejectedValue(new Error('offline'));
      api.list.mockClear();
      fireEvent.click(recheck);
      await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
      expect(api.checkIn.mock.calls.length).toBe(checkIns);
      if (shape === 'then_ok' || shape === 'typed') {
        await waitFor(() => expect(screen.queryByTestId('door-act-recheck')).toBeNull());
      } else {
        await waitFor(() => expect((screen.getByTestId('door-act-recheck') as HTMLButtonElement).disabled).toBe(false));
        expect(screen.getByTestId('door-notallowed-back')).toBeTruthy();
        expect(screen.queryByRole('alert')).toBeNull();
      }
    });
  });
});
