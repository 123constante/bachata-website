import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/**
 * SSR shape, with JavaScript disabled -- the check that would have caught the
 * whole Google Search Console "Soft 404" report before it shipped.
 *
 * WHY IT EXISTS. Every other check in this repo observes the page AFTER
 * hydration. Browser QA therefore looked perfect while ~91 sitemapped URLs were
 * returning HTTP 200 with no meaningful content to a client that does not run
 * JavaScript -- which is to say, to Googlebot. `javaScriptEnabled: false` (set on
 * the `nojs` project in playwright.config.ts) is the entire trick: it makes the
 * server's real output the only thing under test.
 *
 * WHAT IT ASSERTS, and the offender each rule fires on today (2026-09-01,
 * measured against production):
 *
 *   non-empty <h1>            10 sitemapped listing URLs were byte-identical
 *                             ~27,689-byte shells with no <h1> at all.
 *   no "not found" heading    34 organiser pages server-rendered
 *                             "<h1>Organiser not found</h1>" with HTTP 200, on
 *                             valid published organisers.
 *   no placeholder name       47 dancer pages rendered "<h1>Dancer</h1>" because
 *                             the loader's column list omitted display_name.
 *   no id as a name           /djs/dj-chino-bzuk26 rendered its raw UUID as both
 *                             <h1> and <title>.
 *   distinct <title>s         the same three clusters produced duplicate titles
 *                             across dozens of URLs.
 *
 * WHAT IT DOES NOT COVER. The legacy SPA route tree -- /city/:slug/{parties,
 * classes,venues,tonight}, /search, /raffles and the directory listings -- still
 * server-renders null by construction (app/routes/catchall.tsx). Those pages are
 * Phase 2 of the SSR convergence and are deliberately NOT enumerated here: this
 * suite is a regression gate for routes that HAVE a loader, and wiring in known-
 * red URLs would make it a permanently-red check that everyone learns to ignore.
 * When a family is promoted to a framework route, add it to FAMILIES below --
 * that is the moment its URLs start being guarded.
 *
 * A KNOWN BLIND SPOT, stated because it already bit once. The sample is drawn
 * from the sitemap, so a page that EXISTS and is reachable but is deliberately
 * left out of the sitemap -- the nameless profiles this change noindexes -- is
 * invisible to this suite. A regression that 500s exactly those pages would run
 * green here: that is not hypothetical, it is what happened on 2026-09-01, when
 * widening displayName to `string | null` left an unguarded `.charAt(0)` in
 * DancerProfileGrid and the two nameless dancers began returning HTTP 500. It
 * was caught by hand, not by this file. Closing it properly needs the route to
 * enumerate its own indexable AND non-indexable URLs (SSR roadmap, commitment 4:
 * `enumerateIndexable()` colocated with each loader); until then, a change to
 * how a nameless entity renders must be checked against a real one by hand.
 *
 * CREDENTIALS. This project needs REAL Supabase credentials (a .env with a live
 * key), because it asserts on rendered DATA. The CI e2e-smoke workflow runs with
 * a placeholder key where every SSR route 500s by design, which is exactly why
 * this project is excluded from `npm run test:e2e` and from e2e-smoke.yml. It
 * FAILS rather than skips when the server is not serving real data -- a check
 * that quietly passes when it could not run is worse than no check.
 */

// A UUID rendered as a name. `resolvePublicName` (src/lib/publicName.ts) is what
// stops one reaching a heading; this is the assertion that it did.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Headings that mean "this page has no subject". Deliberately matched against
// the WHOLE trimmed heading, never as a substring: a dancer legitimately named
// "Dancer Mendez" must not trip the rule, and an organiser page whose body
// mentions "not found" somewhere is not the defect either -- the <h1> is.
const PLACEHOLDER_HEADINGS = new Set([
  'dancer', 'dj', 'organiser', 'teacher', 'venue', 'event', 'festival',
  'not found', 'organiser not found', 'dancer not found', 'dj not found',
  'venue not found', 'event not found', 'page not found',
]);

/** Route families with a loader today. Each entry names how to recognise its
 *  sitemap URLs; the sample is drawn from the LIVE sitemap so the list cannot
 *  drift out of date the way a hard-coded slug list would.
 *
 *  `minUrls` is the non-vacuity floor: a family that silently stops appearing in
 *  the sitemap must turn this suite RED rather than quietly shrink its own
 *  coverage to nothing. It is 0 only where the family is genuinely optional --
 *  festivals come and go, and /venue-entity is behind a flag that is OFF in
 *  production, so neither can be required to be non-empty. */
const FAMILIES = [
  { name: 'dancer.detail', prefix: '/dancers/', minUrls: 1 },
  { name: 'organiser.detail', prefix: '/organisers/', minUrls: 1 },
  { name: 'event.detail', prefix: '/event/', minUrls: 1 },
  { name: 'festival.detail', prefix: '/festival/', minUrls: 0 },
  { name: 'venue.detail', prefix: '/venue-entity/', minUrls: 0 },
] as const;

