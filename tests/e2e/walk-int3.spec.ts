import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, PHONE, OrganiserFake } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (INT3), NOT in the test:e2e gate list. Screenshots at 390x844 of the
// P-DATES screens P-DATES did not walk, against the route-mocked organiser fake, into
// docs/organiser-rebuild/walk-INT3/. Run against the PRODUCTION build:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build && node scripts/_serve-build.mjs --port 4173 &
//   npx playwright test tests/e2e/walk-int3.spec.ts --project=chromium

test.use({ viewport: PHONE });
test.describe.configure({ mode: 'serial' });

const OUT = 'docs/organiser-rebuild/walk-INT3';
mkdirSync(OUT, { recursive: true });

// Friday Bachata (fake clock 8 Oct): next date 9 Oct; 23 Oct is a NON-next date.
const D23 = '2026-10-23';
const D30 = '2026-10-30';
const D06 = '2026-11-06';
const base = (occ: string) => `/account/o/change/${FRIDAY}/${occ}`;

/** has_override + the date's own note / ticket link on chosen dates (Copy needs a source). */
async function open(page: Page, path: (f: OrganiserFake) => string, own: Record<string, Record<string, string>> = {}) {
  const fake = new OrganiserFake();
  await fake.install(page);
  const s = fake.series.get(FRIDAY)!;
  await page.route('**/rest/v1/rpc/admin_event_workspace_p5', async (route) => {
    const ws = fake.workspace(s) as { occurrences: { occurrence_date: string; has_override: boolean }[] };
    for (const o of ws.occurrences) if (own[o.occurrence_date]) o.has_override = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ws) });
  });
  await page.route('**/rest/v1/rpc/event_view_p5', async (route) => {
    const id = String((route.request().postDataJSON() as { p_target?: { occurrence_id?: string } }).p_target?.occurrence_id);
    const date = fake.dates(s).find((d) => fake.occId(s, d) === id);
    if (!date) return route.fallback();
    const view = fake.dateDetail(s, date) as { event: Record<string, unknown> };
    Object.assign(view.event, own[date] ?? {});
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(view) });
  });
  await page.route('**/rest/v1/rpc/admin_bulk_occurrence_command_p5', async (route) => {
    const env = (route.request().postDataJSON() as { p_envelope: { command: { payload: { occurrence_ids: string[] } } } }).p_envelope;
    const ids = env.command.payload.occurrence_ids;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, new_version: s.version + 1, data: { affected_count: ids.length, affected_ids: ids } }) });
  });
  await page.goto(path(fake));
  return fake;
}
const occ = (f: OrganiserFake, d: string) => f.occId(f.series.get(FRIDAY)!, d);
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(500); // entrance motion
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
};

test('01 Change "what" for a non-next date', async ({ page }) => {
  await open(page, (f) => base(occ(f, D23)));
  await expect(page.getByTestId('change-what')).toBeVisible();
  await expect(page.getByTestId('change-off')).toContainText('Take this date off');
  await shot(page, '01-change-what-23-oct');
});

test('02 Sessions and line-up for a non-next date', async ({ page }) => {
  await open(page, (f) => `${base(occ(f, D23))}/lineup`);
  await expect(page.getByText('Add a session')).toBeVisible();
  await expect(page.getByText('Take this date off').first()).toBeVisible();
  await shot(page, '02-lineup-23-oct');
});

test('03 Venue for one date', async ({ page }) => {
  await open(page, (f) => `${base(occ(f, D23))}/venue`);
  await expect(page.getByTestId('change-venue-screen')).toBeVisible();
  await shot(page, '03-venue-23-oct');
});

for (const [n, field] of [['04', 'ticket'], ['05', 'picture'], ['06', 'note']] as const) {
  test(`${n} ${field} for one date`, async ({ page }) => {
    await open(page, (f) => `${base(occ(f, D23))}/${field}`);
    await expect(page.getByTestId('change-detail-screen')).toBeVisible();
    await shot(page, `${n}-${field}-23-oct`);
  });
}

test('07-08 Copy changes: copyable first, newest first; then the keys', async ({ page }) => {
  await open(page, (f) => `${base(occ(f, D23))}/copy`, { [D30]: { description_override: 'Live band tonight' }, [D06]: { ticket_url_override: 'https://tix.example.com/n6' } });
  const rows = page.getByTestId('change-copy-source');
  await expect(rows.first()).toBeVisible();
  await expect(rows.nth(0)).toBeEnabled();
  await expect(rows.nth(0)).toContainText('6 November');
  await expect(rows.nth(1)).toContainText('30 October');
  await expect(rows.nth(2)).toBeDisabled();
  await shot(page, '07-copy-list');
  await rows.nth(1).click();
  await expect(page.getByTestId('change-copy-keys')).toBeVisible();
  await shot(page, '08-copy-keys');
});

test('09 Take this date off confirm', async ({ page }) => {
  await open(page, (f) => `${base(occ(f, D23))}/off`);
  await expect(page.getByTestId('change-off-confirm')).toHaveText('Take it off');
  await shot(page, '09-take-off-confirm');
});

test('10-11 Cancel from Change; Keep it returns to Change', async ({ page }) => {
  await open(page, (f) => base(occ(f, D23)));
  await page.getByTestId('change-cancel').click();
  await expect(page.getByTestId('cancel-confirm')).toBeVisible();
  await shot(page, '10-cancel-from-change');
  await page.getByTestId('cancel-keep').click();
  await expect(page.getByTestId('change-what')).toBeVisible();
  await shot(page, '11-keep-it-back-on-change');
});

test('12-14 Pick several dates: tick 2, cancel, result', async ({ page }) => {
  await open(page, () => `/account/o/change/${FRIDAY}/pick`);
  const dates = page.getByTestId('change-pick-date');
  await dates.nth(1).click();
  await dates.nth(2).click();
  await expect(page.getByTestId('change-pick-count')).toContainText('2');
  await shot(page, '12-pick-two');
  await page.getByTestId('change-pick-cancel').click();
  await expect(page.getByTestId('change-pick-confirm-screen')).toBeVisible();
  await shot(page, '13-pick-confirm');
  await page.getByTestId('change-pick-confirm').click();
  await expect(page.getByTestId('change-pick-result')).toBeVisible();
  await shot(page, '14-pick-result');
});

test('15 Change time on a class + social date', async ({ page }) => {
  await open(page, (f) => `${base(occ(f, D23))}/time`);
  await expect(page.getByTestId('change-time-sessions')).toBeVisible();
  await page.getByTestId('change-time-input').fill('21:00');
  await expect(page.getByTestId('change-time-delta')).toBeVisible();
  await shot(page, '15-time-class-social');
});
