import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { CITY, PHONE, json, openOrganiser } from './helpers/organiserFake';

// THROWAWAY WALK SCRIPT (S-MERGE), NOT in the test:e2e gate list. Screenshots at 390x844 of the screens
// S-ERR added plus the merged events list/Past section, against the route-mocked organiser fake. Run against
// the PRODUCTION build (support contact is a build-time env, so run it once per build):
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true [VITE_SUPPORT_WHATSAPP=... VITE_SUPPORT_EMAIL=...] npm run build
//   node scripts/_serve-build.mjs --port 4173 &
//   SMERGE_SUPPORT=on|off npx playwright test tests/e2e/walk-smerge.spec.ts --project=chromium

test.use({ viewport: PHONE });
test.describe.configure({ mode: 'serial' });

const OUT = 'docs/organiser-rebuild/walk-SMERGE';
mkdirSync(OUT, { recursive: true });
const SUPPORT = process.env.SMERGE_SUPPORT === 'on';
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

test(`(a/b) new page after organiser_invite_required, support ${SUPPORT ? 'configured' : 'not configured'}`, async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o', { noOrganiser: true });
  fake.refuse('create_organiser_profile_v1', 'organiser_invite_required', 5);
  await page.getByTestId('onboarding-create').click();
  await page.getByTestId('onboarding-create-name').fill('Salsa & Bachata Leeds');
  await page.getByTestId('onboarding-create-next').click();
  await page.getByTestId('onboarding-city-search').fill('Lon');
  await page.getByTestId('onboarding-city-option').first().click();
  await expect(page.getByTestId('onboarding-create-invite')).toBeVisible();
  // No retry: a retry cannot work.
  await expect(page.getByTestId('onboarding-create-retry')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /try again|retry/i })).toHaveCount(0);
  if (SUPPORT) {
    await expect(page.getByTestId('onboarding-create-support-whatsapp')).toBeVisible();
    await expect(page.getByTestId('onboarding-create-support-email')).toBeVisible();
  } else {
    await expect(page.getByTestId('onboarding-create-support-whatsapp')).toHaveCount(0);
    await expect(page.getByTestId('onboarding-create-support-email')).toHaveCount(0);
    await expect(page.getByTestId('onboarding-create-support-none')).toBeVisible();
  }
  await shot(page, SUPPORT ? 'a-new-page-invite-required-support' : 'b-new-page-invite-required-no-support');
  console.log('AUDIT a/b', JSON.stringify(await audit(page)));
  void CITY;
});

test('(c) team screen after team_full: the message, no Add', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o/team/add');
  fake.refuse('organiser_team_add_member_by_profile_v1', 'team_full', 5);
  await expect(page.getByTestId('org-page-team-add')).toBeVisible();
  const target = page.getByTestId('add-face').first().or(page.getByTestId('add-result').first());
  await target.click();
  // A server team_full on a page that read as under the cap: the mapped message shows (add-error); the faces stay tappable (walk finding).
  await expect(page.getByTestId('add-error')).toContainText('This team already has 20 people');
  await shot(page, 'c-team-full');
  console.log('AUDIT c', JSON.stringify(await audit(page)));
});

test('(d) redeem screen for team_full', async ({ page }) => {
  const fake = await openOrganiser(page, '/account/o');
  void fake;
  await page.route('**/rest/v1/rpc/redeem_organiser_invite_v1', (route) => json(route, { ok: false, reason: 'team_full' }));
  await page.goto(`/invite/${'ab'.repeat(32)}`);
  await page.getByTestId('invite-join').click();
  await expect(page.getByTestId('invite-title')).toHaveText('This team is full');
  await expect(page.getByTestId('invite-body')).toContainText('20 people');
  await expect(page.getByTestId('invite-retry')).toHaveCount(0);
  await expect(page.getByTestId('invite-home')).toBeVisible();
  await shot(page, 'd-redeem-team-full');
  console.log('AUDIT d', JSON.stringify(await audit(page)));
});

test('(e) events list and editors: ended series and past-dates-only series', async ({ page }) => {
  await openOrganiser(page, '/account/o/events', {}, (f) => {
    const org = f.organisers[0];
    f.addSeries(org, { id: SERIES_ENDED, name: 'Picnic Social', lifecycle_status: 'ended', format: 'recurring', category: 'party', default_start_date: '2026-08-02',
      recurrence_rule: { mode: 'weekly', weekdays: [0], end: { kind: 'until_date', date: '2026-09-06' } }, ended_on: '2026-09-06' } as never);
    f.addSeries(org, { id: SERIES_PAST, name: 'Summer Warehouse Night', lifecycle_status: 'live', format: 'one_off', category: 'party', default_start_date: '2026-09-12', recurrence_rule: null } as never);
    f.addSeries(org, { id: SERIES_ROLLING, name: 'Tuesday Social', lifecycle_status: 'live', format: 'recurring', category: 'party', default_start_date: '2026-08-04', recurrence_rule: null } as never);
  });
  await expect(page.getByTestId('org-event-list')).toBeVisible();
  await expect(page.getByTestId('org-events-past-toggle')).toBeVisible();
  await expect(page.getByTestId('org-events-past-toggle')).toHaveAttribute('aria-expanded', 'false');
  await shot(page, 'e1-events-list-past-collapsed');
  await page.getByTestId('org-events-past-toggle').click();
  await expect(page.getByTestId('org-events-past')).toContainText('Ended');
  await expect(page.getByTestId('org-events-past')).toContainText('Finished');
  await expect(page.getByTestId('org-events-past')).toContainText('Nothing coming up');
  await shot(page, 'e2-events-list-past-open');
  console.log('AUDIT e list', JSON.stringify(await audit(page)));
  for (const [id, name] of [[SERIES_ENDED, 'e3-event-ended'], [SERIES_PAST, 'e4-event-past-dates-only'], [SERIES_ROLLING, 'e5-event-nothing-coming-up']] as const) {
    await page.goto(`/account/o/events/${id}`);
    await expect(page.getByTestId('org-page-event')).toBeVisible();
    await expect(page.getByTestId('org-row-type')).toHaveCount(0);
    await expect(page.getByText(/^Type$/)).toHaveCount(0);
    await shot(page, name);
    console.log('AUDIT', name, JSON.stringify(await audit(page)));
  }
});
