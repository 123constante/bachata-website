// @vitest-environment node
/**
 * The HOMEPAGE loader must DEGRADE, not 500, when its SSR RPCs fail.
 *
 * 2026-10-06 incident: get_map_events_v1 / get_calendar_events_v2 hit Postgres
 * statement timeout (SQLSTATE 57014) on a starved DB, the loader's fetchQuery
 * gate threw, and / (307 -> /city/london-gb) plus every /city/:slug went 500.
 *
 * Drives the REAL loader + headers(); only the two event RPCs are mocked, and
 * they reject the way supabase-js surfaces a PostgrestError -- a plain object
 * carrying `code: '57014'`, not an Error instance.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

const STATEMENT_TIMEOUT = {
  code: '57014',
  message: 'canceling statement due to statement timeout',
  details: null,
  hint: null,
};

const rpc = vi.hoisted(() => ({
  failMap: false,
  failCalendar: false,
  mapError: null as unknown,
  hangMap: false,
}));

vi.mock('@/integrations/supabase/eventRpcs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/supabase/eventRpcs')>();
  return {
    ...actual,
    getCalendarEvents: async () => {
      if (rpc.failCalendar) throw STATEMENT_TIMEOUT;
      return [];
    },
    getMapEvents: async () => {
      if (rpc.hangMap) return new Promise(() => {});
      if (rpc.mapError) throw rpc.mapError;
      if (rpc.failMap) throw STATEMENT_TIMEOUT;
      return [];
    },
  };
});

type LoaderResult = {
  data: { dehydratedState: { queries: unknown[] }; seoEventLinks: unknown[]; cityDisplay?: string };
  init?: { status?: number; headers?: Record<string, string> };
};

const run = async () => {
  const mod = await import('../app/routes/home');
  const result = (await (mod.loader as (a: unknown) => Promise<unknown>)({
    params: { slug: 'london-gb' },
    request: new Request('https://example.test/city/london-gb'),
  })) as LoaderResult;
  const headers = (mod.headers as (a: unknown) => Record<string, string>)({
    loaderHeaders: new Headers(result.init?.headers),
  });
  return { result, headers };
};

describe('home loader degrades on SSR RPC failure (57014)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  // The first run() cold-imports the whole home route. Under the full parallel suite that
  // alone can exceed the 5 s per-test default (it did locally, deterministically), so pay it
  // here with a generous budget instead of inside the first test.
  beforeAll(async () => {
    await import('../app/routes/home');
  }, 60_000);
  beforeEach(() => {
    rpc.failMap = false;
    rpc.failCalendar = false;
    rpc.mapError = null;
    rpc.hangMap = false;
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errorSpy.mockRestore());

  for (const which of ['map', 'calendar', 'both'] as const) {
    it(`${which} RPC rejecting with 57014 -> 200 shell, empty feed, no-store, no throw`, async () => {
      rpc.failMap = which !== 'calendar';
      rpc.failCalendar = which !== 'map';

      const { result, headers } = await run();

      // 200: no explicit status on the data() init.
      expect(result.init?.status ?? 200).toBe(200);
      expect(result.data.dehydratedState.queries).toEqual([]);
      expect(result.data.seoEventLinks).toEqual([]);
      expect(result.data.cityDisplay).toBe('London');
      // Browser never stores it; edge holds it 30s, no stale window, no purge tag.
      expect(headers['Cache-Control']).toBe('no-store');
      expect(headers['Vercel-CDN-Cache-Control']).toBe('public, s-maxage=30');
      expect(headers['Vercel-Cache-Tag']).toBeUndefined();
      // Not swallowed silently.
      const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('"tag":"ssr-degraded"');
      expect(logged).toContain('"code":"57014"');
    });
  }

  it('the SSR deadline (starved DB that never answers) also degrades', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      rpc.hangMap = true;
      const pending = run();
      await vi.advanceTimersByTimeAsync(8_001);
      const { result, headers } = await pending;
      expect(result.init?.status ?? 200).toBe(200);
      expect(result.data.dehydratedState.queries).toEqual([]);
      expect(headers['Cache-Control']).toBe('no-store');
      const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('"kind":"ssr_loader_timeout"');
    } finally {
      vi.useRealTimers();
    }
  });

  // Deterministic breakage must stay a 500 so the prod alarm / synthetic
  // monitor still see it -- only starvation-shaped failures degrade.
  for (const [label, error] of [
    ['a code bug (TypeError)', new TypeError("Cannot read properties of undefined (reading 'x')")],
    ['a missing RPC (PGRST202)', { code: 'PGRST202', message: 'Could not find the function' }],
    ['a thrown Response', new Response(null, { status: 404 })],
  ] as const) {
    it(`${label} is NOT degraded -- it still throws`, async () => {
      rpc.mapError = error;
      await expect(run()).rejects.toBe(error);
      const logged = errorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).not.toContain('ssr-degraded');
    });
  }

  it('healthy path keeps its edge cache policy and tag', async () => {
    const { result, headers } = await run();
    expect(result.init?.status ?? 200).toBe(200);
    expect(headers['Cache-Control']).toBe('public, max-age=0, must-revalidate');
    expect(headers['Vercel-CDN-Cache-Control']).toMatch(/s-maxage=\d+/);
    expect(headers['Vercel-Cache-Tag']).toContain('home-feed');
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
