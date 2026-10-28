// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
    expect(screen.getByTestId('tix-refund-order').textContent).toContain('2 \u00D7 \u00A312.50');
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

describe('focus inside a layer, and no close while a write is in flight (review round 1)', () => {
  beforeEach(() => load(SHAPES.selling));

  it('the add sheet opens on Name, step 2 on Places, Back lands inside the sheet (never on Close, never on body)', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    expect(document.activeElement).toBe(screen.getByTestId('tix-form-name'));
    fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Door' } });
    tap(screen.getByTestId('tix-next'));
    expect(document.activeElement).toBe(screen.getByTestId('tix-form-capacity'));
    tap(screen.getByTestId('tix-sheet-back'));
    expect(document.activeElement).toBe(screen.getByTestId('tix-form-name'));
  });

  it('the Refund sheet opens on Keep the order, not on the money button', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(within(screen.getByTestId('tix-order-o0')).getByTestId('tix-refund'));
    expect(document.activeElement).toBe(screen.getByTestId('tix-refund-cancel'));
  });

  it('a refund in flight: the sheet still closes, its Refund button waits, a late refusal comes back as a toast', async () => {
    let answer: (v: unknown) => void = () => {};
    api.refundOrder.mockReturnValue(new Promise((r) => { answer = r; }));
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(within(screen.getByTestId('tix-order-o0')).getByTestId('tix-refund'));
    fireEvent.click(screen.getByTestId('tix-refund-confirm'));
    fireEvent.click(screen.getByTestId('tix-refund-cancel'));
    expect(layers()).toEqual(['tix-tall']);
    const btn = within(screen.getByTestId('tix-order-o0')).getByTestId('tix-refund') as HTMLButtonElement;
    expect([btn.disabled, btn.textContent]).toEqual([true, 'Refunding\u2026']);
    answer({ kind: 'failed', reason: null });
    expect((await screen.findByTestId('tix-toast')).querySelector('span')?.textContent).toBe("Refund for Buyer o0's order did not start. That did not work. Try again in a moment.");
    expect(api.refundOrder).toHaveBeenCalledTimes(1);
  });

  it('a save in flight: the sheet still closes, the draft is dropped so it cannot be sent twice', async () => {
    let answer: (v: unknown) => void = () => {};
    api.upsertTicketType.mockReturnValue(new Promise((r) => { answer = r; }));
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    toReview();
    fireEvent.click(screen.getByTestId('tix-save'));
    esc();
    expect(layers()).toEqual(['tix-tall']);
    tap(screen.getByTestId('tix-add'));
    expect((screen.getByTestId('tix-form-name') as HTMLInputElement).value).toBe('');
    esc();
    answer({ ok: true, reason: null, id: 'x' });
    expect(await screen.findByTestId('tix-toast')).toBeTruthy();
    expect(api.upsertTicketType).toHaveBeenCalledTimes(1);
  });

  it('two switches tapped quickly each stay busy until their own answer', async () => {
    const answers: Array<(v: unknown) => void> = [];
    api.setTicketStatus.mockImplementation(() => new Promise((r) => answers.push(r)));
    load(SHAPES.survey);
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    const sw = (id: string) => within(screen.getByTestId(`tix-type-${id}`)).getByTestId('tix-switch') as HTMLButtonElement;
    fireEvent.click(sw('t-free'));
    fireEvent.click(sw('t-paid'));
    expect([sw('t-free').disabled, sw('t-paid').disabled]).toEqual([true, true]);
    answers[0]({ ok: false, reason: 'bad_transition' });
    expect(await screen.findByTestId('tix-move-error')).toBeTruthy();
    expect([sw('t-free').disabled, sw('t-paid').disabled]).toEqual([false, true]);
    answers[1]({ ok: false, reason: 'bad_transition' });
    await waitFor(() => expect(screen.getAllByTestId('tix-move-error')).toHaveLength(2));
  });
});

