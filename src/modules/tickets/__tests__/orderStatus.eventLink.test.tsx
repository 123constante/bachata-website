// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), auth: { getSession: vi.fn() } } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import TicketThanksPage from '../TicketThanksPage';
import { parseOrderStatus } from '../ticketCheckoutModel';

const ORDER = '3f2a9c10-1111-4222-8333-444455556666';
const EID = 'abc-123';

type Row = { status: string; extra?: Record<string, unknown>; eventId: unknown; free: boolean; link: boolean };
const rows: Row[] = [];
for (const free of [false, true]) {
  for (const status of ['paid', 'failed', 'pending', 'unknown', 'retry_later']) {
    for (const eventId of [EID, null, '', 42]) {
      const intended = (status === 'paid' || status === 'failed') && eventId === EID;
      rows.push({ status, eventId, free, link: intended });
    }
  }
}

const reply = (r: Row) =>
  r.status === 'retry_later'
    ? { status: 'unknown', retry_later: true, event_id: r.eventId }
    : { status: r.status, event_id: r.eventId, event_title: 'Salsa Night', ticket_count: 2 };

describe('thanks page: back to the event link', () => {
  afterEach(() => { cleanup(); rpc.mockReset(); });
  it.each(rows.map((r) => [`${r.status} eventId=${JSON.stringify(r.eventId)} free=${r.free}`, r] as const))('%s', async (_l, r) => {
    rpc.mockResolvedValue({ data: reply(r), error: null });
    render(<MemoryRouter initialEntries={[`/tickets/thanks?o=${ORDER}${r.free ? '&free=1' : ''}`]}><TicketThanksPage /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    const link = screen.queryByTestId('thanks-back-to-event');
    const root = screen.getByTestId('tickets-thanks');
    if (r.link) {
      expect(link).not.toBeNull();
      expect(link!.getAttribute('href')).toBe(`/event/${EID}`);
      expect(link!.textContent).toBe(r.status === 'failed' ? 'Back to the event to try again' : 'Back to the event');
    } else {
      expect(link).toBeNull();
    }
    // The failed copy points at "go back and try again": a way back must exist on screen.
    if (r.status === 'failed') expect(root.querySelectorAll('a').length).toBeGreaterThan(0);
    // The what's-on link always stays.
    expect(root.querySelector('a[href="/"]')).not.toBeNull();
  });
});

describe('thanks page: processing (gave up polling) back-to-event link', () => {
  beforeEach(() => { vi.useFakeTimers(); rpc.mockReset(); window.sessionStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it.each([
    ['eventId set', EID, false],
    ['eventId null', null, false],
  ] as const)('pending forever, %s', async (_l, eventId, link) => {
    rpc.mockResolvedValue({ data: { status: 'pending', event_id: eventId }, error: null });
    render(<MemoryRouter initialEntries={[`/tickets/thanks?o=${ORDER}`]}><TicketThanksPage /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    const root = screen.getByTestId('tickets-thanks');
    expect(root.textContent).toMatch(/Still processing/);
    const el = screen.queryByTestId('thanks-back-to-event');
    if (link) {
      expect(el!.getAttribute('href')).toBe(`/event/${EID}`);
      expect(el!.textContent).toBe('Back to the event');
    } else {
      expect(el).toBeNull();
    }
    expect(root.querySelector('a[href="/"]')!.textContent).toBe('Back');
  });
});

describe('parseOrderStatus event_id', () => {
  it.each([
    ['paid', EID, EID], ['failed', ' x1 ', 'x1'], ['pending', EID, null], ['unknown', EID, null],
    ['paid', '', null], ['paid', 42, null], ['paid', null, null], ['paid', undefined, null],
  ])('%s %j -> %j', (status, id, want) => {
    expect(parseOrderStatus({ status, event_id: id }).eventId).toBe(want);
  });
});
