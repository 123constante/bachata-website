// @vitest-environment jsdom
/**
 * TICKET_LEAD_IN_SITE: while our Buy is live for the night, the sticky bar leads with the in-site
 * buy action and the organiser's external link is hidden. Sold out / closed / not yet open show
 * the quiet bar plus a small "Tickets elsewhere" text link. While the probe is pending neither
 * her link nor a primary shows (placeholder). Table-driven over those shapes, per night, plus
 * the onTicketingLive signal and the JSON-LD offer URL that follows it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));
vi.mock('@/lib/eventLinkClicks', () => ({ recordEventLinkClick: vi.fn() }));
vi.mock('@/modules/event-page/bento/utils/eventActions', () => ({ shareEvent: vi.fn() }));

const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn() }));
const PAGE = 'https://site.example.test/event/e1';
vi.mock('@/modules/tickets/ticketCheckoutApi', async (orig) => ({
  ...(await orig<typeof import('@/modules/tickets/ticketCheckoutApi')>()),
  ...api,
}));

import { EventStickyActionBar } from '../EventStickyActionBar';
import { ticketOfferUrl } from '../utils/ticketOfferUrl';
import { sellsInSite, ticketingLive } from '@/modules/tickets/ticketCheckoutApi';
import type { PublicTicketType } from '@/modules/tickets/ticketCheckoutModel';

const mk = (id: string, p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id, occurrenceId: null, name: `Type ${id}`, pricePence: 1200, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...p,
});
const LINK = 'https://tickets.example.test/e';

type Row = { name: string; types: PublicTicketType[]; link: string | null; ticketingOn: boolean; inSite: boolean; primary: 'buy' | 'link' | 'directions' | 'quiet'; elsewhere?: boolean; night?: string | null; live?: boolean };
const past = '2020-01-01T00:00:00Z';
const future = '2099-01-01T00:00:00Z';
const rows: Row[] = [
  { name: 'link only', types: [], link: LINK, ticketingOn: true, inSite: false, primary: 'link' },
  { name: 'types on sale only', types: [mk('a')], link: null, ticketingOn: true, inSite: true, primary: 'buy' },
  { name: 'both', types: [mk('a')], link: LINK, ticketingOn: true, inSite: true, primary: 'buy' },
  { name: 'neither', types: [], link: null, ticketingOn: true, inSite: false, primary: 'directions' },
    { name: 'sold out, link shown', types: [mk('a', { status: 'sold_out', remaining: 0 })], link: LINK, ticketingOn: true, inSite: false, primary: 'quiet', elsewhere: true },
  { name: 'closed, link shown', types: [mk('a', { salesCloseAt: past })], link: LINK, ticketingOn: true, inSite: false, primary: 'quiet', elsewhere: true },
  { name: 'not yet open, link shown', types: [mk('a', { salesOpenAt: future })], link: LINK, ticketingOn: true, inSite: false, primary: 'quiet', elsewhere: true },
  { name: 'mixed nights: this night (o1) open hides link', types: [mk('a', { occurrenceId: 'o1' }), mk('b', { occurrenceId: 'o2', salesOpenAt: future })], night: 'o1', link: LINK, ticketingOn: true, inSite: true, primary: 'buy' },
  { name: 'mixed nights: this night (o2) not open shows link while o1 is open', types: [mk('a', { occurrenceId: 'o1' }), mk('b', { occurrenceId: 'o2', salesOpenAt: future })], night: 'o2', link: LINK, ticketingOn: true, inSite: false, primary: 'quiet', elsewhere: true },
  { name: 'types but Stripe not ready (no buyable types fetched)', types: [], link: LINK, ticketingOn: true, inSite: false, primary: 'link' },
  // The page passes ticketUrl=null and inSiteTicketing=false for an ended event: nothing of hers, nothing of ours.
  { name: 'ended event with a link: page suppresses both', types: [mk('a')], link: null, ticketingOn: false, inSite: false, primary: 'directions' },
  { name: 'free ticket + link', types: [mk('f', { pricePence: 0 })], link: LINK, ticketingOn: true, inSite: true, primary: 'buy' },
];

function renderBar(r: Row, onTicketingLive?: (live: boolean) => void) {
  api.fetchPublicTicketTypes.mockImplementation(async (_s: string, occ: string | null) =>
    r.types.filter((t) => t.occurrenceId == null || t.occurrenceId === occ));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EventStickyActionBar
        eventId="e1"
        occurrenceId={r.night ?? null}
        onTicketingLive={onTicketingLive}
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
      if (r.primary === 'quiet') await screen.findByTestId('buy-quiet');
      if (r.primary === 'link') await screen.findByText('Get Tickets');
      if (r.primary === 'directions' && r.ticketingOn) await waitFor(() => expect(screen.queryByTestId('buy-pending')).toBeNull());
      const primaries = Array.from(document.querySelectorAll('[data-primary="true"]'));
      expect(primaries).toHaveLength(r.primary === 'quiet' ? 0 : 1);
      const p = primaries[0];
      if (r.primary === 'buy') expect(p.getAttribute('data-testid')).toBe('buy-in-site');
      if (r.primary === 'link') expect(p.getAttribute('href')).toBe(LINK);
      if (r.primary === 'directions') expect(p.textContent).toMatch(/directions/i);
      const elsewhere = screen.queryByTestId('tickets-elsewhere');
      if (r.elsewhere) {
        expect(elsewhere).not.toBeNull();
        expect(elsewhere!.getAttribute('href')).toBe(LINK);
        expect(elsewhere!.hasAttribute('data-primary')).toBe(false);
      } else if (r.inSite) {
        // ticketing live: ours is the only buy action, no external link at all
        expect(document.querySelector(`a[href="${LINK}"]`)).toBeNull();
        expect(elsewhere).toBeNull();
      } else {
        expect(elsewhere).toBeNull();
      }
    });
  }
});

describe('pending probe: neither her link nor a primary', () => {
  it('shows a placeholder, then her link only once resolved not-live', async () => {
    let resolve: (v: PublicTicketType[]) => void = () => {};
    api.fetchPublicTicketTypes.mockImplementation(() => new Promise<PublicTicketType[]>((r) => { resolve = r; }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <EventStickyActionBar eventId="e1" directionsUrl="https://maps.example.test/x" ticketUrl={LINK} inSiteTicketing shareTitle="t" shareSubtitle={null} canAddToCalendar={false} onAddToCalendar={() => {}} />
      </QueryClientProvider>,
    );
    await screen.findByTestId('buy-pending');
    expect(document.querySelector(`a[href="${LINK}"]`)).toBeNull();
    expect(document.querySelectorAll('[data-primary="true"]')).toHaveLength(0);
    await act(async () => resolve([]));
    await screen.findByText('Get Tickets');
    expect(screen.queryByTestId('buy-pending')).toBeNull();
    expect(document.querySelector(`a[href="${LINK}"]`)).not.toBeNull();
  });
  it('a failed fetch resolves to not-live (her link shows)', async () => {
    api.fetchPublicTicketTypes.mockRejectedValue(new Error('boom'));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <EventStickyActionBar eventId="e1" directionsUrl={null} ticketUrl={LINK} inSiteTicketing shareTitle="t" shareSubtitle={null} canAddToCalendar={false} onAddToCalendar={() => {}} />
      </QueryClientProvider>,
    );
    await screen.findByText('Get Tickets');
  });
});

describe('onTicketingLive and JSON-LD offer URL: ours when live, hers otherwise', () => {
  for (const r of rows) {
    it(r.name, async () => {
      const seen: boolean[] = [];
      renderBar(r, (l) => seen.push(l));
      if (r.inSite) await screen.findByTestId('buy-in-site');
      else if (r.ticketingOn) await waitFor(() => expect(screen.queryByTestId('buy-pending')).toBeNull());
      const live = seen[seen.length - 1];
      expect(live).toBe(r.inSite);
      expect(ticketOfferUrl(live, PAGE, r.link)).toBe(r.inSite ? PAGE : r.link);
    });
  }
  it('no link and not live gives no offer URL', () => {
    expect(ticketOfferUrl(false, PAGE, null)).toBeNull();
    expect(ticketOfferUrl(false, PAGE, undefined)).toBeNull();
  });
});

describe('ticketingLive', () => {
  const now = new Date('2026-10-27T12:00:00Z');
  it('is true only when a type is buyable now', () => {
    expect(ticketingLive(undefined, now)).toBe(false);
    expect(ticketingLive([], now)).toBe(false);
    expect(ticketingLive([mk('a', { status: 'sold_out', remaining: 0 })], now)).toBe(false);
    expect(ticketingLive([mk('a', { salesOpenAt: '2026-11-01T00:00:00Z' })], now)).toBe(false);
    expect(ticketingLive([mk('a')], now)).toBe(true);
  });
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
