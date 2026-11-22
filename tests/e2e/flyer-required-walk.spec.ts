// WALK (flyer required, brief #1940): 390x844 tap-walk of the "a flyer is required" words and the no-Remove rule across
// the flyer sheets, the Go live card, the Home job card and the New event photo step. TEST ONLY: no product code is touched.
// Mocked data. A row the built UI cannot satisfy FAILS plainly; never weakened, never fixed here.
// Needs the flags at dev-server start (the v2 screens and the P3 create flow mount only with them):
//   rows 1-5, 8: VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_DASH=true VITE_ENABLE_ORGANISER_EDITOR_V2=true npx playwright test tests/e2e/flyer-required-walk.spec.ts --project=chromium
//   rows 6, 7 (R1 screens; P3 must be OFF): VITE_ENABLE_ORGANISER_SELF_SERVE=true npx playwright test tests/e2e/flyer-required-walk.spec.ts --project=chromium
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FRIDAY, SUNDAY, ORG, ORG_NAME, OrganiserFake, PHONE, json, expectNoHorizontalScroll } from './helpers/organiserFake';

test.use({ viewport: PHONE });
const OUT = 'test-results/flyer-required-phone';
mkdirSync(OUT, { recursive: true });
const REQUIRED = 'A flyer is required to continue.';
const REQUIRED_NO_DOT = 'A flyer is required to continue';

const P3 = process.env.VITE_ENABLE_ORGANISER_P3 === 'true';
// P3 on: /account/o is the P3 home, so the R1 screens (rows 6, 7) need a second run with P3 off (see the header).

type St = 'usual' | 'noFlyer' | 'night' | 'nightNoFlyer' | 'oneOff' | 'oneOffNoFlyer';

const ok = (r: import('@playwright/test').Route, body: unknown) => r.fulfill({ json: body });
const dlg = (p: Page) => p.getByTestId('v2-sheet').last().getByRole('dialog');
const shot = async (p: Page, name: string) => { await expectNoHorizontalScroll(p); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); };

/** The editor on a Friday weekly series, a Sunday one-off, or either with / without a flyer. */
async function openEditor(page: Page, st: St) {
  const fake = new OrganiserFake();
  const oneOff = st === 'oneOff' || st === 'oneOffNoFlyer';
  const sid = oneOff ? SUNDAY : FRIDAY;
  const s = fake.series.get(sid)!;
  const bag = s as { cover_image_url?: string | null; night_cover?: Record<string, string> };
  if (oneOff) s.format = 'one_off';
  if (st === 'usual' || st === 'night' || st === 'oneOff') bag.cover_image_url = 'https://img.example/usual.jpg';
  if (st === 'night') bag.night_cover = { '2026-10-09': 'https://img.example/night.jpg' };
  await fake.install(page);
  await page.route(/\/rest\/v1\/ticket_types\?/, (r) => ok(r, []));
  await page.route(/\/rest\/v1\/organiser_stripe_accounts/, (r) => ok(r, { charges_enabled: true, payouts_enabled: true, details_submitted: true }));
  await page.route(/\/rpc\/ticket_night_prices_v1/, (r) => ok(r, { ok: true, night_open: true, tickets: [] }));
  await page.route(/\/rpc\/ticket_sales_summary_v2/, (r) => ok(r, { ok: true, money_visible: true, ticket_types: [] }));
  await page.route(/\/rpc\/ticket_orders_for_organiser_v1/, (r) => ok(r, { ok: true, orders: [] }));
  await page.route(/\/rpc\/ticket_types_manage_v1/, (r) => ok(r, { ok: true, ticket_types: [] }));
  await page.route(/\/rpc\/organiser_raffle_nights_v1/, (r) => ok(r, { ok: true, series_id: sid, can_edit: true, view_only_reason: null, nights: [] }));
  await page.route(/organiser_profiles\?.*id=in\./, (r) => ok(r, [{ id: fake.organisers[0].id, name: fake.organisers[0].name, avatar_url: null }]));
  await page.goto(`/account/p3/events/${sid}`);
  await expect(page.getByTestId('ev2-page')).toBeVisible({ timeout: 40_000 });
  return { fake, sid };
}
const tapIn = async (p: Page, label: string | RegExp) => {
  const scope = (await p.getByTestId('v2-sheet').count()) > 0 ? dlg(p) : p;
  await scope.getByRole('button', { name: label }).or(scope.getByRole('tab', { name: label })).first().click();
};
const openFlyerSheet = async (p: Page, tab: 'night' | 'every' | 'none') => {
  if (tab === 'every') await tapIn(p, /^Every /);
  if (tab === 'night') await tapIn(p, 'This night');
  await tapIn(p, /Flyer and photos/);
  await expect(dlg(p)).toBeVisible();
  await expect(dlg(p).getByTestId('flyer-choose')).toBeVisible();
};
/** Rules every flyer sheet shares: Choose is there, Remove never is; the required line shows exactly when there is no flyer. */
const sheetRules = async (p: Page, hasFlyer: boolean) => {
  const d = dlg(p);
  await expect(d.getByRole('button', { name: 'Choose a new flyer' })).toBeVisible();
  await expect(d.getByRole('button', { name: /Remove the flyer/ })).toHaveCount(0);
  await expect(d.getByTestId('flyer-remove')).toHaveCount(0);
  if (hasFlyer) await expect(d.getByTestId('flyer-required')).toHaveCount(0);
  else {
    await expect(d.getByTestId('flyer-required')).toHaveText(REQUIRED);
    const above = await d.evaluate((el) => {
      const a = el.querySelector('[data-testid="flyer-required"]')!.getBoundingClientRect();
      const b = el.querySelector('[data-testid="flyer-choose"]')!.getBoundingClientRect();
      return a.bottom <= b.top + 1;
    });
    expect(above, 'required line sits above Choose a new flyer').toBe(true);
  }
};

