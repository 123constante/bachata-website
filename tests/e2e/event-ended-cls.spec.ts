/**
 * Ended event page layout shift -- regression guard.
 *
 * An ended series' BentoPage renders the organiser "door" (MoreEventsSection,
 * blocks=['organiser']) ABOVE the bento grid. It used to be fetched on the
 * client only, so it appeared ~4.5 s after first paint (phone CPU) and pushed
 * the whole grid down 120-176 px: CLS 0.121 at 390x844, 0.123 at 360x640.
 * Fix: the /event/:id loader prefetches it (prefetchEndedDoor), so it is in the
 * server HTML. See docs/handover-ended-event-cls.md.
 *
 * Needs a PRODUCTION build (`npm run build`) and real event data, so like
 * event-hydration-421.spec.ts it serves the build through
 * scripts/_serve-build.mjs on its own port and SKIPS when the build is missing
 * or the event slug does not render (placeholder CI keys make every SSR event
 * page 404/500). Phone simulation: CDP CPU 4x.
 *
 * serial mode: a red run shows only the first failing case.
 */
import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 4392;
const BASE = process.env.ENDED_CLS_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const CPU_RATE = Number(process.env.ENDED_CLS_CPU_RATE ?? 4);
const SETTLE_MS = Number(process.env.ENDED_CLS_SETTLE_MS ?? 7000);
// Google's "good" limit.
const MAX_CLS = 0.1;
// The bento grid is the element the late door used to move. Sub-pixel jitter
// (a font settling) is allowed; a block landing above it is not.
const MAX_GRID_MOVE_PX = 4;
// The grid root: BentoGrid's container-query grid, the only one on the page.
// React serialises its inline style with no spaces.
const GRID = 'div[style*="container-type:inline-size"][style*="display:grid"]';

// lifecycle_status = 'ended' series in prod (ended_on 2026-10-13 / 2026-10-19).
const SLUGS = ['the-camden-tuesdays', 'bachata-pasos-libres'];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];

// One server per file: parallel workers would each spawn on PORT and the
// first afterAll would kill it under the others.
test.describe.configure({ mode: 'serial' });

let server: ChildProcess | undefined;

test.beforeAll(async () => {
  if (process.env.ENDED_CLS_BASE_URL) return;
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

for (const slug of SLUGS) {
  for (const vp of VIEWPORTS) {
    test(`ended event ${slug} does not shift after load at ${vp.width}x${vp.height}`, async ({ browser }) => {
      test.setTimeout(60_000);
      const url = `${BASE}/event/${slug}`;
      // Say why when skipping: a slug later archived (410) or a build without
      // real data must not turn this guard into a silent pass. The skip runs
      // after the try, since test.skip throws and the catch would eat its reason.
      let skipReason: string | null = null;
      try {
        const res = await fetch(url);
        const html = await res.text();
        // Judge the body, not the status (see event-hydration-421.spec.ts). The
        // 404 page also carries 'routes/event', so require the bento grid too.
        if (res.status === 404 || !html.includes('container-type:inline-size'))
          skipReason = `SKIP ${slug}: SSR ${url} -> ${res.status}, no bento grid; slug archived, or no production build / real data`;
      } catch {
        skipReason = `SKIP ${slug}: production server not reachable at ${BASE}`;
      }
      if (skipReason) {
        console.warn(skipReason);
        test.skip(true, skipReason);
      }

      const context = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });
      await page.addInitScript((gridSel) => {
        const w = window as unknown as { __cls: number; __shifts: string[]; __gridTop: number[] };
        w.__cls = 0;
        w.__shifts = [];
        w.__gridTop = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as Array<{
            value: number;
            hadRecentInput: boolean;
            startTime: number;
            sources?: Array<{ node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }>;
          }>) {
            if (e.hadRecentInput) continue;
            w.__cls += e.value;
            const src = (e.sources ?? [])
              .map((s) => `${s.node?.nodeName ?? '?'} y ${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)}`)
              .join(', ');
            w.__shifts.push(`${Math.round(e.startTime)}ms ${e.value.toFixed(4)} [${src}]`);
          }
        }).observe({ type: 'layout-shift', buffered: true });
        // Document-relative top of the grid, every frame it exists.
        const tick = () => {
          const g = document.querySelector(gridSel);
          if (g) w.__gridTop.push(Math.round(g.getBoundingClientRect().top + window.scrollY));
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, GRID);

      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(SETTLE_MS);
      const { cls, shifts, gridTop } = await page.evaluate(() => {
        const w = window as unknown as { __cls: number; __shifts: string[]; __gridTop: number[] };
        return { cls: w.__cls, shifts: w.__shifts, gridTop: w.__gridTop };
      });
      await context.close();

      const detail = `CLS ${cls.toFixed(4)}\n${shifts.join('\n')}`;
      expect(gridTop.length, 'bento grid never rendered').toBeGreaterThan(0);
      const moved = Math.max(...gridTop) - Math.min(...gridTop);
      expect(moved, `bento grid moved ${moved}px\n${detail}`).toBeLessThanOrEqual(MAX_GRID_MOVE_PX);
      expect(cls, detail).toBeLessThan(MAX_CLS);
    });
  }
}
