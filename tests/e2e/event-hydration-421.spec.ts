/**
 * React #421 on /event/:id -- regression guard.
 *
 * BentoPage's two lazy <Suspense> slots (RSVP, level rating / derived-level
 * badge) stay dehydrated while their chunks download. A BentoPage re-render in
 * that window hands the dehydrated boundary new props and React throws the
 * server HTML away (#421). Fix: memoised RsvpSlot/LevelSlot + module-scope
 * chunk warm-up. See docs/handover-hydration-421-fix.md.
 *
 * Needs a PRODUCTION build (`npm run build`) and real event data, so it runs
 * the build through scripts/_serve-build.mjs on its own port and SKIPS when the
 * build is missing or the event slug does not render (placeholder CI keys make
 * every SSR event page 404/500). Phone simulation: 390x844, CDP CPU 4x, and a
 * 1000 ms delay on every lazy /assets/*.js chunk (not in the document's
 * script/modulepreload set).
 */
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 4391;
const BASE = process.env.HYDRATION_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const CHUNK_DELAY_MS = Number(process.env.HYDRATION_CHUNK_DELAY_MS ?? 1000);
const CPU_RATE = Number(process.env.HYDRATION_CPU_RATE ?? 4);
// Max tolerated hydration errors per load at the delay/CPU above. Measured, see handover.
const MAX_HYDRATION_ERRORS = Number(process.env.HYDRATION_MAX_ERRORS ?? 0);
const HYDRATION_ERROR = /Minified React error #4(18|21|23|25)|\[hydration\]/;

const EVENTS = [
  { label: 'ongoing', slug: 'ronald-alba-halloween-edition-sensual-vibes' },
  { label: 'ended', slug: 'the-camden-tuesdays' },
];

let server: ChildProcess | undefined;

test.beforeAll(async () => {
  if (process.env.HYDRATION_BASE_URL) return;
  if (!existsSync('build/server') || !existsSync('build/client')) return;
  server = spawn('node', ['--conditions=production', 'scripts/_serve-build.mjs', '--port', String(PORT)], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`${BASE}/faq`);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
});

test.afterAll(() => {
  server?.kill();
});

for (const ev of EVENTS) {
  test(`no hydration errors on an ${ev.label} event page (phone-class CPU, slow lazy chunks)`, async ({ browser }) => {
    test.setTimeout(90_000);
    const url = `${BASE}/event/${ev.slug}`;
    let html = '';
    try {
      const res = await fetch(url);
      html = await res.text();
      // SSR can answer 500 after streaming a full page (entry.server onError), so judge the body, not the status.
      if (res.status === 404 || !html.includes('routes/event')) test.skip(true, `SSR ${url} -> ${res.status}; needs a production build and real data`);
    } catch {
      test.skip(true, 'production server not reachable');
    }
    // Chunks the document itself loads are not "lazy"; everything else under /assets is.
    const eager = new Set<string>();
    for (const m of html.matchAll(/(?:href|src)="([^"]*\/assets\/[^"]+\.js)"/g)) eager.add(m[1]);

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
    await page.route('**/assets/*.js', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (!eager.has(path)) await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
      await route.continue();
    });

    const hits: string[] = [];
    page.on('console', (msg) => {
      if (HYDRATION_ERROR.test(msg.text())) hits.push(msg.text().slice(0, 160));
    });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(CHUNK_DELAY_MS * 4 + 2000);
    await context.close();

    expect(hits.length, hits.join("\n")).toBeLessThanOrEqual(MAX_HYDRATION_ERRORS);
  });
}