// 1, 2: the usual flyer sheet (Every tab)
test('1 usual flyer sheet WITH flyer: no Remove, Choose present, no required line', async ({ page }) => {
  test.skip(!P3, 'needs VITE_ENABLE_ORGANISER_P3=true');
  await openEditor(page, 'usual');
  await openFlyerSheet(page, 'every');
  await sheetRules(page, true);
});
test('2 usual flyer sheet WITHOUT flyer: required line above Choose', async ({ page }) => {
  test.skip(!P3, 'needs VITE_ENABLE_ORGANISER_P3=true');
  await openEditor(page, 'noFlyer');
  await openFlyerSheet(page, 'every');
  await sheetRules(page, false);
  await shot(page, '02-usual-sheet-no-flyer');
});

// 3, 4: the night flyer sheet (This night tab)
test('3 night flyer sheet WITH flyer: Choose + Back to the usual flyer only; Back goes to the usual flyer', async ({ page }) => {
  test.skip(!P3, 'needs VITE_ENABLE_ORGANISER_P3=true');
  await openEditor(page, 'night');
  await openFlyerSheet(page, 'night');
  await sheetRules(page, true);
  await expect(dlg(page).getByRole('button', { name: 'Back to the usual flyer' })).toBeVisible();
  await shot(page, '03-night-sheet-with-flyer');
  // the fake does not clear a night's flyer, so the expected result is read from what the tap SENT and what the person is told
  const sent = page.waitForRequest((q) => /occurrence_command_p5/.test(q.url()) && q.method() === 'POST');
  await dlg(page).getByRole('button', { name: 'Back to the usual flyer' }).click();
  const body = JSON.parse((await sent).postData() ?? '{}') as { p_envelope?: { command?: { kind?: string; payload?: Record<string, unknown> } } };
  expect(body.p_envelope?.command?.kind).toBe('occurrence.set_override');
  expect(body.p_envelope?.command?.payload).toEqual({ cover_image_url: null });
  await expect(page.getByTestId('v2-sheet')).toHaveCount(0);
  await expect(page.getByTestId('v2-toast')).toContainText('Back to usual');
});
test('4 night flyer sheet WITHOUT flyer: required line, no Remove', async ({ page }) => {
  test.skip(!P3, 'needs VITE_ENABLE_ORGANISER_P3=true');
  await openEditor(page, 'nightNoFlyer');
  await openFlyerSheet(page, 'night');
  await sheetRules(page, false);
});

