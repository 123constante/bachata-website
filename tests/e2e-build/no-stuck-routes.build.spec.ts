import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { fakeSupabase } from '../e2e-phone/helpers';
import { FLAG_EVENT_ID, ORG_SLUG } from '../e2e-phone/fakeSupabase.mjs';

// The routes PR #747's Vercel preview broke while every CI job was green: the
// party list (stuck on skeleton rows: `TypeError: le is not a function` in the
// vendor-ui chunk), an event by its uuid (schedule card on "Loading..." forever)
// and an organiser page. Against the PRODUCTION build (playwright.build.config.ts):
// no uncaught page error, and nothing still loading 8 s after the page is opened.
// Red-first: a build whose classifier files @radix-ui/react-context in
// vendor-ui-modal (a vendor-ui <-> vendor-ui-modal cycle) fails all three with
// `TypeError: Z is not a function`.
const ROUTES = [
  { name: 'party list', path: '/parties' },
  { name: 'event by uuid', path: `/event/${FLAG_EVENT_ID}` },
  { name: 'organiser page', path: `/organisers/${ORG_SLUG}` },
];

// What a stuck page shows: skeleton rows (animate-pulse) or a "Loading..." label.
const STILL_LOADING = '.animate-pulse, [aria-busy="true"]';

for (const r of ROUTES) {
  test(`${r.name} (${r.path}) renders from the production build`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));
    await fakeSupabase(page, { realClock: true });
    await page.goto(r.path, { waitUntil: 'load' });
    await page.waitForTimeout(8_000);

    expect(errors, 'uncaught errors in the page').toEqual([]);
    const loadingText = await page.getByText(/^Loading(\.\.\.|…)?$/).count();
    const skeletons = await page.locator(STILL_LOADING).evaluateAll(
      (els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).length,
    );
    expect({ loadingText, skeletons }, 'still loading after 8 s').toEqual({ loadingText: 0, skeletons: 0 });
  });
}

// The same class, read straight off the build output: no static import cycle
// that passes through a vendor-* chunk (the cycle is what lets a chunk run before
// the one it imports has finished). Cheaper than a route and independent of which
// routes happen to load the chunks.
test('no vendor chunk sits on a static import cycle', () => {
  const dir = path.join(process.cwd(), 'build', 'client', 'assets');
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const imports = new Map(
    files.map((f) => {
      const src = readFileSync(path.join(dir, f), 'utf8');
      const deps = [...src.matchAll(/(?:import|export)\s*(?:[^"';]*?from\s*)?"\.\/([^"]+\.js)"/g)].map((m) => m[1]);
      return [f, [...new Set(deps)]];
    }),
  );
  const cycles: string[] = [];
  const reaches = (from: string, to: string, seen = new Set<string>()): string[] | null => {
    for (const next of imports.get(from) ?? []) {
      if (next === to) return [from, to];
      if (seen.has(next)) continue;
      seen.add(next);
      const rest = reaches(next, to, seen);
      if (rest) return [from, ...rest];
    }
    return null;
  };
  for (const f of files.filter((x) => x.startsWith('vendor-'))) {
    const loop = reaches(f, f);
    if (loop) cycles.push(loop.join(' -> '));
  }
  expect(files.some((f) => f.startsWith('vendor-ui-'))).toBe(true);
  expect(cycles).toEqual([]);
});
