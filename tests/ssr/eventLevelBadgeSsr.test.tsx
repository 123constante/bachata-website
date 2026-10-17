// @vitest-environment node
/**
 * SSR pin for the lazy dancer-level slot on /event/:id (review finding S9).
 *
 * BentoPage makes DerivedLevelBadge and LevelRatingPrompt lazy (lazyWithRetry)
 * inside <Suspense fallback={null}>, to keep the level-rating modules out of
 * the route's first-load JS. Nothing pinned what an ANONYMOUS visitor gets in
 * the server HTML once those imports settle. This file does, by rendering the
 * real framework route component (app/routes/event.tsx default export) with a
 * loader-shaped dehydratedState, in plain node (not jsdom), offline.
 *
 * Pins:
 *  1. settled server HTML carries the event name AND the "Dancers rate:" badge
 *     (LevelRatingPrompt has no summary on the server, so it renders its
 *     `fallback` = the badge), with no error-boundary / SSR-error markers;
 *  2. the lazy slot is the ONLY thing that differs (bar the separately lazy
 *     RSVP slot, tokenised out) between the first pass
 *     (lazy imports still pending) and the settled pass: strip the badge and
 *     React's Suspense markers and the two passes are identical, so the lazy
 *     split cannot quietly drop or reshuffle the content around it;
 *  3. below the rating threshold (derivedLevel null) no badge is rendered.
 *
 * Modelled on tests/ssr/eventPageSsr.test.tsx (env stubs, fetch blocked,
 * dynamic imports so the stubs land before the supabase client evaluates).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router';

const EVENT_UUID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const OCC_UUID = '7a2b3c4d-5e6f-4a70-8b8c-9d0e1f2a3b4c';
const EVENT_NAME = 'Sala Sensual Thursday Social';
const ERROR_BOUNDARY_MARKER = 'Something went wrong';
// Skeleton class shared by the route-level Suspense fallbacks.
const FALLBACK_MARKER = 'h-48 w-full rounded-xl';

let realFetch: typeof globalThis.fetch;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://stub-project.supabase.co');
  }
  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'stub-publishable-key');
  }
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error('SSR level-badge pin: network fetch must not happen during renderToString');
  }) as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  vi.unstubAllEnvs();
});

beforeEach(() => {
  // A React.lazy component caches its resolved module at module scope, so
  // without a reset every test after the first would see the lazy slot already
  // resolved on its "first" pass. Fresh app modules per test = a real cold first
  // render (node_modules, React included, are not re-evaluated).
  vi.resetModules();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

const occurrence = {
  occurrenceId: OCC_UUID,
  startsAt: '2027-01-14T20:00:00',
  endsAt: '2027-01-15T01:00:00',
  localDate: '2027-01-14',
  timezone: 'Europe/London',
  isCancelled: false,
  cancellationReasonLabel: null,
  isLive: false,
  isPast: false,
  isUpcoming: true,
  lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
};

/** Snapshot in the shape parseEventPageSnapshot hands the route (see
 *  buildEventPageModel.derivedLevel.test.ts). Anonymous viewer: no RSVP status. */
const buildSnapshot = (level: { derivedLevel: string | null; levelVoteCount: number | null }) => ({
  eventId: EVENT_UUID,
  occurrenceId: OCC_UUID,
  event: {
    name: EVENT_NAME,
    description: null,
    date: '2027-01-14',
    type: 'party',
    format: 'party',
    timezone: 'Europe/London',
    citySlug: 'london',
    location: null,
    status: 'published',
    lifecycleStatus: null,
    level: 'beginner',
    musicStyles: [],
    isPublished: true,
    createdBy: null,
    imageUrl: null,
    posterUrl: null,
    galleryUrls: [],
    paymentMethods: null,
    keyTimes: null,
    metaDataPublic: {},
    tickets: [],
    promoCodes: [],
    actions: {
      ticketUrl: null,
      websiteUrl: null,
      facebookUrl: null,
      instagramUrl: null,
      whatsappLink: null,
      tiktokUrl: null,
      livestreamUrl: null,
      pricing: null,
    },
    ...level,
  },
  organisers: [],
  organiserCard: { slot1: null, slot2: null },
  occurrences: [occurrence],
  occurrenceEffective: occurrence,
  locationDefault: { city: null, venue: null, timezone: 'Europe/London' },
  attendance: { goingCount: 0, interestedCount: 0, currentUserStatus: null, preview: [] },
});

type Level = Parameters<typeof buildSnapshot>[0];

/**
 * Seed what the /event/:id loader dehydrates (app/routes/event.tsx): the
 * entity-resolve entry, the snapshot, and the festival-detail sniff (null =>
 * not a festival). Rendered through the REAL route component so its
 * HydrationBoundary + InitialVisiblePageTransition are on the path.
 */
