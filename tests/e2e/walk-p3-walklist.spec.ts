import { test } from '@playwright/test';
import { FRIDAY, OrganiserFake, PHONE } from './helpers/organiserFake';
test.use({ viewport: PHONE, reducedMotion: 'reduce' });
test('probe', async ({ page }) => {
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.goto(`/account/p3/events/${FRIDAY}/details`);
  await page.waitForLoadState("networkidle").catch(()=>{}); await page.waitForTimeout(8000);
  console.log(await page.locator('body').innerText());
  await page.screenshot({ path: '/tmp/claude-0/probe.png' });
});
