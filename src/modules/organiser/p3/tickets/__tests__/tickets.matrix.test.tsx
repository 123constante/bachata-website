// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { NOT_MANAGER, NOT_MANAGER_REFUND, refundable } from '../../../tickets/ticketModel';
import { PAYMENTS_WHERE, shownOrders } from '../model';
import { SHAPES, SHAPE_KEYS, type Shape, type ShapeKey } from './fixtures';
import { dataMock, load, show } from './harness';

/*
 * W-T consistency matrix: the event page's Tickets row and its tall sheet x every surveyed
 * shape (fixtures.ts). Every order shows its state tag; Refund is a separate button; every
 * greyed control says why; no line points at a control or a screen that is not there.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

const ROW: Record<ShapeKey, [string, string]> = {
  bare: ['No tickets', 'Add a ticket'],
  survey: ['Not selling', 'Paused \u00B7 2 sold'],
  selling: ['Selling', '34 sold \u00B7 26 left of 60'],
  started: ['Not selling', 'Not on sale yet \u00B7 0 sold'],
  closed: ['No tickets', '3 sold \u00B7 Add a ticket'],
  past: ['Not selling', 'Paused \u00B7 4 sold'],
  contributor: ['Selling', '26 left of 40'],
};

const open = () => fireEvent.click(screen.getByTestId('tix-row'));

describe.each(SHAPE_KEYS)('shape %s', (k) => {
  const s: Shape = SHAPES[k];
  const manager = s.role === 'owner' || s.role === 'manager';
  beforeEach(() => load(s));

  it('the row: chip and detail', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    expect(screen.getByTestId('tix-row-chip').textContent).toBe(ROW[k][0]);
    expect(screen.getByTestId('tix-row-detail').textContent).toBe(` \u00B7 ${ROW[k][1]}`);
  });

  it('the sheet: rules line, one row per type, the read-only note only for a contributor', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    const sheet = screen.getByTestId('tix-tall');
    expect(within(sheet).getByTestId('tix-event-rules').textContent).toBe(
      'Next: Sunday 1 November. Buyers pay a 50p booking fee per paid ticket, up to 20 tickets an order.',
    );
    expect(within(sheet).queryByTestId('tix-readonly')?.textContent ?? null).toBe(manager ? null : NOT_MANAGER);
    for (const t of s.types) {
      const row = within(sheet).getByTestId(`tix-type-${t.id}`);
      if (t.status === 'closed') expect(within(row).getByTestId('tix-type-closed').textContent).toBe('Closed');
      else {
        const sw = within(row).getByTestId('tix-switch') as HTMLButtonElement;
        // a greyed switch always says why: under the row, or once at the top (the role reason)
        if (sw.disabled && manager) expect(within(row).getByTestId('tix-switch-reason').textContent).not.toBe('');
        if (!manager) expect(sw.disabled).toBe(true);
      }
    }
    if (s.types.length === 0) expect(within(sheet).getByTestId('tix-types-empty')).toBeTruthy();
  });

  it('orders: the state tag is ALWAYS shown; Refund is a separate button, only for a manager on a paid order', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    const shown = shownOrders(s.orders);
    if (s.types.length === 0) return;
    if (shown.length === 0) {
      expect(screen.getByTestId('tix-orders-empty').textContent).toMatch(/^No orders yet\./);
      return;
    }
    const preview = shown.slice(0, 2);
    for (const o of preview) {
      const row = screen.getByTestId(`tix-order-${o.id}`);
      expect(within(row).getByTestId('tix-order-tag').textContent).toMatch(/^(Paid|Refunded|Disputed)$/);
      expect(within(row).queryAllByTestId('tix-refund')).toHaveLength(manager && refundable(o) ? 1 : 0);
    }
    expect(screen.queryByTestId('tix-see-all')?.textContent ?? null).toBe(shown.length > 2 ? `See all ${shown.length} orders` : null);
    expect(screen.queryByTestId('tix-refund-reason')?.textContent ?? null).toBe(!manager && shown.some(refundable) ? NOT_MANAGER_REFUND : null);
  });

  it('Add a ticket: enabled, or greyed with its reason on screen', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    const add = screen.getByTestId('tix-add') as HTMLButtonElement;
    const live = s.lifecycle === 'live';
    expect(add.disabled).toBe(!manager || !live);
    if (add.disabled) {
      const why = s.types.length ? screen.getByTestId('tix-add-reason').textContent : screen.getByTestId('tix-types-empty').textContent;
      expect(why).toContain(!manager ? NOT_MANAGER : 'Put this event live before adding tickets.');
    }
  });

  it('no line points at a screen P3 has not got', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    expect(document.body.textContent).not.toMatch(/Tickets home|ticket home/i);
  });
});

describe('the add sheet, paid, payments not connected', () => {
  it('Put on sale is greyed and says where to connect (You > Get paid, which exists)', () => {
    load(SHAPES.started);
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fireEvent.click(screen.getByTestId('tix-add'));
    fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Standard' } });
    fireEvent.change(screen.getByTestId('tix-form-price'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '40' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    expect((screen.getByTestId('tix-sell') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('tix-sell-reason').textContent).toBe(PAYMENTS_WHERE);
    expect((screen.getByTestId('tix-save') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('untouched edit sends nothing', () => {
  it('Save changes on an untouched ticket sends no command and says so', async () => {
    load(SHAPES.selling);
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
    fireEvent.click(screen.getByTestId('tix-save'));
    expect(await screen.findByTestId('tix-toast')).toBeTruthy();
    expect(screen.getByTestId('tix-toast').textContent).toBe('Nothing changed, so nothing was saved.');
    expect(api.upsertTicketType).not.toHaveBeenCalled();
    expect(api.setTicketStatus).not.toHaveBeenCalled();
  });
  it('a sold ticket says why its price is locked', () => {
    load(SHAPES.selling);
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
    expect((screen.getByTestId('tix-form-price') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('tix-price-help').textContent).toBe('The price cannot change once someone has bought a ticket.');
  });
});

describe('the Selling switch', () => {
  it('one tap sends one status move and the toast names it', async () => {
    load(SHAPES.survey);
    api.setTicketStatus.mockResolvedValue({ ok: true, reason: null });
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fireEvent.click(within(screen.getByTestId('tix-type-t-free')).getByTestId('tix-switch'));
    expect(await screen.findByTestId('tix-toast')).toBeTruthy();
    expect(api.setTicketStatus).toHaveBeenCalledTimes(1);
    expect(api.setTicketStatus).toHaveBeenCalledWith('t-free', 'on_sale');
    expect(screen.getByTestId('tix-toast').textContent).toBe('Door: Selling');
  });
  it('a server refusal shows under the row in P3 words', async () => {
    load(SHAPES.survey);
    api.setTicketStatus.mockResolvedValue({ ok: false, reason: 'organiser_not_onboarded' });
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fireEvent.click(within(screen.getByTestId('tix-type-t-free')).getByTestId('tix-switch'));
    expect((await screen.findByTestId('tix-move-error')).textContent).toBe(PAYMENTS_WHERE);
  });
});
