import { test, expect, type Page } from '@playwright/test';
import { ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// P3 series PICTURES sheet on Details (#1229 merged it without a browser walk), at 390x844, light and dark.
// Mocked workspaces: 0, 1, 2 and 30 pictures, plus a festival. There is NO reorder control in the sheet
// (add, remove, Done), so "reordering" is not walked; removing is. Runs only in the P3 gate:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-series-pictures.spec.ts --project=chromium
// No test.skip: with the flags off the page does not mount and every test FAILS (scripts/check-p3-specs-not-skipped.mjs).

const SID = (n: number) => `b0000000-0000-4000-8000-0000000009${String(n).padStart(2, '0')}`;
const pics = (n: number) => Array.from({ length: n }, (_, i) => `https://img.example/p${i}.svg`);
const SHAPES = [
  { n: 0, id: SID(0), gallery: pics(0), format: 'recurring' },
  { n: 1, id: SID(1), gallery: pics(1), format: 'recurring' },
  { n: 2, id: SID(2), gallery: pics(2), format: 'recurring' },
  { n: 30, id: SID(30), gallery: pics(30), format: 'recurring' },
];
const FESTIVAL = { id: SID(99), gallery: pics(3), format: 'festival' };

async function open(page: Page, s: { id: string; gallery: string[]; format: string }) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  const org = fake.organisers[0];
  fake.addSeries(org, { id: s.id, name: 'Pictures walk', category: 'party', format: s.format, gallery: s.gallery, default_start_date: '2026-10-09' });
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, {
      v: 1, gate_on: false, is_admin: false, complete: true,
      person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }],
    }));
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }));
  await page.goto(`/account/p3/events/${s.id}/details?o=${ORG}`);
  // The flags are on in this gate: an unmounted page is a failure.
  await expect(page.getByTestId('p3-details')).toBeVisible({ timeout: 20_000 });
  await settled(page);
  return fake;
}

async function settled(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
}

/** Contrast of every visible text in the open sheet, against the first opaque ancestor background; tap boxes. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ground = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        if (c.length >= 3 && (c.length === 3 || c[3] > 0.95)) return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    const dlg = document.querySelector('[role="dialog"]')!;
    let minContrast = 99;
    let worst = '';
    const walker = document.createTreeWalker(dlg, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim()) continue;
      const box = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (!box.width || !box.height || st.visibility === 'hidden' || el.closest('[aria-hidden="true"], .p3-sr, [disabled]')) continue;
      const [a, b] = [lum(rgb(st.color).slice(0, 3)), lum(ground(el))].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      if (ratio < minContrast) { minContrast = ratio; worst = n.textContent.trim().slice(0, 40); }
    }
    const small = [...dlg.querySelectorAll('button:not([aria-hidden="true"]), a[href]')]
      .filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && !e.closest('.p3-sr') && (r.height < 43.5 || r.width < 43.5); })
      .map((e) => `${e.getAttribute('data-testid') ?? e.textContent}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
    return { minContrast: Math.round(minContrast * 100) / 100, worst, small };
  });
}

async function inViewport(page: Page, loc: ReturnType<Page['locator']>, what: string) {
  const b = await loc.boundingBox();
  expect(b, `${what} has a box`).not.toBeNull();
  expect(b!.x, `${what} left`).toBeGreaterThanOrEqual(-0.5);
  expect(b!.y, `${what} top`).toBeGreaterThanOrEqual(-0.5);
  expect(b!.x + b!.width, `${what} right`).toBeLessThanOrEqual(PHONE.width + 0.5);
  expect(b!.y + b!.height, `${what} bottom`).toBeLessThanOrEqual(PHONE.height + 0.5);
}

test.use({ viewport: PHONE });

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`pictures sheet, ${scheme}`, () => {
    test.beforeEach(async ({ page }) => { await page.emulateMedia({ colorScheme: scheme }); });

    for (const shape of SHAPES) {
      test(`${shape.n} pictures: row reachable, sheet fits, no page scroll, tap + contrast`, async ({ page }) => {
        const fake = await open(page, shape);
        const row = page.getByTestId('p3-d-pictures-open');
        const count = page.getByTestId('p3-d-pictures-count');
        await expect(count).toHaveText(shape.n ? `${shape.n} ${shape.n === 1 ? 'picture' : 'pictures'}` : 'None yet');

        // reachable above the sticky save bar when scrolled to the bottom
        await row.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await row.scrollIntoViewIfNeeded();
        const [rb, tb] = [await row.boundingBox(), await page.getByTestId('p3-tray').boundingBox()];
        expect(rb!.y + rb!.height, 'Pictures button sits above the save bar').toBeLessThanOrEqual(tb!.y + 0.5);

        // opening does not scroll the page
        const before = await page.evaluate(() => [window.scrollX, window.scrollY]);
        await row.click();
        const sheet = page.getByTestId('p3-sheet');
        await expect(sheet).toBeVisible();
        await settled(page);
        expect(await page.evaluate(() => [window.scrollX, window.scrollY]), 'opening the sheet scrolled the page').toEqual(before);

        await inViewport(page, sheet, 'sheet');
        await inViewport(page, sheet.getByRole('button', { name: 'Close' }), 'Close');
        await inViewport(page, page.getByTestId('p3-pictures-done'), 'Done');

        const a = await audit(page);
        expect(a.minContrast, `lowest contrast "${a.worst}"`).toBeGreaterThanOrEqual(4.5);
        expect(a.small, 'controls under 44px').toEqual([]);

        if (shape.n === 0) {
          const empty = page.getByTestId('p3-pictures-empty');
          await expect(empty).toBeVisible();
          await expect(empty).toContainText(/add/i);
          await expect(page.getByTestId('p3-pictures-add')).toBeEnabled();
        }
        if (shape.n === 30) {
          await expect(page.getByTestId('p3-pictures-add')).toHaveCount(0);
          await expect(page.getByTestId('p3-pictures-max')).toContainText('Remove one to add another');
        } else if (shape.n > 0) {
          await expect(page.getByTestId('p3-pictures-add')).toBeEnabled();
        }

        if (shape.n > 0) {
          await page.getByTestId('p3-picture-remove').first().click();
          await expect(page.getByTestId('p3-picture')).toHaveCount(shape.n - 1);
          if (shape.n === 30) await expect(page.getByTestId('p3-pictures-add')).toBeEnabled();
        }
        await page.getByTestId('p3-pictures-done').click();
        await expect(sheet).toHaveCount(0);
        if (shape.n > 0) {
          const left = shape.n - 1;
          await expect(count).toHaveText(left ? `${left} ${left === 1 ? 'picture' : 'pictures'}` : 'None yet');
        }
        expect(fake.envelopes(), 'nothing is sent before Save').toEqual([]);
      });
    }

    test('saving untouched sends no command', async ({ page }) => {
      const fake = await open(page, SHAPES[2]);
      await page.getByTestId('p3-d-pictures-open').click();
      await page.getByTestId('p3-pictures-done').click();
      const save = page.getByTestId('p3-save');
      if (await save.isEnabled()) await save.click();
      await page.waitForTimeout(500);
      expect(fake.envelopes(), 'an untouched save sent a command').toEqual([]);
    });

    test('a festival: the row is disabled and says why', async ({ page }) => {
      await open(page, FESTIVAL);
      await expect(page.getByTestId('p3-d-pictures-open')).toBeDisabled();
      await expect(page.getByTestId('p3-d-pictures-festival')).toBeVisible();
      await expect(page.getByTestId('p3-d-pictures-festival')).toContainText('Bachata Calendar team');
    });
  });
}
