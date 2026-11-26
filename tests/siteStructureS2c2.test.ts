// Site structure S2c-2 (2026-11-26): bare /tonight moved off the catchall
// (server HTML = null) onto a framework route whose server HTML carries a
// London this-week list of event links; the client page mounts after hydration.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('S2c-2: /tonight server-renders an event list', () => {
  it('app/routes.ts registers /tonight before the :night and catchall routes', () => {
    const src = read('app/routes.ts');
    const at = src.indexOf('route("tonight", "routes/tonight.tsx")');
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(src.indexOf('route(":night"'));
  });

  it('app/routes/tonight.tsx has a loader, cache headers, a server list and a hydration gate', () => {
    const src = read('app/routes/tonight.tsx');
    expect(src).toMatch(/export const loader = withSsrLoaderTimeout\(/);
    expect(src).toContain('SEO_LANDING_WINDOWS.guide');
    expect(src).toContain('cacheHeaders(loaderHeaders)');
    expect(src).toContain('buildSeoForRoute("tonight")');
    expect(src).toContain('<HydrationBoundary state={loaderData.dehydratedState}>');
    expect(src).toContain('useSyncExternalStore(emptySubscribe, () => true, () => false)');
    expect(src).toContain('<Tonight serverTodayKey={loaderData.todayKey} />');
    expect(src).toContain('<LiveEventsSection');
    expect(src).toContain('<h1');
  });

  it('src/pages/Tonight.tsx renders the list only when the route passed serverTodayKey', () => {
    const src = read('src/pages/Tonight.tsx');
    expect(src).toContain('serverTodayKey !== undefined && city.isLondon ? (');
    expect(src).toContain('serverTodayKey={serverTodayKey}');
  });

  it('check-seo.mjs floors /tonight above zero event links', () => {
    expect(read('scripts/check-seo.mjs')).toContain("['/tonight', 1],");
  });
});
