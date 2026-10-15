import { expect, test, type Locator, type Page } from '@playwright/test';
import { fakeSupabase } from '../e2e-phone/helpers';
import { FLAG_EVENT_ID, ORG_SLUG } from '../e2e-phone/fakeSupabase.mjs';

// The routes PR #747's Vercel preview broke while every CI job was green: the
// party list (stuck on skeleton rows: `TypeError: le is not a function` in the
// vendor-ui chunk), an event by its uuid (schedule card on "Loading..." forever)
// and an organiser page. Against the PRODUCTION build (playwright.build.config.ts):
// no uncaught page error, nothing visibly loading 8 s after the page opened, and
// the route's own content on screen (so an error boundary or a gate cannot pass).
// Red-first: a build with a vendor-ui <-> vendor-ui-modal cycle
// (@radix-ui/react-context filed in vendor-ui-modal, cycle guard off) fails all
// three with `TypeError: Z is not a function`. The cycle itself fails the build
// (vendorChunkCycleGuard, vite.chunks.ts); this catches what a cycle check
// cannot: any other way a production build leaves these pages stuck.
const ROUTES: { name: string; path: string; content: (page: Page) => Locator }[] = [
  // The data-driven part: the calendar's day cells (the skeleton rows stood in for them).
  { name: 'party list', path: '/parties', content: (page) => page.getByRole('button', { name: /^\d+ \w+ \d{4}, / }) },
  // The schedule card's first session: the card is past its loading state.
  { name: 'event by uuid', path: `/event/${FLAG_EVENT_ID}`, content: (page) => page.getByText('Bachata Sensual Improvers') },
  { name: 'organiser page', path: `/organisers/${ORG_SLUG}`, content: (page) => page.getByRole('heading', { name: 'Ritmo Phone QA' }) },
];

// What a stuck page shows: skeleton rows (animate-pulse), aria-busy, or a
// "Loading..." / "Loading\u2026" label. Visible ones only: NavigationSplash keeps a
// hidden "Loading" span mounted after a client navigation.
const STILL_LOADING = '.animate-pulse, [aria-busy="true"]';
const LOADING_LABEL = /^Loading(\.\.\.|\u2026)$/;

for (const r of ROUTES) {
  test(`${r.name} (${r.path}) renders from the production build`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`${e.name}: ${e.message}`));
    await fakeSupabase(page, { realClock: true });
    await page.goto(r.path, { waitUntil: 'load' });
    await page.waitForTimeout(8_000);

    expect(errors, 'uncaught errors in the page').toEqual([]);
    const visible = (els: Element[]) => els.filter((el) => (el as HTMLElement).offsetParent !== null).length;
    const skeletons = await page.locator(STILL_LOADING).evaluateAll(visible);
    const loadingText = await page.getByText(LOADING_LABEL).evaluateAll(visible);
    expect({ loadingText, skeletons }, 'still loading after 8 s').toEqual({ loadingText: 0, skeletons: 0 });
    await expect(r.content(page).first(), 'the route content').toBeVisible({ timeout: 1_000 });
  });
}
