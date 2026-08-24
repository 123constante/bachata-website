/**
 * The ONE festival fixture. Both the SSR gate (tests/ssr/festivalDaysAwaySsr)
 * and the client harness (tests/client/festivalClientState) seed from here.
 *
 * It lives in its own module because the two suites assert opposite halves of
 * the same component -- what the SERVER emits, and what the CLIENT does after
 * hydration -- and a fixture copied into both drifts silently: the copy that
 * stops matching the parser keeps passing, because a stale shape still renders
 * SOMETHING. One source, one parser, one set of dates.
 */
import { vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';

export const EVENT_UUID = '00000000-0000-4000-8000-0000000000f1';
export const SLUG = 'test-festival';

// Deliberately NOT Europe/London. The festival page runs on the EVENT's
// calendar, so a London-pinned assumption anywhere in this path has to show up
// as a wrong result rather than passing by coincidence on a London machine.
export const TZ = 'Africa/Tunis';

// The festival runs 4-6 Sept. Every expectation is derived from these two keys
// plus a pinned "today", never hard-coded to a real date -- so nothing here
// rots the moment it runs on a different day.
export const LOCAL_START = '2026-09-04';
export const LOCAL_END = '2026-09-06';

/**
 * One session on each of the festival's three days. `days` comes from the SPAN
 * (local_start..local_end) via festivalGridDays, not from the schedule -- but
 * the timeline block is still gated on having both days AND hours, and `hours`
 * is session-derived, so nothing renders without this.
 *
 * WHAT THIS FIXTURE CANNOT SEE: the span/schedule distinction. Its three
 * session days are exactly the three span days, so span-derived and
 * session-derived columns are identical here and a case built on it passes
 * against EITHER implementation. The SSR suite covers the session-less span day
 * separately by filtering this list down to two of the three days. An
 * out-of-span session and an undated session remain queued, not covered.
 */
export const SCHEDULE = [LOCAL_START, '2026-09-05', LOCAL_END].map((day, i) => ({
  id: `sess-${i}`,
  day,
  title: `Session ${i}`,
  start_time: '20:00:00',
  type: 'class',
}));

/**
 * A SECOND festival, for the warm-navigation cases. Different id, different
 * span, and deliberately FEWER days than the first -- a festival-to-festival
 * navigation from a 3-day event to a 2-day one is what makes a leaked day
 * index out-of-range rather than merely wrong.
 */
export const EVENT_UUID_B = '00000000-0000-4000-8000-0000000000f2';
export const SLUG_B = 'test-festival-b';
export const LOCAL_START_B = '2026-10-10';
export const LOCAL_END_B = '2026-10-11';
export const SCHEDULE_B = [LOCAL_START_B, LOCAL_END_B].map((day, i) => ({
  id: `b-sess-${i}`,
  day,
  title: `B Session ${i}`,
  start_time: '20:00:00',
  type: 'class',
}));

let realFetch: typeof globalThis.fetch | undefined;

/**
 * Stub the env and make fetch THROW. Every query is pre-seeded, so a network
 * call means the fixture is wrong rather than the assertion being lenient.
 *
 * This is not hygiene. A real Supabase client opened in an extra worker has
 * reproducibly reddened three unrelated timing-sensitive tests in this repo
 * while passing when run alone -- so an un-stubbed fetch here does not fail
 * HERE, it fails somewhere else, intermittently.
 */
export function installFixtureFetchGate(label: string) {
  // Refuse to stack. A second install without a remove would capture the
  // THROWING stub as `realFetch`, and the restore would then leave every
  // subsequent test in the worker with a fetch that throws -- a failure that
  // surfaces far from its cause.
  if (realFetch) {
    throw new Error(`${label}: a fixture fetch gate is already installed`);
  }
  if (!import.meta.env.VITE_SUPABASE_URL) {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://stub-project.supabase.co');
  }
  if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'stub-publishable-key');
  }
  realFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error(`${label}: every query must be pre-seeded; no fetch during render`);
  }) as typeof globalThis.fetch;
}

export function removeFixtureFetchGate() {
  // Only restore what was actually captured. Unconditional restore sets
  // `globalThis.fetch = undefined` whenever install threw before reaching the
  // capture -- a sibling beforeAll hook throwing (jsdom polyfills, say) would
  // then delete fetch for the rest of the worker.
  if (realFetch) {
    globalThis.fetch = realFetch;
    realFetch = undefined;
  }
  vi.unstubAllEnvs();
}

/**
 * Seed the four queries FestivalDetail mounts. Built through the REAL
 * parseFestivalDetail rather than a hand-written object literal: the parser is
 * what the loader and the client hook both run, so if the payload shape changes
 * under us this fixture changes with it instead of silently describing a shape
 * that no longer exists.
 */
export async function seedClient(
  schedule: unknown[] = [],
  span: { start: string; end: string } = { start: LOCAL_START, end: LOCAL_END },
  ids: { uuid: string; slug: string; name: string } = {
    uuid: EVENT_UUID,
    slug: SLUG,
    name: 'Test Festival',
  },
  client?: QueryClient,
): Promise<QueryClient> {
  const { createQueryClient } = await import('@/App');
  const { parseFestivalDetail, festivalDetailQueryKey } = await import(
    '@/modules/event-page/useFestivalDetailQuery'
  );
  const { festivalEventQueryKey } = await import('@/modules/event-page/festivalEventQuery');

  const qc = client ?? createQueryClient();

  // useEntitySlugOrId: for `events` the id comes ONLY from this query (the raw
  // uuid is deliberately never re-injected), so without this the page renders
  // "Festival not found" and every other assertion would be vacuous.
  qc.setQueryData(['entity-resolve', 'events', 'id', ids.uuid], {
    id: ids.uuid,
    slug: ids.slug,
  });

  qc.setQueryData(festivalEventQueryKey(ids.uuid), {
    id: ids.uuid,
    name: ids.name,
    city: 'Tunis',
    date: null,
    start_time: null,
    poster_url: null,
    description: null,
    ticket_url: null,
    faq: null,
    meta_data: null,
  });

  // Non-cancelled AND present: heroDayStatus stays silent until cancellation is
  // KNOWN, so an absent snapshot would suppress output for a reason that has
  // nothing to do with what these suites test.
  qc.setQueryData(['festival-snapshot', ids.uuid], {
    occurrence_effective: { is_cancelled: false, cancellation_reason_label: null },
  });

  qc.setQueryData(
    festivalDetailQueryKey(ids.uuid),
    parseFestivalDetail({
      event_id: ids.uuid,
      identity: { name: ids.name },
      dates: { local_start: span.start, local_end: span.end, timezone: TZ },
      schedule,
      passes: [],
    }),
  );

  return qc;
}
