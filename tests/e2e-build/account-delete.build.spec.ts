import { test, expect, type Page } from '@playwright/test';
import { OrganiserFake, expectNoHorizontalScroll, json } from '../e2e/helpers/organiserFake';

// Delete = hide (admin PR #820; Website slice 3a + 3d). PRODUCTION build at 390x844
// (playwright.build.config.ts) against mocked RPCs: the deletion status, restore, the
// erase check and the account-erase edge function. Each walk saves its phone-size
// screenshot under docs/handover/shots-3ad/ (the journey grid's W refs point there).

const SHOTS = 'docs/handover/shots-3ad';
const NONE = { state: 'none', requested_at: null, restore_until: null };
const PENDING = { state: 'pending', requested_at: '2026-10-01T10:00:00+00:00', restore_until: '2026-10-31T10:00:00+00:00' };
const EXPIRED = { state: 'expired', requested_at: '2026-08-01T10:00:00+00:00', restore_until: '2026-08-31T10:00:00+00:00' };
// Review B1: a sign-in carrying a returnTo (here /parties) still restores first, via /auth/callback.
const SIGN_IN = '/auth/callback?mode=signin&returnTo=%2Fparties';
const FORBIDDEN = /erased|permanent|cannot be undone|photos are gone|for good/i;

type Mocks = { status?: unknown; restore?: unknown; check?: unknown; erase?: { status: number; body: unknown } };
async function mocked(page: Page, m: Mocks, opts: ConstructorParameters<typeof OrganiserFake>[0] = { noOrganiser: true }) {
  const fake = new OrganiserFake(opts);
  await fake.install(page);
  const calls: string[] = [];
  await page.route('**/rest/v1/rpc/my_account_deletion_status_v1', (r) => (calls.push('status'), json(r, m.status ?? NONE)));
  await page.route('**/rest/v1/rpc/my_account_restore_v1', (r) => (calls.push('restore'), json(r, m.restore ?? { ...NONE, restored: false, code: 'no_self_delete' })));
  await page.route('**/rest/v1/rpc/my_account_erase_check_v1', (r) => json(r, m.check ?? { can_erase: true, blockers: [], code: null }));
  await page.route('**/auth/v1/logout**', (r) => (calls.push(`logout:${new URL(r.request().url()).searchParams.get('scope')}`), r.fulfill({ status: 204 })));
  await page.route('**/functions/v1/account-erase', (r) => (calls.push('erase'), json(r, m.erase?.body ?? { ok: true, hidden: true, deletion: PENDING }, m.erase?.status ?? 200)));
  return { fake, calls };
}
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png` });

test('delete hides: type DELETE, signed out on every device, the deleted page says hidden and 30 days', async ({ page }) => {
  const { calls } = await mocked(page, {});
  await page.goto('/account/settings/delete');
  await expect(page.getByTestId('delete-lost')).toContainText('within 30 days');
  await expect(page.locator('body')).not.toContainText(FORBIDDEN);
  await expectNoHorizontalScroll(page);
  await shot(page, '01-delete-screen');
  await page.getByTestId('delete-type-input').fill('DELETE');
  await page.getByTestId('delete-confirm').click();
  await expect(page).toHaveURL(/\/account\/deleted$/);
  await expect(page.getByTestId('account-deleted-copy')).toContainText('Sign in within 30 days to undo');
  await expect(page.locator('body')).not.toContainText(FORBIDDEN);
  expect(calls).toContain('erase');
  expect(calls).toContain('logout:global');
  await shot(page, '02-deleted-page');
});

test('a sole organiser owner is refused at delete, with the pages listed', async ({ page }) => {
  await mocked(page, {
    erase: { status: 409, body: { ok: false, code: 'sole_organiser_owner', blockers: [{ entity_id: 'o1', name: 'Late Club' }] } },
  });
  await page.goto('/account/settings/delete');
  await page.getByTestId('delete-type-input').fill('DELETE');
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId('delete-blocked')).toContainText('Late Club');
  await expect(page.getByTestId('delete-blocked')).toContainText('only owner');
  await expect(page).toHaveURL(/\/account\/settings\/delete$/);
  await shot(page, '03-refused-sole-owner');
});

test('a rate-limited delete says to wait, and nothing changes', async ({ page }) => {
  await mocked(page, { erase: { status: 429, body: { ok: false, code: 'rate_limited' } } });
  await page.goto('/account/settings/delete');
  await page.getByTestId('delete-type-input').fill('DELETE');
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByTestId('delete-blocked')).toContainText('wait 24 hours');
  await shot(page, '04-refused-rate-limited');
});

test('signing in within 30 days restores the account and says welcome back', async ({ page }) => {
  const { calls } = await mocked(page, { status: PENDING, restore: { ...NONE, restored: true, code: null } });
  await page.goto(SIGN_IN);
  await expect(page).toHaveURL(/\/account\/restore\?returnTo=%2Fparties$/);
  await expect(page.getByTestId('restore-restored')).toContainText('Welcome back, your account is restored');
  expect(calls.filter((c) => c === 'restore')).toHaveLength(1);
  await expectNoHorizontalScroll(page);
  await shot(page, '05-restored-banner');
});

test('an admin-archived profile is not restored: it says an admin hid it', async ({ page }) => {
  await mocked(page, { status: PENDING, restore: { ...PENDING, restored: false, code: 'admin_archived' } });
  await page.goto(SIGN_IN);
  await expect(page.getByTestId('restore-admin_archived')).toContainText('An admin has hidden this profile');
  await expect(page.getByTestId('restore-contact')).toHaveAttribute('href', /^mailto:/);
  await shot(page, '06-admin-archived');
});

test('after 30 days the deleted card names the date, and both asks go to the contact address', async ({ page }) => {
  const { calls } = await mocked(page, { status: EXPIRED });
  await page.goto(SIGN_IN);
  await expect(page.getByTestId('restore-deleted-card')).toContainText('This account was deleted on 1 August 2026');
  await expect(page.getByTestId('restore-ask-restore')).toHaveAttribute('href', /^mailto:.*restore/i);
  await expect(page.getByTestId('restore-ask-erase')).toHaveAttribute('href', /^mailto:.*erase/i);
  await expect(page.locator('body')).not.toContainText(FORBIDDEN);
  expect(calls).not.toContain('restore');
  await expectNoHorizontalScroll(page);
  await shot(page, '07-deleted-card');
});

test('settings: sign out of all devices is a global sign-out', async ({ page }) => {
  const { calls } = await mocked(page, {});
  await page.goto('/account/settings');
  await expect(page.getByTestId('settings-signout-all')).toBeVisible();
  await page.getByTestId('settings-signout-all').scrollIntoViewIfNeeded();
  await shot(page, '08-settings-signout-all');
  await page.getByTestId('settings-signout-all').click();
  // D119 #4: the button opens a confirm sheet; the sign-out runs from its confirm.
  await page.getByTestId('settings-signout-all-confirm').click();
  await expect.poll(() => calls).toContain('logout:global');
});

// Review #789 B1: every sign-out button on these pages lands where it says, never on the
// sign-in form ("Welcome back"). Each row reads the FINAL address after the move settles.
// The site home: "/" itself, or the city home it forwards to.
const HOME = /^\/(city\/[a-z0-9-]+)?$/;
const SIGN_OUT_ROWS = [
  { name: 'settings: Sign out, Yes', at: '/account/settings?from=app', m: {}, taps: ['settings-signout', 'settings-signout-yes'], lands: HOME, scope: 'local' },
  { name: 'settings: Sign out of all devices', at: '/account/settings?from=app', m: {}, taps: ['settings-signout-all', 'settings-signout-all-confirm'], lands: HOME, scope: 'global' },
  { name: 'restore (deleted, expired): Sign out', at: SIGN_IN, m: { status: EXPIRED }, taps: ['restore-signout'], lands: HOME, scope: 'local' },
  { name: 'delete: Delete my account', at: '/account/settings/delete?from=app', m: {}, taps: ['delete-type-input', 'delete-confirm'], lands: /^\/account\/deleted$/, scope: 'global' },
] as const;
for (const row of SIGN_OUT_ROWS) {
  test(`sign-out lands on ${row.lands === HOME ? 'the site home' : '/account/deleted'}, not /auth: ${row.name}`, async ({ page }) => {
    const { calls } = await mocked(page, row.m);
    await page.goto(row.at);
    for (const id of row.taps) {
      if (id === 'delete-type-input') await page.getByTestId(id).fill('DELETE');
      else await page.getByTestId(id).click();
    }
    await expect.poll(() => calls).toContain(`logout:${row.scope}`);
    await expect.poll(() => new URL(page.url()).pathname).toMatch(row.lands);
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname).toMatch(row.lands);
  });
}