// 5: one-off
test('5a one-off flyer sheet WITH flyer: same rules', async ({ page }) => {
  test.skip(!P3, 'needs VITE_ENABLE_ORGANISER_P3=true');
  await openEditor(page, 'oneOff');
  await openFlyerSheet(page, 'none');
  await sheetRules(page, true);
});
test('5b one-off flyer sheet WITHOUT flyer: same rules', async ({ page }) => {
  test.skip(!P3, 'needs VITE_ENABLE_ORGANISER_P3=true');
  await openEditor(page, 'oneOffNoFlyer');
  await openFlyerSheet(page, 'none');
  await sheetRules(page, false);
});

// 6: the Go live card of a draft with no cover
test('6 Go live card, no cover: the row reads the required words; tapping it opens the flyer screen; Go live stays dimmed', async ({ page }) => {
  test.skip(P3, 'R1 screens: run with VITE_ENABLE_ORGANISER_P3 unset');
  const fake = new OrganiserFake();
  fake.series.get(FRIDAY)!.lifecycle_status = 'draft';
  await fake.install(page);
  await page.route(/\/rpc\/series_go_live_check_v1/, (r) => json(r, { ready: false, event_missing: [{ code: 'cover', section: 'cover' }, { code: 'no_flyer', section: 'cover' }], recommended: [], profile_rule_applies: true, profile_missing: [] }));
  await page.goto(`/account/o/events/${FRIDAY}`);
  const card = page.getByTestId('org-life-list');
  await expect(card).toBeVisible({ timeout: 40_000 });
  const row = card.getByTestId('org-life-item-cover');
  await expect(row).toHaveText(new RegExp(REQUIRED_NO_DOT));
  await expect(card.getByText(REQUIRED_NO_DOT)).toHaveCount(1);
  await expect(page.getByTestId('org-life-golive')).toHaveAttribute('aria-disabled', 'true');
  await shot(page, '06-go-live-card');
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/account/o/cover/${FRIDAY}`));
  await expect(page.getByTestId('org-page-cover')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('org-life-golive')).toHaveAttribute('aria-disabled', 'true');
});

// 7: the Home job card
test('7 Home job card no_cover: "Add a flyer: <name>", sub "A flyer is required to continue"; tap goes to the cover screen', async ({ page }) => {
  test.skip(P3, 'R1 screens: run with VITE_ENABLE_ORGANISER_P3 unset');
  const fake = new OrganiserFake();
  await fake.install(page);
  await page.goto('/account/o');
  const name = fake.series.get(FRIDAY)!.name;
  const job = page.getByTestId('home-job').filter({ hasText: `Add a flyer: ${name}` });
  await expect(job).toBeVisible({ timeout: 40_000 });
  await expect(job.getByTestId('home-job-sub')).toHaveText(REQUIRED_NO_DOT);
  await shot(page, '07-home-job-card');
  await job.click();
  await expect(page).toHaveURL(new RegExp(`/account/o/cover/${FRIDAY}`));
  await expect(page.getByTestId('org-page-cover')).toBeVisible();
});

// 8: the New event flow photo step
test('8 New event photo step: required note + blocked; with a flyer the note says Needed to go live and it works', async ({ page }) => {
  test.skip(!P3, 'needs VITE_ENABLE_ORGANISER_P3=true');
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, {
    v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] },
    organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }],
  }));
  await page.goto(`/account/p3/create?at=form&kind=weekly&o=${ORG}`);
  const photo = page.getByTestId('p3-new-photo');
  await expect(photo).toBeVisible({ timeout: 40_000 });
  await photo.scrollIntoViewIfNeeded();
  await expect(photo).toContainText(`${REQUIRED} `);
  await expect(photo).not.toContainText('Needed to go live.');
  // go-live-why line says "a flyer", not "a photo"
  const why = page.getByTestId('p3-new-live-why');
  await expect(why).toContainText('a flyer');
  await expect(why).not.toContainText('a photo');
  await expect(page.getByTestId('p3-new-go-live')).toBeDisabled();
  await shot(page, '08-new-event-photo-no-flyer');
  // add a flyer
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await page.getByTestId('p3-new-cover-input').setInputFiles({ name: 'flyer.png', mimeType: 'image/png', buffer: png });
  await expect(photo).toContainText('Needed to go live.');
  await expect(photo).not.toContainText(REQUIRED);
  await expect(why).not.toContainText('a flyer');
  await photo.scrollIntoViewIfNeeded();
  await shot(page, '08b-new-event-photo-with-flyer');
});
