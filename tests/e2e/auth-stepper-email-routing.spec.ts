// @ts-nocheck
import { test, expect } from '@playwright/test';

const rpcPath = '**/rest/v1/rpc/account_exists_by_email';

async function openAuthFlow(page: any) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.context().clearCookies();
  await page.goto('/auth?mode=signup');
  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByRole('button', { name: 'Lock role' }).click();
  await expect(page.getByRole('heading', { name: 'Secure your account' })).toBeVisible();
}

test('routes to returning flow when lookup finds account', async ({ page }) => {
  await page.route(rpcPath, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'true',
    });
  });

  await openAuthFlow(page);

  await page.getByPlaceholder('you@example.com').fill('existing@example.com');
  await page.getByRole('button', { name: /^Continue$/ }).click();

  await expect(page.getByText('Account found. We will send a sign-in code.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send sign-in code' })).toBeVisible();
  await expect(page.getByLabel('First name')).toHaveCount(0);
  await expect(page.getByLabel('Password')).toHaveCount(0);
});

test('routes to new-account flow when lookup does not find account', async ({ page }) => {
  await page.route(rpcPath, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: 'false',
    });
  });

  await openAuthFlow(page);

  await page.getByPlaceholder('you@example.com').fill('new@example.com');
  await page.getByRole('button', { name: /^Continue$/ }).click();

  await expect(page.getByText('No account found. Create your account details below.')).toBeVisible();
  await expect(page.getByLabel('First name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send account code' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveCount(0);
});
