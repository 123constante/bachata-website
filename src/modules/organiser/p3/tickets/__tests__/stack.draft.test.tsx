// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { SHAPES } from './fixtures';
import { dataMock, load, pending, q, show, ok } from './harness';

/*
 * Mockup C's named risk: sheets on sheets. The add-ticket and Refund sheets open OVER the
 * tall Tickets sheet; closing each gives focus back to the control that opened it; Back
 * and Escape never close two layers. And the add-ticket draft survives a re-render, a
 * refetch and the sheet layer mounting again (the S3 defect: reset once at the review step).
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

/** Focus, then click: a real tap focuses the control first. */
const tap = (el: HTMLElement) => {
  el.focus();
  fireEvent.click(el);
};
const esc = () => fireEvent.keyDown(document, { key: 'Escape' });
const layers = () => screen.queryAllByRole('dialog').map((d) => d.getAttribute('data-testid'));

describe('stacked sheets', () => {
  beforeEach(() => load(SHAPES.selling));

  it('the tall sheet closes back to the Tickets row', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    expect(layers()).toEqual(['tix-tall']);
    esc();
    expect(layers()).toEqual([]);
    expect(document.activeElement).toBe(screen.getByTestId('tix-row'));
  });

  it('add sheet over the tall sheet: Escape closes ONE layer and focus returns to Add a ticket', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    expect(layers()).toEqual(['tix-tall', 'tix-sheet']);
    expect(screen.getByTestId('tix-tall').getAttribute('data-top')).toBe('false');
    esc();
    expect(layers()).toEqual(['tix-tall']);
    expect(document.activeElement).toBe(screen.getByTestId('tix-add'));
    esc();
    expect(layers()).toEqual([]);
  });

  it('Back in the add sheet goes one step, never closes a layer', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Door' } });
    fireEvent.click(screen.getByTestId('tix-next'));
    expect(screen.getByTestId('tix-step').textContent).toBe('2 / 3');
    fireEvent.click(screen.getByTestId('tix-sheet-back'));
    expect(screen.getByTestId('tix-step').textContent).toBe('1 / 3');
    expect(layers()).toEqual(['tix-tall', 'tix-sheet']);
    expect(screen.queryByTestId('tix-sheet-back')).toBeNull();
  });

  it('Refund sheet over the tall sheet: Keep the order returns focus to that Refund button', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    const refund = within(screen.getByTestId('tix-order-o0')).getByTestId('tix-refund');
    tap(refund);
    expect(layers()).toEqual(['tix-tall', 'tix-refund-sheet']);
    expect(screen.getByTestId('tix-refund-order').textContent).toContain('2 × £12.50');
    fireEvent.click(screen.getByTestId('tix-refund-cancel'));
    expect(layers()).toEqual(['tix-tall']);
    expect(document.activeElement).toBe(refund);
  });

  it('the scrim of the lower layer does nothing while a layer is over it', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    const lower = screen.getByTestId('tix-tall-scrim');
    fireEvent.click(lower);
    expect(layers()).toEqual(['tix-tall', 'tix-sheet']);
  });

  it('See all opens the orders view in the same layer; Back returns to the list, the sheet stays', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    fireEvent.click(screen.getByTestId('tix-see-all'));
    expect(screen.getAllByTestId(/^tix-order-o\d$/)).toHaveLength(5);
    expect(screen.getAllByTestId('tix-order-tag').map((t) => t.textContent)).toEqual(['Paid', 'Paid', 'Paid', 'Refunded', 'Disputed']);
    expect(screen.queryByTestId('tix-add')).toBeNull();
    fireEvent.click(screen.getByTestId('tix-tall-back'));
    expect(screen.getByTestId('tix-list-view')).toBeTruthy();
    expect(layers()).toEqual(['tix-tall']);
  });
});

/** Fill steps 1 and 2 and land on the review. */
const toReview = () => {
  fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Late bird' } });
  fireEvent.change(screen.getByTestId('tix-form-price'), { target: { value: '8' } });
  fireEvent.click(screen.getByTestId('tix-next'));
  fireEvent.change(screen.getByTestId('tix-form-capacity'), { target: { value: '25' } });
  fireEvent.click(screen.getByTestId('tix-next'));
  expect(screen.getByTestId('tix-step').textContent).toBe('3 / 3');
};
const review = () => [screen.getByTestId('tix-step').textContent, screen.getByTestId('tix-review-name').textContent, screen.getByTestId('tix-review-places').textContent];
const HELD = ['3 / 3', 'Late bird', 'Places25'];

describe('the add-ticket draft is held above the sheets (defect fix, red-first)', () => {
  beforeEach(() => load(SHAPES.selling));

  it('survives a re-render', () => {
    const r = show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    toReview();
    r.again();
    expect(review()).toEqual(HELD);
  });

  it('survives a background refetch (types go back to loading, then land with new rows)', () => {
    const r = show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    toReview();
    q.types = pending();
    r.again();
    expect(screen.getByTestId('tix-types-loading')).toBeTruthy();
    q.types = ok([...SHAPES.selling.types]);
    r.again();
    expect(review()).toEqual(HELD);
  });

  it('survives the add sheet layer mounting again (closed by a stray tap, opened again)', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    toReview();
    esc();
    expect(layers()).toEqual(['tix-tall']);
    tap(screen.getByTestId('tix-add'));
    expect(review()).toEqual(HELD);
  });

  it('saving drops the draft: the next Add a ticket starts empty', async () => {
    api.upsertTicketType.mockResolvedValue({ ok: true, reason: null, id: 't-new' });
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    toReview();
    fireEvent.click(screen.getByTestId('tix-save'));
    expect((await screen.findByTestId('tix-toast')).textContent).toBe('Ticket saved as a draft. Switch it to Selling when you are ready.');
    expect(api.upsertTicketType).toHaveBeenCalledTimes(1);
    tap(screen.getByTestId('tix-add'));
    expect((screen.getByTestId('tix-form-name') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('tix-step').textContent).toBe('1 / 3');
  });

  it('editing another ticket never reuses the add draft', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    toReview();
    esc();
    fireEvent.click(within(screen.getByTestId('tix-type-t-out')).getByTestId('tix-edit'));
    expect((screen.getByTestId('tix-form-name') as HTMLInputElement).value).toBe('Early bird');
    expect(screen.getByTestId('tix-sheet').querySelector('h3')?.textContent).toBe('Edit ticket');
  });
});
