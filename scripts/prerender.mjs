#!/usr/bin/env node
/**
 * Full-sitemap prerender for SEO.
 *
 * Renders every sitemap URL (plus a curated static baseline) with a headless
 * browser at build time and writes the rendered HTML to `dist/<route>/index.html`.
 * The static HTML carries the title, meta, JSON-LD and body copy (incl. internal
 * links) for crawlers; real users still client-render via createRoot which
 * replaces the static markup. Vercel serves these files filesystem-first, so the
 * same full HTML goes to bots and humans — the long-term replacement for the
 * bot-only edge-middleware stub (dynamic rendering).
 *
 * Route list = STATIC_ROUTES ∪ <loc> paths from the freshly generated
 * dist/sitemap.xml (generate-sitemap.mjs runs first in the build). Detail routes
 * (/event/:slug, /dancers/:slug, …) go through a READINESS GATE before they are
 * written; a page that never becomes ready (still-loading, not-found, or a
 * canonical that points elsewhere) is SKIPPED, never written — so a hollow or
 * noindex snapshot is structurally impossible to ship. Skipped URLs simply keep
 * their existing bot behaviour (middleware stub), a monotone-safe degradation.
 *
 * A manifest of successfully-written paths is emitted to
 * dist/prerender-manifest.json for the middleware to consult (Deploy B) so it can
 * `next()` search bots onto the real snapshot instead of the stub.
 *
 * Browser detection:
 *  - On Vercel (process.env.VERCEL): @sparticuz/chromium + puppeteer-core.
 *  - Locally: Playwright (already a devDep).
 *
 * Env / overrides:
 *   PRERENDER_SKIP=1                    - skip prerender entirely
 *   PRERENDER_PORT                      - port to serve dist on (default 4173)
 *   PRERENDER_TIMEOUT                   - per-page navigation timeout ms (default 30000)
 *   PRERENDER_READY_TIMEOUT            - detail-page readiness wait ms (default 15000)
 *   PRERENDER_CONCURRENCY             - parallel pages (default 4)
 *   PRERENDER_MAX_MS                  - wall-clock budget; 0 = unbounded (default 0)
 *   PRERENDER_MAX_CONSECUTIVE_FAILURES - circuit breaker on repeated HARD failures (default 25)
 *   PRERENDER_STRICT=1                 - exit 1 if any URL hard-FAILS (skips never fail)
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PRERENDER_PORT) || 4173;
const TIMEOUT = Number(process.env.PRERENDER_TIMEOUT) || 30000;
const READY_TIMEOUT = Number(process.env.PRERENDER_READY_TIMEOUT) || 15000;
const CONCURRENCY = Math.max(1, Number(process.env.PRERENDER_CONCURRENCY) || 4);
const MAX_MS = Number(process.env.PRERENDER_MAX_MS) || 0; // 0 = no wall-clock budget
const MAX_CONSECUTIVE_FAILURES = Number(process.env.PRERENDER_MAX_CONSECUTIVE_FAILURES) || 25;
const BASE = `http://localhost:${PORT}`;
const ON_VERCEL = Boolean(process.env.VERCEL);
const PRERENDER_UA =
  'Mozilla/5.0 (compatible; BachataCalendarPrerender/1.0; +https://bachatacalendar.co.uk)';

// Curated baseline — always attempted even if the sitemap parse yields nothing.
const STATIC_ROUTES = [
  '/',
  '/faq',
  '/london-bachata-guide',
  '/learn-bachata-london',
  '/bachata-london-monday',
  '/bachata-london-tuesday',
  '/bachata-london-wednesday',
  '/bachata-london-thursday',
  '/bachata-london-friday',
  '/bachata-london-saturday',
  '/bachata-london-sunday',
  '/parties',
  '/classes',
  '/tonight',
  '/festivals',
  '/venues',
  '/teachers',
  '/djs',
  '/organisers',
  '/dancers',
  '/discounts',
  '/cities',
  '/practice-partners',
  '/videographers',
  '/vendors',
  '/choreography',
];

// Entity detail routes: /kind/slug (exactly one path segment after the kind).
const DETAIL_RE = /^\/(event|festival|venue-entity|teachers|djs|dancers|organisers)\/[^/]+$/;

function normPath(p) {
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}

// Parse <loc> paths from the freshly built sitemap. dist/sitemap.xml is present
// because generate-sitemap.mjs writes public/sitemap.xml and vite copies public/
// → dist/ before this script runs; fall back to public/ just in case.
function loadSitemapRoutes() {
  const candidates = [path.join(DIST, 'sitemap.xml'), path.join(ROOT, 'public', 'sitemap.xml')];
  let xml = null;
  for (const f of candidates) {
    if (existsSync(f)) { xml = readFileSync(f, 'utf8'); break; }
  }
  if (!xml) {
    console.warn('[prerender] no sitemap.xml found - using static baseline only.');
    return [];
  }
  const out = [];
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const unescaped = m[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    let p;
    try { p = new URL(unescaped).pathname; } catch { continue; }
    p = normPath(p);
    // Sanitise: only safe kebab/segment paths (guards writeFile path traversal).
    if (!/^\/[a-z0-9\-/_]*$/i.test(p)) continue;
    out.push(p);
  }
  return out;
}

// Runs IN THE BROWSER. Detail-page readiness: a canonical link whose pathname
// matches the visited path AND no robots=noindex meta. This is false at every
// dangerous moment — the pre-React shell / homepage-fallback (canonical is "/" or
// baseline, ≠ route), the loading state and the not-found state (both emit
// noindex via buildSeoForRoute) — and true exactly when the real entity has
// rendered. Self-contained (no args) so it works identically under puppeteer &
// playwright waitForFunction.
const READY_FN = () => {
  const c = document.head.querySelector('link[rel="canonical"]');
  if (!c) return false;
  const robots = document.head.querySelector('meta[name="robots"]');
  if (robots && /noindex/i.test(robots.getAttribute('content') || '')) return false;
  let cp;
  try { cp = new URL(c.href, location.origin).pathname; } catch { return false; }
  const norm = (p) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p);
  return norm(cp) === norm(location.pathname);
};

// Write guards — a snapshot must never ship a noindex meta or a localhost URL in
// its structured data (JSON-LD). Both would actively harm the index.
function hasNoindexMeta(html) {
  return /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html);
}
function hasLocalhostJsonLd(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/localhost/i.test(m[1])) return true;
  }
  return false;
}

function guardError(msg) {
  const e = new Error(msg);
  e.__guard = true;
  return e;
}

if (process.env.PRERENDER_SKIP === '1') {
  console.log('[prerender] PRERENDER_SKIP=1 - skipping prerender step.');
  process.exit(0);
}

if (!existsSync(DIST)) {
  console.error('[prerender] dist/ not found - run vite build first.');
  process.exit(1);
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch {}
      if (Date.now() - start > timeoutMs) return reject(new Error('server start timed out'));
      setTimeout(tick, 200);
    };
    tick();
  });
}

/** Returns { type, launch, newPage } or null on failure. */
async function pickBrowser() {
  if (ON_VERCEL) {
    try {
      const [{ default: chromium }, puppeteer] = await Promise.all([
        import('@sparticuz/chromium'),
        import('puppeteer-core'),
      ]);
      console.log('[prerender] using puppeteer-core + @sparticuz/chromium');
      return {
        type: 'puppeteer',
        launch: async () =>
          puppeteer.default.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            defaultViewport: chromium.defaultViewport,
          }),
        newPage: async (browser) => {
          const p = await browser.newPage();
          await p.setUserAgent(PRERENDER_UA);
          return p;
        },
      };
    } catch (err) {
      console.warn('[prerender] sparticuz/puppeteer-core not available on Vercel:', err.message);
      return null;
    }
  }
  try {
    const playwright = await import('playwright');
    console.log('[prerender] using playwright chromium');
    let browser;
    return {
      type: 'playwright',
      launch: async () => {
        browser = await playwright.chromium.launch();
        return browser;
      },
      newPage: async () => {
        const ctx = await browser.newContext({ userAgent: PRERENDER_UA });
        return ctx.newPage();
      },
    };
  } catch (err) {
    console.warn('[prerender] playwright not available locally:', err.message);
    return null;
  }
}

