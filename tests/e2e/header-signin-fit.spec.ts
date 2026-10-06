import { test, expect } from '@playwright/test';

// The signed-out header must keep "Sign in" fully on screen at every width
// where the desktop nav shows. At md widths the logo, five nav links and a
// fixed-width search box used to push the link off the right edge.
for (const width of [360, 390, 768, 820, 900, 1024, 1280]) {
  test(`Sign in stays inside the viewport @${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/vendors/header-signin-probe');
    const link = page.getByTestId('header-sign-in-link');
    // Auth resolves after the deferred Supabase client loads, or its 8s deadline.
    await expect(link).toBeVisible({ timeout: 30_000 });
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  });
}