async function buildTree(level: Level) {
  const { AppProviders, createQueryClient } = await import('@/App');
  const { dehydrate } = await import('@tanstack/react-query');
  const { eventPageQueryKey } = await import('@/modules/event-page/useEventPageQuery');
  const { festivalDetailQueryKey } = await import('@/modules/event-page/useFestivalDetailQuery');
  const { default: EventRoute } = await import('../../app/routes/event');
  const { CityProvider } = await import('@/contexts/CityContext');
  const { SearchProvider } = await import('@/components/search/SearchProvider');

  const loaderClient = createQueryClient();
  loaderClient.setQueryData(['entity-resolve', 'events', 'id', EVENT_UUID], { id: EVENT_UUID, slug: null });
  loaderClient.setQueryData(eventPageQueryKey(EVENT_UUID, null), buildSnapshot(level));
  loaderClient.setQueryData(festivalDetailQueryKey(EVENT_UUID), null);
  const loaderData = { dehydratedState: dehydrate(loaderClient) };

  // Per-request render client, as in real SSR.
  const client = createQueryClient();
  const Route_ = EventRoute as unknown as (p: { loaderData: unknown; params: { id: string } }) => ReactElement;
  return (
    <AppProviders client={client}>
      <StaticRouter location={`/event/${EVENT_UUID}`}>
        {/* Same provider order as app/root.tsx (minus AppChrome's header and
            nav, which are not what this file pins). */}
        <CityProvider>
          <SearchProvider>
            <Routes>
              <Route path="/event/:id" element={<Route_ loaderData={loaderData} params={{ id: EVENT_UUID }} />} />
            </Routes>
          </SearchProvider>
        </CityProvider>
      </StaticRouter>
    </AppProviders>
  );
}

/** First pass (lazy imports pending) and the settled pass (re-rendered after
 *  each dynamic import settles until the output is stable, capped). */
async function renderPasses(level: Level): Promise<{ first: string; settled: string }> {
  const tree = await buildTree(level);
  const first = renderToString(tree);
  let html = first;
  for (let pass = 0; pass < 12; pass++) {
    await vi.dynamicImportSettled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const next = renderToString(tree);
    if (next === html) break;
    html = next;
  }
  return { first, settled: html };
}

function expectCleanRender(html: string) {
  expect(html).not.toContain(FALLBACK_MARKER);
  expect(html).not.toContain(ERROR_BOUNDARY_MARKER);
  expect(html).not.toContain('is not defined');
  const logged = consoleErrorSpy.mock.calls
    .flat()
    .map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a)))
    .join('\n');
  expect(logged).not.toMatch(/ReferenceError|is not defined/);
}

// The badge's wrapper div as DerivedLevelBadge renders it (no nested divs).
const BADGE_RE = /<div class="mt-3 flex flex-wrap gap-2"><span data-testid="derived-level-badge"[\s\S]*?<\/span><\/span><\/div>/g;

/** Drop React's Suspense boundary comments and the client-render templates a
 *  still-pending lazy leaves in the first pass, so only real markup compares. */
const normaliseSuspense = (html: string) =>
  html.replace(/<template[^>]*><\/template>/g, '').replace(/<!--\/?\$[!?]?-->/g, '');

// RsvpBlock is the OTHER lazy slot on this path (placeholder first, block once
// its chunk settles). Both render one <section> with no nested section; swap
// either for a token so the comparison isolates the level slot.
const RSVP_RE = /<section[^>]*data-testid="rsvp-(?:placeholder|block)"[\s\S]*?<\/section>/g;
const RSVP_TOKEN = '<RSVP-SLOT/>';

describe('SSR: /event/:id dancer-level lazy slot (anonymous, node)', { timeout: 30_000 }, () => {
  it('settled server HTML carries the event name and the "Dancers rate:" badge, cleanly', async () => {
    const { DANCER_LEVEL_LABEL } = await import('@/modules/event-page/bento/blocks/DerivedLevelBadge');
    const { settled } = await renderPasses({ derivedLevel: 'strong', levelVoteCount: 9 });
    expectCleanRender(settled);
    expect(settled).toContain(EVENT_NAME);
    expect(settled).toContain(DANCER_LEVEL_LABEL);
    expect(settled).toContain('data-testid="derived-level-badge"');
    expect(settled).toContain('Rated by dancers (9 ratings)');
    // Exactly one badge: the cancelled branch and the prompt fallback never both render.
    expect(settled.match(BADGE_RE)).toHaveLength(1);
  });

  it('only the lazy level slot differs between the first pass and the settled pass', async () => {
    const { DANCER_LEVEL_LABEL } = await import('@/modules/event-page/bento/blocks/DerivedLevelBadge');
    const { first, settled } = await renderPasses({ derivedLevel: 'strong', levelVoteCount: 9 });
    // Page content is server-rendered before the lazy slot resolves...
    expect(first).toContain(EVENT_NAME);
    // ...and the slot itself is empty on the first pass (fallback={null}).
    expect(first).not.toContain(DANCER_LEVEL_LABEL);
    expectCleanRender(settled);
    // The RSVP slot is present in both passes (placeholder, then the block).
    expect(first.match(RSVP_RE)).toHaveLength(1);
    expect(settled.match(RSVP_RE)).toHaveLength(1);
    // Everything outside the two lazy slots is byte-identical across the passes:
    // resolving the level badge adds the badge and nothing else.
    const strip = (html: string) => normaliseSuspense(html.replace(RSVP_RE, RSVP_TOKEN));
    expect(strip(settled.replace(BADGE_RE, ''))).toBe(strip(first));
  });

  it('below the rating threshold (derivedLevel null) the settled HTML has no badge', async () => {
    const { DANCER_LEVEL_LABEL } = await import('@/modules/event-page/bento/blocks/DerivedLevelBadge');
    const { settled } = await renderPasses({ derivedLevel: null, levelVoteCount: 3 });
    expectCleanRender(settled);
    expect(settled).toContain(EVENT_NAME);
    expect(settled).not.toContain(DANCER_LEVEL_LABEL);
  });
});
