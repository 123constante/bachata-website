// @vitest-environment jsdom
/**
 * TICKET_LEAD_IN_SITE: when the series sells tickets in-site, the sticky bar leads with the
 * in-site buy action and the external ticket link is a small plain text link. Table-driven
 * over: link only, types on sale only, both, neither, sold out, ended, free ticket.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));
vi.mock('@/lib/eventLinkClicks', () => ({ recordEventLinkClick: vi.fn() }));
vi.mock('@/modules/event-page/bento/utils/eventActions', () => ({ shareEvent: vi.fn() }));

const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn() }));
vi.mock('@/modules/tickets/ticketCheckoutApi', async (orig) => ({
  ...(await orig<typeof import('@/modules/tickets/ticketCheckoutApi')>()),
  ...api,
}));

import { EventStickyActionBar } from '../EventStickyActionBar';
import { sellsInSite } from '@/modules/tickets/ticketCheckoutApi';
import type { PublicTicketType } from '@/modules/tickets/ticketCheckoutModel';

const mk = (id: string, p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id, occurrenceId: null, name: `Type ${id}`, pricePence: 1200, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...p,
});
const LINK = 'https://tickets.example.test/e';

type Row = { name: string; types: PublicTicketType[]; link: string | null; ticketingOn: boolean; inSite: boolean; primary: 'buy' | 'link' | 'directions' };
const rows: Row[] = [
  { name: 'link only', types: [], link: LINK, ticketingOn: true, inSite: false, primary: 'link' },
  { name: 'types on sale only', types: [mk('a')], link: null, ticketingOn: true, inSite: true, primary: 'buy' },
  { name: 'both', types: [mk('a')], link: LINK, ticketingOn: true, inSite: true, primary: 'buy' },
  { name: 'neither', types: [], link: null, ticketingOn: true, inSite: false, primary: 'directions' },
  { name: 'sold out + link', types: [mk('a', { status: 'sold_out', remaining: 0 })], link: LINK, ticketingOn: true, inSite: false, primary: 'link' },
  { name: 'ended event (page suppresses both)', types: [mk('a')], link: null, ticketingOn: false, inSite: false, primary: 'directions' },
  { name: 'free ticket + link', types: [mk('f', { pricePence: 0 })], link: LINK, ticketingOn: true, inSite: true, primary: 'buy' },
];

function renderBar(r: Row) {
  api.fetchPublicTicketTypes.mockResolvedValue(r.types);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EventStickyActionBar
        eventId="e1"
        directionsUrl="https://maps.example.test/x"
        ticketUrl={r.link}
        inSiteTicketing={r.ticketingOn}
        shareTitle="t"
        shareSubtitle={null}
        canAddToCalendar={false}
        onAddToCalendar={() => {}}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('sticky bar x ticket state: exactly one primary, link never primary when selling in-site', () => {
  for (const r of rows) {
    it(r.name, async () => {
      renderBar(r);
      if (r.inSite) await screen.findByTestId('buy-in-site');
      else await waitFor(() => expect(api.fetchPublicTicketTypes).toHaveBeenCalledTimes(r.ticketingOn ? 1 : 0));
      const primaries = Array.from(document.querySelectorAll('[data-primary="true"]'));
      expect(primaries).toHaveLength(1);
      const p = primaries[0];
      if (r.primary === 'buy') expect(p.getAttribute('data-testid')).toBe('buy-in-site');
      if (r.primary === 'link') expect(p.getAttribute('href')).toBe(LINK);
      if (r.primary === 'directions') expect(p.textContent).toMatch(/directions/i);
      const elsewhere = screen.queryByTestId('tickets-elsewhere');
      if (r.inSite && r.link) {
        expect(elsewhere).not.toBeNull();
        expect(elsewhere!.getAttribute('href')).toBe(LINK);
        expect(elsewhere!.hasAttribute('data-primary')).toBe(false);
        expect(elsewhere!.className).not.toMatch(/rounded-full/);
      } else {
        expect(elsewhere).toBeNull();
      }
    });
  }
});

describe('sellsInSite', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  it('is false for nothing, sold out, not yet and closed; true for a buyable type', () => {
    expect(sellsInSite(undefined, now)).toBe(false);
    expect(sellsInSite([], now)).toBe(false);
    expect(sellsInSite([mk('a', { status: 'sold_out', remaining: 0 })], now)).toBe(false);
    expect(sellsInSite([mk('a', { salesOpenAt: '2026-11-01T00:00:00Z' })], now)).toBe(false);
    expect(sellsInSite([mk('a', { salesCloseAt: '2026-10-01T00:00:00Z' })], now)).toBe(false);
    expect(sellsInSite([mk('a')], now)).toBe(true);
    expect(sellsInSite([mk('a', { status: 'sold_out', remaining: 0 }), mk('b')], now)).toBe(true);
  });
});
