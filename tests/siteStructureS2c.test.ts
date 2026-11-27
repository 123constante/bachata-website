// Site structure S2c (2026-11-26): /parties and /classes moved off build-time
// prerender onto on-demand SSR + tagged ISR, so the indexed HTML carries a real
// "this week" list of /event/ links instead of a client-only calendar with none.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('S2c: /parties and /classes server-render an event list', () => {
  it.each(['parties', 'classes'])('app/routes/%s.tsx has a loader, cache headers and passes serverTodayKey', (slug) => {
    const src = read(`app/routes/${slug}.tsx`);
    expect(src).toMatch(/export const loader = withSsrLoaderTimeout\(/);
    expect(src).toContain('loadSeoLandingDay(');
    expect(src).toContain('SEO_LANDING_WINDOWS.guide');
    expect(src).toMatch(/export function headers\(/);
    expect(src).toContain('cacheHeaders(loaderHeaders)');
    expect(src).toContain('<HydrationBoundary state={loaderData.dehydratedState}>');
    expect(src).toContain('serverTodayKey={loaderData.todayKey}');
  });

  // S3b (#2343) also took /faq off prerender (it now 301s), so the list is
  // asserted by what it must NOT hold, never by an exact pin.
  it('react-router.config.ts no longer prerenders them', () => {
    const src = read('react-router.config.ts');
    const list = src.slice(src.indexOf('return ['), src.indexOf('];', src.indexOf('return [')));
    expect(list).not.toContain('"/parties"');
    expect(list).not.toContain('"/classes"');
    expect(list).not.toContain('"/faq"');
  });

  it('perf-budgets.json drops their prerender-only request pins', () => {
    const keys = Object.keys(JSON.parse(read('perf-budgets.json')).firstLoadRequestRatchet);
    expect(keys).not.toContain('/parties');
    expect(keys).not.toContain('/classes');
  });

  it.each([
    ['Parties', 'partiesOnly'],
    ['Classes', 'classesOnly'],
  ])('src/pages/%s.tsx renders the list only when the route passed serverTodayKey', (comp, flag) => {
    const src = read(`src/pages/${comp}.tsx`);
    expect(src).toContain('serverTodayKey !== undefined && city.isLondon ? (');
    expect(src).toContain('<LiveEventsSection');
    expect(src).toContain(flag);
    expect(src).toContain('serverTodayKey={serverTodayKey}');
  });

  it('check-seo.mjs floors both pages above zero event links', () => {
    const src = read('scripts/check-seo.mjs');
    expect(src).toContain("['/parties', 1],");
    expect(src).toContain("['/classes', 1],");
  });
});
