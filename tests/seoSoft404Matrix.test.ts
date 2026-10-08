import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { matchPath } from 'react-router';

// Soft-404 matrix (2026-10-08). Live bug: /this-page-does-not-exist-live-qa
// answered 308 -> /city/this-page-does-not-exist-live-qa, which answered 200 as
// "What's on in This Page Does Not Exist Live" with canonical "/". Any made-up
// path was an indexable 200.
//
// One request is simulated end to end over the REAL pieces, in the order they
// run in prod: vercel.json redirects (the real file) -> app/routes.ts ownership
// -> the route's loader / the catchall gate wired in entry.server.tsx -> the
// document header finaliser entry.server.tsx applies. Only the DB is faked, and
// it is faked with the prod survey of 2026-10-08 (read-only, counts only):
// cities = 1 active (london-gb) + 318 inactive, all lowercase ascii slugs;
// event series carry 1 active city (136 series), 4 inactive cities (5 series:
// gammarth-tn, barcelona-es, madrid-es, budapest-hu) and no city (601).
// Expected values are LITERALS, never derived from the code under test.

const ORIGIN = 'https://www.bachatacalendar.co.uk';

const db = vi.hoisted(() => ({
  activeCities: new Set(['london-gb']),
  mode: 'ok' as 'ok' | 'error' | 'hang',
}));
vi.mock('@/lib/cityValidity', () => ({
  // Mirrors is_valid_city_slug: slug = lower(trim(p)) AND is_active.
  isRealCitySlug: vi.fn(async (slug: string) => {
    if (db.mode === 'error') throw Object.assign(new Error('boom'), { code: 'XX000' });
    if (db.mode === 'hang') return new Promise<boolean>(() => {});
    return db.activeCities.has(slug.trim().toLowerCase());
  }),
}));
vi.mock('@/integrations/supabase/eventRpcs', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCalendarEvents: vi.fn(async () => []),
  getMapEvents: vi.fn(async () => []),
}));
const resolvePublicEventRef = vi.fn(async () => null);
const hiddenEventLifecycle = vi.fn(async () => null);
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef }));
vi.mock('../app/lib/hiddenEventLookup', () => ({ hiddenEventLifecycle }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn(async () => ({ data: null, error: null })) },
}));
vi.mock('@/pages/EventPage', () => ({ default: () => null }));
vi.mock('@/pages/Index', () => ({ default: () => null }));

type Redirect = { source: string; destination: string; permanent: boolean };
const vercel = JSON.parse(readFileSync(path.resolve(__dirname, '../vercel.json'), 'utf8')) as {
  redirects: Redirect[];
};

// Vercel's path-to-regexp subset used in vercel.json: `:name(regex)` and `:name`.
function applyVercelRedirects(pathname: string): { status: number; location: string } | null {
  for (const r of vercel.redirects) {
    const names: string[] = [];
    const src = r.source.replace(/:(\w+)(\(([^)]*)\))?/g, (_m, name: string, _g, re?: string) => {
      names.push(name);
      return `(${re ?? '[^/]+'})`;
    });
    const m = new RegExp(`^${src}$`).exec(pathname);
    if (!m) continue;
    let location = r.destination;
    names.forEach((n, i) => (location = location.replace(`:${n}`, m[i + 1])));
    return { status: r.permanent ? 308 : 307, location };
  }
  return null;
}

type Result = { status: number; location: string | null; robots: string | null; cacheControl: string | null; canonical: string | null };

async function finalise(status: number, routeHeaders: Record<string, string>, canonical: string | null): Promise<Result> {
  const { finalizeDocumentCacheHeaders } = await import('../app/documentCacheHeaders');
  const h = new Headers(routeHeaders);
  // entry.server.tsx: every >= 400 document is noindex, then finalised.
  if (status >= 400) h.set('X-Robots-Tag', 'noindex');
  finalizeDocumentCacheHeaders(h, status, { enabled: false, deploymentId: undefined });
  return { status, location: null, robots: h.get('X-Robots-Tag'), cacheControl: h.get('Cache-Control'), canonical: status === 200 ? canonical : null };
}

async function simulate(url: string): Promise<Result> {
  const u = new URL(url, ORIGIN);
  const redirect = applyVercelRedirects(u.pathname);
  if (redirect) return { status: redirect.status, location: redirect.location, robots: null, cacheControl: null, canonical: null };
  const request = new Request(u);

  const city = matchPath('/city/:slug', u.pathname);
  if (city) {
    const home = await import('../app/routes/home');
    try {
      const data = (await home.loader({ params: city.params, request } as never)) as { data?: unknown; init?: { headers?: HeadersInit } };
      const payload = (data && typeof data === 'object' && 'data' in data ? data.data : data) as { cityDisplay?: string };
      const loaderHeaders = new Headers(data?.init?.headers);
      const meta = home.meta({ data: payload } as never) as Array<Record<string, string>>;
      const canonical = meta.find((m) => m.tagName === 'link' && m.rel === 'canonical')?.href ?? null;
      return finalise(200, home.headers({ loaderHeaders } as never) as Record<string, string>, canonical);
    } catch (thrown) {
      if (thrown instanceof Response) return finalise(thrown.status, {}, null);
      throw thrown;
    }
  }

  const event = matchPath('/event/:id', u.pathname);
  if (event) {
    const mod = await import('../app/routes/event');
    try {
      await mod.loader({ params: event.params, request } as never);
      return finalise(200, {}, null);
    } catch (thrown) {
      if (thrown instanceof Response) return finalise(thrown.status, {}, null);
      throw thrown;
    }
  }

  // Everything else in this matrix falls to routes/catchall.tsx.
  const { staticShellCacheHeaders } = await import('../app/detailLoader');
  const entry = (await import('../app/entry.server')) as Record<string, unknown>;
  const gate = entry.gateCatchallDocument as ((req: Request) => Promise<{ status: number; headers: Headers } | number>) | undefined;
  // Before the fix nothing gated the catchall: the shell always answered 200.
  const outcome = gate ? await gate(request) : 200;
  if (typeof outcome !== 'number') {
    return { status: outcome.status, location: outcome.headers.get('Location'), robots: null, cacheControl: outcome.headers.get('Cache-Control'), canonical: null };
  }
  return finalise(outcome, staticShellCacheHeaders(), null);
}

