import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { ORG, ORG_NAME, OrganiserFake, PHONE, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// The single Get paid screen (/account/p3/get-paid?o=<id>) at 390x844 over the route-mocked
// organiser fake: fresh, started, back from Stripe (pending then connected), a non-manager and a
// link for a page that is not on the account. Nothing is written; the Stripe read is answered in
// its live shape (organiser_stripe_accounts). Needs the flags (skips itself otherwise):
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_TICKETING=true \
//     GETPAID_SHOTS=test-results/getpaid-start npx playwright test tests/e2e/walk-getpaid-start.spec.ts --project=chromium

const OUT = process.env.GETPAID_SHOTS ?? 'test-results/getpaid-start';
mkdirSync(OUT, { recursive: true });
const MOUNTED = process.env.VITE_ENABLE_ORGANISER_P3 === 'true' && process.env.VITE_ENABLE_ORGANISER_TICKETING === 'true';
test.skip(!MOUNTED, 'organiserP3 / organiserTicketing is off in this server: the Get paid screen is not mounted');
test.use({ viewport: PHONE });

type Row = { charges_enabled: boolean; payouts_enabled: boolean; details_submitted: boolean } | null;
const NONE: Row = null;
const STARTED: Row = { charges_enabled: false, payouts_enabled: false, details_submitted: true };
const CONNECTED: Row = { charges_enabled: true, payouts_enabled: true, details_submitted: true };

/** `reads` answers the Nth Stripe read (the last repeats). */
async function open(page: Page, path: string, reads: Row[], role?: string) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  if (role) (fake.organisers[0] as { role: string }).role = role;
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, {
      v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role: role ?? 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }],
    }));
  let n = 0;
  await page.route('**/rest/v1/organiser_stripe_accounts*', (r) => {
    const row = reads[Math.min(n++, reads.length - 1)];
    const one = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    return json(r, one ? row : row ? [row] : []);
  });
  await page.route('**/rest/v1/rpc/ticket_sales_summary_v1*', (r) => json(r, { ok: true, ticket_types: [] }));
  await page.goto(path);
  await expect(page.getByTestId('getpaid-start')).toBeVisible({ timeout: 45_000 });
}

/** Every visible control is a >= 44 px tap and sits inside 0..390; no sideways scroll. */
async function geometry(page: Page) {
  await expectNoHorizontalScroll(page);
  const boxes = await page.locator('[data-testid="getpaid-start"] :is(a, button)').evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent, h: r.height, l: r.left, r: r.right }; }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.h, String(b.t)).toBeGreaterThanOrEqual(44);
    expect(b.l, String(b.t)).toBeGreaterThanOrEqual(0);
    expect(b.r, String(b.t)).toBeLessThanOrEqual(PHONE.width);
  }
}

const START = `/account/p3/get-paid?o=${ORG}`;

test('a: fresh, no Stripe row: heading, what Stripe asks, one Connect Stripe button', async ({ page }) => {
  await open(page, START, [NONE]);
  await expect(page.getByTestId('getpaid-start-title')).toHaveText('Get paid for your tickets');
  await expect(page.getByTestId('getpaid-start-asks')).toContainText('What Stripe will ask you');
  await expect(page.getByTestId('getpaid-start-go')).toHaveText('Connect Stripe');
  await expect(page.locator('button.p3-btn:not(.p3-btn-line), a.p3-btn')).toHaveCount(1);
  await geometry(page);
  await page.screenshot({ path: `${OUT}/a-fresh.png` });
});

test('b: Stripe row started: the button carries on', async ({ page }) => {
  await open(page, START, [STARTED]);
  await expect(page.getByTestId('getpaid-start-go')).toHaveText('Carry on with Stripe');
  await geometry(page);
  await page.screenshot({ path: `${OUT}/b-started.png` });
});

test('c: back from Stripe, still pending: Checking with Stripe, then ready', async ({ page }) => {
  await open(page, `${START}&stripe=return`, [STARTED, STARTED, CONNECTED]);
  await expect(page.getByTestId('getpaid-start-status')).toHaveText(/Checking with Stripe/);
  await page.screenshot({ path: `${OUT}/c-checking.png` });
  await expect(page.getByTestId('getpaid-start-title')).toHaveText('You’re ready to sell tickets', { timeout: 20_000 });
  await expect(page.getByTestId('getpaid-start-add')).toHaveText('Add a ticket');
  await expect(page).not.toHaveURL(/stripe=/);
  await geometry(page);
  await page.screenshot({ path: `${OUT}/d-connected.png` });
});

test('e: contributor (not a manager): the owner is asked, no button', async ({ page }) => {
  await open(page, START, [NONE], 'contributor');
  await expect(page.getByTestId('getpaid-start-note')).toHaveText(/^Ask .+ to connect payments$/);
  await expect(page.getByTestId('getpaid-start-go')).toHaveCount(0);
  await geometry(page);
  await page.screenshot({ path: `${OUT}/e-non-manager.png` });
});

test('f: a link for a page that is not on the account', async ({ page }) => {
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, { v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] }, organisers: [] }));
  await page.route('**/rest/v1/organiser_stripe_accounts*', (r) => json(r, []));
  await page.goto('/account/p3/get-paid?o=z0000000-0000-4000-8000-00000000dead');
  await expect(page.getByTestId('getpaid-start-wrong')).toContainText('This link is for a page that is not on your account', { timeout: 45_000 });
  await expect(page.getByTestId('getpaid-start-go')).toHaveCount(0);
  await geometry(page);
  await page.screenshot({ path: `${OUT}/f-wrong-page.png` });
});
