// @vitest-environment jsdom
/**
 * TICKET_FESTIVAL_IN_SITE: shape x screen table on the REAL FestivalDetail. Mounts the page
 * against a fake Supabase (ticket_types_public_v2 answers per shape) with the festival's own
 * queries seeded, then reads (a) the sticky bar's primary, (b) every place the organiser's
 * link can appear (hero, pass cards, end CTA, bar), (c) the quiet bar's disabled reason,
 * (d) the offer URLs in the emitted JSON-LD <script>. Nothing here re-implements the rule.
 *
 * Shapes come from the read-only prod survey (PR body): Ritmo = 12 series-wide types,
 * 6 buyable + 6 not yet, organiser link set, ONE occurrence; other festivals have no types.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from './jsdomPolyfills';

const LINK = 'https://tickets.example.test/ritmo';
const UUID = '00000000-0000-4000-8000-0000000000a1';
const SLUG = 'ritmo-test';
const NIGHT = '00000000-0000-4000-8000-0000000000b1';

const h = vi.hoisted(() => {
  const state = { types: (_occ: string | null): Promise<unknown[]> => Promise.resolve([]), asked: [] as (string | null)[] };
  const chain = (): unknown =>
    new Proxy(function () {}, {
      get: (_t, prop) =>
        prop === 'then' ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null }) : chain(),
      apply: () => chain(),
    });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
    if (name === 'ticket_types_public_v2') {
      state.asked.push((args.p_occurrence_id as string) ?? null);
      try {
        return { data: await state.types((args.p_occurrence_id as string) ?? null), error: null };
      } catch (e) {
        return { data: null, error: { message: String(e) } };
      }
    }
    return { data: null, error: null };
  });
  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  };
  const fakeClient = new Proxy({ rpc, auth } as Record<string | symbol, unknown>, {
    get: (t, prop) => (prop === 'then' ? undefined : prop in t ? t[prop] : chain()),
  });
  return { rpc, fakeClient, state };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: h.fakeClient }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.fakeClient }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: { ...m.flags, publicTicketing: true } };
});
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, session: null, loading: false }),
}));

import { SITE_ORIGIN } from '@/lib/seo';

const OURS = `${SITE_ORIGIN}/festival/${SLUG}`;
const PAST = '2020-01-01T00:00:00Z';
const FUTURE = '2099-01-01T00:00:00Z';
const row = (o: Record<string, unknown>) => ({
  id: 't1', occurrence_id: null, name: 'Full pass', price_pence: 9000, status: 'on_sale', remaining: 50,
  sales_open_at: null, sales_close_at: null, sold_out: false, effective_close_at: null, currency: 'GBP', kind: 'night', ...o,
});

async function seed(link: string | null, lifecycle: string, passes: unknown[]) {
  const { createQueryClient } = await import('@/App');
  const { parseFestivalDetail, festivalDetailQueryKey } = await import('@/modules/event-page/useFestivalDetailQuery');
  const { festivalEventQueryKey } = await import('@/modules/event-page/festivalEventQuery');
  const qc = createQueryClient();
  qc.setQueryData(['entity-resolve', 'events', 'id', UUID], { id: UUID, slug: SLUG });
  qc.setQueryData(festivalEventQueryKey(UUID), {
    id: UUID, name: 'Ritmo Test', city: 'London', date: null, start_time: null, poster_url: null,
    description: null, ticket_url: link, faq: null, meta_data: null,
  });
  qc.setQueryData(['festival-snapshot', UUID], {
    occurrence_id: NIGHT,
    occurrence_effective: { is_cancelled: false, cancellation_reason_label: null },
    event: { lifecycle_status: lifecycle, ended_on: lifecycle === 'ended' ? '2026-06-01' : null, ran_from: null },
  });
  qc.setQueryData(
    festivalDetailQueryKey(UUID),
    parseFestivalDetail({
      event_id: UUID,
      identity: { name: 'Ritmo Test' },
      dates: { local_start: '2099-03-01', local_end: '2099-03-03', timezone: 'Europe/London' },
      links: { ticket_url: link },
      schedule: [],
      passes,
    }),
  );
  return qc;
}

async function mount(link: string | null, lifecycle: string, passes: unknown[]) {
  const { AppProviders } = await import('@/App');
  const { default: FestivalDetail } = await import('@/pages/FestivalDetail');
  const qc = await seed(link, lifecycle, passes);
  render(
    <AppProviders client={qc}>
      <MemoryRouter initialEntries={[`/festival/${UUID}`]}>
        <Routes>
          <Route path="/festival/:id" element={<FestivalDetail />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

type Primary = 'ours' | 'quiet' | 'hers' | 'directions' | 'placeholder' | null;
function barPrimary(): Primary {
  const bar = document.querySelector('[data-sticky-action-bar]');
  if (!bar) return null;
  if (bar.querySelector('[data-testid="buy-in-site"]')) return 'ours';
  if (bar.querySelector('[data-testid="buy-quiet"],[data-testid="buy-choose-night"]')) return 'quiet';
  if (bar.querySelector('[data-testid="buy-pending"]')) return 'placeholder';
  if (bar.querySelector(`a[data-primary="true"][href="${LINK}"]`)) return 'hers';
  return null;
}
const herLinks = () => document.querySelectorAll(`a[href="${LINK}"]`).length;
const heroText = () => document.querySelector('.hero-cta')?.textContent?.trim() ?? null;
const quietReason = () => document.querySelector('[data-sticky-action-bar] [data-testid="buy-quiet"]')?.textContent?.trim() ?? null;
type LdOffer = { url?: string; name?: string; price?: string; priceCurrency?: string };
function ldOffers(): LdOffer[] | null {
  const node = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => JSON.parse(s.textContent ?? '{}') as { '@type'?: string; offers?: LdOffer[] | LdOffer })
    .find((n) => n['@type'] !== 'BreadcrumbList');
  if (!node) return null;
  return node.offers == null ? [] : Array.isArray(node.offers) ? node.offers : [node.offers];
}
function offerUrls(): (string | null)[] | null {
  const offers = ldOffers();
  return offers ? offers.map((o) => o.url ?? null) : null;
}

beforeEach(() => {
  installJsdomPolyfills();
  h.rpc.mockClear();
  h.state.asked = [];
});
afterEach(cleanup);

const PASS = { id: 'p1', name: 'Full pass', price: 90, currency: 'GBP' };
const ok = (rows: unknown[]) => () => Promise.resolve(rows);
type Shape = {
  name: string;
  link: string | null;
  lifecycle?: string;
  types: (occ: string | null) => Promise<unknown[]>;
  primary: Primary;
  hero: string | null;
  herLinkShown: boolean;
  reason?: string;
  offer: 'ours' | 'hers' | 'none';
};
const shapes: Shape[] = [
  { name: 'live (Ritmo: buyable + not-yet rows) + link', link: LINK, types: ok([row({}), row({ id: 't2', sales_open_at: FUTURE })]), primary: 'ours', hero: 'Buy tickets', herLinkShown: false, offer: 'ours' },
  { name: 'sold out + link', link: LINK, types: ok([row({ status: 'sold_out', remaining: 0, sold_out: true })]), primary: 'quiet', hero: 'Get Tickets', herLinkShown: true, reason: 'Sold out', offer: 'hers' },
  { name: 'closed + link', link: LINK, types: ok([row({ sales_close_at: PAST })]), primary: 'quiet', hero: 'Get Tickets', herLinkShown: true, reason: 'Closed', offer: 'hers' },
  { name: 'not yet open + link', link: LINK, types: ok([row({ sales_open_at: FUTURE })]), primary: 'quiet', hero: 'Get Tickets', herLinkShown: true, reason: 'Not yet', offer: 'hers' },
  { name: 'no types + link (unchanged page)', link: LINK, types: ok([]), primary: 'hers', hero: 'Get Tickets', herLinkShown: true, offer: 'hers' },
  { name: 'no types, no link (Tickets TBA)', link: null, types: ok([]), primary: null, hero: 'Tickets TBA', herLinkShown: false, offer: 'none' },
  { name: 'ticket RPC fails + link (never stuck hidden)', link: LINK, types: () => Promise.reject(new Error('down')), primary: 'hers', hero: 'Get Tickets', herLinkShown: true, offer: 'hers' },
  { name: 'live, no link', link: null, types: ok([row({})]), primary: 'ours', hero: 'Buy tickets', herLinkShown: false, offer: 'ours' },
  { name: 'ended + buyable rows + link: no ticket CTA at all', link: LINK, lifecycle: 'ended', types: ok([row({})]), primary: null, hero: null, herLinkShown: false, offer: 'none' },
];

describe('festival page x ticket shape (TICKET_FESTIVAL_IN_SITE)', () => {
  it.each(shapes)('$name', async (s) => {
    h.state.types = s.types;
    await mount(s.link, s.lifecycle ?? 'live', [PASS]);
    if (s.lifecycle === 'ended') {
      await waitFor(() => expect(document.querySelector('.hero-ended')).not.toBeNull());
      await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
      expect(h.state.asked).toEqual([]); // no probe for an ended run
    } else {
      await waitFor(() => expect(barPrimary()).toBe(s.primary), { timeout: 3000 });
      // The probe asks about the festival's one night (same key as the buy block).
      expect(h.state.asked.every((n) => n === NIGHT)).toBe(true);
    }
    expect(s.hero === null ? document.querySelector('.hero-cta') : heroText()).toBe(s.hero);
    expect(herLinks() > 0).toBe(s.herLinkShown);
    if (s.reason) expect(quietReason()).toBe(s.reason);
    if (s.primary === 'quiet') {
      // Disabled with its reason; the organiser's link returns under it.
      expect((document.querySelector('[data-testid="buy-quiet"]') as HTMLButtonElement).disabled).toBe(true);
      expect(document.querySelector('[data-testid="tickets-elsewhere"]')).not.toBeNull();
    }
    const urls = offerUrls();
    if (s.offer === 'none') {
      // Ended: no offers node. No link and not live: the pass keeps its price, no URL (unchanged).
      expect(urls ?? []).toEqual(s.lifecycle === 'ended' ? [] : [null]);
    } else expect(urls).toEqual([s.offer === 'ours' ? OURS : LINK]);
    if (s.primary === 'ours') {
      // Every Buy on the page opens our tickets page; no copy points at a missing control.
      expect(document.querySelector('[data-testid="festival-pass-ours"]')).not.toBeNull();
      expect(document.querySelector('[data-testid="festival-buy-end"]')).not.toBeNull();
    }
  });

  it('live: a pass card opens the in-site tickets page (one checkout, no second system)', async () => {
    // Fix round 1: the pass and the ticket type have DIFFERENT names, and the assertion reads the
    // tickets page's own root, so a broken openTickets or lazy import cannot pass this.
    h.state.types = ok([row({ name: 'In-site weekender' })]);
    await mount(LINK, 'live', [{ ...PASS, name: 'Organiser weekend pass' }]);
    await waitFor(() => expect(barPrimary()).toBe('ours'), { timeout: 3000 });
    expect(document.querySelector('[data-testid="event-tickets-page"]')).toBeNull();
    fireEvent.click(document.querySelector('[data-testid="festival-pass-ours"]') as HTMLElement);
    await waitFor(() => expect(document.querySelector('[data-testid="event-tickets-page"]')).not.toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(document.querySelector('[data-testid="event-tickets-page"]')?.textContent).toMatch(/In-site weekender/), { timeout: 3000 });
    // Same ticket query key as the probe: one fetch for the night, not two.
    expect(h.state.asked.filter((n) => n === NIGHT).length).toBe(1);
  });

  it('live: JSON-LD offers are the live ticket types at THEIR price, not the passes (passes 90, type 85 -> 85)', async () => {
    h.state.types = ok([row({ name: 'In-site weekender', price_pence: 8500 }), row({ id: 't2', name: 'Later', sales_open_at: FUTURE })]);
    await mount(LINK, 'live', [PASS]);
    await waitFor(() => expect(barPrimary()).toBe('ours'), { timeout: 3000 });
    await waitFor(() => expect(ldOffers()).toEqual([{ '@type': 'Offer', url: OURS, name: 'In-site weekender', price: '85.00', priceCurrency: 'GBP' }]));
  });

  it('live, festival has NO passes: JSON-LD still carries offers from the live types', async () => {
    h.state.types = ok([row({ name: 'In-site weekender', price_pence: 8500 })]);
    await mount(LINK, 'live', []);
    await waitFor(() => expect(barPrimary()).toBe('ours'), { timeout: 3000 });
    await waitFor(() => expect(ldOffers()).toEqual([{ '@type': 'Offer', url: OURS, name: 'In-site weekender', price: '85.00', priceCurrency: 'GBP' }]));
  });

  it('probe pending: hero, pass cards and end CTA show no organiser link; it returns after a quiet answer', async () => {
    let answer: (rows: unknown[]) => void = () => {};
    h.state.types = () => new Promise((r) => { answer = r; });
    await mount(LINK, 'live', [PASS]);
    await waitFor(() => expect(barPrimary()).toBe('placeholder'), { timeout: 3000 });
    expect(herLinks()).toBe(0);
    expect(document.querySelector('[data-testid="festival-tickets-pending"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="festival-pass-pending"]')).not.toBeNull();
    expect(offerUrls()).toEqual([LINK]); // JSON-LD keeps her link until our Buy is live (unchanged rule)
    await act(async () => { answer([row({ status: 'sold_out', remaining: 0, sold_out: true })]); });
    await waitFor(() => expect(barPrimary()).toBe('quiet'), { timeout: 3000 });
    expect(heroText()).toBe('Get Tickets');
    // hero + pass card + end CTA (the bar's "Tickets elsewhere" may add one more)
    expect(herLinks()).toBeGreaterThanOrEqual(3);
    expect(document.querySelector('[data-testid="festival-pass-pending"]')).toBeNull();
  });

  it('flag off: no probe, no pending window, her link everywhere at once (unchanged page)', async () => {
    const { flags } = await import('@/lib/featureFlags');
    (flags as { publicTicketing: boolean }).publicTicketing = false;
    try {
      h.state.types = ok([row({})]);
      await mount(LINK, 'live', [PASS]);
      await waitFor(() => expect(barPrimary()).toBe('hers'), { timeout: 3000 });
      expect(heroText()).toBe('Get Tickets');
      expect(document.querySelector('[data-testid="festival-tickets-pending"]')).toBeNull();
      expect(herLinks()).toBeGreaterThanOrEqual(3);
      expect(offerUrls()).toEqual([LINK]);
      expect(h.state.asked).toEqual([]);
    } finally {
      (flags as { publicTicketing: boolean }).publicTicketing = true;
    }
  });
});
