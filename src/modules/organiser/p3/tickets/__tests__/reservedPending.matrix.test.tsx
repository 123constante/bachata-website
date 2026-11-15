// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { SHAPES, sales, type } from './fixtures';
import { dataMock, load, ok, q, show } from './harness';
import { RESERVED_LOADING, type TicketType } from '../../../tickets/ticketModel';

/**
 * Admin review 1793 R3: `reserved` comes from the sales summary, never ticket_types.reserved_count. While a
 * type's count is not known (summary not ok, failed, or without the type), nothing is decided on it: the
 * sheet's save is disabled with the plain reason, and Selling waits. A known count behaves as before.
 */
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const loadWith = (known: boolean, status: TicketType['status'] = 'on_sale') => {
  const t = type('t-sell', { status, reserved: known ? 6 : 0, reservedKnown: known });
  load({ ...SHAPES.selling, types: [t], sales: [sales(t)], orders: [] });
  q.types = ok([t]);
  show(<TicketsEntry seriesId="ser-1" />);
  fireEvent.click(screen.getByTestId('tix-row'));
};

describe('TypeSheet x reserved known', () => {
  it('unknown: save disabled with the reason, and a press sends nothing', () => {
    loadWith(false);
    fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
    fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Renamed' } });
    const save = screen.getByTestId('tix-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByTestId('tix-reserved-pending').textContent).toBe(RESERVED_LOADING);
    fireEvent.click(save);
    expect(api.upsertTicketType).not.toHaveBeenCalled();
  });
  it('known: save enabled, no reason drawn', () => {
    loadWith(true);
    fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
    expect((screen.getByTestId('tix-save') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('tix-reserved-pending')).toBeNull();
  });
  it('a new ticket never waits on a count (none is taken)', () => {
    loadWith(false);
    fireEvent.click(screen.getByTestId('tix-add'));
    expect(screen.queryByTestId('tix-reserved-pending')).toBeNull();
  });
});

describe('Selling switch x reserved known', () => {
  it('unknown, paused: the switch says why it waits and does not move', () => {
    loadWith(false, 'paused');
    const row = within(screen.getByTestId('tix-type-t-sell'));
    expect(row.getByTestId('tix-switch-reason').textContent).toBe(RESERVED_LOADING);
    fireEvent.click(row.getByTestId('tix-switch'));
    expect(api.setTicketStatus).not.toHaveBeenCalled();
  });
  it('known, paused: no wait reason', () => {
    loadWith(true, 'paused');
    expect(within(screen.getByTestId('tix-type-t-sell')).queryByTestId('tix-switch-reason')).toBeNull();
  });
});
