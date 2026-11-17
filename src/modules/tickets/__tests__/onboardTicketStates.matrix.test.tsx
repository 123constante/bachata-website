// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

// Buyer onboarding slice A continuation: checkout return lands on Home (item 4), ONE ticket status
// mapping (owner clicks: passed / cancelled / refunded), and the different-email note.
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/buyerOnboardingFlag', () => ({ get BUYER_ONBOARDING_ENABLED() { return flag.on; } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-11-17' }));
const auth = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, authStatus: 'ready', retryAuth: () => {} }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(() => Promise.resolve({ data: { status: 'pending' }, error: null })) } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));
vi.mock('../TicketQrCode', () => ({ default: () => <div data-testid="qr" /> }));
const qr = vi.hoisted(() => ({ fetchOrderQr: vi.fn(), fetchMyTickets: vi.fn() }));
vi.mock('@/modules/tickets/myTicketsApi', () => qr);
vi.mock('@/modules/dancer-app/screens/tickets/useOrderStatus', () => ({ useOrderStatus: () => ({ reading: { status: 'paid', eventId: 'e1', eventTitle: 'Coco', eventDate: '2026-11-20' }, gaveUp: false }) }));

import TicketThanksPage from '../TicketThanksPage';
import { useTicketCard } from '@/modules/dancer-app/screens/tickets/useTicketCard';
import { TICKET_STATUS_COPY, ticketNightKey, ticketQrShown, ticketStatus, ticketStatusAt, ticketStatusLine, type TicketStatus, type TicketStatusInput } from '../ticketCardStatus';
import TicketCard from '@/modules/dancer-app/screens/tickets/TicketCard';
import { CARD_COPY, type CardTicket } from '@/modules/dancer-app/screens/tickets/model';

const ORDER = '3f2b8c1e-5a47-4d1b-9c2e-7a6b5c4d3e2f';
const TODAY = '2026-11-17';

// Every screen reads the real clock through ticketStatusAt: pin it to midday London on TODAY.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  window.sessionStorage.clear();
  flag.on = true;
  auth.user = { id: 'u1' };
});

describe('ticketStatus: the one mapping, every shape', () => {
  const rows: [string, TicketStatusInput, TicketStatus][] = [
    ['future night', { date: '2026-11-20' }, 'valid'],
    ['tonight', { date: TODAY }, 'valid'],
    ['date to be confirmed (series-wide)', { date: null }, 'valid'],
    ['yesterday', { date: '2026-11-16' }, 'passed'],
    ['last year', { date: '2025-12-31' }, 'passed'],
    ['cancelled future night', { date: '2026-11-20', eventCancelled: true }, 'event_cancelled'],
    ['cancelled past night', { date: '2026-11-01', eventCancelled: true }, 'event_cancelled'],
    ['refunded future', { date: '2026-11-20', refunded: true }, 'refunded'],
    ['refunded + cancelled + passed', { date: '2026-11-01', eventCancelled: true, refunded: true }, 'refunded'],
    ['refunded, no date', { date: null, refunded: true }, 'refunded'],
  ];
  it.each(rows)('%s', (_name, input, want) => {
    const s = ticketStatus(input, TODAY);
    expect(s).toBe(want);
    expect(ticketQrShown(s)).toBe(want === 'valid');
    expect(ticketStatusLine(s)).toBe(want === 'valid' ? null : TICKET_STATUS_COPY[want as Exclude<TicketStatus, 'valid'>]);
  });
  // H1: the night is not over at midnight. 00:00 to 08:00 London belongs to the night before
  // (src/lib/programDayRollover.ts). November = GMT, so London wall clock = UTC here; the BST rows prove the zone.
  const nightRows: [string, string, string, TicketStatus][] = [
    ['00:30 the morning after: still valid', '2026-11-16', '2026-11-17T00:30:00Z', 'valid'],
    ['07:59 the morning after: still valid', '2026-11-16', '2026-11-17T07:59:00Z', 'valid'],
    ['08:00 the morning after: passed', '2026-11-16', '2026-11-17T08:00:00Z', 'passed'],
    ['09:00 the morning after: passed', '2026-11-16', '2026-11-17T09:00:00Z', 'passed'],
    ['23:50 on the night: valid', '2026-11-16', '2026-11-16T23:50:00Z', 'valid'],
    ['two mornings after, 00:30: passed', '2026-11-15', '2026-11-17T00:30:00Z', 'passed'],
    ['BST: 00:30 London (23:30 UTC) the morning after: valid', '2026-07-04', '2026-07-04T23:30:00Z', 'valid'],
    ['BST: 08:30 London (07:30 UTC) the morning after: passed', '2026-07-04', '2026-07-05T07:30:00Z', 'passed'],
  ];
  it.each(nightRows)('%s', (_n, date, now, want) => {
    expect(ticketStatusAt({ date }, new Date(now))).toBe(want);
  });
  it('night key rolls back only before 08:00 London', () => {
    expect(ticketNightKey(new Date('2026-11-17T07:59:00Z'))).toBe('2026-11-16');
    expect(ticketNightKey(new Date('2026-11-17T08:00:00Z'))).toBe('2026-11-17');
  });
  it('owner copy, exact', () => {
    expect(TICKET_STATUS_COPY).toEqual({ passed: 'This night has passed', event_cancelled: 'This night was cancelled', refunded: 'This ticket was refunded' });
  });
});