async function snapshotRoute(picker, page, route) {
  const isDetail = DETAIL_RE.test(route);
  const url = BASE + route;

  if (isDetail) {
    // domcontentloaded (not networkidle): event pages hold a realtime websocket
    // open, which never lets networkidle fire. We wait on the readiness predicate
    // instead, so websockets / late analytics POSTs don't matter.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    if (picker.type === 'puppeteer') {
      await page.waitForFunction(READY_FN, { timeout: READY_TIMEOUT });
    } else {
      await page.waitForFunction(READY_FN, null, { timeout: READY_TIMEOUT });
    }
    await new Promise((r) => setTimeout(r, 300)); // settle late-rendered JSON-LD/tiles
  } else {
    const waitUntil = picker.type === 'puppeteer' ? 'networkidle0' : 'networkidle';
    await page.goto(url, { waitUntil, timeout: TIMEOUT });
    await new Promise((r) => setTimeout(r, 500));
  }

  // Belt-and-braces: force the clean title from og:title so the indexed <title>
  // is never a scrambled mid-scroll frame (useSeo also skips the scroll headless).
  await page.evaluate(() => {
    const og = document.querySelector('meta[property="og:title"]');
    const clean = og && og.getAttribute('content');
    if (clean) document.title = clean;
  });

  const html = await page.content();
  if (hasNoindexMeta(html)) throw guardError('noindex meta present in output');
  if (hasLocalhostJsonLd(html)) throw guardError('localhost URL in JSON-LD');

  const outDir = route === '/' ? DIST : path.join(DIST, route.replace(/^\//, ''));
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
}

function classify(err, isDetail) {
  if (err && err.__guard) return 'guard';
  if (err && err.name === 'TimeoutError' && isDetail) return 'not-ready';
  return 'fail';
}

async function runPool(picker, browser, routes, results) {
  let idx = 0;
  let consecutiveFails = 0;
  let aborted = false;
  const startMs = Date.now();

  const worker = async () => {
    let page = await picker.newPage(browser);
    try {
      while (true) {
        if (aborted) break;
        if (MAX_MS && Date.now() - startMs > MAX_MS) {
          if (!aborted) console.error(`[prerender] wall-clock budget ${MAX_MS}ms hit - aborting remaining routes.`);
          aborted = true;
          break;
        }
        if (consecutiveFails >= MAX_CONSECUTIVE_FAILURES) {
          if (!aborted) console.error(`[prerender] circuit breaker: ${consecutiveFails} consecutive HARD failures (Supabase / read-path down?) - aborting remaining routes.`);
          aborted = true;
          break;
        }
        const myIdx = idx++;
        if (myIdx >= routes.length) break;
        const route = routes[myIdx];
        const isDetail = DETAIL_RE.test(route);
        const t0 = Date.now();
        try {
          await snapshotRoute(picker, page, route);
          const dt = ((Date.now() - t0) / 1000).toFixed(1);
          results.ok.push(route);
          consecutiveFails = 0;
          console.log(`[prerender] ok   ${route} (${dt}s)`);
        } catch (err) {
          const dt = ((Date.now() - t0) / 1000).toFixed(1);
          const kind = classify(err, isDetail);
          if (kind === 'guard') {
            // Expected, monotone-safe skip (a page that must not ship). Does NOT
            // feed the circuit breaker — only hard failures do.
            results.skipped.push(route);
            console.warn(`[prerender] SKIP ${route} (${dt}s) - GUARD: ${err.message}`);
          } else if (kind === 'not-ready') {
            // Expected skip: never became ready (e.g. a festival whose canonical
            // points elsewhere, or a settled not-found detail page). Degrades to
            // the middleware stub. Does NOT feed the circuit breaker — so a cluster
            // of adjacent festivals/not-founds can never abort the run.
            results.skipped.push(route);
            console.log(`[prerender] skip ${route} (${dt}s) - not ready`);
          } else {
            // Genuine failure (navigation / JS error). Only these trip the breaker,
            // so a real read-path outage aborts, but expected skips never do.
            results.failed.push(route);
            consecutiveFails += 1;
            console.error(`[prerender] FAIL ${route} (${dt}s): ${err.message}`);
          }
          // Recreate the page to shed any bad state.
          try { await page.close(); } catch {}
          page = await picker.newPage(browser);
        }
      }
    } finally {
      try { await page.close(); } catch {}
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, routes.length) }, () => worker()));

  if (aborted) {
    for (let i = idx; i < routes.length; i += 1) results.skipped.push(routes[i]);
  }
}

