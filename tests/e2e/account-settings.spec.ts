import { test, expect, type Page } from '@playwright/test';
import { CITY, PHONE, OrganiserFake, expectNoHorizontalScroll, json } from './helpers/organiserFake';

// Account settings (/account/settings, /ownership, /delete, /account/deleted) at 390x844
// against the organiser fake plus MOCKED account-lifecycle RPCs and the account-erase edge
// function (the real ones ship from the admin repo; nothing here proves their behaviour).

const SHORT = { width: 390, height: 600 };
type Check = { can_erase: boolean; blockers: { entity_id: string; name: string }[]; code: string | null };
const OK: Check = { can_erase: true, blockers: [], code: null };

async function open(page: Page, path: string, o: { check?: Check; active?: boolean; noPersona?: boolean; erase?: { status: number; body: unknown } } = {}) {
  const fake = new OrganiserFake({ noOrganiser: true });
  const calls: string[] = [];
  let active = o.active ?? true;
  await fake.install(page);
  await page.route('**/rest/v1/rpc/_my_dancer_profile_id_v1', (r) => json(r, o.noPersona ? null : 'persona-1'));
  await page.route('**/rest/v1/rpc/profile_complete_v1', (r) => json(r, false));
  await page.route('**/rest/v1/dancer_profiles**', (r) => {
    const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const out = { id: 'persona-1', is_active: active, first_name: null, dance_role: null, avatar_url: null, based_city_id: null, city: null };
    return json(r, single ? out : [out]);
  });
  await page.route('**/rest/v1/rpc/my_account_erase_check_v1', (r) => json(r, o.check ?? OK));
  await page.route('**/rest/v1/rpc/my_account_export_v1', (r) =>
    json(r, { exported_at: '2026-10-13T00:00:00Z', email: 'diego@ritmo.example', profile: null, roles: {}, ratings: [], attendance: [] }));
  await page.route('**/rest/v1/rpc/my_profile_disable_v1', (r) => {
    active = !(r.request().postDataJSON()?.p_disabled as boolean);
    calls.push(`disable:${!active}`);
    return json(r, { disabled: !active });
  });
  await page.route('**/functions/v1/account-erase', (r) => {
    calls.push('erase');
    const e = o.erase ?? { status: 200, body: { ok: true } };
    return json(r, e.body, e.status);
  });
  await page.goto(path);
  return { calls };
}

/** The fixed test clock freezes the page-transition fade part-way (the dancer home does the same), so shots force it opaque. */
async function solid(page: Page) {
  await page.evaluate(() => {
    for (let e: Element | null = document.querySelector('.max-w-md'); e; e = e.parentElement) (e as HTMLElement).style.opacity = '1';
  });
}

async function smallControls(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('.max-w-md a, .max-w-md button, .max-w-md input'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 43.5) out.push(`${el.tagName}:${(el.textContent || '').trim().slice(0, 30)} ${r.height}`);
    }
    return out;
  });
}

for (const viewport of [PHONE, SHORT]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, reducedMotion: 'reduce' });

    test('an UNFINISHED profile reaches settings (no gate); controls are 44px+; no sideways scroll', async ({ page }) => {
      await open(page, '/account/settings');
      await expect(page.getByTestId('settings-signout')).toBeVisible();
      await expect(page).toHaveURL(/\/account\/settings$/);
      await page.waitForTimeout(1500);
      expect(await smallControls(page)).toEqual([]);
      await expectNoHorizontalScroll(page);
      await solid(page);
      await page.screenshot({ path: `test-results/settings-home-${viewport.height}.png`, fullPage: false });
    });

    test('delete screen: disabled until DELETE typed exactly', async ({ page }) => {
      await open(page, '/account/settings/delete');
      const btn = page.getByTestId('delete-confirm');
      await expect(page.getByTestId('delete-type-input')).toBeVisible();
      await expect(btn).toBeDisabled();
      await page.getByTestId('delete-type-input').fill('delete');
      await expect(btn).toBeDisabled();
      await page.getByTestId('delete-type-input').fill('DELETE');
      await expect(btn).toBeEnabled();
      await page.waitForTimeout(1500);
      expect(await smallControls(page)).toEqual([]);
      await expectNoHorizontalScroll(page);
      await solid(page);
      await page.screenshot({ path: `test-results/settings-delete-${viewport.height}.png`, fullPage: false });
    });
  });
}

test.describe('flows @390', () => {
  test.use({ viewport: PHONE, reducedMotion: 'reduce' });

  test('sole organiser owner: reason and page names, erase disabled, hide still offered', async ({ page }) => {
    await open(page, '/account/settings/delete', { check: { can_erase: false, code: 'sole_organiser_owner', blockers: [{ entity_id: 'o1', name: 'Ritmo Bachata London' }] } });
    await expect(page.getByTestId('delete-blocked')).toContainText('Ritmo Bachata London');
    await expect(page.getByTestId('delete-confirm')).toBeDisabled();
    await expect(page.getByTestId('delete-hide-instead')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await solid(page);
      await page.screenshot({ path: 'test-results/settings-delete-blocked.png', fullPage: false });
  });

  test('hide, then show again', async ({ page }) => {
    const { calls } = await open(page, '/account/settings');
    await page.getByTestId('settings-disable-toggle').click();
    await page.getByTestId('settings-disable-confirm').click();
    await expect(page.getByTestId('settings-disable-state')).toContainText('hidden');
    await page.getByTestId('settings-disable-toggle').click();
    await expect(page.getByTestId('settings-disable-state')).toContainText('visible');
    expect(calls).toEqual(['disable:true', 'disable:false']);
  });

  test('erase: types DELETE, calls the function once, lands on the deleted page signed out', async ({ page }) => {
    const { calls } = await open(page, '/account/settings/delete');
    await page.getByTestId('delete-type-input').fill('DELETE');
    await page.getByTestId('delete-confirm').click();
    await expect(page).toHaveURL(/\/account\/deleted$/);
    await expect(page.getByTestId('account-deleted')).toBeVisible();
    expect(calls).toEqual(['erase']);
    await solid(page);
      await page.screenshot({ path: 'test-results/settings-deleted.png', fullPage: false });
  });

  test('media_delete_failed: stays put and says nothing was deleted', async ({ page }) => {
    await open(page, '/account/settings/delete', { erase: { status: 500, body: { ok: false, code: 'media_delete_failed' } } });
    await page.getByTestId('delete-type-input').fill('DELETE');
    await page.getByTestId('delete-confirm').click();
    await expect(page.getByTestId('delete-error')).toContainText('nothing was deleted');
    await expect(page).toHaveURL(/\/account\/settings\/delete$/);
  });

  test('no persona: hide control replaced by a reason', async ({ page }) => {
    await open(page, '/account/settings', { noPersona: true });
    await expect(page.getByTestId('settings-disable-none')).toBeVisible();
    await expect(page.getByTestId('settings-disable-toggle')).toHaveCount(0);
  });
});
