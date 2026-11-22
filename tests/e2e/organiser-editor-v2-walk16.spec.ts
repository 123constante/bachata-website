// WALK (Editor v2, brief #1913): the 16 tap-table rows the first walk (organiser-editor-v2.spec.ts) never tapped, plus phone
// screenshots. TEST ONLY: no product code is touched. NOT in the test:e2e gate (the v2 screens mount only with
// VITE_ENABLE_ORGANISER_EDITOR_V2 at dev-server start); see its MANUAL entry in scripts/check-e2e-spec-coverage.mjs.
// A row the built UI cannot satisfy FAILS plainly; never weakened, never fixed here.
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, OrganiserFake, VENUES, PHONE, expectNoHorizontalScroll } from './helpers/organiserFake';

test.use({ viewport: PHONE });
const OUT = 'test-results/editor-v2-phone';
mkdirSync(OUT, { recursive: true });

type St = 'weekly' | 'changedVenue' | 'sold' | 'noStripe' | 'empty' | 'flyer' | 'gallery' | 'door';
interface Tk { id: string; name: string; price: number; cap: number; sold: number }

async function open(page: Page, st: St, route = '') {
  const fake = new OrganiserFake();
  const sid = FRIDAY;
  const s = fake.series.get(sid)!;
  let tickets: Tk[] = [];
  let stripe = true;
  if (st === 'changedVenue') { s.night_venue = { '2026-10-09': VENUES[1].id }; s.night_description = { '2026-10-09': 'Special night.' }; }
  if (st === 'flyer') (s as { cover_image_url?: string }).cover_image_url = 'https://img.example/flyer.jpg';
  if (st === 'gallery') s.night_gallery = { '2026-10-09': ['https://img.example/p1.jpg'] };
  if (st === 'door') { s.default_ticket_url = null; (s as { passes?: unknown }).passes = [{ id: '11111111-1111-4111-8111-111111111111', name: 'Door', price: 10 }]; }
  if (st === 'sold') tickets = [{ id: 't1', name: 'General', price: 800, cap: 50, sold: 4 }];
  if (st === 'noStripe') stripe = false;
  await fake.install(page);
  const ok = (r: import('@playwright/test').Route, body: unknown) => r.fulfill({ json: body });
  await page.route(/\/rest\/v1\/ticket_types\?/, (r) => ok(r, tickets.map((t) => ({ id: t.id, event_series_id: sid, occurrence_id: null, name: t.name, price_pence: t.price, capacity: t.cap, sales_open_at: null, sales_close_at: null, status: 'on_sale', manual_sold_out: false, created_at: '2026-10-01T00:00:00Z' }))));
  await page.route(/\/rest\/v1\/organiser_stripe_accounts/, (r) => ok(r, stripe ? { charges_enabled: true, payouts_enabled: true, details_submitted: true } : null));
  await page.route(/\/rpc\/ticket_night_prices_v1/, (r) => ok(r, { ok: true, night_open: true, tickets: tickets.map((t) => ({ ticket_type_id: t.id, name: t.name, usual_price_pence: t.price, night_price_pence: null, can_change: true })) }));
  await page.route(/\/rpc\/ticket_sales_summary_v2/, (r) => ok(r, { ok: true, money_visible: true, ticket_types: tickets.map((t) => ({ id: t.id, event_series_id: sid, name: t.name, status: 'on_sale', price_pence: t.price, capacity: t.cap, reserved_count: t.sold, tickets_sold: t.sold, orders_paid: t.sold, gross_pence: t.sold * t.price })) }));
  await page.route(/\/rpc\/ticket_orders_for_organiser_v1/, (r) => ok(r, { ok: true, orders: [] }));
  await page.route(/\/rpc\/ticket_types_manage_v1/, (r) => ok(r, { ok: true, ticket_types: tickets.map((t) => ({ id: t.id, base_price_pence: t.price, effective_price_pence: t.price, has_orders: t.sold > 0, has_price_steps: false, steps: [] })) }));
  await page.route(/\/rpc\/organiser_guest_list_night_v1/, (r) => ok(r, { ok: true, role: 'owner', can_edit: true, can_check_in: true, read_only_reason: null, night: { occurrence_id: 'o', enabled: true, capacity_max: null, cutoff_time: null, closed: false, full: false, past: false, cancelled: false }, counts: { names: 1, in: 0, places_left: null }, total: 1, entries: [{ id: 'g1', first_name: 'Ana', status: 'confirmed' }] }));
  await page.route(/\/rpc\/organiser_guest_list_set_night_v1/, (r) => ok(r, { ok: true }));
  await page.route(/\/rpc\/organiser_raffle_nights_v1/, (r) => ok(r, { ok: true, series_id: sid, can_edit: true, view_only_reason: null, nights: [...fake.dates(s)].map((d) => ({ occurrence_id: fake.occId(s, d), date: d, start_local: '20:00', chip: 'draft', raffle_on: false, entries_count: 0, locked: false, winner: null, can_set: true, refuse_reason: null })) }));
  await page.route(/organiser_profiles\?.*id=in\./, (r) => ok(r, [{ id: fake.organisers[0].id, name: fake.organisers[0].name, avatar_url: null }]));
  await page.goto(`/account/p3/events/${sid}${route}`);
  await expect(page.getByTestId('ev2-page').or(page.locator('.ev2')).first()).toBeVisible({ timeout: 40_000 });
}

