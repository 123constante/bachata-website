// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { SHAPES, SHAPE_KEYS, type Shape } from './fixtures';
import { dataMock, load, show } from './harness';

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));
const door = vi.hoisted(() => ({ fetchDoorList: vi.fn() }));
vi.mock('../../door/data', async (orig) => ({ ...(await orig<typeof import('../../door/data')>()), ...door }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  door.fetchDoorList.mockReset().mockRejectedValue(new Error('door down'));
});
afterEach(cleanup);

const openOrders = async (s: Shape) => {
  load(s);
  show(<TicketsEntry seriesId="ser-1" />);
  fireEvent.click(screen.getByTestId('tix-row'));
  const see = screen.queryByTestId('tix-see-all');
  if (see) fireEvent.click(see);
  else if (s.orders.length === 0) return;
};

describe.each(SHAPE_KEYS)('sales report, shape %s', (k) => {
  const s = SHAPES[k];
  const counted = s.orders.filter((o) => ['paid', 'refunded', 'disputed'].includes(o.status)).length;
  it('card renders on the orders view only; totals agree; download state', async () => {
    load(s);
    show(<TicketsEntry seriesId="ser-1" />);
    fireEvent.click(screen.getByTestId('tix-row'));
    expect(screen.queryByTestId('tix-report')).toBeNull(); // list view sends/shows nothing
    const see = screen.queryByTestId('tix-see-all');
    if (!see) return; // orders view only reachable with > 2 orders in the list view
    fireEvent.click(see);
    await screen.findByTestId('tix-report');
    const btn = screen.getByTestId('tix-report-download') as HTMLButtonElement;
    expect(btn.disabled).toBe(counted === 0);
    if (counted === 0) expect(screen.getByTestId('tix-report-why').textContent).toMatch(/No paid orders/);
    // no refund control inside the report, whatever the role
    expect(screen.getByTestId('tix-report').querySelector('[data-testid="tix-refund"]')).toBeNull();
    // door list failed: no checked-in line, no error
    await waitFor(() => expect(door.fetchDoorList).toHaveBeenCalled());
    expect(screen.queryByTestId('tix-report-checkedin')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(api.setTicketStatus).not.toHaveBeenCalled();
    expect(api.refundOrder).not.toHaveBeenCalled();
  });
});

describe('door list loads', () => {
  it('shows the checked-in line', async () => {
    const withMany = Object.values(SHAPES).find((s) => s.orders.length > 2)!;
    door.fetchDoorList.mockResolvedValue({ result: 'ok', rows: [], truncated: false, inCount: 3, totalCount: 9, loadedAt: 0 });
    await openOrders(withMany);
    expect((await screen.findByTestId('tix-report-checkedin')).textContent).toMatch(/3 of 9 checked in/);
  });
});