async function main() {
  const picker = await pickBrowser();
  if (!picker) {
    console.warn('[prerender] no browser available - skipping prerender.');
    process.exit(0);
  }

  const sitemapPaths = loadSitemapRoutes();
  const allRoutes = [...new Set([...STATIC_ROUTES, ...sitemapPaths])];
  // Prerender '/' LAST, on its own: keeps dist/index.html as the plain built
  // shell for the whole pool run (it is the SPA-rewrite fallback for
  // not-yet-written routes), so the readiness gate is never fooled by a
  // homepage snapshot served under a detail URL.
  const poolRoutes = allRoutes.filter((r) => r !== '/');
  const detailCount = poolRoutes.filter((r) => DETAIL_RE.test(r)).length;
  console.log(
    `[prerender] ${allRoutes.length} routes (${detailCount} detail, ${poolRoutes.length - detailCount} listing/static, +/) @ concurrency ${CONCURRENCY}`,
  );

  console.log(`[prerender] launching vite preview on :${PORT}`);
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  let serverErr = '';
  server.stderr.on('data', (d) => { serverErr += d.toString(); });

  try {
    await waitForServer(BASE + '/', 15000);
  } catch (err) {
    console.error('[prerender] failed to start vite preview:', err.message);
    console.error(serverErr.slice(-500));
    server.kill();
    process.exit(1);
  }

  let browser;
  try {
    browser = await picker.launch();
  } catch (err) {
    console.warn('[prerender] chromium failed to launch - skipping (' + err.message + ')');
    server.kill();
    process.exit(0);
  }

  const results = { ok: [], skipped: [], failed: [] };
  const started = Date.now();

  await runPool(picker, browser, poolRoutes, results);

  // '/' last, sequentially.
  {
    const t0 = Date.now();
    const page = await picker.newPage(browser);
    try {
      await snapshotRoute(picker, page, '/');
      results.ok.push('/');
      console.log(`[prerender] ok   / (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (err) {
      results.failed.push('/');
      console.error(`[prerender] FAIL / (${((Date.now() - t0) / 1000).toFixed(1)}s): ${err.message}`);
    } finally {
      try { await page.close(); } catch {}
    }
  }

  await browser.close();
  server.kill();

  // Manifest for the middleware (Deploy B): only successfully-written paths.
  const manifest = {
    generatedAt: new Date().toISOString(),
    count: results.ok.length,
    paths: [...results.ok].sort(),
    skipped: [...results.skipped].sort(),
  };
  await writeFile(path.join(DIST, 'prerender-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const totalS = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[prerender] done in ${totalS}s: ${results.ok.length} ok, ${results.skipped.length} skipped, ${results.failed.length} failed (manifest: ${manifest.count} paths)`,
  );
  if (results.skipped.length) {
    console.log(`[prerender] skipped: ${results.skipped.slice(0, 20).join(', ')}${results.skipped.length > 20 ? ` … +${results.skipped.length - 20}` : ''}`);
  }

  process.exit(results.failed.length > 0 && process.env.PRERENDER_STRICT === '1' ? 1 : 0);
}

main().catch((err) => {
  console.error('[prerender] fatal:', err);
  process.exit(1);
});
