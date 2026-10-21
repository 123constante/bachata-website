import { test, expect, type Page } from '@playwright/test';
import { CITY, ORG, ORG_NAME, PHONE, openOrganiser, json, type OrganiserFake } from './helpers/organiserFake';

// Arc 1 PR 3 slice C walk at 390x844 (not in the test:e2e gate list): the claim screens 6a-6e,
// the page question 7b, the second-page welcome 7c, the cannot-create screen 8a/8b. Every call
// is answered in the browser by helpers/organiserFake.ts. Screenshots go to test-results/.

test.use({ viewport: PHONE });

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/arc1-claim/${name}.png`, fullPage: true });

const CLAIM_ROWS = [
  { name: 'Ritmo Latino Leeds Bachata Society', email: 'Diego@Ritmo.example', claimed: false, screen: '6c', title: 'Claim Ritmo Latino Leeds Bachata Society' },
  { name: 'Ritmo Club Managed', email: null, claimed: true, screen: '6b', title: 'Ritmo Club Managed already has an owner' },
  { name: 'Ritmo Manchester', email: 'priya@latino.example', claimed: false, screen: '6d', title: 'Is Ritmo Manchester yours?' },
  { name: 'Ritmo No Email', email: null, claimed: false, screen: '6e', title: 'Is Ritmo No Email yours?' },
];

function seedClaimable(fake: OrganiserFake) {
  fake.claimable = CLAIM_ROWS.map((r, i) => ({
    id: `a0000000-0000-4000-8000-0000000000d${i}`,
    name: r.name,
    contact_email: r.email,
    claimed_by: r.claimed ? '99999999-9999-4999-8999-999999999999' : null,
  }));
}

for (const row of CLAIM_ROWS) {
  test(`${row.screen}: ${row.title}`, async ({ page }) => {
    await openOrganiser(page, '/account/o', { noOrganiser: true }, seedClaimable);
    await page.getByTestId('onboarding-search').fill('Ritmo');
    const result = page.getByTestId('onboarding-result').filter({ hasText: row.name });
    await result.getByRole('button').click();
    await expect(page.getByTestId('onboarding-claim-title')).toHaveText(row.title);
    await expect(page.getByTestId('onboarding-not-this-one')).toBeVisible();
    await shot(page, row.screen);
    await page.getByTestId('onboarding-not-this-one').click();
    await expect(page.getByTestId('onboarding-claim-title')).toHaveCount(0);
  });
}

test('6a: your own page', async ({ page }) => {
  await openOrganiser(page, '/account/o', {}, (fake) => {
    // The fake's search reads `claimable`; the hint read answers 'yours' first for a page on the login.
    fake.claimable = [{ id: ORG, name: ORG_NAME, contact_email: null, claimed_by: null }];
  });
  // The fake answers both 'yours' and the claimable hint for one id; the database answers one.
  await page.route('**/rest/v1/rpc/organiser_claim_hints_v1', (route) => json(route, [{ organiser_id: ORG, hint: 'yours' }]));
  await page.goto('/account/o/switch');
  await page.getByTestId('switch-add-page').click();
  await page.getByTestId('onboarding-search').fill('Ritmo');
  await page.getByTestId('onboarding-home').click();
  await expect(page.getByTestId('onboarding-claim-title')).toHaveText('Ritmo Bachata London is yours');
  await shot(page, '6a');
  await page.getByTestId('onboarding-yours-home').click();
  await expect(page.getByTestId('org-page-home')).toBeVisible();
});

function secondPage(fake: OrganiserFake) {
  const first = fake.organisers[0];
  fake.organisers.push({ ...first, id: 'a0000000-0000-4000-8000-0000000000e1', name: 'Bachata Club', series: [], requests: [] });
}

test('7b: which page, with two pages', async ({ page }) => {
  await openOrganiser(page, '/account/o/new/what', {}, secondPage);
  await expect(page.getByTestId('org-new-page-row')).toHaveCount(2);
  await shot(page, '7b');
  await page.getByTestId('org-new-page-row').nth(1).click();
  await page.getByTestId('org-new-page-continue').click();
  await expect(page.getByTestId('org-new-format-recurring')).toBeVisible();
  expect(page.url()).toContain('o=a0000000-0000-4000-8000-0000000000e1');
});

test('7c: second invite accepted', async ({ page }) => {
  await openOrganiser(page, '/account/o/welcome?o=a0000000-0000-4000-8000-0000000000e1', {}, secondPage);
  await expect(page.getByTestId('org-welcome-title')).toHaveText('You now manage Bachata Club');
  await expect(page.getByTestId('org-welcome-sub')).toHaveText('You also manage Ritmo Bachata London. Switch any time from Home.');
  await shot(page, '7c');
  await page.getByTestId('org-welcome-home').click();
  await expect(page.getByTestId('org-page-home')).toBeVisible();
});

test('8a/8b: events are not open to you yet', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o', { noOrganiser: true }, (f) => {
    f.refuse('create_organiser_profile_v1', 'organiser_invite_required', 5);
  });
  await page.route('**/rest/v1/rpc/request_signup_access_v1', (route) => json(route, { ok: true }));
  await page.getByTestId('onboarding-create').click();
  await page.getByTestId('onboarding-create-name').fill('Nova Bachata');
  await page.getByTestId('onboarding-create-next').click();
  await page.getByTestId('onboarding-city-search').fill(CITY.name.slice(0, 3));
  await page.getByTestId('onboarding-city-option').first().click();
  await expect(page.getByTestId('onboarding-create-closed-title')).toHaveText('Events are not open to you yet');
  await shot(page, '8a');
  await page.getByTestId('onboarding-create-open-ask').click();
  await expect(page.getByTestId('onboarding-create-open-sent')).toContainText('We are checking');
  await shot(page, '8b');
  expect(fake.calls.filter((c) => c.rpc === 'create_organiser_profile_v1')).toHaveLength(1);
});
