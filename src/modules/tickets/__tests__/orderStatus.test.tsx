// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.fn();
// A rejecting vi.fn is reported by vitest itself as a failure, so the offline case rejects outside it.
let offline = false;
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => (offline ? Promise.reject(new Error('offline')) : rpc(...a)), auth: { getSession: vi.fn() } } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import TicketThanksPage from '../TicketThanksPage';
import { readOrderStatus } from '../ticketCheckoutApi';
import { MAX_ORDER_POLLS, UNKNOWN_READING, parseOrderStatus, pollDelayMs, thanksCopy, type ThanksOrderState } from '../ticketCheckoutModel';

const ORDER = '3f2a9c10-1111-4222-8333-444455556666';
const text = () => screen.getByTestId('tickets-thanks').textContent ?? '';
const mount = (q: string) => render(<MemoryRouter initialEntries={[`/tickets/thanks${q}`]}><TicketThanksPage /></MemoryRouter>);
const flush = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('parseOrderStatus', () => {
  it.each([
    ['null', null], ['string', 'paid'], ['array', []], ['empty', {}], ['bad status', { status: 'PAID' }], ['number status', { status: 1 }],
  ])('%s reads as unknown', (_l, raw) => expect(parseOrderStatus(raw)).toEqual(UNKNOWN_READING));
  it('reads a full paid reply and drops junk fields', () => {
    expect(parseOrderStatus({ status: 'paid', ticket_count: 2, event_title: ' Salsa Night ', event_date: '2026-11-01', x: 1 })).toEqual({
      status: 'paid', ticketCount: 2, eventTitle: 'Salsa Night', eventDate: '2026-11-01', retryLater: false,
    });
  });
  it('rejects a bad ticket_count and reads retry_later', () => {
    expect(parseOrderStatus({ status: 'paid', ticket_count: -1 }).ticketCount).toBeNull();
    expect(parseOrderStatus({ status: 'paid', ticket_count: '2' }).ticketCount).toBeNull();
    expect(parseOrderStatus({ status: 'pending', retry_later: true }).retryLater).toBe(true);
  });
});

describe('poll schedule', () => {
  it('is 2, 4, 8 then 15 s, capped at 8 polls', () => {
    expect([0, 1, 2, 3, 4, 7].map(pollDelayMs)).toEqual([2000, 4000, 8000, 15000, 15000, 15000]);
    expect(MAX_ORDER_POLLS).toBe(8);
  });
});

describe('thanksCopy: only paid says Confirmed', () => {
  const states: ThanksOrderState[] = ['confirmed', 'checking', 'none', 'paid', 'failed', 'processing'];
  it.each(states.flatMap((s) => [[s, false], [s, true]] as const))('%s free=%s', (state, free) => {
    const c = thanksCopy(free, state, { ticketCount: 2, eventTitle: 'Salsa Night', eventDate: '2026-11-01' });
    const all = `${c.title} ${c.body}`;
    if (state === 'paid') expect(c.title).toMatch(/^Confirmed\./);
    else expect(all).not.toMatch(/confirmed/i);
    if (state === 'paid') expect(c.body).toMatch(/2 tickets for Salsa Night, 2026-11-01/);
    if (state === 'failed' || state === 'processing') expect(all.length).toBeGreaterThan(20);
  });
  it('paid with no detail still reads cleanly; one ticket is singular', () => {
    expect(thanksCopy(false, 'paid').body).toMatch(/^Each ticket/);
    expect(thanksCopy(false, 'paid', { ticketCount: 1 }).body).toMatch(/^1 ticket\./);
  });
});

describe('readOrderStatus', () => {
  beforeEach(() => rpc.mockClear());
  it('calls the rpc with p_ref only (a plain POST rpc)', async () => {
    rpc.mockResolvedValue({ data: { status: 'paid' }, error: null });
    expect((await readOrderStatus(ORDER)).status).toBe('paid');
    expect(rpc).toHaveBeenCalledWith('ticket_order_public_status_v1', { p_ref: ORDER });
  });
  it.each([
    ['rpc error (not applied yet)', () => Promise.resolve({ data: null, error: { message: 'function does not exist' } })],
    ['odd shape', () => Promise.resolve({ data: 'ok', error: null })],
  ])('%s degrades to unknown', async (_l, impl) => {
    rpc.mockImplementation(impl);
    expect(await readOrderStatus(ORDER)).toEqual(UNKNOWN_READING);
  });
  it('network throw degrades to unknown', async () => {
    offline = true;
    try {
      expect(await readOrderStatus(ORDER)).toEqual(UNKNOWN_READING);
    } finally {
      offline = false;
    }
  });
});

