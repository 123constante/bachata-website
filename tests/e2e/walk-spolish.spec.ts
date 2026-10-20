import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { CITY, PHONE, json, openOrganiser } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (S-POLISH), NOT in the test:e2e gate list. Screenshots at 390x844 of the screens
// S-ERR added plus the merged events list/Past section, against the route-mocked organiser fake. Run against
// the PRODUCTION build (support contact is a build-time env, so run it once per build):
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true [VITE_SUPPORT_WHATSAPP=... VITE_SUPPORT_EMAIL=...] npm run build
//   node scripts/_serve-build.mjs --port 4173 &
//   SPOLISH_SUPPORT=on|off npx playwright test tests/e2e/walk-spolish.spec.ts --project=chromium

test.use({ viewport: PHONE });
test.describe.configure({ mode: 'serial' });

const OUT = 'docs/organiser-rebuild/walk-SPOLISH';
mkdirSync(OUT, { recursive: true });
const SUPPORT = process.env.SPOLISH_SUPPORT === 'on';
const SERIES_ENDED = 'b0000000-0000-4000-8000-0000000000e1';
const SERIES_PAST = 'b0000000-0000-4000-8000-0000000000e2';
const SERIES_ROLLING = 'b0000000-0000-4000-8000-0000000000e3';

const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });

/** Every interactive control must be at least 44px in both directions and inside the 390 viewport. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const bad: string[] = [];
    const sel = 'a[href], button, [role="button"], input, select, textarea';
    // Only the screen under walk: the organiser shell, or the invite card's main area (the site header/footer are not ours).
    const root = document.querySelector('.org-theme') ?? document.querySelector('main') ?? document.body;
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const id = el.getAttribute('data-testid') ?? el.tagName + ':' + (el.textContent ?? '').trim().slice(0, 24);
      if (r.height < 43.5 || r.width < 43.5) bad.push(`small ${id} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (r.right > 390.5 || r.left < -0.5) bad.push(`clipped ${id} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    if (document.documentElement.scrollWidth > 391) bad.push(`horizontal scroll ${document.documentElement.scrollWidth}`);
    return bad;
  });
}


const title = (page: Page) => page.getByTestId('onboarding-sheet-title');
async function toRefusal(page: Page, code: string, name: string) {
  const fake = await openOrganiser(page, '/account/o', { noOrganiser: true });
  fake.refuse('create_organiser_profile_v1', code, 5);
  await page.getByTestId('onboarding-create').click();
  await page.getByTestId('onboarding-create-name').fill(name);
  await page.getByTestId('onboarding-create-next').click();
  await page.getByTestId('onboarding-city-search').fill('Lon');
  await page.getByTestId('onboarding-city-option').first().click();
  await expect(page.getByTestId('onboarding-create-refusal')).toBeVisible();
}

test('(a) invite required: header is not City', async ({ page }) => {
  await toRefusal(page, 'organiser_invite_required', 'Salsa & Bachata Leeds');
  await expect(title(page)).toHaveText('New organiser page');
  await shot(page, 'a-invite-required');
  console.log('AUDIT a', JSON.stringify(await audit(page)));
});
test('(b1) name taken: header', async ({ page }) => {
  await toRefusal(page, 'organiser_name_taken', 'Ritmo');
  await expect(title(page)).toHaveText('New organiser page');
  await shot(page, 'b1-name-taken');
});
test('(b2) cap: header', async ({ page }) => {
  await toRefusal(page, 'draft_limit_reached', 'Nova');
  await expect(title(page)).toHaveText('New organiser page');
  await shot(page, 'b2-cap');
});

test('(c1) team_full from the server: faces disabled, message visible, invite row stays', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/team/add');
  fake.refuse('organiser_team_add_member_by_profile_v1', 'team_full', 5);
  await expect(page.getByTestId('org-page-team-add')).toBeVisible();
  await page.getByTestId('add-face').first().click();
  await expect(page.getByTestId('add-error')).toContainText('This team already has 20 people');
  for (const b of await page.getByTestId('add-face').all()) await expect(b).toBeDisabled();
  await expect(page.getByTestId('add-invite')).toBeEnabled();
  await shot(page, 'c1-team-full-after-server');
  console.log('AUDIT c1', JSON.stringify(await audit(page)));
});
test('(c2) page already at 20 members', async ({ page }) => {
  await openOrganiser(page, '/account/o/team/add', {}, (f) => {
    const org = f.organisers[0];
    for (let i = org.team.length; i < 20; i++) org.team.push({ user_id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`, member_role: 'manager', is_primary: false, email: `m${i}@x.example`, display_name: `Member ${i}` });
  });
  await expect(page.getByTestId('add-full')).toBeVisible();
  for (const b of await page.getByTestId('add-face').all()) await expect(b).toBeDisabled();
  await expect(page.getByTestId('add-invite')).toBeEnabled();
  await shot(page, 'c2-team-at-20');
  console.log('AUDIT c2', JSON.stringify(await audit(page)));
});

test('(d) events list Past collapsed and open', async ({ page }) => {
  await openOrganiser(page, '/account/o/events', {}, (f) => {
    const org = f.organisers[0];
    f.addSeries(org, { id: SERIES_ENDED, name: 'Picnic Social', lifecycle_status: 'ended', format: 'recurring', category: 'party', default_start_date: '2026-08-02',
      recurrence_rule: { mode: 'weekly', weekdays: [0], end: { kind: 'until_date', date: '2026-09-06' } }, ended_on: '2026-09-06' } as never);
    f.addSeries(org, { id: SERIES_PAST, name: 'Summer Warehouse Night', lifecycle_status: 'live', format: 'one_off', category: 'party', default_start_date: '2026-09-12', recurrence_rule: null } as never);
    f.addSeries(org, { id: SERIES_ROLLING, name: 'Tuesday Social', lifecycle_status: 'live', format: 'recurring', category: 'party', default_start_date: '2026-08-04', recurrence_rule: null } as never);
  });
  const toggle = page.getByTestId('org-events-past-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const before = await toggle.boundingBox();
  await shot(page, 'd1-past-collapsed');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.waitForTimeout(500);
  const after = await toggle.boundingBox();
  expect(after!.height).toBe(before!.height);
  const icon = await toggle.locator('svg').boundingBox();
  console.log('CHEVRON', JSON.stringify({ icon, toggle: after }));
  await shot(page, 'd2-past-open');
});