// DJ detail pages are NOT in the sitemap -- which is precisely how a UUID sat in
// a live <title> unnoticed, since check-gsc.mjs only ever walks sitemap URLs.
// They are linked from event line-ups and fully crawlable, so they are listed by
// hand until app/routes/sitemap.tsx enumerates them (SSR roadmap, commitment 4).
const UNSITEMAPPED: Array<{ name: string; paths: string[] }> = [
  { name: 'dj.detail (unsitemapped)', paths: ['/djs/dj-chino-bzuk26'] },
];

// How many URLs to sample per family. Evenly spaced across the family's sorted
// list rather than the first N, so the sample is deterministic (no flake, no
// ordering dependence) but still reaches rows deep in the table -- the nameless
// dancers sat at positions no "first 5" sample would ever have visited.
const SAMPLE = (() => {
  const raw = process.env.NOJS_SAMPLE;
  if (raw === undefined) return 8;
  const n = Number(raw);
  // REFUSE a bad value rather than coerce it. `Number('all')` is NaN, and NaN
  // flows straight through evenlySpaced to an EMPTY sample, which would skip
  // every family after the non-vacuity floor had already passed -- the suite
  // reports green-with-skips and asserts nothing. That is exactly the "quietly
  // passes when it could not run" failure this file's header forbids, so it
  // throws at module load instead.
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(
      `NOJS_SAMPLE must be a positive integer; got ${JSON.stringify(raw)}. ` +
        'Refusing rather than sampling zero URLs and reporting green.',
    );
  }
  return n;
})();

// A cold react-router dev server compiles each route on first hit, so a family's
// first page can take tens of seconds. The default 60s per test is sized for a
// warm client-side spec, not for N cold SSR renders.
const FAMILY_TIMEOUT_MS = 6 * 60 * 1000;

function evenlySpaced<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const step = items.length / n;
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]);
}

async function sitemapPaths(request: APIRequestContext): Promise<string[]> {
  const res = await request.get('/sitemap.xml');
  expect(
    res.status(),
    'GET /sitemap.xml must return 200. A non-200 here usually means the dev server ' +
      'has no real Supabase credentials -- this project asserts on rendered DATA and ' +
      'cannot run without them (see the header comment).',
  ).toBe(200);
  const xml = await res.text();
  const paths = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((m) => m[1].replace(/^https?:\/\/[^/]+/, ''))
    .filter(Boolean);
  expect(paths.length, 'sitemap.xml parsed to zero URLs -- the suite would vacuously pass')
    .toBeGreaterThan(0);
  return paths;
}

type Shape = { path: string; status: number; title: string; h1s: string[]; noindex: boolean };

