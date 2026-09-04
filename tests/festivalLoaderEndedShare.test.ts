// @vitest-environment node
/**
 * Series-termination arc W14 -- the /festival/:id loader's ended share copy.
 *
 * Both cases here are regressions with a receipt.
 *
 * THE CRASH. The first version of this feature called parseEventPageSnapshot at
 * the top level of the loader. That function is the CLIENT'S contract check and
 * it THROWS on a payload missing a required key. The snapshot it reads comes
 * from a prefetchQuery, which swallows its own errors by design -- so the cache
 * entry is legitimately absent, or partial from a degraded RPC -- and every one
 * of those became a 500 on a live festival page, to decide one line of share
 * copy. tests/festivalLoaderEdgeTtl.test.ts caught it, incidentally, because its
 * supabase mock returns `{}`. Incidentally is not good enough: that file is
 * about cache TTLs, its rpc mock could reasonably be enriched one day, and this
 * claim would then go untested with nothing to say so. Case 1 names it.
 *
 * THE OPPOSITE HALF, which the crash test cannot give: proving the loader does
 * not throw says nothing about whether it produces the right copy, and a `catch`
 * that swallowed everything would pass case 1 forever. Case 2 drives a real
 * ended payload through and pins the sentence.
 */
import { describe, it, expect, vi } from 'vitest';

const EVENT_UUID = '00000000-0000-4000-8000-0000000000f2';
const SLUG = 'ended-festival';

// The snapshot the mocked event_view_p5 returns. Mutated per case; snake_case
// because this is the RAW compat payload, which is what the loader caches.
const rpc = vi.hoisted(() => ({ payload: {} as Record<string, unknown> }));

vi.mock('../app/detailLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app/detailLoader')>();
  return {
    ...actual,
    resolveEntityInLoader: async () => ({ id: EVENT_UUID, slug: SLUG, arrivedViaUuid: false }),
    resolveOgCardImage: async () => 'https://example.test/card.jpg',
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async () => ({ data: rpc.payload, error: null }) },
}));

vi.mock('@/modules/event-page/festivalEventQuery', () => ({
  festivalEventQueryKey: (id: string) => ['festival-event', id],
  fetchFestivalEventRow: async () => ({ id: EVENT_UUID, name: 'Ended Festival', city: 'London' }),
}));

vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({
  festivalDetailQueryKey: (id: string) => ['festival-detail', id],
  fetchFestivalDetail: async () => ({
    eventId: EVENT_UUID,
    dates: { local_start: '2026-05-01', local_end: '2026-05-04', timezone: 'Europe/London' },
  }),
}));

const runLoader = async () => {
  const { loader } = await import('../app/routes/festival');
  return loader({
    params: { id: SLUG },
    request: new Request(`https://example.test/festival/${SLUG}`),
    context: {} as never,
  } as never);
};

const endedDescriptionOf = (result: unknown): string | null =>
  (result as { data: { endedDescription: string | null } }).data.endedDescription;

// A payload carrying every key parseEventPageSnapshot requires, in the ended
// state. Built here rather than imported so a change to the RPC's shape shows up
// as a failure in this file, which is the point of a fixture.
const endedPayload = {
  event_id: EVENT_UUID,
  occurrence_id: null,
  event: {
    name: 'Ended Festival',
    description: 'Four days of bachata on the coast. Passes from EUR 100.',
    lifecycle_status: 'ended',
    ended_on: '2026-05-04',
    ran_from: '2026-05-01',
    format: 'festival',
    type: 'festival',
    category: null,
    status: 'published',
    is_published: true,
    // REQUIRED by parseEventPageSnapshot (requireObject), along with
    // `attendance` and `location_default` below. Leaving them out is how the
    // first draft of this fixture threw inside the loader's try -- and the catch
    // reported it as "no ended copy", indistinguishable from a live festival.
    // That is exactly the blindness case 2 exists to remove: the crash test
    // alone would have stayed green through it.
    actions: {},
    meta_data_public: {},
  },
  organisers: [],
  occurrences: [],
  occurrence_effective: null,
  location_default: { city: null, venue: null, timezone: 'Europe/London' },
  attendance: { going_count: 0, interested_count: 0, current_user_status: null, preview: [] },
};

describe('/festival/:id loader -- ended share copy', () => {
  it('does not throw on a partial snapshot, and asserts no ended copy', async () => {
    rpc.payload = {}; // what a swallowed prefetch failure leaves behind
    const result = await runLoader();
    // The absence is the assertion. Reaching this line at all is the crash test;
    // null is what lets festival.detail's own template stand, which is exactly
    // what this route served before W14.
    expect(endedDescriptionOf(result)).toBeNull();
  });

  it('emits the ended sentence, replacing the sell, for a real ended payload', async () => {
    rpc.payload = endedPayload;
    const description = endedDescriptionOf(await runLoader());
    expect(description).toBe(
      'This festival has finished and is no longer running. It ran 1 to 4 May 2026. See what else is on at Bachata Calendar.',
    );
    // REPLACED, not prefixed. The stored copy sells passes, and leaving it in
    // the preview is the defect the whole ended treatment exists to stop.
    expect(description).not.toContain('Passes from');
  });

  // THE ASYMMETRY CASE (review finding, 2026-09-04). This payload is ENDED and
  // carries every field the sentence needs, but is missing keys the CLIENT'S
  // parser requires -- no event.actions, no attendance, no location_default.
  // While the loader ran it through parseEventPageSnapshot the parse threw, the
  // catch returned null, and the document shipped "...dates, line-up, location
  // and tickets" over a page that was ALREADY rendering the tombstone, because
  // FestivalDetailInner reads lifecycle_status raw and never parses. Same
  // page/preview contradiction W14 exists to remove, pointing the other way.
  // The loader now reads at the component's strictness, so this is ended copy.
  it('still emits ended copy when the payload lacks keys only the PARSER needs', async () => {
    rpc.payload = {
      event: {
        name: 'Ended Festival',
        lifecycle_status: 'ended',
        ended_on: '2026-05-04',
        ran_from: '2026-05-01',
        format: 'festival',
        type: 'festival',
        category: null,
      },
    };
    expect(endedDescriptionOf(await runLoader())).toBe(
      'This festival has finished and is no longer running. It ran 1 to 4 May 2026. See what else is on at Bachata Calendar.',
    );
  });

  it('leaves a LIVE festival with no ended copy, so the template stands', async () => {
    rpc.payload = {
      ...endedPayload,
      event: { ...endedPayload.event, lifecycle_status: 'live', ended_on: null, ran_from: null },
    };
    expect(endedDescriptionOf(await runLoader())).toBeNull();
  });
});
