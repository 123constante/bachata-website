import { test, expect, type Page } from '@playwright/test';
import { PHONE, OrganiserFake, expectNoHorizontalScroll, json, refuse } from '../helpers/organiserFake';
import { CITY_LONDON, DANCER_SHAPES, withDerived, type DancerShapeName } from '../../../src/modules/dancer-app/api/fixtures';
import type { MyDancerEdit } from '../../../src/modules/dancer-app/api/types';

// /app/welcome in a real browser at 390x844: the gate, my_dancer_edit_v1, save_my_dancer_profile_v2 and
// the city search are mocked with page.route on the RPC URLs (the dev server is the real app).
// Screenshots of every step on three shapes land in docs/handover/dancer-rebuild-w2a/.

const RPC = '**/rest/v1/rpc/';
const SHOTS = 'docs/handover/dancer-rebuild-w2a';

async function open(page: Page, shape: DancerShapeName) {
  const fake = new OrganiserFake({ noOrganiser: true });
  let profile: MyDancerEdit = DANCER_SHAPES[shape].profile!;
  const saves: unknown[] = [];
  await fake.install(page);
  await page.route(`${RPC}dancer_area_gate_v1`, (r) => json(r, { open: false, allowed: true }));
  await page.route(`${RPC}my_dancer_edit_v1`, (r) => json(r, profile));
  await page.route(`${RPC}search_cities`, (r) =>
    json(r, [{ id: CITY_LONDON.id, name: 'London', slug: 'london', country_name: 'United Kingdom', display_name: 'London, United Kingdom' }]),
  );
  await page.route(`${RPC}save_my_dancer_profile_v2`, (r) => {
    const payload = (r.request().postDataJSON() as { p_payload: Record<string, unknown> }).p_payload;
    saves.push(payload);
    if (payload.first_name === 'boom') return refuse(r, 'rate_limited');
    profile = withDerived({ ...profile, ...payload, ...(payload.based_city_id ? { city_name: 'London' } : {}) } as MyDancerEdit);
    return json(r, profile);
  });
  await page.goto('/app/welcome');
  return { saves, setPhoto: () => { profile = withDerived({ ...profile, avatar_url: 'https://img.example/a.jpg' }); } };
}

async function shortControls(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('[data-testid^="onboarding-"] a, [data-testid^="onboarding-"] button'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 43.5) out.push(`${(el.textContent || '').trim().slice(0, 20)} ${r.width}x${r.height}`);
    }
    return out;
  });
}

const shot = async (page: Page, name: string) => {
  expect(await shortControls(page)).toEqual([]);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};

test.describe('onboarding 390x844', () => {
  test.use({ viewport: PHONE });

  test('empty stub: name, city (real picker), then the role card', async ({ page }) => {
    const { saves } = await open(page, 'emptyStub');
    await expect(page.getByTestId('onboarding-name')).toBeVisible();
    await expect(page.getByTestId('onboarding-consent')).toContainText('By continuing you accept the Terms and Privacy policy');
    await expect(page.getByTestId('onboarding-continue')).toBeDisabled();
    await expect(page.getByTestId('onboarding-reason')).toContainText('first name');
    await shot(page, 'stub-1-name');
    await page.getByLabel('First name').fill('Ana');
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('onboarding-city')).toBeVisible();
    await expect(page.getByTestId('onboarding-pct')).toHaveText('25%');
    await shot(page, 'stub-2-city');
    expect(saves).toEqual([{ first_name: 'Ana' }]);
  });

  test('name + city only: role, then the photo hand-off that cannot be skipped', async ({ page }) => {
    const { saves } = await open(page, 'nameCityOnly');
    await expect(page.getByTestId('onboarding-role')).toBeVisible();
    await shot(page, 'namecity-3-role');
    await page.getByRole('radio', { name: 'Follower' }).click();
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('onboarding-photo')).toBeVisible();
    await expect(page.getByRole('button', { name: /skip|continue/i })).toHaveCount(0);
    await shot(page, 'namecity-4-photo');
    expect(saves).toEqual([{ dance_role: 'Follower' }]);
    await page.getByTestId('onboarding-take-photo').click();
    await expect(page).toHaveURL(/\/app\/me\/photo\?return=\/app\/welcome$/);
  });

  test('four-field complete: You are in, both optional cards, Nice work', async ({ page }) => {
    const { saves } = await open(page, 'fourFieldComplete');
    await expect(page.getByTestId('onboarding-in-card')).toContainText('You’re in, Ana');
    await expect(page.getByTestId('onboarding-pct')).toHaveText('70%');
    await shot(page, 'complete-5-in');
    await page.getByTestId('onboarding-boost').click();
    await expect(page.getByTestId('onboarding-years')).toBeVisible();
    await page.getByRole('radio', { name: '3 to 6 years' }).click();
    await shot(page, 'complete-6-years');
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('onboarding-styles')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Kizomba' }).click();
    await shot(page, 'complete-7-styles');
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('onboarding-nice-card')).toContainText('Nice work, Ana');
    await shot(page, 'complete-8-nice');
    expect(saves).toEqual([{ dance_started_year: new Date().getFullYear() - 4 }, { favorite_styles: ['Kizomba'] }]);
    await page.getByTestId('onboarding-home').click();
    await expect(page).toHaveURL(/\/app\/home$/);
  });

  test('a save error stays on the card with the one copy', async ({ page }) => {
    await open(page, 'emptyStub');
    await page.getByLabel('First name').fill('boom');
    await page.getByTestId('onboarding-continue').click();
    await expect(page.getByTestId('onboarding-error')).toContainText('lot of saves');
    await expect(page.getByTestId('onboarding-name')).toBeVisible();
  });

  test('complete + all extras has no onboarding: straight to Home', async ({ page }) => {
    await open(page, 'completeAllExtras');
    await expect(page).toHaveURL(/\/app\/home$/);
  });
});
