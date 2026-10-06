// @vitest-environment jsdom
/**
 * Repro for the missing "What level is this event?" prompt on /event/:slug
 * (observed on prod 2026-10-06 for a signed-in dancer).
 *
 * Mounts the REAL route chain -- EventPage -> useEntitySlugOrId -> BentoPage ->
 * LevelRatingPrompt -- against a fake Supabase whose RPCs follow the LIVE
 * contracts, read from the DB on 2026-10-06:
 *
 *   resolve_public_event_ref_v1  -> {id: COALESCE(legacy_event_id, series id), slug}
 *   event_view_p5                -> echoes that id back as `event_id`
 *   series_level_summary_p5_v1   -> NULL unless p_series_id is an event_series_p5.id
 *                                   (_p5_series_is_public_v1 matches `s.id = p_series_id`)
 *
 * A series with a legacy_event_id (every live one when this was written) therefore
 * hands the prompt an id the summary RPC does not know, gets NULL, and the prompt
 * renders nothing. My Attendance has the same defect: get_my_event_attendance_v2
 * emits event_series_p5.public_event_id, which is that same public id.
 *
 * The page has no anon-readable way to learn the series uuid (event_series_p5's
 * select policy is admin-only and no public payload carries it), so the fix
 * belongs to the admin repo: series_level_summary_p5_v1 and rate_series_level_p5_v1
 * must accept the public event id. When that migration lands, flip
 * LEVEL_RPC_ACCEPTS_LEGACY_ID below to true -- the `it.fails` case then goes red,
 * which is the signal to turn it into a plain `it`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import './jsdomPolyfills';

/** Mirror of the live series_level_summary_p5_v1 contract. False on 2026-10-06. */
const LEVEL_RPC_ACCEPTS_LEGACY_ID = false;

const h = vi.hoisted(() => {
  const SERIES_ID = '00730598-fd66-4a1a-90c6-e3f1b027336e';
  const LEGACY_ID = '4ec7a3d5-02bb-4e80-9439-9db4766b00b2';
  const state = {
    user: null as { id: string; is_anonymous: boolean } | null,
    levelRpcAcceptsLegacyId: false,
  };

  // Chainable no-op for every non-RPC client surface the page touches
  // (.from().select().eq()..., .channel().on().subscribe(), auth.*). Awaiting any
  // link resolves to an empty result.
  const chain = (): unknown =>
    new Proxy(function () {}, {
      get: (_t, prop) =>
        prop === 'then'
          ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null })
          : chain(),
      apply: () => chain(),
    });

  const snapshot = {
    event_id: LEGACY_ID,
    occurrence_id: null,
    event: {
      name: 'Pura Nights Ealing',
      description: 'Bachata Party',
      format: 'party',
      type: 'party',
      lifecycle_status: 'live',
      is_published: true,
      actions: {},
      photo_urls: [],
      video_urls: [],
      music_styles: [],
    },
    location_default: {},
    attendance: { going_count: 0, interested_count: 0, preview: [] },
    organisers: [],
    occurrences: [],
    occurrence_effective: null,
  };

  const rpc = vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
    switch (name) {
      case 'resolve_public_event_ref_v1':
        return { data: { id: LEGACY_ID, slug: 'pura-nights-ealing' }, error: null };
      case 'event_view_p5':
        return { data: snapshot, error: null };
      case 'series_level_summary_p5_v1': {
        const id = args.p_series_id;
        const known = id === SERIES_ID || (state.levelRpcAcceptsLegacyId && id === LEGACY_ID);
        return {
          data: known
            ? { series_id: SERIES_ID, vote_count: 0, threshold: 7, counts: null, derived_level: null, my_level: null }
            : null,
          error: null,
        };
      }
      default:
        return { data: null, error: null };
    }
  });

  const fakeClient = new Proxy({ rpc } as Record<string | symbol, unknown>, {
    // No `then`: getSupabase() is awaited, and a thenable client would unwrap.
    get: (t, prop) => (prop === 'then' ? undefined : prop in t ? t[prop] : chain()),
  });

  return { rpc, fakeClient, state };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: h.fakeClient }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.fakeClient }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.state.user, session: null, loading: false }) }));

import EventPage from '@/pages/EventPage';
import { CityProvider } from '@/contexts/CityContext';

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/pura-nights-ealing']}>
        <CityProvider>
          <Routes>
            <Route path="/event/:id" element={<EventPage />} />
          </Routes>
        </CityProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const summaryCalls = () => h.rpc.mock.calls.filter(([name]) => name === 'series_level_summary_p5_v1');

beforeEach(() => {
  h.state.user = { id: 'dancer-1', is_anonymous: false };
  h.state.levelRpcAcceptsLegacyId = LEVEL_RPC_ACCEPTS_LEGACY_ID;
  h.rpc.mockClear();
});
afterEach(cleanup);

describe('/event/:slug level rating prompt (signed-in dancer)', () => {
  // Precondition for the `it.fails` below: the page renders and the prompt asks
  // the summary RPC. Green here + red there pins the failure to the RPC answer,
  // not to a crash or a fake-client gap.
  it('renders the event page and asks for the level summary', async () => {
    mount();
    expect((await screen.findAllByText('Pura Nights Ealing')).length).toBeGreaterThan(0);
    await waitFor(() => expect(summaryCalls().length).toBeGreaterThan(0));
  });

  // KNOWN BUG (2026-10-06). See the header for why this is `it.fails`.
  it.fails('shows the rating chips on a live event page', async () => {
    mount();
    expect(await screen.findByTestId('level-rating-beginner', {}, { timeout: 2000 })).toBeTruthy();
  });

  it('shows the chips once the level RPC accepts the public (legacy) event id', async () => {
    h.state.levelRpcAcceptsLegacyId = true;
    mount();
    expect(await screen.findByTestId('level-rating-beginner')).toBeTruthy();
    expect(screen.getByLabelText('Rate the level of this event')).toBeTruthy();
  });
});