describe('TicketThanksPage reads the order', () => {
  beforeEach(() => { vi.useFakeTimers(); rpc.mockClear(); window.sessionStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it.each([
    ['paid', false, { status: 'paid', ticket_count: 2, event_title: 'Salsa Night', event_date: '2026-11-01' }, /^Confirmed\. Your tickets are in your email\./],
    ['paid free', true, { status: 'paid', ticket_count: 1 }, /^Confirmed\./],
    ['failed', false, { status: 'failed' }, /Payment didn.t go through/],
    ['unknown', false, { status: 'unknown' }, /^Checking your order/],
    ['odd reply', false, 'nope', /^Checking your order/],
  ])('%s', async (_l, free, reply, title) => {
    rpc.mockResolvedValue({ data: reply, error: null });
    mount(`?o=${ORDER}${free ? '&free=1' : ''}`);
    await flush();
    expect(text()).toMatch(title);
    expect(rpc).toHaveBeenCalledTimes(1); // terminal states do not poll
    await flush(60_000);
    expect(rpc).toHaveBeenCalledTimes(1);
    if (!/^Confirmed/.test(text())) expect(text()).not.toMatch(/Confirmed/);
  });

  it('rpc error and network error keep today\'s neutral copy and never poll', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'missing' } });
    mount(`?o=${ORDER}`);
    await flush(60_000);
    expect(text()).toMatch(/^Checking your order/);
    expect(text()).not.toMatch(/Confirmed|processing/);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('no order: no call, neutral copy', async () => {
    mount('');
    await flush(60_000);
    expect(rpc).not.toHaveBeenCalled();
    expect(text()).toMatch(/^Checking your order/);
  });

  it('pending polls at 2, 4, 8, then 15 s, stops after 8 polls and goes calm', async () => {
    rpc.mockResolvedValue({ data: { status: 'pending' }, error: null });
    mount(`?o=${ORDER}`);
    await flush();
    expect(rpc).toHaveBeenCalledTimes(1);
    await flush(1999); expect(rpc).toHaveBeenCalledTimes(1);
    await flush(1); expect(rpc).toHaveBeenCalledTimes(2);
    await flush(4000); expect(rpc).toHaveBeenCalledTimes(3);
    await flush(8000); expect(rpc).toHaveBeenCalledTimes(4);
    await flush(15000); expect(rpc).toHaveBeenCalledTimes(5);
    expect(text()).toMatch(/^Checking your order/);
    await flush(15000 * 10);
    expect(rpc).toHaveBeenCalledTimes(1 + MAX_ORDER_POLLS);
    expect(text()).toMatch(/^Still processing/);
    expect(text()).toMatch(/Check your email in a few minutes/);
    expect(text()).not.toMatch(/Confirmed/);
    expect(screen.getByRole('link', { name: 'Back' })).toBeTruthy();
  });

  it('retry_later backs off like pending and can then resolve to paid', async () => {
    rpc.mockResolvedValueOnce({ data: { status: 'unknown', retry_later: true }, error: null })
      .mockResolvedValue({ data: { status: 'paid', ticket_count: 3 }, error: null });
    mount(`?o=${ORDER}`);
    await flush();
    expect(text()).toMatch(/^Checking your order/);
    await flush(2000);
    expect(text()).toMatch(/^Confirmed\./);
    expect(text()).toMatch(/3 tickets/);
  });

  it('pending then paid on a later poll', async () => {
    rpc.mockResolvedValueOnce({ data: { status: 'pending' }, error: null })
      .mockResolvedValue({ data: { status: 'paid' }, error: null });
    mount(`?o=${ORDER}`);
    await flush(2000);
    expect(text()).toMatch(/^Confirmed\./);
  });

  it('stops polling on unmount', async () => {
    rpc.mockResolvedValue({ data: { status: 'pending' }, error: null });
    const { unmount } = mount(`?o=${ORDER}`);
    await flush();
    unmount();
    await flush(120_000);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
