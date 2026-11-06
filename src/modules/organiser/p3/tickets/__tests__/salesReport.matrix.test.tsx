// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { SHAPES, SHAPE_KEYS, order, type, type Shape } from './fixtures';
import { dataMock, load, show } from './harness';
import { REPORT_SOURCE_TEXT } from '../salesReportModel';
import { SalesReport } from '../SalesReport';

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
    // the source label: shown only with orders to point at; says what the gross includes
    const source = screen.queryByTestId('tix-report-source');
    if (counted === 0) expect(source).toBeNull();
    else expect(source?.textContent).toBe(REPORT_SOURCE_TEXT);
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

describe('SalesReport rendered directly (shapes the list view cannot reach)', () => {
  const T = type('t1', { name: 'General', capacity: 50, reserved: 1 });
  const renderReport = (orders: ReturnType<typeof order>[]) =>
    show(<SalesReport seriesId="ser-1" eventName="Sunday Social" types={[T]} orders={orders} today="2026-10-27" />);

  it('0 counted orders: empty words, no source label, Download greyed with why', () => {
    renderReport([]);
    expect(screen.getByTestId('tix-report-empty').textContent).toMatch(/No sales to report yet/);
    expect(screen.queryByTestId('tix-report-source')).toBeNull();
    expect(screen.queryByTestId('tix-report-notpaid')).toBeNull();
    expect((screen.getByTestId('tix-report-download') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('tix-report-why').textContent).toMatch(/No paid orders/);
  });
  it('notPaid-only: one pending order is left out, said once, nothing counted', () => {
    renderReport([order('p1', 't1', { status: 'pending', paidAt: null })]);
    expect(screen.getByTestId('tix-report-empty')).toBeTruthy();
    expect(screen.getByTestId('tix-report-notpaid').textContent).toBe('1 order not paid, left out.');
    expect((screen.getByTestId('tix-report-download') as HTMLButtonElement).disabled).toBe(true);
  });
  it('notPaid-only: several pending / expired orders use the plural', () => {
    renderReport([order('p1', 't1', { status: 'pending', paidAt: null }), order('p2', 't1', { status: 'expired', paidAt: null })]);
    expect(screen.getByTestId('tix-report-notpaid').textContent).toBe('2 orders not paid, left out.');
  });
  it('lost dispute: its own Disputed line, not sold, Net 0.00', () => {
    renderReport([order('d1', 't1', { status: 'disputed', quantity: 1, totalPence: 1200, refundedPence: 0 })]);
    const row = screen.getByTestId('tix-report-row-t1');
    expect(row.querySelector('[data-testid="tix-report-counts"]')?.textContent).toMatch(/^0 sold/);
    expect(row.querySelector('[data-testid="tix-report-disputed"]')?.textContent).toMatch(/Disputed 1 .*12\.00/);
    expect(row.querySelector('[data-testid="tix-report-money"]')?.textContent).toMatch(/Net \S*0\.00/);
    expect(screen.getByTestId('tix-report-total-money').textContent).toMatch(/Net \S*0\.00/);
    expect(screen.queryByTestId('tix-report-notpaid')).toBeNull();
  });
});
