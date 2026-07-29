// @vitest-environment node
/**
 * Integration proof for WS14: the columnar codec is wired into createQueryClient()
 * and the REAL React Query dehydrate -> JSON -> hydrate path is lossless.
 *
 * The unit test (src/lib/dehydrateCodec.test.ts) exercises pack/unpack directly.
 * This gate exercises them THROUGH the actual library, via the factory the app
 * and the SSR render both use, so a mis-wire (serializeData set but deserializeData
 * missing, or on the wrong options key) fails here — that mis-wire is exactly what
 * would hydration-mismatch in production. Dynamic import + env stub mirrors the
 * SSR gate so @/App evaluates in node.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';

beforeAll(() => {
  if (!import.meta.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = 'https://stub-project.supabase.co';
  }
  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'stub-publishable-key';
  }
});
afterAll(() => {});

const MAP_KEY = ['map-events', 'london-gb', '2026-07-20', '2026-10-18'];
const mapRows = [
  {
    occurrence_id: '11111111-1111-4111-8111-111111111111',
    event_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Sensual Vibes',
    cover_image_url: 'https://x.r2.dev/covers/a.webp',
    venue_name: 'The Dance Hall',
    area: null,
    city_slug: 'london-gb',
    lat: 51.5,
    lng: -0.12,
    instance_date: '2026-07-20',
    start_time: '2026-07-20 20:00:00+00',
    end_time: '2026-07-20 23:00:00+00',
    type: 'standard',
    has_party: true,
    has_class: true,
    created_at: '2026-07-01T10:00:00+00:00',
    updated_at: '2026-07-10T12:00:00+00:00',
    freshness_kind: 'updated',
    is_cancelled: false,
    cancellation_reason_label: null,
    class_start: '20:00',
    class_end: '21:00',
    party_start: '21:00',
    party_end: '23:00',
    format: 'recurring',
    category: 'party',
    slug: 'sensual-vibes',
  },
  {
    occurrence_id: '22222222-2222-4222-8222-222222222222',
    event_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    name: 'ABCD Festival',
    cover_image_url: null,
    venue_name: null,
    area: null,
    city_slug: 'london-gb',
    lat: null,
    lng: null,
    instance_date: '2026-08-01',
    start_time: '2026-08-01 18:00:00+00',
    end_time: null,
    type: 'festival',
    has_party: false,
    has_class: false,
    created_at: '2026-06-15T09:00:00+00:00',
    updated_at: null,
    freshness_kind: 'added',
    is_cancelled: true,
    cancellation_reason_label: 'Venue closed',
    class_start: null,
    class_end: null,
    party_start: null,
    party_end: null,
    format: 'festival',
    category: 'fest',
    slug: 'abcd-festival',
  },
];

/**
 * Both tests below `await import('@/App')`, which evaluates the app's whole
 * module graph in a node env. That costs seconds on its own, and vitest runs
 * this file alongside ~22 others -- the sibling eventPageSsr spec, which does
 * the same import, is measured at ~11s in a full-suite run. Vitest's 5s default
 * was therefore never a realistic budget here: the spec passes in ~1.7s ALONE
 * and times out under parallel load, so the default made a green suite depend
 * on how busy the machine was. This is a load allowance, not a slow assertion
 * being papered over -- the assertions themselves are synchronous.
 */
const APP_IMPORT_TIMEOUT_MS = 20_000;

describe('WS14 dehydrate/hydrate wiring', () => {
  it('columnar-encodes the dehydrated map-events payload and hydrates it back identically', async () => {
    const { createQueryClient } = await import('@/App');

    // Server side: seed a per-request client and dehydrate (serializeData = pack).
    const server: QueryClient = createQueryClient();
    server.setQueryData(MAP_KEY, mapRows);
    const state = dehydrate(server);

    // The wire form must actually be columnar (proves serializeData engaged on the factory).
    const wire = JSON.stringify(state);
    expect(wire).toContain('__mapEventsColumnarV1');
    // And it must be smaller than the naive array-of-objects encoding.
    const naive = JSON.stringify({ ...state, queries: [{ ...state.queries[0], state: { data: mapRows } }] });
    expect(wire.length).toBeLessThan(naive.length);

    // Client side: a DIFFERENT client hydrates the JSON-serialised state
    // (deserializeData = unpack) — the real SSR -> browser boundary.
    const client: QueryClient = createQueryClient();
    hydrate(client, JSON.parse(wire));

    expect(client.getQueryData(MAP_KEY)).toEqual(mapRows);
  }, APP_IMPORT_TIMEOUT_MS);

  it('leaves the live cache raw (pack does not mutate the source array)', async () => {
    const { createQueryClient } = await import('@/App');
    const server = createQueryClient();
    server.setQueryData(MAP_KEY, mapRows);
    dehydrate(server);
    // home.tsx reads qc.getQueryData(['map-events']) for seoEventLinks BEFORE dehydrate
    // and again the render reads the live cache — both must see raw objects, not packed.
    expect(server.getQueryData(MAP_KEY)).toEqual(mapRows);
    expect(Array.isArray(server.getQueryData(MAP_KEY))).toBe(true);
  }, APP_IMPORT_TIMEOUT_MS);
});
