// @vitest-environment jsdom
/**
 * TICKET_LEAD_IN_SITE (fix round 2): screen x shape table on the REAL page. Mounts BentoPage
 * against a fake Supabase and reads (a) the sticky bar's primary action, (b) whether the
 * organiser's link is on screen, (c) the offer URL in the JSON-LD <script> the page emits.
 * Nothing here re-implements ticketOfferUrl: the URL is read out of the rendered script.
 *
 * A MutationObserver records every committed bar state, so "never two primaries" and "her
 * link never flashes on a live night" are checked across the whole run, not just at the end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import './jsdomPolyfills';

const LINK = 'https://tickets.example.test/ritmo';


const h = vi.hoisted(() => {
  const state = {
    link: null as string | null,
    past: false,
    occurrence: 'o1' as string,
    // ticket_types_public_v2 rows by night; a function returning a promise lets a row hang.
    types: (_occ: string | null): Promise<unknown[]> => Promise.resolve([]),
  };
  const chain = (): unknown =>
    new Proxy(function () {}, {
      get: (_t, prop) =>
        prop === 'then' ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null }) : chain(),
      apply: () => chain(),
    });
  const occ = (id: string) => ({
    occurrence_id: id,
    starts_at: state.past ? '2020-01-01T20:00:00+00:00' : '2099-01-01T20:00:00+00:00',
    ends_at: state.past ? '2020-01-01T23:00:00+00:00' : '2099-01-01T23:00:00+00:00',
    local_date: state.past ? '2020-01-01' : '2099-01-01',
    timezone: 'Europe/London',
    is_cancelled: false,
    is_past: state.past,
    is_upcoming: !state.past,
    is_live: false,
    lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
  });
  const snapshot = (occurrenceId: string) => ({
    event_id: 'e1',
    occurrence_id: occurrenceId,
    event: {
      name: 'Ritmo Test Night',
      description: 'Bachata Party',
      format: 'party',
      type: 'party',
      lifecycle_status: 'live',
      is_published: true,
      date: '2099-01-01T20:00:00+00:00',
      actions: { ticket_url: state.link },
      meta_data_public: { tickets: [{ id: 'm1', name: 'Entry', price: '10' }] },
      photo_urls: [],
      video_urls: [],
      music_styles: [],
    },
    location_default: {},
    attendance: { going_count: 0, interested_count: 0, preview: [] },
    organisers: [],
    occurrences: [occ('o1'), occ('o2')],
    occurrence_effective: occ(occurrenceId),
  });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
    if (name === 'event_view_p5') return { data: snapshot((args.p_occurrence_id as string) ?? state.occurrence), error: null };
    if (name === 'ticket_types_public_v2') {
      try {
        return { data: await state.types((args.p_occurrence_id as string) ?? null), error: null };
      } catch (e) {
        return { data: null, error: { message: String(e) } };
      }
    }
    return { data: null, error: null };
  });
  const fakeClient = new Proxy({ rpc } as Record<string | symbol, unknown>, {
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

import { BentoPage } from '@/modules/event-page/bento/BentoPage';
import { CityProvider } from '@/contexts/CityContext';
import { SITE_ORIGIN } from '@/lib/seo';

const OURS = `${SITE_ORIGIN}/event/ritmo-test`;

type Kind = 'ours' | 'hers' | 'quiet' | 'placeholder' | 'directions';
const row = (o: Record<string, unknown>) => ({
  id: 't1', occurrence_id: null, name: 'Entry', price_pence: 1000, status: 'on_sale', remaining: 50,
  sales_open_at: null, sales_close_at: null, sold_out: false, effective_close_at: null, currency: 'GBP', kind: null, ...o,
});
const PAST = '2020-01-01T00:00:00Z';
const FUTURE = '2099-01-01T00:00:00Z';

/** Every primary-looking thing on the bar right now. */
function barKinds(): Kind[] {
  const bar = document.querySelector('[data-sticky-action-bar]');
  if (!bar) return [];
  const k: Kind[] = [];
  if (bar.querySelector('[data-testid="buy-in-site"]')) k.push('ours');
  if (bar.querySelector(`a[data-primary="true"][href="${LINK}"]`)) k.push('hers');
  if (bar.querySelector('[data-testid="buy-quiet"],[data-testid="buy-choose-night"]')) k.push('quiet');
  if (bar.querySelector('[data-testid="buy-pending"]')) k.push('placeholder');
  const dir = bar.querySelector('a[data-primary="true"]:not([href^="https://tickets"])');
  if (dir && /directions/i.test(dir.textContent ?? '')) k.push('directions');
  return k;
}
const herLinkOnScreen = () => !!document.querySelector(`[data-sticky-action-bar] a[href="${LINK}"]`);
function offerUrls(): (string | null)[] | null {
  const node = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => JSON.parse(s.textContent ?? '{}') as { '@type'?: string; offers?: Array<{ url?: string }> | { url?: string } })
    .find((n) => n['@type'] !== 'BreadcrumbList');
  if (!node) return null;
  const offers = node.offers == null ? [] : Array.isArray(node.offers) ? node.offers : [node.offers];
  return offers.map((o) => o.url ?? null);
}

