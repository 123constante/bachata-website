import { test, expect } from '@playwright/test';

// A signed-out visitor sees "Sign in" in the header on every page, and it
// carries them back to the page they were on once they have signed in.
for (const width of [390, 1280]) {
  test(`signed-out header offers Sign in @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/vendors/header-signin-probe');

    const link = page.getByTestId('header-signin-link');
    // Auth resolves only after the deferred Supabase client loads (or its
    // 8s deadline passes; the smoke suite has a placeholder key, so it waits it out).
    await expect(link).toBeVisible({ timeout: 30_000 });
    await expect(link).toHaveText('Sign in');
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await link.click();
    await expect(page).toHaveURL(/\/auth\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get('mode')).toBe('signin');
    expect(url.searchParams.get('returnTo')).toBe('/vendors/header-signin-probe');

    // The auth page itself does not offer a link back to itself. Wait for the
    // page's own form first: the URL changes before the lazy chunk has mounted.
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('header-signin-link')).toHaveCount(0);
  });
}