describe('a late outcome never touches the sheet open NOW (review r1 F1, F2, F3, F4)', () => {
  beforeEach(() => load(SHAPES.selling));

  it('F2: a late refund success for order A leaves the Refund sheet open for order B', async () => {
    let answer: (v: unknown) => void = () => {};
    api.refundOrder.mockReturnValueOnce(new Promise((r) => { answer = r; }));
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(within(screen.getByTestId('tix-order-o0')).getByTestId('tix-refund'));
    fireEvent.click(screen.getByTestId('tix-refund-confirm'));
    fireEvent.click(screen.getByTestId('tix-refund-cancel'));
    tap(within(screen.getByTestId('tix-order-o1')).getByTestId('tix-refund'));
    expect(layers()).toEqual(['tix-tall', 'tix-refund-sheet']);
    await act(async () => answer({ kind: 'ok' }));
    // R2: the late words name the order they are about, never read as B's.
    expect((await screen.findByTestId('tix-toast')).textContent).toBe("Refund started for Buyer o0's order.");
    expect(layers()).toEqual(['tix-tall', 'tix-refund-sheet']);
    expect(api.refundOrder).toHaveBeenCalledTimes(1);
  });

  it('F1: a late save success leaves the second add sheet open with its draft', async () => {
    let answer: (v: unknown) => void = () => {};
    api.upsertTicketType.mockReturnValueOnce(new Promise((r) => { answer = r; }));
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    toReview();
    fireEvent.click(screen.getByTestId('tix-save'));
    esc();
    tap(screen.getByTestId('tix-add'));
    fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Second ticket' } });
    await act(async () => answer({ ok: true, reason: null, id: 'x' }));
    expect((await screen.findByTestId('tix-toast')).textContent).toBe('"Late bird": Ticket saved as a draft. Switch it to Selling when you are ready.');
    expect(layers()).toEqual(['tix-tall', 'tix-sheet']);
    expect((screen.getByTestId('tix-form-name') as HTMLInputElement).value).toBe('Second ticket');
  });

  const roles = () => screen.queryAllByTestId('tix-toast').map((t) => t.getAttribute('role'));

  it('F3 / P1: a late refusal is an alert a status toast never clears; the status goes at 8 s, the alert stays', async () => {
    // R3: the fake clock goes in BEFORE mount, so every toast timer is on it (the old order let a real timer escape).
    vi.useFakeTimers();
    try {
      let answer: (v: unknown) => void = () => {};
      api.refundOrder.mockReturnValueOnce(new Promise((r) => { answer = r; }));
      api.setTicketStatus.mockResolvedValue({ ok: true, reason: null });
      show(<TicketsEntry seriesId="ser-1" />);
      tap(screen.getByTestId('tix-row'));
      tap(within(screen.getByTestId('tix-order-o0')).getByTestId('tix-refund'));
      fireEvent.click(screen.getByTestId('tix-refund-confirm'));
      fireEvent.click(screen.getByTestId('tix-refund-cancel'));
      await act(async () => answer({ kind: 'failed', reason: null }));
      expect(roles()).toEqual(['alert']);
      expect(screen.getByTestId('tix-toast').textContent).toContain("Buyer o0's order");
      fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-switch'));
      await act(async () => { await Promise.resolve(); });
      expect(roles().sort()).toEqual(['alert', 'status']);
      act(() => { vi.advanceTimersByTime(8_001); });
      expect(roles()).toEqual(['alert']);
    } finally {
      vi.useRealTimers();
    }
    const dismiss = screen.getByTestId('tix-toast-dismiss');
    expect(dismiss.className).toContain('p3-link');
    fireEvent.click(dismiss);
    expect(screen.queryByTestId('tix-toast')).toBeNull();
  });

  it('P1b: two late refusals both stay readable, each naming its order', async () => {
    const answers: Array<(v: unknown) => void> = [];
    api.refundOrder.mockImplementation(() => new Promise((r) => answers.push(r)));
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    for (const id of ['o0', 'o1']) {
      tap(within(screen.getByTestId(`tix-order-${id}`)).getByTestId('tix-refund'));
      fireEvent.click(screen.getByTestId('tix-refund-confirm'));
      fireEvent.click(screen.getByTestId('tix-refund-cancel'));
    }
    await act(async () => answers[0]({ kind: 'not_configured' }));
    await act(async () => answers[1]({ kind: 'failed', reason: null }));
    const shown = screen.getAllByTestId('tix-toast');
    expect(shown.map((t) => t.getAttribute('role'))).toEqual(['alert', 'alert']);
    expect(shown.map((t) => /Buyer (o\d)/.exec(t.textContent ?? '')?.[1])).toEqual(['o0', 'o1']);
    fireEvent.click(within(shown[0]).getByTestId('tix-toast-dismiss'));
    expect(screen.getByTestId('tix-toast').textContent).toContain('Buyer o1');
  });

  it('R5 / P9: Escape while "Close sales" is in flight keeps "Closing\u2026" (no false Close sales for good)', async () => {
    api.setTicketStatus.mockReturnValueOnce(new Promise(() => {}));
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-close'));
    fireEvent.click(screen.getByTestId('tix-close-confirm'));
    expect(screen.getByTestId('tix-close-confirm').textContent).toBe('Closing\u2026');
    esc();
    expect(screen.getByTestId('tix-close-confirm').textContent).toBe('Closing\u2026');
    expect(screen.queryByTestId('tix-close')).toBeNull();
    expect((screen.getByTestId('tix-close-keep') as HTMLButtonElement).disabled).toBe(true);
    expect(api.setTicketStatus).toHaveBeenCalledTimes(1);
  });

  it('F6: Escape inside "Close sales for good?" means Keep selling; the next Escape closes the sheet', () => {
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-edit'));
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-next'));
    fireEvent.click(screen.getByTestId('tix-close'));
    expect(screen.getByTestId('tix-close-keep')).toBeTruthy();
    esc();
    expect(layers()).toEqual(['tix-tall', 'tix-sheet']);
    expect([screen.queryByTestId('tix-close-keep'), !!screen.queryByTestId('tix-close')]).toEqual([null, true]);
    esc();
    expect(layers()).toEqual(['tix-tall']);
    expect(api.setTicketStatus).not.toHaveBeenCalled();
  });

  it('F5: while sales are loading the price waits with "Checking sales", it never unlocks first', () => {
    // A type with nothing reserved: only the sales and orders reads can say whether it has sold.
    load(SHAPES.survey);
    q.summary = pending();
    q.orders = ok([]);
    const view = show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(within(screen.getByTestId('tix-type-t-paid')).getByTestId('tix-edit'));
    expect((screen.getByTestId('tix-form-price') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('tix-price-help').textContent).toBe('Checking sales\u2026');
    load(SHAPES.survey);
    view.again();
    expect(screen.getByTestId('tix-price-help').textContent).not.toBe('Checking sales\u2026');
  });

  it('F4: one switch success keeps another row\'s refusal on screen', async () => {
    const answers: Array<(v: unknown) => void> = [];
    api.setTicketStatus.mockImplementation(() => new Promise((r) => answers.push(r)));
    load(SHAPES.survey);
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    const row = (id: string) => screen.getByTestId(`tix-type-${id}`);
    fireEvent.click(within(row('t-paid')).getByTestId('tix-switch'));
    await act(async () => answers[0]({ ok: false, reason: 'bad_transition' }));
    expect(within(row('t-paid')).getByTestId('tix-move-error')).toBeTruthy();
    fireEvent.click(within(row('t-free')).getByTestId('tix-switch'));
    await act(async () => answers[1]({ ok: true, reason: null }));
    expect(await screen.findByTestId('tix-toast')).toBeTruthy();
    expect(within(row('t-paid')).queryByTestId('tix-move-error')).toBeTruthy();
  });

  it('a late "Put on sale" that saved but was refused on sale is an alert, not an 8 s status', async () => {
    let answer: (v: unknown) => void = () => {};
    api.upsertTicketType.mockReturnValueOnce(new Promise((r) => { answer = r; }));
    api.setTicketStatus.mockResolvedValueOnce({ ok: false, reason: null });
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    tap(screen.getByTestId('tix-add'));
    toReview();
    fireEvent.click(screen.getByTestId('tix-sell'));
    esc();
    await act(async () => answer({ ok: true, reason: null, id: 'x' }));
    const toast = await screen.findByTestId('tix-toast');
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.textContent).toContain('"Late bird": Ticket saved as a draft, not on sale yet.');
  });

  it('R4: a save that lands late clears its own row\'s stale switch reason, and only that one', async () => {
    load(SHAPES.survey);
    api.setTicketStatus.mockResolvedValue({ ok: false, reason: 'bad_transition' });
    let answer: (v: unknown) => void = () => {};
    api.upsertTicketType.mockReturnValueOnce(new Promise((r) => { answer = r; }));
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    const row = (id: string) => screen.getByTestId(`tix-type-${id}`);
    for (const id of ['t-paid', 't-free']) {
      fireEvent.click(within(row(id)).getByTestId('tix-switch'));
      await act(async () => { await Promise.resolve(); });
    }
    tap(within(row('t-free')).getByTestId('tix-edit'));
    fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Door renamed' } });
    fireEvent.click(screen.getByTestId('tix-save'));
    esc();
    await act(async () => answer({ ok: true, reason: null, id: 't-free' }));
    expect(screen.getByTestId('tix-toast').textContent).toBe('"Door": Ticket saved.');
    expect([!!within(row('t-paid')).queryByTestId('tix-move-error'), !!within(row('t-free')).queryByTestId('tix-move-error')]).toEqual([true, false]);
  });

  it('the same words said twice are a new toast with a new 8 s', async () => {
    vi.useFakeTimers();
    try {
      api.setTicketStatus.mockResolvedValue({ ok: true, reason: null });
      show(<TicketsEntry seriesId="ser-1" />);
      tap(screen.getByTestId('tix-row'));
      const flip = async () => {
        fireEvent.click(within(screen.getByTestId('tix-type-t-sell')).getByTestId('tix-switch'));
        await act(async () => { await Promise.resolve(); });
      };
      await flip();
      act(() => { vi.advanceTimersByTime(6_000); });
      await flip();
      act(() => { vi.advanceTimersByTime(3_000); });
      expect(screen.queryByTestId('tix-toast')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(5_001); });
      expect(screen.queryByTestId('tix-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('R4 / P6: an edit SAVE success keeps another row\'s switch refusal', async () => {
    load(SHAPES.survey);
    api.setTicketStatus.mockResolvedValueOnce({ ok: false, reason: 'bad_transition' });
    api.upsertTicketType.mockResolvedValueOnce({ ok: true, reason: null, id: 't-free' });
    show(<TicketsEntry seriesId="ser-1" />);
    tap(screen.getByTestId('tix-row'));
    fireEvent.click(within(screen.getByTestId('tix-type-t-paid')).getByTestId('tix-switch'));
    await act(async () => { await Promise.resolve(); });
    expect(within(screen.getByTestId('tix-type-t-paid')).getByTestId('tix-move-error')).toBeTruthy();
    tap(within(screen.getByTestId('tix-type-t-free')).getByTestId('tix-edit'));
    fireEvent.change(screen.getByTestId('tix-form-name'), { target: { value: 'Door renamed' } });
    fireEvent.click(screen.getByTestId('tix-save'));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('tix-toast').textContent).toBe('Ticket saved.');
    expect(within(screen.getByTestId('tix-type-t-paid')).queryByTestId('tix-move-error')).toBeTruthy();
  });
});
