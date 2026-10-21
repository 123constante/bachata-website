import { test, expect, type Page } from '@playwright/test';
import { CITY, OrganiserFake, json } from './helpers/organiserFake';

// Release B slice A (restyle): the person-area and account screens in the Ember look, at 390x844 and 1280x800,
// on mocked data (the organiser fake plus the people-arc RPCs). Checks per route: zero console errors, no sideways
// scroll, the primary button is what a tap at its centre hits, the "Bachata Calendar" home link (D120) is there.
// Shots go to docs/people-arc/restyle-a/. Not in the e2e-smoke gate list; run by name:
//   npx playwright test tests/e2e/restyle-a-walk.spec.ts

const TEACHER = { years_teaching: 6, teaching_styles: ['Sensual'], offers_private: null, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null, partner_role: null };
const DJ = { dj_name: 'DJ Luna', genres: [], soundcloud: null, mixcloud: null, pricing: null };
const ROLES = [
  { role: 'dancer', active: true, complete: true }, { role: 'organiser', active: false, complete: false },
  { role: 'teacher', active: true, complete: true }, { role: 'dj', active: false, complete: false },
];

async function open(page: Page, path: string, o: { signedOut?: boolean } = {}) {
  const fake = new OrganiserFake({ noOrganiser: true, signedOut: o.signedOut });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/_my_dancer_profile_id_v1', (r) => json(r, 'persona-1'));
  await page.route('**/rest/v1/rpc/profile_complete_v1', (r) => json(r, true));
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: false, allowed: false }));
  await page.route('**/rest/v1/rpc/my_roles_v1', (r) => json(r, ROLES));
  await page.route('**/rest/v1/rpc/my_profile_progress_v1', (r) => json(r, { percent: 60, required_left: 0, publish_ready: true, steps: [], declined: [] }));
  await page.route('**/rest/v1/rpc/my_role_details_v1', (r) => json(r, { role: r.request().postDataJSON()?.p_role, person_id: 'p1', details: r.request().postDataJSON()?.p_role === 'dj' ? DJ : TEACHER }));
  await page.route('**/rest/v1/rpc/my_lineup_appearances_v1', (r) => json(r, []));
  await page.route('**/rest/v1/dancer_profiles**', (r) => {
    const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const out = { id: 'persona-1', is_active: true, first_name: 'Diego', dance_role: 'Lead', avatar_url: 'https://media.bachatacalendar.co.uk/diego.jpg', based_city_id: CITY.id, city: { name: CITY.name }, hide_surname_publicly: false };
    return json(r, single ? out : [out]);
  });
  await page.goto(path);
}

/** The fixed test clock freezes the page-transition fade part-way, so shots force every ancestor opaque. */
async function solid(page: Page, testId: string) {
  await page.addStyleTag({ content: '[style*="opacity"]{opacity:1 !important}[style*="filter"]{filter:none !important}' });
  await page.evaluate((id) => {
    for (let e: Element | null = document.querySelector(`[data-testid="${id}"]`); e; e = e.parentElement) (e as HTMLElement).style.opacity = '1';
  }, testId);
}

const ROUTES: { name: string; path: string; ready: string; primary?: string; signedOut?: boolean }[] = [
  { name: 'account-home', path: '/account/dancer', ready: 'account-areas-row' },
  { name: 'account-settings', path: '/account/settings', ready: 'settings-signout' },
  { name: 'account-delete', path: '/account/settings/delete', ready: 'delete-confirm' },
  { name: 'your-areas', path: '/account/areas', ready: 'area-row-dj' },
  { name: 'teacher-area', path: '/account/t', ready: 'completeness-line', primary: 'edit-details' },
  { name: 'teacher-details', path: '/account/t/details', ready: 'save-details', primary: 'save-details' },
  { name: 'dj-area', path: '/account/dj', ready: 'completeness-line', primary: 'edit-details' },
  { name: 'dj-details', path: '/account/dj/details', ready: 'save-details', primary: 'save-details' },
];

for (const vp of [{ width: 390, height: 844, tag: '390' }, { width: 1280, height: 800, tag: '1280' }]) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' });
    for (const r of ROUTES) {
      test(r.name, async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push(String(e)));
        await open(page, r.path);
        await expect(page.getByTestId(r.ready)).toBeVisible();
        await expect(page.getByTestId('site-home-link').first()).toBeVisible();
        await page.waitForTimeout(600);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        if (r.primary) {
          const btn = page.getByTestId(r.primary);
          await btn.scrollIntoViewIfNeeded();
          const hit = await btn.evaluate((el) => {
            const b = el.getBoundingClientRect();
            const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
            return top === el || el.contains(top);
          });
          expect(hit).toBe(true);
        }
        await solid(page, r.ready);
        if (vp.tag === '390') await page.screenshot({ path: `docs/people-arc/restyle-a/${r.name}-390.png` });
        expect(errors.filter((e) => !/favicon|Failed to load resource|Extra attributes from the server|violates the following Content Security Policy|\[hydration\]|fetchPriority/.test(e)).map((e) => e.slice(0, 300))).toEqual([]);
      });
    }
  });
}

test.describe('390x844 sheets and the sign-up roles step', () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  test('ask sheet', async ({ page }) => {
    await open(page, '/account/areas');
    await page.getByTestId('area-action-ask').click();
    await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
    await page.screenshot({ path: 'docs/people-arc/restyle-a/ask-sheet-390.png' });
  });
  test('hide profile and sign-out-all sheets', async ({ page }) => {
    await open(page, '/account/settings');
    await page.getByTestId('settings-disable-toggle').click();
    await expect(page.getByTestId('settings-disable-confirm')).toBeVisible();
    await page.screenshot({ path: 'docs/people-arc/restyle-a/hide-sheet-390.png' });
    await page.getByRole('button', { name: 'Keep it visible' }).click();
    await page.getByTestId('settings-signout-all').click();
    await expect(page.getByTestId('settings-signout-all-confirm')).toBeVisible();
    await page.screenshot({ path: 'docs/people-arc/restyle-a/signout-all-sheet-390.png' });
  });
  test('discard sheet', async ({ page }) => {
    await open(page, '/account/t/details');
    await page.getByLabel(/years/i).fill('9');
    await page.getByTestId('site-home-link').click();
    await expect(page.getByTestId('discard-keep')).toBeVisible();
    await page.screenshot({ path: 'docs/people-arc/restyle-a/discard-sheet-390.png' });
  });
  test('sign-up roles step', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await open(page, '/auth?mode=signup', { signedOut: true });
    await expect(page.getByTestId('signup-roles-step')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await solid(page, 'signup-roles-step');
    await page.screenshot({ path: 'docs/people-arc/restyle-a/signup-roles-390.png' });
    expect(errors.filter((e) => !/favicon|Failed to load resource|Extra attributes from the server|violates the following Content Security Policy|\[hydration\]|fetchPriority/.test(e)).map((e) => e.slice(0, 300))).toEqual([]);
  });
});
