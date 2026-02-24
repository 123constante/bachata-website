import { test, expect } from '@playwright/test';

test('signup stepper advances from role selection to profile details', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.context().clearCookies();
  await page.goto('/auth?mode=signup');

  await expect(page.getByRole('heading', { name: 'What brings you here?' })).toBeVisible();

  await page.getByRole('button', { name: 'Teacher' }).click();

  await expect(page.getByRole('heading', { name: 'A little about you' })).toBeVisible();
  await expect(page.getByText('Step 2 of 3')).toBeVisible();
  await expect(page.getByLabel('First name')).toBeVisible();
});

test('signin flow can switch to signup wizard', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.context().clearCookies();
  await page.goto('/auth?mode=signin');

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();

  await page.getByRole('button', { name: 'New here? Create an account' }).click();

  await expect(page).toHaveURL(/\/auth\?mode=signup/);
  await expect(page.getByRole('heading', { name: 'What brings you here?' })).toBeVisible();
});
