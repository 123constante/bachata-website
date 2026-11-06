// @vitest-environment jsdom
/**
 * "How to pay" line on /event/:id: stored payment_methods x event state.
 * Pure mapping table + the same table through the real BentoPage mount.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '../../../../../tests/client/jsdomPolyfills';
import { howToPayText } from '@/lib/paymentMethods';
import { HowToPayLine } from '@/modules/event-page/bento/blocks/HowToPayLine';

const VALUES: Array<[string, string | null, string | null]> = [
  ['free', 'free', 'Free'],
  ['free + door (free wins)', 'free,door', 'Free'],
  ['ticket link', 'ticket_link', 'Ticket link'],
  ['screen order', 'door,bank_transfer,cash', 'Pay at the door, Bank transfer, Cash'],
  ['null', null, null],
  ['empty', '', null],
  ['unknown only', 'bogus', null],
];

describe('howToPayText', () => {
  it.each(VALUES)('%s', (_n, stored, want) => {
    expect(howToPayText(stored)).toBe(want);
  });
});

describe('HowToPayLine', () => {
  afterEach(cleanup);
  it.each(VALUES)('%s', (_n, stored, want) => {
    const { container } = render(<HowToPayLine stored={stored} />);
    if (want === null) expect(container.textContent).toBe('');
    else {
      expect(screen.getByText('How to pay')).toBeTruthy();
      expect(screen.getByText(want)).toBeTruthy();
    }
  });
});

const h = vi.hoisted(() => {
  const ID = '4ec7a3d5-02bb-4e80-9439-9db4766b00b2';
  const state = { pay: null as string | null, occ: null as Record<string, unknown> | null };
  const chain = (): unknown =>
    new Proxy(function () {}, {
      get: (_t, p) => (p === 'then' ? (r: (v: unknown) => void) => r({ data: null, error: null }) : chain()),
      apply: () => chain(),
    });
  const snap = () => ({
    event_id: ID,
    occurrence_id: null,
    event: {
      name: 'Pay Test Night', description: 'x', format: 'party', type: 'party',
      lifecycle_status: 'live', is_published: true, actions: {}, photo_urls: [], video_urls: [],
      music_styles: [], payment_methods: state.pay,
    },
    location_default: {}, attendance: { going_count: 0, interested_count: 0, preview: [] },
    organisers: [], occurrences: [], occurrence_effective: state.occ ? { occurrence_id: 'occ-1', lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] }, is_live: false, is_upcoming: true, ...state.occ } : null,
  });
  const rpc = vi.fn(async (name: string) => {
    if (name === 'resolve_public_event_ref_v1') return { data: { id: ID, slug: 'pay-test' }, error: null };
    if (name === 'event_view_p5') return { data: snap(), error: null };
    return { data: null, error: null };
  });
  const client = new Proxy({ rpc } as Record<string | symbol, unknown>, {
    get: (t, p) => (p === 'then' ? undefined : p in t ? t[p] : chain()),
  });
  return { client, state };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: h.client }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.client }));
vi.mock('@/hooks/useAuth', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, session: null, loading: false }),
}));

import EventPage from '@/pages/EventPage';
import { CityProvider } from '@/contexts/CityContext';

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/pay-test']}>
        <CityProvider>
          <Routes><Route path="/event/:id" element={<EventPage />} /></Routes>
        </CityProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const STATES: Array<[string, Record<string, unknown>, boolean]> = [
  ['upcoming', { is_past: false, is_cancelled: false, starts_at: '2099-01-01T20:00:00', ends_at: '2099-01-02T02:00:00' }, true],
  ['past', { is_past: true, is_cancelled: false, starts_at: '2020-01-01T20:00:00', ends_at: '2020-01-02T02:00:00' }, false],
  ['cancelled', { is_past: false, is_cancelled: true }, false],
];

describe('BentoPage how-to-pay line', () => {
  afterEach(cleanup);
  for (const [sn, occ, visible] of STATES) {
    for (const [vn, stored, want] of VALUES) {
      it(`${sn} x ${vn}`, async () => {
        h.state.pay = stored;
        h.state.occ = occ;
        mount();
        try { expect((await screen.findAllByText('Pay Test Night', {}, { timeout: 3000 })).length).toBeGreaterThan(0); } catch (e) { console.log('BODY', document.body.textContent?.slice(0, 600)); throw e; }
        if (visible && want) {
          expect(await screen.findByText(want, {}, { timeout: 4000 })).toBeTruthy();
          expect(screen.getByText('How to pay')).toBeTruthy();
        } else {
          await new Promise((r) => setTimeout(r, 50));
          expect(screen.queryByText('How to pay')).toBeNull();
        }
      });
    }
  }
});