async function readShape(page: Page, path: string): Promise<Shape> {
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  const title = (await page.title()).trim();
  const h1s = (await page.locator('h1').allTextContents())
    .map((t) => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  // count() FIRST, and getAttribute only if there is something to read.
  // app/root.tsx emits no default robots tag and app/seoMeta.ts adds one only when
  // noindex is true, so a HEALTHY page has no such element -- and locator
  // .getAttribute() auto-waits for it, burning the full 15s use.actionTimeout on
  // every good page. At SAMPLE=8 that was ~2 minutes of pure idling per family,
  // inside a 6-minute budget. count() resolves immediately. (page.evaluate is not
  // an option here: javaScriptEnabled is false.)
  const robotsLocator = page.locator('meta[name="robots"]');
  const robots =
    (await robotsLocator.count()) > 0
      ? ((await robotsLocator.first().getAttribute('content')) ?? '')
      : '';
  return { path, status: res?.status() ?? 0, title, h1s, noindex: /noindex/i.test(robots) };
}

/** The rules. Returns one human-readable line per violation, naming the URL and
 *  what to do about it -- a failure message that only says "expected 0" costs
 *  whoever hits it the whole investigation over again. */
function violations(family: string, shapes: Shape[]): string[] {
  const out: string[] = [];

  for (const s of shapes) {
    if (s.status !== 200) {
      out.push(`[${family}] ${s.path} -- HTTP ${s.status}, expected 200`);
      continue;
    }

    // A page declaring itself noindex has made an explicit decision that it has
    // no indexable subject -- Ricky's call for genuinely thin profiles, so
    // festival line-up links keep resolving. That is the OPPOSITE of a soft 404
    // (which claims to be content while being empty), so the naming rules below
    // do not apply. It must still render something rather than nothing.
    if (s.noindex) {
      if (s.h1s.length === 0 && s.title === '') {
        out.push(`[${family}] ${s.path} -- noindex AND completely empty (no h1, no title)`);
      }
      continue;
    }

    if (s.h1s.length === 0) out.push(`[${family}] ${s.path} -- no <h1> in the server HTML (empty shell)`);
    if (!s.title) out.push(`[${family}] ${s.path} -- empty <title>`);

    // The LAST h1 is the page's own subject: the shared layout emits a
    // site-level h1 above the route's.
    const subject = s.h1s[s.h1s.length - 1] ?? '';
    if (PLACEHOLDER_HEADINGS.has(subject.toLowerCase())) {
      out.push(
        `[${family}] ${s.path} -- <h1> is the placeholder "${subject}", not a real name. ` +
          'An indexable page must name its subject; if this entity genuinely has no name, ' +
          'the loader should pass entityName: undefined so the page is noindexed instead.',
      );
    }
    if (UUID_RE.test(subject)) {
      out.push(`[${family}] ${s.path} -- <h1> renders a raw id: "${subject}". Never fall back to an id.`);
    }
    if (UUID_RE.test(s.title)) {
      out.push(`[${family}] ${s.path} -- <title> renders a raw id: "${s.title}"`);
    }
  }

  // Duplicate titles among INDEXABLE URLs. Threshold 3, not 2: a legitimate pair
  // can share a title (two dancers really can be called "Ana Ruiz"), while three
  // or more is the signature of a placeholder cluster -- 47 pages titled
  // "Dancer - Bachata Dancer, London" is what this rule is sized against.
  const byTitle = new Map<string, string[]>();
  for (const s of shapes) {
    if (s.noindex || s.status !== 200 || !s.title) continue;
    byTitle.set(s.title, [...(byTitle.get(s.title) ?? []), s.path]);
  }
  for (const [title, paths] of byTitle) {
    if (paths.length >= 3) {
      out.push(
        `[${family}] ${paths.length} indexable URLs share the <title> "${title}": ${paths.slice(0, 5).join(', ')}`,
      );
    }
  }

  return out;
}

// One test per family: bounded runtime, parallel across workers, and a failure
// names the family rather than the whole suite.
for (const fam of FAMILIES) {
  test(`${fam.name} -- server-rendered pages name their subject (no JS)`, async ({ page, request }) => {
    test.setTimeout(FAMILY_TIMEOUT_MS);

    const paths = (await sitemapPaths(request))
      .filter((p) => p.startsWith(fam.prefix) && !p.slice(fam.prefix.length).includes('/'))
      .sort();

    expect(
      paths.length,
      `route family ${fam.name} contributed ${paths.length} sitemap URLs, expected at least ${fam.minUrls}. ` +
        'A family vanishing from the sitemap silently removes its own coverage.',
    ).toBeGreaterThanOrEqual(fam.minUrls);

    // Skips ONLY when the family genuinely has no sitemap URLs and is declared
    // optional. SAMPLE is validated at module load, so an empty sample can no
    // longer arise from a bad env var and silently take this branch.
    const sample = evenlySpaced(paths, SAMPLE);
    test.skip(
      paths.length === 0 && fam.minUrls === 0,
      `${fam.name} has no URLs in the sitemap (minUrls is 0, so this is allowed)`,
    );

    const shapes: Shape[] = [];
    for (const p of sample) shapes.push(await readShape(page, p));

    // Non-vacuity: the count is asserted, not assumed, and reported so a run that
    // checked 1 URL is distinguishable from one that checked 8.
    expect(shapes.length, `${fam.name}: checked zero URLs`).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`[nojs] ${fam.name}: checked ${shapes.length} of ${paths.length} sitemap URLs`);

    const failures = violations(fam.name, shapes);
    expect(
      failures,
      `${failures.length} soft-404-shaped page(s) of ${shapes.length} checked in ${fam.name}:\n  ${failures.join('\n  ')}`,
    ).toHaveLength(0);
  });
}

for (const group of UNSITEMAPPED) {
  test(`${group.name} -- server-rendered pages name their subject (no JS)`, async ({ page }) => {
    test.setTimeout(FAMILY_TIMEOUT_MS);
    const shapes: Shape[] = [];
    for (const p of group.paths) shapes.push(await readShape(page, p));
    expect(shapes.length, `${group.name}: checked zero URLs`).toBeGreaterThan(0);
    const failures = violations(group.name, shapes);
    expect(
      failures,
      `${failures.length} soft-404-shaped page(s) of ${shapes.length} checked in ${group.name}:\n  ${failures.join('\n  ')}`,
    ).toHaveLength(0);
  });
}

test('a genuinely missing entity is a real 404, not a 200 with a not-found heading', async ({ page }) => {
  // The other half of the soft-404 contract. A miss must be a 404 so Google
  // de-indexes it, rather than a 200 that claims to be a page -- and it must NOT
  // be a 404 for an entity that merely failed to load, which is why the loaders
  // let transient errors propagate as a 500 instead of swallowing them to null.
  for (const path of [
    '/organisers/zzz-no-such-organiser-9999',
    '/dancers/zzz-no-such-dancer-9999',
    '/djs/zzz-no-such-dj-9999',
  ]) {
    const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(res?.status(), `${path} should 404`).toBe(404);
  }
});
