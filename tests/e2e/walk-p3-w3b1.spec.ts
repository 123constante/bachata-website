import { test, expect, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (P3 W3b-1 History), NOT in the test:e2e gate list. The History screen at
// 390x844 and 360x640, light and dark, against the route-mocked organiser fake, with
// organiser_series_history_v1 answered in its live shape. Needs the flags ON in the server:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-w3b1.spec.ts --project=chromium

const OUT = process.env.P3_WALK_DIR ?? 'test-results/p3-w3b1-walk';
mkdirSync(OUT, { recursive: true });

const WHO = ['you', 'a co-host', 'the Bachata team'];
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({
  at: new Date(Date.parse('2026-10-08T10:00:00Z') - i * 5 * 3_600_000).toISOString(),
  kind: i % 3 ? 'series.upsert' : 'series.add_date',
  label: i === n - 1 ? 'Created the event' : i % 3 ? 'Changed the details' : 'Added a date',
  who: WHO[i % 3],
  date: i % 3 ? null : '2026-11-06',
  fields: i % 3 ? ['Name', 'Price', 'About the event', 'Ticket link'] : [],
}));

async function open(page: Page, all: ReturnType<typeof rows> | 'error') {
  const fake = new OrganiserFake();
  await fake.install(page);
  // registered after the fake's own rest route, so this one answers the history read
  await page.route('**/rest/v1/rpc/organiser_series_history_v1*', async (route: Route) => {
    if (all === 'error') return json(route, { code: 'XX000', message: 'boom', details: null, hint: null }, 500);
    const a = route.request().postDataJSON() as { p_limit: number; p_before?: string };
    const rest = a.p_before ? all.filter((x) => x.at < a.p_before!) : all;
    const page1 = rest.slice(0, a.p_limit);
    const more = rest.length > page1.length;
    return json(route, { series_id: FRIDAY, items: page1, has_more: more, next_before: more ? page1[page1.length - 1].at : null });
  });
  await page.goto(`/account/p3/events/${FRIDAY}`);
  await page.getByTestId('p3-open-history').click();
  await expect(page.getByTestId('p3-history')).toBeVisible();
}

async function taps(page: Page) {
  const sizes = await page.locator('.p3-main a, .p3-main button').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => [e.textContent, e.getBoundingClientRect().height]));
  for (const [t, h] of sizes) expect(h as number, String(t)).toBeGreaterThanOrEqual(44);
}

for (const vp of [PHONE, { width: 360, height: 640 }])
  for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${vp.width}x${vp.height} ${scheme}`, () => {
      test.use({ viewport: vp });
      test('a list over one page: rows, then Show older changes', async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, rows(60));
        await expect(page.getByTestId('p3-history-row')).toHaveCount(50);
        await expectNoHorizontalScroll(page);
        await taps(page);
        await page.screenshot({ path: `${OUT}/list-${vp.width}-${scheme}.png`, fullPage: false });
        await page.getByTestId('p3-history-more').click();
        await expect(page.getByTestId('p3-history-row')).toHaveCount(60);
        await expect(page.getByTestId('p3-history-more')).toHaveCount(0);
        await expect(page.getByText('Undo', { exact: true })).toHaveCount(0);
        await expectNoHorizontalScroll(page);
      });
      test('one row, empty and error', async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, rows(1));
        await expect(page.getByTestId('p3-history-row')).toHaveText(/Created the event/);
        await page.screenshot({ path: `${OUT}/one-${vp.width}-${scheme}.png` });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await open(page, []);
        await expect(page.getByTestId('p3-history-empty')).toContainText('Nothing has changed yet');
        await expectNoHorizontalScroll(page);
        await taps(page);
        await page.screenshot({ path: `${OUT}/empty-${vp.width}-${scheme}.png` });
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await open(page, 'error');
        await expect(page.getByTestId('p3-history-error')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
        await taps(page);
        await page.screenshot({ path: `${OUT}/error-${vp.width}-${scheme}.png` });
      });
    });
  }
