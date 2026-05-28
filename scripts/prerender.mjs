#!/usr/bin/env node
/**
 * Static prerender for high-value SEO routes.
 *
 * Why: Vite build emits a SPA whose initial HTML is `<div id="root"></div>`.
 * Google can render JS but it's slower and less reliable; long-tail pages
 * sometimes index a blank page. This script renders a curated set of routes
 * with Playwright at build time and writes the rendered HTML back into
 * `dist/<route>/index.html`. The static HTML carries the title, meta,
 * JSON-LD and body copy. When a real user hits the page, createRoot()
 * replaces the static content with the live SPA - no hydration step.
 *
 * Wired into the build via package.json:
 *   "build": "...generate-sitemap... && vite build && node scripts/prerender.mjs"
 *
 * Override / disable:
 *   PRERENDER_SKIP=1  - skip prerender (use during fast iteration)
 *   PRERENDER_PORT    - port to serve dist on (default 4173)
 *   PRERENDER_TIMEOUT - per-page navigation timeout in ms (default 30000)
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PRERENDER_PORT) || 4173;
const TIMEOUT = Number(process.env.PRERENDER_TIMEOUT) || 30000;
const BASE = `http://localhost:${PORT}`;

const STATIC_ROUTES = [
  '/',
  '/faq',
  '/london-bachata-guide',
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

if (process.env.PRERENDER_SKIP === '1') {
  console.log('[prerender] PRERENDER_SKIP=1 - skipping prerender step.');
  process.exit(0);
}

if (!existsSync(DIST)) {
  console.error('[prerender] dist/ not found - run vite build first.');
  process.exit(1);
}

let playwright;
try {
  playwright = await import('playwright');
} catch (err) {
  console.warn('[prerender] playwright not installed - skipping prerender (', err.message, ')');
  process.exit(0);
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

async function main() {
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

  console.log(`[prerender] launching chromium`);
  let browser;
  try {
    browser = await playwright.chromium.launch();
  } catch (err) {
    console.warn('[prerender] chromium not available - skipping prerender (' + err.message + ')');
    console.warn('[prerender] hint: run `npx playwright install chromium` to enable prerender.');
    server.kill();
    process.exit(0);
  }
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (compatible; BachataCalendarPrerender/1.0; +https://bachatacalendar.co.uk)',
  });

  let ok = 0;
  let failed = 0;
  for (const route of STATIC_ROUTES) {
    const url = BASE + route;
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });
      // Give React Query a beat to settle any post-mount fetches.
      await page.waitForTimeout(500);
      const html = await page.content();
      const outDir = route === '/' ? DIST : path.join(DIST, route.replace(/^\//, ''));
      await mkdir(outDir, { recursive: true });
      await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
      console.log(`[prerender] ok  ${route}`);
      ok += 1;
    } catch (err) {
      console.error(`[prerender] FAIL ${route}: ${err.message}`);
      failed += 1;
    } finally {
      await page.close();
    }
  }

  await browser.close();
  server.kill();

  console.log(`[prerender] done: ${ok} ok, ${failed} failed (${STATIC_ROUTES.length} total)`);
  process.exit(failed > 0 && process.env.PRERENDER_STRICT === '1' ? 1 : 0);
}

main().catch((err) => {
  console.error('[prerender] fatal:', err);
  process.exit(1);
});