const NOINDEX_404 = { status: 404, location: null, robots: 'noindex', cacheControl: 'no-store', canonical: null };
const SHELL_200 = { status: 200, location: null, robots: null, cacheControl: 'public, max-age=0, must-revalidate', canonical: null };
const CITY_200 = { ...SHELL_200, canonical: `${ORIGIN}/` };

type Row = { name: string; url: string; mode?: 'ok' | 'error' | 'hang'; expect: Partial<Result> };

const ROWS: Row[] = [
  // Every real (active) city slug: 1 in prod.
  { name: 'real city london-gb', url: '/city/london-gb', expect: CITY_200 },
  // Today's behaviour, kept: the loader lowercases, the RPC lower(trim)s.
  { name: 'real city, different case', url: '/city/London-GB', expect: CITY_200 },
  { name: 'real city, trailing slash', url: '/city/london-gb/', expect: CITY_200 },
  // Was 200 "Bachata in Lóndon" (a soft 404); not a city in the DB -> 404.
  { name: 'city slug with diacritics', url: '/city/l%C3%B3ndon-gb', expect: NOINDEX_404 },
  // Inactive cities that events still point at (5 series): not public cities.
  { name: 'inactive city with events (barcelona-es)', url: '/city/barcelona-es', expect: NOINDEX_404 },
  { name: 'unknown city', url: '/city/zzzz-not-a-place-qqq', expect: NOINDEX_404 },
  { name: 'unknown top-level path (live bug)', url: '/this-page-does-not-exist-live-qa', expect: NOINDEX_404 },
  { name: 'unknown top-level path, no city shape', url: '/zzzz', expect: NOINDEX_404 },
  { name: 'deep unknown path', url: '/a/b/c/d', expect: NOINDEX_404 },
  { name: 'real city subpage', url: '/city/london-gb/parties', expect: SHELL_200 },
  { name: 'unknown city subpage', url: '/city/zzzz-not-a-place-qqq/parties', expect: NOINDEX_404 },
  // Legacy/vanity redirects keep their status.
  { name: 'legacy /<city> -> /city/<city>', url: '/london-gb', expect: { status: 308, location: '/city/london-gb' } },
  { name: 'legacy /<city>?q keeps the query', url: '/london-gb?x=1', expect: { status: 308, location: '/city/london-gb?x=1' } },
  { name: 'legacy /<unknown-xx> no longer becomes a city', url: '/zzzz-not-a-place-qq', expect: NOINDEX_404 },
  { name: 'legacy /<city>/parties', url: '/london-gb/parties', expect: { status: 308, location: '/city/london-gb/parties' } },
  { name: 'legacy /<x>/dancers -> /dancers', url: '/london-gb/dancers', expect: { status: 308, location: '/dancers' } },
  { name: 'legacy /experience -> /festivals', url: '/experience', expect: { status: 308, location: '/festivals' } },
  { name: 'bare / -> /city/london-gb (temporary)', url: '/', expect: { status: 307, location: '/city/london-gb' } },
  // Client-rendered pages on the catchall stay 200.
  { name: 'client page /teachers', url: '/teachers', expect: SHELL_200 },
  { name: 'client page /auth/callback', url: '/auth/callback', expect: SHELL_200 },
  { name: 'client page /account/o/anything', url: '/account/o/x/y', expect: SHELL_200 },
  { name: 'client page /vendors/:id', url: '/vendors/abc', expect: SHELL_200 },
  // #683: an unknown event stays a real 404.
  { name: 'unknown event', url: '/event/zzzz-no-such-event-qqq', expect: NOINDEX_404 },
  // Lookup failure: never a 404 guess about a real city.
  // A non-transient lookup error takes the loader's existing 500 path (a
  // transient one degrades, see tests/homeLoaderDegrade.test.ts); never a 404.
  { name: 'city lookup errors on /city/<real>', url: '/city/london-gb', mode: 'error', expect: { status: 500 } },
  { name: 'city lookup errors on legacy /<city>', url: '/london-gb', mode: 'error', expect: { status: 503, robots: 'noindex', cacheControl: 'no-store' } },
  { name: 'city lookup hangs on /city/<real>/parties', url: '/city/london-gb/parties', mode: 'hang', expect: { status: 503, robots: 'noindex', cacheControl: 'no-store' } },
];

describe('soft-404 matrix: status, robots, canonical, Cache-Control', () => {
  beforeEach(() => {
    db.mode = 'ok';
  });

  it.each(ROWS.map((r) => [r.name, r] as const))('%s', async (_n, row) => {
    db.mode = row.mode ?? 'ok';
    let got: Result;
    try {
      got = await simulate(row.url);
    } catch {
      got = { status: 500, location: null, robots: null, cacheControl: null, canonical: null };
    }
    expect(got).toMatchObject(row.expect);
  }, 15_000);
});
