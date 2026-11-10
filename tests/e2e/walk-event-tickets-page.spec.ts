import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, PHONE } from './helpers/organiserFake';

// WALK (event-tickets-page), NOT in the test:e2e gate list: the flag is off there.
// /event/:id is server-rendered, so page.route() cannot feed its loader. Run against the LOCAL mock
// Supabase (no prod calls, no real keys):
//   MOCK_PORT=54321 npx tsx tests/e2e/helpers/mockSupabaseServer.ts &
//   VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=placeholder VITE_ENABLE_PUBLIC_TICKETING=true \
//     npm run dev -- --host 127.0.0.1 --port 4173 &
//   npx playwright test tests/e2e/walk-event-tickets-page.spec.ts --project=chromium
// The ticket shape is switched on the mock via GET /__shape?v=several|single|soldout.
// bypassCSP: the page CSP connect-src allows *.supabase.co only, not the local mock origin.
test.use({ viewport: PHONE, bypassCSP: true });
const OUT = process.env.WALK_OUT ?? 'test-results/walk-event-tickets-page';
mkdirSync(OUT, { recursive: true });

const MOCK = process.env.MOCK_URL ?? 'http://127.0.0.1:54321';
const SHAPES = { several: 1, single: 1, soldout: 1, full: 1 } as const;

async function open(page: Page, shape: keyof typeof SHAPES) {
  await fetch(`${MOCK}/__shape?v=${shape}`);
  await page.goto(`/event/${FRIDAY}`);
}

// Taps: every button/link inside `scope` that takes space must be >= 44px tall. (The site header and the
// skip link are outside this feature and are not measured here.)
async function expectTaps(scope: Locator) {
  for (const el of await scope.locator('button:visible, a:visible').all()) {
    const b = await el.boundingBox();
    if (b && b.width > 1 && b.height > 1) expect(b.height, `${await el.innerText()} (${Math.round(b.width)}x${Math.round(b.height)})`).toBeGreaterThanOrEqual(44);
  }
}
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const shape of ['several', 'single', 'full'] as const) {
  test(`tickets page: ${shape}`, async ({ page }) => {
    await open(page, shape);
    const bar = page.getByRole('button', { name: /Buy tickets/i }).first();
    await expect(bar).toBeVisible();
    await bar.click();
    const root = page.getByTestId('event-tickets-page').first();
    await expect(root).toBeVisible();
    await expect(page.getByTestId('good-to-know').first()).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${shape}.png`, fullPage: false });
    await expectTaps(root);
    expect(await noSideways(page)).toBe(true);
    // Header is below the site header and fully visible; tiles carry glyphs.
    const h1 = await root.locator('h1').boundingBox();
    expect(h1 && h1.y).toBeGreaterThanOrEqual(106);
    expect(await root.locator('svg[data-glyph]').count()).toBeGreaterThan(0);
    if (shape === 'full') {
      await expect(page.getByTestId('programme').first()).toBeVisible();
      await expect(root.locator('[data-chip]').first()).toBeVisible();
    }
  });
}

// Cold load, every ticket type sold out: the event page shows a quiet disabled bar.
test('event page: cold sold out shows quiet disabled bar', async ({ page }) => {
  await open(page, 'soldout');
  const q = page.getByTestId('buy-quiet').first();
  await expect(q).toBeVisible();
  await expect(q).toBeDisabled();
  await expect(q).toHaveText(/Sold out/);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/soldout-cold.png`, fullPage: false });
});

// All types sold out. A cold load shows NO Buy tickets bar (nothing buyable), so the quiet green bar
// (inside the tickets page) is reachable only when the last ticket sells out while the page is open:
// open it on sale, flip the mock to sold out, age the cached list past its 30s staleTime and refocus.
test('tickets page: soldout (quiet green bar)', async ({ page }) => {
  await page.clock.install();
  await open(page, 'several');
  await page.getByRole('button', { name: /Buy tickets/i }).first().click();
  const root = page.getByTestId('event-tickets-page').first();
  await expect(root).toBeVisible();
  await fetch(`${MOCK}/__shape?v=soldout`);
  await page.clock.fastForward(60_000);
  const refetch = page.waitForRequest((r) => r.url().includes('ticket_types_public_v1'));
  // A reconnect refetches stale queries (react-query onlineManager).
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await refetch;
  const quiet = page.getByTestId('ticket-bar-quiet').first();
  await expect(quiet).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/soldout.png`, fullPage: false });
  await expectTaps(root);
  expect(await noSideways(page)).toBe(true);
});
