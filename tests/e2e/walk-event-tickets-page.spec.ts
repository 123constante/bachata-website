import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, PHONE, OrganiserFake, json } from './helpers/organiserFake';

// WALK (event-tickets-page), NOT in the test:e2e gate list: the flag is off there.
//   VITE_ENABLE_PUBLIC_TICKETING=true npx playwright test tests/e2e/walk-event-tickets-page.spec.ts --project=chromium
// STATUS: NOT YET GREEN. /event/:id is server-rendered; its loader reads Supabase from the SERVER, so
// page.route() cannot feed it and with placeholder keys the route answers "Page not found" (see
// event-hydration-421.spec.ts). Needs a local mock Supabase (VITE_SUPABASE_URL=http://127.0.0.1:<port>)
// serving event_view_p5 + ticket_types_public_v1, or real keys. The ticket RPC mock below is right.
// Mocked at the network layer, no prod calls. Screenshots go to the scratch dir, not the repo.
test.use({ viewport: PHONE });
const OUT = process.env.WALK_OUT ?? 'test-results/walk-event-tickets-page';
mkdirSync(OUT, { recursive: true });

const type = (id: string, name: string, pence: number, status: 'on_sale' | 'sold_out', remaining: number) => ({
  id, occurrence_id: null, name, price_pence: pence, status, remaining, currency: 'GBP', sales_open_at: null, sales_close_at: null,
});
const SHAPES: Record<string, unknown[]> = {
  several: [type('t1', 'Early bird', 1000, 'on_sale', 12), type('t2', 'General', 1500, 'on_sale', 80), type('t3', 'Party + workshop', 2200, 'on_sale', 30)],
  single: [type('t1', 'General', 1200, 'on_sale', 50)],
  soldout: [type('t1', 'General', 1200, 'sold_out', 0)],
};

async function open(page: Page, shape: keyof typeof SHAPES) {
  const fake = new OrganiserFake();
  await fake.install(page);
  const s = fake.series.get(FRIDAY)!;
  const date = fake.dates(s)[0];
  await page.route('**/rest/v1/rpc/ticket_types_public_v1', (r) => json(r, SHAPES[shape]));
  await page.goto(`/event/${fake.occId(s, date)}`);
}

for (const shape of Object.keys(SHAPES) as (keyof typeof SHAPES)[]) {
  test(`tickets page: ${shape}`, async ({ page }) => {
    await open(page, shape);
    const bar = page.getByRole('button', { name: /Buy tickets/i }).first();
    await expect(bar).toBeVisible();
    await bar.click();
    const root = page.getByTestId('good-to-know').first();
    await expect(root).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/${shape}.png`, fullPage: false });
    for (const el of await page.locator('button:visible, a:visible').all()) {
      const b = await el.boundingBox();
      if (b && b.width > 0) expect(b.height, await el.innerText()).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
