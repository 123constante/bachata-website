#!/usr/bin/env node
/**
 * Static prerender for high-value SEO routes.
 *
 * Renders a curated set of routes with a headless browser at build time and
 * writes the rendered HTML to `dist/<route>/index.html`. The static HTML
 * carries the title, meta, JSON-LD and body copy for crawlers; real users
 * still client-render via createRoot which replaces the static markup.
 *
 * Browser detection:
 *  - On Vercel (process.env.VERCEL) we use @sparticuz/chromium + puppeteer-core
 *    because Vercel's build sandbox doesn't have the system libs Playwright's
 *    bundled Chromium needs (libnspr4 etc.).
 *  - Locally we use Playwright (already a devDep and already installed).
 *
 * Override / disable:
 *   PRERENDER_SKIP=1   - skip prerender entirely
 *   PRERENDER_PORT     - port to serve dist on (default 4173)
 *   PRERENDER_TIMEOUT  - per-page navigation timeout in ms (default 30000)
 *   PRERENDER_STRICT=1 - exit 1 if any URL fails (default: succeed on partial)
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
const ON_VERCEL = Boolean(process.env.VERCEL);

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

/** Returns { type: 'puppeteer'|'playwright', launch, contextNewPage } or null on failure. */
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
        newPage: (browser) => browser.newPage(),
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
        const ctx = await browser.newContext({
          userAgent:
            'Mozilla/5.0 (compatible; BachataCalendarPrerender/1.0; +https://bachatacalendar.co.uk)',
        });
        return ctx.newPage();
      },
    };
  } catch (err) {
    console.warn('[prerender] playwright not available locally:', err.message);
    return null;
  }
}

async function main() {
  const picker = await pickBrowser();
  if (!picker) {
    console.warn('[prerender] no browser available - skipping prerender.');
    process.exit(0);
  }

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

  let ok = 0;
  let failed = 0;
  for (const route of STATIC_ROUTES) {
    const url = BASE + route;
    const page = await picker.newPage(browser);
    try {
      const waitUntil = picker.type === 'puppeteer' ? 'networkidle0' : 'networkidle';
      await page.goto(url, { waitUntil, timeout: TIMEOUT });
      await new Promise((r) => setTimeout(r, 500));
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
