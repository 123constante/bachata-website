// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

import TicketThanksPage from '../TicketThanksPage';
import { TICKET_STATUS_COPY, ticketQrShown, ticketStatus, ticketStatusLine, type TicketStatus, type TicketStatusInput } from '../ticketCardStatus';
import TicketCard from '@/modules/dancer-app/screens/tickets/TicketCard';
import { CARD_COPY, type CardTicket } from '@/modules/dancer-app/screens/tickets/model';

const ORDER = '3f2b8c1e-5a47-4d1b-9c2e-7a6b5c4d3e2f';
const TODAY = '2026-11-17';

afterEach(() => {
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
  it('different-email note shows only on a paid_email view that says so', () => {
    render(<MemoryRouter><TicketCard view={{ kind: 'paid_email', otherEmail: true }} retry={() => {}} copy={CARD_COPY} /></MemoryRouter>);
    expect(screen.getByTestId('tickets-card-other-email').textContent).toBe('Your ticket is under another email');
    cleanup();
    render(<MemoryRouter><TicketCard view={{ kind: 'paid_email' }} retry={() => {}} copy={CARD_COPY} /></MemoryRouter>);
    expect(screen.queryByTestId('tickets-card-other-email')).toBeNull();
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
