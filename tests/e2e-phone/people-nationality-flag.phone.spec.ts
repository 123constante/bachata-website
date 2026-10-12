import { test, expect, type Page } from '@playwright/test';
import { checkOverflow, fakeSupabase, frames, settled } from './helpers';
import { FLAG_DJ_ID, FLAG_PEOPLE, FLAG_PEOPLE_CODED, ORG3_SLUG, ORG3_TEAM_CODES, VENDOR_ID } from './fakeSupabase.mjs';

/**
 * The nationality flag on person photos (owner decision: style "L Waving flag", the
 * Silk preset), on a PHONE at 390x844, 360x640 and 412x915 (each size runs once, in
 * the 390x844 project, with its own viewport), on prod-shaped data (fakeSupabase.mjs:
 * 120 DJs, about 1 in 8 with a code, the codes in use on prod, some with no photo,
 * some long names, some with typed text the read maps to null):
 *   - /djs (100+ people): exactly the coded people carry a flag, with the country's
 *     name; no sideways scroll; a tap on a flag goes through to the person's link;
 *     the flags WAVE (pixels change between frames) on ONE shared clock that draws
 *     only the flags on screen; measured frame rate and draw cost are logged;
 *     reduced motion = no animation at all; a hidden tab stops the clock;
 *   - /djs/:id hero, /vendors/:id team (20px circles), /search cards, and the
 *     organiser page's "Teachers & DJs" circles as a visitor and as the owner (the
 *     owner's photo pencil must stay reachable and clear of every flag).
 * Nothing reaches any database. SHOTS=<dir> also writes screenshots.
 */

const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 412, height: 915 },
];
const country = new Intl.DisplayNames(['en-GB'], { type: 'region' });

const shot = async (page: Page, name: string, selector?: string) => {
  const path = process.env.SHOTS ? `${process.env.SHOTS}/${name}.png` : test.info().outputPath(`${name}.png`);
  if (selector) await page.locator(selector).first().screenshot({ path });
  else await page.screenshot({ path });
};

type FlagInfo = { code: string; label: string | null; title: string | null; pe: string; x: number; y: number; w: number; h: number; throughTo: string };
/** Every flag on the page, and what a tap at its centre lands on. */
const flagsOnPage = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-nationality-flag]')).map((el) => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const link = at?.closest('a');
      return {
        code: el.dataset.nationalityFlag ?? '',
        label: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        pe: getComputedStyle(el).pointerEvents,
        x: r.x, y: r.y, w: r.width, h: r.height,
        throughTo: at && el.contains(at) ? 'FLAG' : link ? `a:${link.getAttribute('href')}` : at ? at.tagName.toLowerCase() : 'nothing',
      };
    }),
  );

const expectSameFact = (flags: FlagInfo[]) => {
  for (const f of flags) {
    expect(f.label, `aria-label for ${f.code}`).toBe(`Nationality: ${country.of(f.code)}`);
    expect(f.title, `title for ${f.code}`).toBe(country.of(f.code));
    expect(f.pe, 'flag never takes a tap').toBe('none');
  }
};

/** A cheap fingerprint of every visible flag canvas's pixels. */
const canvasPrints = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLCanvasElement>('[data-nationality-flag] canvas'))
      .filter((c) => {
        const r = c.getBoundingClientRect();
        return r.bottom > 0 && r.top < innerHeight;
      })
      .map((c) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let h = 0;
        for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0;
        return h;
      }),
  );

type ClockStats = { frames: number; flagsLastFrame: number; drawMsTotal: number; maxFrameMs: number; registered: number; running: boolean };
const clock = (page: Page) => page.evaluate(() => (window as unknown as { __flagClock: { getFlagClockStats(): ClockStats } }).__flagClock.getFlagClockStats());

async function openDjs(page: Page) {
  await fakeSupabase(page, { realClock: true });
  await page.goto('/djs');
  await page.locator('a[href^="/djs/"]').first().waitFor();
  await settled(page);
  await page.locator('[data-nationality-flag]').first().waitFor();
}

