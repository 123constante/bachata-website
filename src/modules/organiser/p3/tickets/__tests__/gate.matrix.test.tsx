// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { SHAPES, sales, type } from './fixtures';
import { dataMock, load, show } from './harness';
import { closeGate, getGate, subscribeGate } from '../../onboarding/gate';
import { SELL_HELD } from '../gateCopy';

/**
 * F-11: every gated ticket write x {gate off, gate on and refused, gate on and passed}. The live bodies (read on prod
 * 2026-11-01): ticket_type_upsert_v1 runs _require_onboarding_complete_v1 in BOTH branches (create: the new
 * ticket's page; update: the existing ticket's page, after its FOR UPDATE read), and
 * ticket_type_set_status_v1 only for p_status = 'on_sale'; the refusal raises P0001 'onboarding_incomplete' with
 * DETAIL {missing, organiser_id}, which supabase-js hands back as `error` and ticketsApi throws. "Gate off" and
 * "gate on, passed" both answer ok from the server, so for the client they are the same row; both are kept so the
 * table reads as the brief lists it.
 */
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

const REFUSAL = { code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: ['org_logo'], organiser_id: 'org-1' }), hint: 'Finish your details' };
const GENERIC = 'That did not work. Try again in a moment.';
type Gate = 'gate off' | 'gate on, refused' | 'gate on, passed';
const GATES: Gate[] = ['gate off', 'gate on, refused', 'gate on, passed'];

let off: () => void = () => undefined;
beforeEach(() => {
  vi.clearAllMocks();
  off = subscribeGate(() => undefined); // P3Shell's GateHost, listening
});
afterEach(() => { cleanup(); act(() => closeGate()); off(); });

const open = () => fireEvent.click(screen.getByTestId('tix-row'));
function fillNew() {
  fireEvent.click(screen.getByTestId('tix-add'));
  fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Standard' } });
  fireEvent.change(screen.getByTestId('tix-form-price'), { target: { value: '12' } });
  fireEvent.click(screen.getByTestId('tix-next'));
  fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '40' } });
  fireEvent.click(screen.getByTestId('tix-next'));
}
const answer = (g: Gate) => (g === 'gate on, refused' ? Promise.reject(REFUSAL) : Promise.resolve({ ok: true, reason: null, id: 't-new' }));

describe('Add ticket (ticket_type_upsert_v1 create) x gate', () => {
  it.each(GATES)('%s', async (g) => {
    load(SHAPES.selling);
    api.upsertTicketType.mockImplementation(() => answer(g));
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fillNew();
    fireEvent.click(screen.getByTestId('tix-save'));
    await waitFor(() => expect(api.upsertTicketType).toHaveBeenCalledTimes(1));
    if (g === 'gate on, refused') {
      await waitFor(() => expect(getGate()).not.toBeNull());
      expect(getGate()).toMatchObject({ organiserId: 'org-1', missing: ['org_logo'] });
      expect(document.body.textContent).not.toContain(GENERIC);
      expect(screen.getByTestId('tix-save')).toBeTruthy(); // the ticket sheet stays open under the gate sheet
    } else {
      expect(await screen.findByTestId('tix-toast')).toBeTruthy();
      expect(getGate()).toBeNull();
    }
  });
});

describe('Add and sell (create, then ticket_type_set_status_v1 on_sale) x gate', () => {
  it.each(GATES)('%s', async (g) => {
    load(SHAPES.selling);
    api.upsertTicketType.mockResolvedValue({ ok: true, reason: null, id: 't-new' });
    api.setTicketStatus.mockImplementation(() => answer(g));
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fillNew();
    fireEvent.click(screen.getByTestId('tix-sell'));
    const toast = await screen.findByTestId('tix-toast');
    expect(api.setTicketStatus).toHaveBeenCalledWith('t-new', 'on_sale');
    if (g === 'gate on, refused') {
      // the real state: saved as a draft, on sale once the details are finished; and the sheet that finishes them
      expect(toast.textContent).toBe(SELL_HELD);
      expect(toast.textContent).not.toContain('Try again');
      expect(getGate()).not.toBeNull();
    } else {
      expect(toast.textContent).toBe('Ticket added and on sale.');
      expect(getGate()).toBeNull();
    }
  });
});

describe('Switch to Selling on a row (ticket_type_set_status_v1 on_sale) x gate', () => {
  it.each(GATES)('%s', async (g) => {
    const t = type('t-pz', { status: 'paused' });
    load({ ...SHAPES.selling, types: [t], sales: [sales(t)], orders: [] });
    api.setTicketStatus.mockImplementation(() => answer(g));
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    const row = screen.getByTestId('tix-type-t-pz');
    fireEvent.click(within(row).getByTestId('tix-switch'));
    await waitFor(() => expect(api.setTicketStatus).toHaveBeenCalledWith('t-pz', 'on_sale'));
    if (g === 'gate on, refused') {
      await waitFor(() => expect(getGate()).not.toBeNull());
      expect(within(row).queryByTestId('tix-move-error')).toBeNull();
    } else {
      await waitFor(() => expect(within(row).queryByTestId('tix-move-error')).toBeNull());
      expect(getGate()).toBeNull();
    }
  });
  it('a non-gate failure still says so on the row (the mapping changes only the refusal)', async () => {
    const t = type('t-pz', { status: 'paused' });
    load({ ...SHAPES.selling, types: [t], sales: [sales(t)], orders: [] });
    api.setTicketStatus.mockRejectedValue(new Error('Failed to fetch'));
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fireEvent.click(within(screen.getByTestId('tix-type-t-pz')).getByTestId('tix-switch'));
    expect((await screen.findByTestId('tix-move-error')).textContent).toBe(GENERIC);
    expect(getGate()).toBeNull();
  });
});

describe('Edit an existing ticket (ticket_type_upsert_v1 update branch, gated too) x gate', () => {
  it.each(GATES)('changed, %s', async (g) => {
    load(SHAPES.selling);
    api.upsertTicketType.mockImplementation(() => (g === 'gate on, refused' ? Promise.reject(REFUSAL) : Promise.resolve({ ok: true, reason: null, id: 't-sell' })));
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
    fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Standard (renamed)' } });
    fireEvent.click(screen.getByTestId('tix-save'));
    await waitFor(() => expect(api.upsertTicketType).toHaveBeenCalledTimes(1));
    if (g === 'gate on, refused') {
      // opens the shared sheet; no generic error, no "Try again"; the ticket sheet stays under it
      await waitFor(() => expect(getGate()).not.toBeNull());
      expect(getGate()).toMatchObject({ organiserId: 'org-1', missing: ['org_logo'] });
      expect(document.body.textContent).not.toContain(GENERIC);
      expect(screen.queryByTestId('tix-form-error')).toBeNull();
      expect(screen.getByTestId('tix-save')).toBeTruthy();
    } else {
      expect(await screen.findByTestId('tix-toast')).toBeTruthy();
      expect(getGate()).toBeNull();
    }
  });
  it('untouched: sends nothing, never opens the gate', async () => {
    load(SHAPES.selling);
    api.upsertTicketType.mockResolvedValue({ ok: true, reason: null, id: 't-sell' });
    show(<TicketsEntry seriesId="ser-1" />);
    open();
    fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
    fireEvent.click(screen.getByTestId('tix-save'));
    expect((await screen.findByTestId('tix-toast')).textContent).toBe('Nothing changed, so nothing was saved.');
    expect(api.upsertTicketType).not.toHaveBeenCalled();
    expect(getGate()).toBeNull();
  });
});