let history: Kind[][] = [];
let herHistory: boolean[] = [];
let observer: MutationObserver | null = null;
function watch() {
  history = [];
  herHistory = [];
  observer = new MutationObserver(() => {
    history.push(barKinds());
    herHistory.push(herLinkOnScreen());
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true });
}

function page(occurrenceId: string) {
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/event/ritmo-test']}>
        <CityProvider>
          <BentoPage eventId="e1" occurrenceId={occurrenceId} eventSlug="ritmo-test" />
        </CityProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
let qc: QueryClient;

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  h.state.link = LINK;
  h.state.past = false;
  h.state.occurrence = 'o1';
  h.rpc.mockClear();
  watch();
});
afterEach(() => {
  observer?.disconnect();
  vi.useRealTimers();
  cleanup();
});

type Shape = {
  name: string;
  link: string | null;
  past?: boolean;
  types: (occ: string | null) => Promise<unknown[]>;
  primary: Kind | null;
  herLink: boolean;
  offer: 'ours' | 'hers' | null;
};
const ok = (rows: unknown[]) => () => Promise.resolve(rows);
const shapes: Shape[] = [
  { name: 'A buyable now + her link', link: LINK, types: ok([row({})]), primary: 'ours', herLink: false, offer: 'ours' },
  { name: 'C sold out + her link', link: LINK, types: ok([row({ status: 'sold_out', remaining: 0, sold_out: true })]), primary: 'quiet', herLink: true, offer: 'hers' },
  { name: 'C closed + her link', link: LINK, types: ok([row({ sales_close_at: PAST })]), primary: 'quiet', herLink: true, offer: 'hers' },
  { name: 'C not yet open + her link', link: LINK, types: ok([row({ sales_open_at: FUTURE })]), primary: 'quiet', herLink: true, offer: 'hers' },
  {
    name: 'mixed nights: this night (o1) not open, o2 open',
    link: LINK,
    types: (occ) => Promise.resolve(occ === 'o1' ? [row({ occurrence_id: 'o1', sales_open_at: FUTURE })] : [row({ occurrence_id: 'o2' })]),
    primary: 'quiet', herLink: true, offer: 'hers',
  },
  { name: 'D no in-site types + her link', link: LINK, types: ok([]), primary: 'hers', herLink: true, offer: 'hers' },
  { name: 'link only: ticket RPC fails', link: LINK, types: () => Promise.reject(new Error('down')), primary: 'hers', herLink: true, offer: 'hers' },
  { name: 'no link, buyable', link: null, types: ok([row({})]), primary: 'ours', herLink: false, offer: 'ours' },
  { name: 'no link, no types', link: null, types: ok([]), primary: null, herLink: false, offer: null },
  { name: 'past night, buyable types + her link (page suppresses both on the bar)', link: LINK, past: true, types: ok([row({})]), primary: null, herLink: false, offer: 'hers' },
];