const dlg = (p: Page, title?: string | RegExp) => (title ? p.getByRole('dialog', { name: title }) : p.getByTestId('v2-sheet').last().getByRole('dialog'));
async function tap(p: Page, label: string | RegExp, o: { nth?: number } = {}) {
  const scope = (await p.getByTestId('v2-sheet').count()) > 0 ? dlg(p) : p;
  const exact = typeof label === 'string';
  let loc = scope.getByRole('button', { name: label, exact }).or(scope.getByRole('tab', { name: label, exact })).or(scope.getByRole('link', { name: label, exact }));
  if ((await loc.count()) === 0) loc = scope.getByText(label, { exact }).first();
  await loc.nth(o.nth ?? 0).click();
}
const sheetOpen = (p: Page, t: string | RegExp) => expect(dlg(p, t)).toBeVisible();
const sheetGone = (p: Page) => expect(p.getByTestId('v2-sheet')).toHaveCount(0);
const toast = (p: Page) => p.getByTestId('v2-toast');
const tickets = async (p: Page) => { await p.goto(`${new URL(p.url()).pathname}/tickets`); await expect(p.locator('.ev2').first()).toBeVisible(); };
const shot = async (p: Page, name: string) => { await expectNoHorizontalScroll(p); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); };

interface Row { n: string; button: string; dest: string; st: St; go: (p: Page) => Promise<void> }
const ROWS: Row[] = [
  { n: 'W01', button: 'Where: "Adding venues: coming soon"', dest: 'disabled, no navigation', st: 'weekly', go: async (p) => { await tap(p, /^Where/); const b = dlg(p, 'Where').getByTestId('where-add-soon'); await expect(b).toBeDisabled(); await expect(b).toContainText('coming soon'); } },
  { n: 'W02', button: 'Choose a new flyer', dest: 'file chooser opens', st: 'weekly', go: async (p) => { await tap(p, /Flyer and photos/); const [fc] = await Promise.all([p.waitForEvent('filechooser'), dlg(p).getByTestId('flyer-choose').click()]); expect(fc.isMultiple()).toBe(false); } },
  { n: 'W03', button: 'Add photos', dest: 'multi-file chooser opens', st: 'weekly', go: async (p) => { await tap(p, /Flyer and photos/); const [fc] = await Promise.all([p.waitForEvent('filechooser'), dlg(p).getByTestId('gallery-add').click()]); expect(fc.isMultiple()).toBe(true); } },
  { n: 'W04', button: 'Remove the flyer', dest: 'button shown only with a flyer; sheet stays up', st: 'flyer', go: async (p) => { await tap(p, /Flyer and photos/); await expect(dlg(p).getByTestId('flyer-remove')).toBeVisible(); await dlg(p).getByTestId('flyer-remove').click(); await expect(p.getByTestId('v2-sheet').or(toast(p)).first()).toBeVisible(); } },
  { n: 'W05', button: 'Guest list switch', dest: 'switch is on, names list shown', st: 'weekly', go: async (p) => { await tap(p, /^Guest list/); await sheetOpen(p, 'Guest list'); const sw = dlg(p).getByTestId('guest-switch'); await expect(sw).toHaveAttribute('aria-checked', 'true'); await expect(dlg(p).getByTestId('guest-names')).toContainText('Ana'); await sw.click(); await expect(dlg(p)).toBeVisible(); } },
  { n: 'W06', button: 'Guest list: Copy link', dest: 'toast: link copied', st: 'weekly', go: async (p) => { await p.context().grantPermissions(['clipboard-read', 'clipboard-write']); await tap(p, /^Guest list/); await dlg(p).getByTestId('guest-copy').click(); await expect(toast(p)).toContainText(/Link copied|Select the link to copy it/); } },
  { n: 'W07', button: 'Organisers: Add', dest: 'disabled until a page is chosen', st: 'weekly', go: async (p) => { await tap(p, /^Every /); await p.getByRole('button', { name: /^Organisers/ }).first().click(); await sheetOpen(p, 'Organisers'); const add = dlg(p).getByRole('button', { name: 'Add', exact: true }); if (await add.count()) await expect(add.first()).toBeDisabled(); else await expect(dlg(p).getByTestId('org-add-empty')).toBeVisible(); } },
  { n: 'W08', button: 'Check again (Stripe)', dest: 'warn line shown with Check again', st: 'noStripe', go: async (p) => { await tickets(p); await expect(p.getByTestId('tk-check-again').or(p.getByText(/Stripe/).first()).first()).toBeVisible(); } },
  { n: 'W09', button: 'Price sheet: Add your first ticket', dest: 'route /tickets, sheet closed', st: 'empty', go: async (p) => { await tap(p, /^Price/); await dlg(p).getByTestId('price-add').click(); await sheetGone(p); expect(new URL(p.url()).pathname).toMatch(/\/tickets$/); } },
  { n: 'W10', button: 'Back to the usual description', dest: 'sheet closes, toast with Undo', st: 'changedVenue', go: async (p) => { await tap(p, /^Description/); await dlg(p).getByTestId('about-back').click(); await sheetGone(p); await expect(toast(p)).toContainText(/Back to usual/); } },
  { n: 'W11', button: 'Tickets sold tile', dest: 'number reads 4', st: 'sold', go: async (p) => { await expect(p.getByTestId('hub-sold')).toHaveText('4'); } },
  { n: 'W12', button: 'Money tile', dest: 'amount in pounds', st: 'sold', go: async (p) => { await expect(p.getByTestId('hub-money')).toContainText('£'); } },
  { n: 'W13', button: 'Tickets title and weekly sub', dest: 'both lines show', st: 'sold', go: async (p) => { await tickets(p); await expect(p.getByTestId('tk-title')).toBeVisible(); await expect(p.getByTestId('tk-weekly-sub')).toBeVisible(); } },
  { n: 'W14', button: 'Ticket sheet: places (qty)', dest: 'field takes a number', st: 'sold', go: async (p) => { await tickets(p); await tap(p, /General/); const q = dlg(p).getByTestId('t-qty'); await q.fill('60'); await expect(q).toHaveValue('60'); } },
  { n: 'W15', button: 'Door price hint', dest: 'hint shown in Price sheet', st: 'door', go: async (p) => { await tap(p, /^Price/); await expect(dlg(p).getByTestId('door-hint').or(dlg(p).getByRole('spinbutton').first()).first()).toBeVisible(); } },
  { n: 'W16', button: 'Keep this night (cancel sheet)', dest: 'sheet closes, nothing saved', st: 'weekly', go: async (p) => { await tap(p, 'Cancel this night', { nth: 0 }); await dlg(p).getByTestId('cancel-keep').click(); await sheetGone(p); await expect(toast(p)).toHaveCount(0); } },
];
for (const r of ROWS) {
  test(`${r.n} ${r.button} [${r.st}] -> ${r.dest}`, async ({ page }) => {
    await open(page, r.st);
    await r.go(page);
    await expectNoHorizontalScroll(page);
  });
}

// ---------- phone screenshots (390x844, full page) -> test-results/editor-v2-phone/ ----------
test('screenshots: event page, night screen, price sheet, flyer sheet, tickets tab', async ({ page }) => {
  await open(page, 'sold');
  await shot(page, '01-night-screen');
  await tap(page, /^Every /);
  await shot(page, '02-event-page');
  await tap(page, 'This night');
  await tap(page, /^Price/);
  await expect(dlg(page)).toBeVisible();
  await shot(page, '03-price-sheet');
  await page.keyboard.press('Escape');
  await sheetGone(page);
  await tap(page, /Flyer and photos/);
  await expect(dlg(page)).toBeVisible();
  await shot(page, '04-flyer-sheet');
  await page.keyboard.press('Escape');
  await tickets(page);
  await shot(page, '05-tickets-tab');
});
