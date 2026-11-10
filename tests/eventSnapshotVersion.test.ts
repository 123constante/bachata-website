// @vitest-environment node
/**
 * Live-now slice 2 (Website half): the public `version` on the event snapshot.
 *
 * event_view_p5(snapshot_compat) carries a top-level `version` (admin
 * 20270312410000 + #1280). Slice 3 reads it off the public /event/<slug>.data
 * twin, which is the loader's dehydrated React Query cache -- and that cache
 * holds the output of parseEventPageSnapshot, which drops every key it does not
 * name. So the field has to survive BOTH the parser and the dehydrate.
 *
 * Prod survey 2026-11-06 (read-only, counts only, project stsdtacfauprzrdebmzg):
 * 40/40 live occurrence-targeted compat calls and 12/12 non-null series-only
 * calls returned `version` as a JSON number; all integers, 1790673796391298 ..
 * 1793435959737933 (microsecond epoch, below 2^53). Expected values below are
 * literals, never derived from the code under test.
 */
import { describe, it, expect, vi } from 'vitest';
import { parseEventPageSnapshot } from '@/modules/event-page/useEventPageQuery';

const EVENT_UUID = '00000000-0000-4000-8000-0000000000a5';
const SLUG = 'version-pin-social';
const PROD_VERSION = 1793435959737933;

const rpc = vi.hoisted(() => ({ payload: null as unknown }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (name: string) => ({ data: name === 'event_view_p5' ? rpc.payload : null, error: null }),
  },
}));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({
  resolvePublicEventRef: async () => ({ id: EVENT_UUID, slug: SLUG }),
}));
vi.mock('../app/detailLoader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../app/detailLoader')>()),
  resolveOgCardImage: async () => 'https://example.test/card.jpg',
}));
vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({
  festivalDetailQueryKey: (id: string) => ['festival-detail', id],
  fetchFestivalDetail: async () => null,
}));
vi.mock('@/pages/EventPage', () => ({ default: () => null }));

// Every key parseEventPageSnapshot requires (snake_case: the RAW compat payload).
const basePayload = (): Record<string, unknown> => ({
  event_id: EVENT_UUID,
  occurrence_id: null,
  event: {
    name: 'Version Pin Social',
    description: null,
    lifecycle_status: 'live',
    format: 'recurring',
    type: 'social',
    category: 'party',
    status: 'published',
    is_published: true,
    actions: {},
    meta_data_public: {},
  },
  organisers: [],
  occurrences: [],
  occurrence_effective: null,
  location_default: { city: null, venue: null, timezone: 'Europe/London' },
  attendance: { going_count: 0, interested_count: 0, current_user_status: null, preview: [] },
});

const withVersion = (v: unknown, present = true) => {
  const p = basePayload();
  if (present) p.version = v;
  return p;
};

const CASES: Array<{ name: string; payload: Record<string, unknown>; expected: number | null }> = [
  { name: 'prod-shaped number', payload: withVersion(PROD_VERSION), expected: 1793435959737933 },
  { name: 'smallest prod value', payload: withVersion(1790673796391298), expected: 1790673796391298 },
  { name: 'zero', payload: withVersion(0), expected: 0 },
  { name: 'absent (pre-#1176 RPC)', payload: withVersion(undefined, false), expected: null },
  { name: 'null', payload: withVersion(null), expected: null },
  { name: 'numeric string', payload: withVersion('1793435959737933'), expected: null },
  { name: 'object', payload: withVersion({ v: 1 }), expected: null },
  { name: 'array', payload: withVersion([1]), expected: null },
  { name: 'boolean', payload: withVersion(true), expected: null },
  { name: 'fraction', payload: withVersion(1.5), expected: null },
  { name: 'negative', payload: withVersion(-1), expected: null },
  { name: 'past 2^53 (precision lost)', payload: withVersion(2 ** 53 + 2), expected: null },
];

describe('parseEventPageSnapshot -- version', () => {
  it.each(CASES)('$name -> $expected, never throws', ({ payload, expected }) => {
    const snap = parseEventPageSnapshot(payload);
    expect(snap).not.toBeNull();
    expect(snap!.version).toBe(expected);
  });

  it('leaves the rest of the snapshot unchanged', () => {
    const without = parseEventPageSnapshot(withVersion(undefined, false))!;
    for (const { payload } of CASES) {
      const { version: _v, ...rest } = parseEventPageSnapshot(payload)!;
      const { version: _w, ...restWithout } = without;
      expect(rest).toEqual(restWithout);
    }
  });
});

const IMPORT_BUDGET_MS = 60_000;

const dehydratedSnapshotVersion = async (): Promise<unknown> => {
  const { loader } = await import('../app/routes/event');
  const result = (await loader({
    params: { id: SLUG },
    request: new Request(`https://example.test/event/${SLUG}`),
    context: {} as never,
  } as never)) as { data: { dehydratedState: unknown } };
  // The .data twin is a serialisation of exactly this object; round-trip it.
  const state = JSON.parse(JSON.stringify(result.data.dehydratedState)) as {
    queries: Array<{ queryKey: unknown[]; state: { data: Record<string, unknown> | null } }>;
  };
  const entry = state.queries.find((q) => q.queryKey[0] === 'event-page-snapshot');
  expect(entry, 'loader must dehydrate the event-page snapshot').toBeTruthy();
  return entry!.state.data ? ('version' in entry!.state.data ? entry!.state.data.version : 'MISSING') : 'NO-DATA';
};

describe('/event/:id loader -- dehydrated .data carries version', () => {
  it('carries the prod-shaped number', async () => {
    rpc.payload = withVersion(PROD_VERSION);
    expect(await dehydratedSnapshotVersion()).toBe(1793435959737933);
  }, IMPORT_BUDGET_MS);

  it('carries an explicit null when the RPC has no version', async () => {
    rpc.payload = withVersion(undefined, false);
    expect(await dehydratedSnapshotVersion()).toBeNull();
  }, IMPORT_BUDGET_MS);
});