describe('event page x ticket shape: bar primary, her link, JSON-LD offer URL', () => {
  for (const s of shapes) {
    it(s.name, async () => {
      h.state.link = s.link;
      h.state.past = !!s.past;
      h.state.types = s.types;
      render(page('o1'));
      const want = s.primary === null ? [] : [s.primary];
      await waitFor(() => {
        const k = barKinds().filter((x) => x !== 'directions');
        expect(k).toEqual(want);
        expect(document.querySelector('[data-sticky-action-bar]')).not.toBeNull();
      }, { timeout: 3000});
      // Settle: the probe answered (or was never asked) and nothing is pending.
      await waitFor(() => expect(barKinds()).not.toContain('placeholder'));
      expect(herLinkOnScreen()).toBe(s.herLink);
      const wantUrl = s.offer === 'ours' ? OURS : s.offer === 'hers' ? LINK : null;
      await waitFor(() => expect(offerUrls()).toEqual([wantUrl]));
      // Whole-run invariants.
      for (const k of history) expect(k.filter((x) => x !== 'directions').length).toBeLessThanOrEqual(1);
      if (s.primary === 'ours') expect(herHistory.some(Boolean)).toBe(false);
    });
  }
});

describe('probe timeout (4s): her link, and no later swap', () => {
  it('a slow answer after the timeout never swaps to ours or a placeholder', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolve: (v: unknown[]) => void = () => {};
    h.state.types = () => new Promise<unknown[]>((r) => { resolve = r; });
    render(page('o1'));
    await waitFor(() => expect(barKinds()).toEqual(['placeholder']));
    await act(async () => { vi.advanceTimersByTime(4100); });
    await waitFor(() => expect(barKinds()).toEqual(['hers']));
    const mark = history.length;
    await act(async () => { resolve([row({})]); });
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(barKinds()).toEqual(['hers']);
    for (const k of history.slice(mark)) expect(k.filter((x) => x !== 'directions')).toEqual(['hers']);
    expect(offerUrls()).toEqual([LINK]);
  });
});

describe('night switch resets the live flag', () => {
  it('o1 not open -> o2 not open -> back to cached o1 -> o2 open: each night answers for itself', async () => {
    h.state.types = (occ) => Promise.resolve(occ === 'o1'
      ? [row({ occurrence_id: 'o1', sales_open_at: FUTURE })]
      : [row({ occurrence_id: 'o2', sales_open_at: FUTURE })]);
    const { rerender } = render(page('o1'));
    await waitFor(() => expect(barKinds()).toEqual(['quiet']));
    rerender(page('o2'));
    await waitFor(() => expect(barKinds()).toEqual(['quiet']));
    // Back to o1: its answer is cached and identical to o2's; it must still settle (not stick pending).
    rerender(page('o1'));
    await waitFor(() => expect(barKinds()).toEqual(['quiet']));
    expect(offerUrls()).toEqual([LINK]);
  });
  it('live o1 -> o2 (pending, then not open): never inherits o1, JSON-LD back to hers', async () => {
    let resolveO2: (v: unknown[]) => void = () => {};
    h.state.types = (occ) => occ === 'o1'
      ? Promise.resolve([row({ occurrence_id: 'o1' })])
      : new Promise<unknown[]>((r) => { resolveO2 = r; });
    const { rerender } = render(page('o1'));
    await waitFor(() => expect(barKinds()).toEqual(['ours']));
    await waitFor(() => expect(offerUrls()).toEqual([OURS]));
    const mark = history.length;
    h.state.occurrence = 'o2';
    rerender(page('o2'));
    await waitFor(() => expect(h.rpc.mock.calls.some(([n, a]) => n === 'ticket_types_public_v2' && (a as { p_occurrence_id?: string }).p_occurrence_id === 'o2')).toBe(true));
    // o2 has not answered: o1's Buy must be gone, and the JSON-LD must not still say ours.
    await waitFor(() => expect(barKinds()).toEqual(['placeholder']));
    expect(offerUrls()).toEqual([LINK]);
    await act(async () => { resolveO2([row({ occurrence_id: 'o2', sales_open_at: FUTURE })]); });
    await waitFor(() => expect(barKinds()).toEqual(['quiet']));
    expect(herLinkOnScreen()).toBe(true);
    expect(offerUrls()).toEqual([LINK]);
    // After the switch, ours never showed again for o2.
    const after = history.slice(mark);
    const firstPlaceholder = after.findIndex((k) => k.includes('placeholder'));
    expect(after.slice(Math.max(firstPlaceholder, 0)).some((k) => k.includes('ours'))).toBe(false);
  });
});
