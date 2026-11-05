// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const rpc = vi.fn();
let offline = false;
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => (offline ? Promise.reject(new Error('offline')) : rpc(...a)), auth: { getSession: vi.fn() } } }));
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, authStatus: 'ready', retryAuth: () => {} }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import TicketThanksPage from '../TicketThanksPage';
import OrderQrBlock from '../OrderQrBlock';
import { fetchOrderQr } from '../myTicketsApi';
import { parseOrderQr } from '../myTicketsModel';

const ORDER = '3f2a9c10-1111-4222-8333-444455556666';
const tok = (i: number) => (i.toString(16).padStart(2, '0')).repeat(32);
const ticket = (i: number, checked = false) => ({ ticket_id: `t${i}`, ticket_type_name: `Type ${i}`, qr_token: tok(i + 10), checked_in: checked });
const tickets = (n: number) => ({ tickets: Array.from({ length: n }, (_, i) => ticket(i)) });
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };

describe('parseOrderQr', () => {
  it('keeps good rows, drops bad ones', () => {
    const bad = [null, 'x', { ticket_id: 1, ticket_type_name: 'a', qr_token: tok(1), checked_in: false }, { ticket_id: 'a', ticket_type_name: 'a', qr_token: 'short', checked_in: false }, { ticket_id: 'a', ticket_type_name: 'a', qr_token: tok(1), checked_in: 'no' }, { ticket_id: 'a', qr_token: tok(1), checked_in: false }];
    expect(parseOrderQr({ tickets: [ticket(1), ...bad, ticket(2, true)] })).toEqual([
      { ticketId: 't1', typeName: 'Type 1', qrToken: tok(11), checkedIn: false },
      { ticketId: 't2', typeName: 'Type 2', qrToken: tok(12), checkedIn: true },
    ]);
  });
  it.each([[null], ['x'], [[]], [{}], [{ tickets: 'no' }]])('malformed envelope %j is an error (null)', (raw) => expect(parseOrderQr(raw)).toBeNull());
  it('empty list is ok and empty', () => expect(parseOrderQr({ tickets: [] })).toEqual([]));
});

describe('fetchOrderQr', () => {
  beforeEach(() => rpc.mockClear());
  it('calls the rpc with p_order_id only', async () => {
    rpc.mockResolvedValue({ data: tickets(1), error: null });
    const r = await fetchOrderQr(ORDER);
    expect(r.kind).toBe('ok');
    expect(rpc).toHaveBeenCalledWith('my_ticket_order_qr_v1', { p_order_id: ORDER });
  });
  it('42501 is signed_out; other error, bad shape and throw are error', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'x' } });
    expect(await fetchOrderQr(ORDER)).toEqual({ kind: 'signed_out' });
    rpc.mockResolvedValue({ data: null, error: { code: 'XX', message: 'x' } });
    expect(await fetchOrderQr(ORDER)).toEqual({ kind: 'error' });
    rpc.mockResolvedValue({ data: 'junk', error: null });
    expect(await fetchOrderQr(ORDER)).toEqual({ kind: 'error' });
    offline = true;
    try { expect(await fetchOrderQr(ORDER)).toEqual({ kind: 'error' }); } finally { offline = false; }
  });
});

const IN_EMAIL = 'Your tickets are in your email, and in My tickets.';
type Reply = { data: unknown; error: { code?: string; message: string } | null };
const replies: Array<[string, Reply, 'cards' | 'email', number]> = [
  ['1 ticket', { data: tickets(1), error: null }, 'cards', 1],
  ['3 tickets', { data: tickets(3), error: null }, 'cards', 3],
  ['9 tickets (cap 8)', { data: tickets(9), error: null }, 'cards', 8],
  ['empty', { data: { tickets: [] }, error: null }, 'email', 0],
  ['signed out', { data: null, error: { code: '42501', message: 'nope' } }, 'email', 0],
  ['other error', { data: null, error: { code: 'XX', message: 'boom' } }, 'email', 0],
  ['malformed rows only', { data: { tickets: [{ ticket_id: 'a' }, null] }, error: null }, 'email', 0],
  ['malformed envelope', { data: 'junk', error: null }, 'email', 0],
];

