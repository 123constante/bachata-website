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

async function open(page: Page, path: string, o: { signedOut?: boolean; roles?: typeof ROLES } = {}) {
  const fake = new OrganiserFake({ noOrganiser: true, signedOut: o.signedOut });
  await fake.install(page);
  await page.route('**/rest/v1/rpc/_my_dancer_profile_id_v1', (r) => json(r, 'persona-1'));
  await page.route('**/rest/v1/rpc/profile_complete_v1', (r) => json(r, true));
  await page.route('**/rest/v1/rpc/dancer_area_gate_v1', (r) => json(r, { open: false, allowed: false }));
  await page.route('**/rest/v1/rpc/my_roles_v1', (r) => json(r, o.roles ?? ROLES));
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

// `crumbs`: the screen sits under GlobalLayout breadcrumbs, whose Home crumb is its one way home (F2).
const DJ_HELD = ROLES.map((r) => ({ ...r, active: r.active || r.role === 'dj', complete: r.complete || r.role === 'dj' }));
const ROUTES: { name: string; path: string; ready: string; primary?: string; signedOut?: boolean; crumbs?: boolean; roles?: typeof ROLES }[] = [
  { name: 'account-home', path: '/account/dancer', ready: 'account-areas-row', crumbs: true },
  { name: 'account-settings', path: '/account/settings', ready: 'settings-signout', crumbs: true },
  { name: 'account-delete', path: '/account/settings/delete', ready: 'delete-confirm', crumbs: true },
  { name: 'your-areas', path: '/account/areas', ready: 'area-row-dj' },
  { name: 'teacher-area', path: '/account/t', ready: 'completeness-line', primary: 'edit-details' },
  { name: 'teacher-details', path: '/account/t/details', ready: 'save-details', primary: 'save-details' },
  { name: 'dj-area', path: '/account/dj', ready: 'completeness-line', primary: 'edit-details', roles: DJ_HELD },
  { name: 'dj-details', path: '/account/dj/details', ready: 'save-details', primary: 'save-details', roles: DJ_HELD },
];

for (const vp of [{ width: 390, height: 844, tag: '390' }, { width: 1280, height: 800, tag: '1280' }]) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'reduce' });
    for (const r of ROUTES) {
      test(r.name, async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('pageerror', (e) => errors.push(String(e)));
        await open(page, r.path, { roles: r.roles });
        await expect(page.getByTestId(r.ready)).toBeVisible();
        // One way home per screen (F2): the breadcrumb's Home under GlobalLayout, else the Ember link.
        if (r.crumbs) {
          await expect(page.getByTestId('site-home-link')).toHaveCount(0);
          await expect(page.locator('nav[aria-label="breadcrumb"]').getByText('Home', { exact: true }).first()).toBeVisible();
        } else {
          await expect(page.getByTestId('site-home-link')).toHaveCount(1);
        }
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
  // F1: a dancer-only account opening the teacher area by link sees the same words and action as Your areas.
  test('not-added teacher opening /account/t', async ({ page }) => {
    const dancerOnly = ROLES.map((r) => ({ ...r, active: r.role === 'dancer' }));
    await open(page, '/account/t', { roles: dancerOnly });
    await expect(page.getByTestId('area-status-teacher')).toHaveText('Not added');
    await expect(page.getByTestId('completeness-line')).toHaveCount(0);
    await expect(page.getByTestId('edit-details')).toHaveCount(0);
    await page.screenshot({ path: 'docs/people-arc/restyle-a/teacher-not-added-390.png' });
    await page.getByTestId('area-action-ask').click();
    await expect(page.getByRole('button', { name: 'Skip for now' })).toBeVisible();
    await page.goto('/account/t/details');
    await expect(page).toHaveURL(/\/account\/t$/);
  });
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
  // Review B3: after Save at the end of the form the page sits on the orange footer; the toast must read over it.
  test('saved toast over the footer', async ({ page }) => {
    await open(page, '/account/t/details');
    await page.route('**/rest/v1/rpc/save_my_role_v1', (r) => json(r, { role: 'teacher', person_id: 'p1', changed: true, changed_keys: ['years_teaching'], details: { ...TEACHER, years_teaching: 9 } }));
    await page.getByLabel(/years/i).fill('9');
    await page.getByTestId('save-details').click();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const pill = page.getByTestId('saved-toast').locator('span').first();
    await expect(pill).toBeVisible();
    const ratio = await pill.evaluate((el) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const cs = getComputedStyle(el);
      const bg = rgb(cs.backgroundColor);
      if (bg.length === 4 && bg[3] < 1) return 0; // translucent: what is under it decides, so it fails
      const [a, b] = [lum(bg), lum(rgb(cs.color))].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: 'docs/people-arc/restyle-a/saved-toast-390.png' });
  });
  // Review B4: browser Back on the real (data) router asks first; Keep editing keeps the edits.
  test('browser back with edits asks first', async ({ page }) => {
    await open(page, '/account/t');
    await page.getByTestId('edit-details').click();
    await page.getByLabel(/years/i).fill('9');
    await page.evaluate(() => window.history.back());
    await expect(page.getByTestId('discard-keep')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/account/t/details');
    await page.screenshot({ path: 'docs/people-arc/restyle-a/discard-back-390.png' });
    await page.getByTestId('discard-keep').click();
    await expect(page.getByLabel(/years/i)).toHaveValue('9');
    await page.evaluate(() => window.history.back());
    await page.getByTestId('discard-leave').click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/account/t');
  });
  test('sign-up roles step', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await open(page, '/auth?mode=signup', { signedOut: true });
    await expect(page.getByTestId('signup-roles-step')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Review S6: the role buttons get the Ember focus ring from the keyboard, like every other slice-A control.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.hasAttribute('aria-pressed') ?? false)) break;
    }
    const ring = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement as Element); return { style: cs.outlineStyle, width: cs.outlineWidth }; });
    expect(ring).toEqual({ style: 'solid', width: '2px' });
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await solid(page, 'signup-roles-step');
    await page.screenshot({ path: 'docs/people-arc/restyle-a/signup-roles-390.png' });
    expect(errors.filter((e) => !/favicon|Failed to load resource|Extra attributes from the server|violates the following Content Security Policy|\[hydration\]|fetchPriority/.test(e)).map((e) => e.slice(0, 300))).toEqual([]);
  });
});
