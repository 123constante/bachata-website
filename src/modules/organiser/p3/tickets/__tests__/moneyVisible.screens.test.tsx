// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { SHAPES } from './fixtures';
import { dataMock, load, ok, q, show } from './harness';

/*
 * Part B: an owner seat whose summary says money_visible=false (server wins over the role we believed).
 * Counts stay; no pound amount on GetPaid MoneySoFar, the Home tickets tile or the Sales report.
 * Every cell also runs with money_visible true as the control, so a gate removed from the source goes red.
 * The pound sign is matched by escape, never pasted.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));

import { GetPaidScreen, TicketsSoldTile } from '../GetPaid';
import { TicketsEntry } from '../TicketsEntry';

afterEach(cleanup);
const POUND = /£/;

/** The owner shape with the server's money_visible flag set on the summary (the harness leaves it unset). */
const loadOwner = (moneyVisible: boolean) => {
  load(SHAPES.selling);
  q.summary = ok({ ok: true, reason: null, moneyVisible, types: SHAPES.selling.sales });
};

describe.each([[true], [false]] as const)('owner, money_visible %s', (visible) => {
  it('GetPaid MoneySoFar', () => {
    loadOwner(visible);
    show(<GetPaidScreen />, '/account/p3/you/get-paid');
    const block = screen.queryByTestId('tix-money');
    if (visible) expect(block?.textContent).toMatch(POUND);
    else expect(block).toBeNull();
    expect(screen.queryByTestId('tix-money-refused')).toBeNull();
  });
  it('Home tickets tile keeps the count', () => {
    loadOwner(visible);
    show(<TicketsSoldTile />, '/account/p3');
    const text = screen.getByTestId('tix-sold-tile').textContent ?? '';
    expect(text).toMatch(/^34Tickets sold/);
    expect(POUND.test(text)).toBe(visible);
  });
  it('Sales report and orders view', async () => {
    loadOwner(visible);
    show(<TicketsEntry seriesId="ser-1" />);
    fireEvent.click(screen.getByTestId('tix-row'));
    const all = screen.queryByTestId('tix-see-all');
    if (all) fireEvent.click(all);
    await screen.findByTestId('tix-report');
    const report = screen.getByTestId('tix-report');
    expect(!!within(report).queryByTestId('tix-report-total-money')).toBe(visible);
    expect(POUND.test(report.textContent ?? '')).toBe(visible);
    expect(q.ordersMoney).toBe(visible);
    // Fail closed on the orders read, and no amount or buyer name on the order lines when hidden.
    const view = screen.getByTestId('tix-orders-view').textContent ?? '';
    expect(POUND.test(view)).toBe(visible);
    if (!visible) {
      expect(screen.getAllByTestId('tix-order-buyer').every((n) => /^Order [0-9A-Z]+$/.test(n.textContent ?? ''))).toBe(true);
    }
  });
});