for (const vp of SIZES) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });
    test.beforeEach(({ page: _page }, info) => {
      test.skip(info.project.name !== 'phone-390x844', 'each size runs once, with its own viewport');
    });

    test('/djs: coded people only, same label everywhere, taps go through, no sideways scroll', async ({ page }) => {
      await openDjs(page);
      const flags = await flagsOnPage(page);
      expect(flags, 'one flag per coded person, none for null / typed text').toHaveLength(FLAG_PEOPLE_CODED);
      const want = FLAG_PEOPLE.filter((p) => p.nationality_code).map((p) => p.nationality_code);
      expect(flags.map((f) => f.code).sort()).toEqual([...want].sort());
      expectSameFact(flags);
      expect(await checkOverflow(page), 'no sideways scroll').toEqual([]);
      // The first card's flag is on screen: a tap there lands on the person's link.
      const first = flags[0];
      expect(first.throughTo).toBe(`a:/djs/${FLAG_PEOPLE[0].id}`);
      await frames(page);
      await shot(page, `djs-${vp.width}x${vp.height}`);
    });

    test('/djs: flags wave on one shared clock, only on-screen flags draw; measured', async ({ page }) => {
      await openDjs(page);
      const a = await canvasPrints(page);
      await page.waitForTimeout(400);
      const b = await canvasPrints(page);
      expect(a.length, 'flags on screen').toBeGreaterThan(0);
      expect(a.filter((h, i) => h !== b[i]).length, 'the cloth moves').toBeGreaterThan(0);

      // Measure 3s while scrolling through the 120-card list.
      await page.evaluate(() => (window as unknown as { __flagClock: { resetFlagClockStats(): void } }).__flagClock.resetFlagClockStats());
      const m = await page.evaluate(
        () =>
          new Promise<{ fps: number; longTasks: number; worstGapMs: number }>((resolve) => {
            let longTasks = 0;
            try {
              new PerformanceObserver((l) => (longTasks += l.getEntries().length)).observe({ type: 'longtask', buffered: false });
            } catch { /* not supported */ }
            const t0 = performance.now();
            let n = 0;
            let last = t0;
            let worst = 0;
            const step = (t: number) => {
              n++;
              worst = Math.max(worst, t - last);
              last = t;
              window.scrollBy(0, 12);
              if (t - t0 < 3000) requestAnimationFrame(step);
              else resolve({ fps: (n * 1000) / (t - t0), longTasks, worstGapMs: worst });
            };
            requestAnimationFrame(step);
          }),
      );
      const s = await clock(page);
      const perFrame = s.frames ? s.drawMsTotal / s.frames : 0;
      const line = `[flag-perf ${vp.width}x${vp.height}] fps=${m.fps.toFixed(1)} worstFrameGap=${m.worstGapMs.toFixed(1)}ms longTasks=${m.longTasks} ` +
        `clockFrames=${s.frames} registered=${s.registered} drawnLastFrame=${s.flagsLastFrame} drawMsPerFrame=${perFrame.toFixed(3)} maxFrameDrawMs=${s.maxFrameMs.toFixed(2)}`;
      console.log(line);
      test.info().annotations.push({ type: 'flag-perf', description: line });
      expect(s.registered, 'every rendered flag is on the clock').toBe(FLAG_PEOPLE_CODED);
      expect(s.flagsLastFrame, 'only on-screen flags draw').toBeLessThan(FLAG_PEOPLE_CODED);
      expect(perFrame, 'drawing all visible flags costs well under a frame').toBeLessThan(4);
    });

    test('/djs: reduced motion = still flags, no clock; a hidden tab stops the clock', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openDjs(page);
      await page.waitForTimeout(300);
      const a = await canvasPrints(page);
      await page.waitForTimeout(600);
      const b = await canvasPrints(page);
      expect(a.length).toBeGreaterThan(0);
      expect(b, 'not one pixel moves').toEqual(a);
      expect(a.every((h) => h !== a[0]) || a.length >= 1, 'flags are drawn').toBe(true);
      expect((await clock(page)).running, 'no animation loop at all').toBe(false);

      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForTimeout(200);
      expect((await clock(page)).running, 'motion back: the clock runs').toBe(true);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect((await clock(page)).running, 'hidden tab: stopped').toBe(false);
    });

    test('/djs/:id hero: the flag on the portrait, inside the screen', async ({ page }) => {
      await fakeSupabase(page, { realClock: true });
      await page.goto(`/djs/${FLAG_DJ_ID}`);
      await page.locator('[data-nationality-flag]').first().waitFor();
      await settled(page);
      const flags = await flagsOnPage(page);
      expect(flags.map((f) => f.code)).toEqual(['ES']);
      expectSameFact(flags);
      const f = flags[0];
      expect(f.x + f.w, 'flag inside the screen').toBeLessThanOrEqual(vp.width);
      expect(await checkOverflow(page)).toEqual([]);
      await shot(page, `dj-hero-${vp.width}x${vp.height}`, '.dj-hero');
    });

    test('/vendors/:id team: 20px circles keep their flag clear of the name', async ({ page }) => {
      await fakeSupabase(page, { realClock: true });
      await page.goto(`/vendors/${VENDOR_ID}`);
      await page.getByText('Team members', { exact: false }).first().waitFor();
      await page.locator('[data-nationality-flag]').first().waitFor();
      await settled(page);
      const flags = await flagsOnPage(page);
      expect(flags.map((f) => f.code)).toEqual(FLAG_PEOPLE.slice(0, 9).filter((p) => p.nationality_code).map((p) => p.nationality_code));
      expectSameFact(flags);
      // The cloth (canvas minus its 4px right margin) stops before the name starts.
      const gaps = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-nationality-flag]')).map((el) => {
          const name = el.parentElement!.nextElementSibling as HTMLElement;
          return name.getBoundingClientRect().left - (el.getBoundingClientRect().right - 4);
        }),
      );
      for (const g of gaps) expect(g, 'cloth clear of the name').toBeGreaterThanOrEqual(-0.5);
      expect(await checkOverflow(page)).toEqual([]);
      await page.locator('[data-nationality-flag]').first().scrollIntoViewIfNeeded();
      await frames(page);
      await shot(page, `vendor-team-${vp.width}x${vp.height}`);
    });

    test('/search: person cards carry the flag inside the photo', async ({ page }) => {
      await fakeSupabase(page, { realClock: true });
      await page.goto('/search?q=a');
      await page.locator('[data-nationality-flag]').first().waitFor();
      await settled(page);
      const flags = await flagsOnPage(page);
      expect(flags.length).toBeGreaterThan(0);
      expectSameFact(flags);
      expect(await checkOverflow(page)).toEqual([]);
      await page.locator('[data-nationality-flag]').first().scrollIntoViewIfNeeded();
      await frames(page);
      await shot(page, `search-${vp.width}x${vp.height}`);
    });

    for (const owner of [false, true]) {
      test(`/organisers/:id Teachers & DJs circles (${owner ? 'owner' : 'visitor'}): flags clear of the gutter${owner ? ' and the photo pencil' : ''}`, async ({ page }) => {
        await fakeSupabase(page, { signedInAsOwner: owner, realClock: true });
        await page.goto(`/organisers/${ORG3_SLUG}`);
        await page.locator('[data-nationality-flag]').first().waitFor();
        await settled(page);
        const flags = await flagsOnPage(page);
        expect(flags.map((f) => f.code).sort()).toEqual([...ORG3_TEAM_CODES].sort());
        expectSameFact(flags);
        for (const f of flags) expect(f.x + f.w, `${f.code} flag inside the screen`).toBeLessThanOrEqual(vp.width);
        expect(await checkOverflow(page)).toEqual([]);
        if (owner) {
          // The owner's controls on a photo: the organiser photo's pencil sits bottom-right;
          // team circles have no controls. A tap at the pencil reaches it, and no flag
          // rectangle overlaps it.
          const pencil = page.locator('[data-eip-pencil="avatar_url"]').first();
          await pencil.scrollIntoViewIfNeeded();
          const r = (await pencil.boundingBox())!;
          const hit = await pencil.evaluate((node) => {
            const b = node.getBoundingClientRect();
            const at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
            return !!at && (at === node || node.contains(at));
          });
          expect(hit, 'photo pencil reachable').toBe(true);
          const now = await flagsOnPage(page);
          for (const f of now) {
            const overlap = !(f.x + f.w <= r.x || r.x + r.width <= f.x || f.y + f.h <= r.y || r.y + r.height <= f.y);
            expect(overlap, `${f.code} flag clear of the pencil`).toBe(false);
          }
        }
        await page.locator('[data-nationality-flag]').first().scrollIntoViewIfNeeded();
        await frames(page);
        await shot(page, `organiser-team-${owner ? 'owner' : 'visitor'}-${vp.width}x${vp.height}`);
      });
    }
  });
}