describe('OrderQrBlock states', () => {
  beforeEach(() => { vi.useFakeTimers(); rpc.mockReset(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it.each(replies)('%s', async (_l, reply, kind, shown) => {
    rpc.mockResolvedValue(reply);
    render(<MemoryRouter><OrderQrBlock orderId={ORDER} /></MemoryRouter>);
    expect(screen.getByTestId('order-qr-loading').textContent).toContain('Getting your door codes…');
    expect(screen.queryAllByTestId('ticket-qr')).toHaveLength(0);
    await flush();
    expect(screen.queryByTestId('order-qr-loading')).toBeNull();
    expect(screen.queryAllByTestId('ticket-qr')).toHaveLength(shown);
    if (kind === 'email') {
      expect(screen.getByTestId('order-qr-email').textContent).toBe(IN_EMAIL);
      expect(screen.queryByRole('link')).toBeNull();
    } else expect(screen.queryByTestId('order-qr-email')).toBeNull();
    const more = screen.queryByTestId('order-qr-more');
    if (_l.startsWith('9')) {
      expect(more?.textContent).toContain('and 1 more in My tickets');
      expect(more?.querySelector('a')?.getAttribute('href')).toBe('/account/my-tickets');
    } else expect(more).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('checked_in shows a tag; unchecked does not', async () => {
    rpc.mockResolvedValue({ data: { tickets: [ticket(1, true), ticket(2)] }, error: null });
    render(<MemoryRouter><OrderQrBlock orderId={ORDER} /></MemoryRouter>);
    await flush();
    const cards = screen.getAllByTestId('order-qr-card');
    expect(cards[0].textContent).toContain('Checked in');
    expect(cards[1].textContent).not.toContain('Checked in');
    expect(cards[0].textContent).toContain('Type 1');
  });
  it('never puts the token in the DOM as text or attribute', async () => {
    rpc.mockResolvedValue({ data: tickets(3), error: null });
    const { container } = render(<MemoryRouter><OrderQrBlock orderId={ORDER} /></MemoryRouter>);
    await flush();
    expect(screen.getAllByTestId('ticket-qr')).toHaveLength(3);
    const html = container.innerHTML;
    for (let i = 0; i < 3; i++) expect(html).not.toContain(tok(i + 10));
    expect(html).not.toMatch(/[0-9a-f]{64}/);
    expect(JSON.stringify({ ...window.localStorage, ...window.sessionStorage })).not.toMatch(/[0-9a-f]{64}/);
  });
});

describe('TicketThanksPage x QR block', () => {
  beforeEach(() => { vi.useFakeTimers(); rpc.mockReset(); window.sessionStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); auth.user = null; });
  const pages: Array<[string, unknown, string, boolean]> = [
    ['paid', { status: 'paid', ticket_count: 2 }, '', true],
    ['paid free', { status: 'paid', ticket_count: 1 }, '&free=1', true],
    ['checking', { status: 'unknown' }, '', false],
    ['processing', { status: 'pending' }, '', false],
    ['failed', { status: 'failed' }, '', false],
  ];
  it.each(pages.flatMap(([l, status, q, qr]) => [[l, status, q, qr, true], [l, status, q, qr, false]] as const))('%s signed in=%s', async (label, status, q, qr, signedIn) => {
    auth.user = signedIn ? { id: 'u1' } : null;
    rpc.mockImplementation((fn: string) => Promise.resolve(fn === 'my_ticket_order_qr_v1' ? { data: tickets(2), error: null } : { data: status, error: null }));
    render(<MemoryRouter initialEntries={[`/tickets/thanks?o=${ORDER}${q}`]}><TicketThanksPage /></MemoryRouter>);
    await act(async () => { await vi.advanceTimersByTimeAsync(label === 'processing' ? 600_000 : 0); });
    await flush();
    await flush();
    const wants = qr && signedIn;
    expect(screen.queryAllByTestId('ticket-qr')).toHaveLength(wants ? 2 : 0);
    expect(rpc.mock.calls.filter((c) => c[0] === 'my_ticket_order_qr_v1')).toHaveLength(wants ? 1 : 0);
    if (!wants) expect(screen.queryByText(IN_EMAIL)).toBeNull();
  });
  it('no order: no block', async () => {
    auth.user = { id: 'u1' };
    rpc.mockResolvedValue({ data: null, error: null });
    render(<MemoryRouter initialEntries={['/tickets/thanks']}><TicketThanksPage /></MemoryRouter>);
    await flush();
    expect(screen.queryByTestId('order-qr-block')).toBeNull();
  });
  it('order of elements: copy, reference, QR block, See your tickets, Back', async () => {
    auth.user = { id: 'u1' };
    rpc.mockImplementation((fn: string) => Promise.resolve(fn === 'my_ticket_order_qr_v1' ? { data: tickets(1), error: null } : { data: { status: 'paid' }, error: null }));
    render(<MemoryRouter initialEntries={[`/tickets/thanks?o=${ORDER}`]}><TicketThanksPage /></MemoryRouter>);
    await flush(); await flush(); await flush();
    const root = screen.getByTestId('tickets-thanks');
    const ref = [...root.querySelectorAll('p')].find((p) => p.textContent?.startsWith('Order reference'))!;
    const block = screen.getByTestId('order-qr-block');
    const mine = screen.getByTestId('tickets-thanks-my-tickets');
    const pos = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(pos(ref, block)).toBe(true);
    expect(pos(block, mine)).toBe(true);
  });
});
