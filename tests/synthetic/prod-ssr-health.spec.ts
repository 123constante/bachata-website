import { test, expect, type ConsoleMessage } from '@playwright/test';

// Synthetic production monitor for the SSR entry points, run under the
// conditions that first broke them: a crawler UA + a non-London timezone (set
// in playwright.synthetic.config.ts). Catches, BEFORE a real crawler does:
//   • RangeError: Invalid time value  (londonDate math on a bad-ICU/tz path)
//   • hydration cascade  (removeChild / "object can not be found" / Root did
//     not complete) — the client-visible half of an SSR mismatch
//   • the root ErrorBoundary tripping (styled fallback rendered instead of page)
//   • a non-2xx document response
//
// Read-only GETs against live prod. Not part of the local e2e gate.

// Console/pageerror signatures that indicate a real client failure (NOT the
// stale-chunk / third-party noise the app already filters).
const FATAL = [
  /Invalid time value/i,
  /removeChild/i,
  /The object can ?not be found here/i,
  /Root did not complete/i,
  /Minified React error/i,
  /Maximum update depth/i,
];

// The root ErrorBoundary / RR7 default error copy — if visible, the page failed
// to render and fell back.
const ERROR_FALLBACK_TEXT = [/Something went wrong/i, /Page not found/i, /Application Error/i];

function attachErrorCollectors(page: import('@playwright/test').Page) {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (FATAL.some((re) => re.test(t))) errors.push(`console: ${t}`);
  });
  page.on('pageerror', (e) => {
    if (FATAL.some((re) => re.test(e.message))) errors.push(`pageerror: ${e.message}`);
  });
  return errors;
}

async function assertHealthy(page: import('@playwright/test').Page, errors: string[], label: string) {
  // No error-boundary fallback text rendered.
  const body = (await page.locator('body').innerText().catch(() => '')) || '';
  for (const re of ERROR_FALLBACK_TEXT) {
    expect(re.test(body), `${label}: error-boundary fallback text visible ("${re}")`).toBe(false);
  }
  // No fatal console/page errors.
  expect(errors, `${label}: fatal client errors`).toEqual([]);
}

test('city page /city/london-gb renders clean under crawler + UTC tz', async ({ page }) => {
  const errors = attachErrorCollectors(page);
  const resp = await page.goto('/city/london-gb', { waitUntil: 'networkidle' });
  expect(resp?.status(), 'city page HTTP status').toBeLessThan(400);
  await assertHealthy(page, errors, '/city/london-gb');
});

test('an event page renders clean under crawler + UTC tz', async ({ page }) => {
  // Self-select a live event by scraping a link off the city page — avoids a
  // brittle hardcoded slug that could be archived.
  await page.goto('/city/london-gb', { waitUntil: 'domcontentloaded' });
  const href = await page
    .locator('a[href*="/event/"]')
    .first()
    .getAttribute('href')
    .catch(() => null);

  test.skip(!href, 'No event link found on the city page to probe.');

  const errors = attachErrorCollectors(page);
  const resp = await page.goto(href!, { waitUntil: 'networkidle' });
  expect(resp?.status(), 'event page HTTP status').toBeLessThan(400);
  await assertHealthy(page, errors, href!);
});