const T = (over: Partial<CardTicket>): CardTicket => ({ ticketId: 't1', typeName: 'Party', qrToken: 'a'.repeat(64), checkedIn: false, shortCode: null, eventTitle: 'Coco', eventDate: '2026-11-20', ...over });

describe('dancer ticket card draws the status (flag ON) and never with flag OFF', () => {
  const cases: [string, Partial<CardTicket>, string | null][] = [
    ['valid', {}, null],
    ['passed', { eventDate: '2026-11-10' }, 'This night has passed'],
    ['cancelled', { eventCancelled: true }, 'This night was cancelled'],
    ['refunded', { refunded: true }, 'This ticket was refunded'],
  ];
  it('last night at 00:30 the morning after: QR still there (H1)', () => {
    vi.setSystemTime(new Date('2026-11-17T00:30:00Z'));
    render(<MemoryRouter><TicketCard view={{ kind: 'tickets', tickets: [T({ eventDate: '2026-11-16' })] }} retry={() => {}} copy={CARD_COPY} /></MemoryRouter>);
    expect(screen.queryByTestId('tickets-card-status')).toBeNull();
    expect(screen.getByTestId('qr')).toBeTruthy();
  });
  it('last night at 09:00 the morning after: passed (H1)', () => {
    vi.setSystemTime(new Date('2026-11-17T09:00:00Z'));
    render(<MemoryRouter><TicketCard view={{ kind: 'tickets', tickets: [T({ eventDate: '2026-11-16' })] }} retry={() => {}} copy={CARD_COPY} /></MemoryRouter>);
    expect(screen.getByTestId('tickets-card-status').textContent).toBe('This night has passed');
    expect(screen.queryByTestId('qr')).toBeNull();
  });
  it.each(cases)('%s', (_n, over, line) => {
    render(<MemoryRouter><TicketCard view={{ kind: 'tickets', tickets: [T(over)] }} retry={() => {}} copy={CARD_COPY} /></MemoryRouter>);
    if (line) {
      expect(screen.getByTestId('tickets-card-status').textContent).toBe(line);
      expect(screen.queryByTestId('qr')).toBeNull();
    } else {
      expect(screen.queryByTestId('tickets-card-status')).toBeNull();
      expect(screen.getByTestId('qr')).toBeTruthy();
    }
  });
  it('flag OFF: a refunded shape still draws the QR exactly as before', () => {
    flag.on = false;
    render(<MemoryRouter><TicketCard view={{ kind: 'tickets', tickets: [T({ refunded: true, eventDate: '2026-11-01' })] }} retry={() => {}} copy={CARD_COPY} /></MemoryRouter>);
    expect(screen.getByTestId('qr')).toBeTruthy();
  });
  it('paid order, empty QR read: only the neutral email line, no cause claimed (H2)', () => {
    render(<MemoryRouter><TicketCard view={{ kind: 'paid_email' }} retry={() => {}} copy={CARD_COPY} /></MemoryRouter>);
    const card = screen.getByTestId('tickets-card');
    expect(card.querySelectorAll('p')).toHaveLength(1);
    expect(card.textContent).toBe(CARD_COPY.paidEmail);
    expect(card.textContent).not.toMatch(/another email/i);
  });
});

// H2: the QR read is empty for the buyer's OWN order too (older than 2 hours, refunded, not issued
// yet, a guest order), so the card never says why. Flag ON and OFF give the same neutral view.
describe('useTicketCard: ok-but-empty QR read on a paid order', () => {
  it.each([[true], [false]])('flag %s: { kind: paid_email } with nothing else', async (on) => {
    flag.on = on;
    qr.fetchOrderQr.mockResolvedValue({ kind: 'ok', tickets: [] });
    const { result } = renderHook(() => useTicketCard(), { wrapper: ({ children }) => <MemoryRouter initialEntries={[`/app/tickets?o=${ORDER}`]}>{children}</MemoryRouter> });
    await waitFor(() => expect(result.current.view.kind).toBe('paid_email'));
    expect(result.current.view).toEqual({ kind: 'paid_email' });
  });
});

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}
function go(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tickets/thanks" element={<TicketThanksPage />} />
        <Route path="/app/*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('checkout return lands on Home (flag ON), the Tickets tab (flag OFF)', () => {
  it('flag ON, paid: /app/home?o=', () => {
    go(`/tickets/thanks?o=${ORDER}`);
    expect(screen.getByTestId('where').textContent).toBe(`/app/home?o=${ORDER}`);
  });
  it('flag ON, free: free=1 kept', () => {
    go(`/tickets/thanks?o=${ORDER}&free=1`);
    expect(screen.getByTestId('where').textContent).toBe(`/app/home?o=${ORDER}&free=1`);
  });
  it('flag OFF: /app/tickets?o= as before', () => {
    flag.on = false;
    go(`/tickets/thanks?o=${ORDER}`);
    expect(screen.getByTestId('where').textContent).toBe(`/app/tickets?o=${ORDER}`);
  });
  it('signed out: the thank-you page stays', () => {
    auth.user = null;
    go(`/tickets/thanks?o=${ORDER}`);
    expect(screen.queryByTestId('where')).toBeNull();
    expect(screen.getByTestId('tickets-thanks')).toBeTruthy();
  });
});
