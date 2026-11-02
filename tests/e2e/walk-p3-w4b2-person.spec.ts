import { test, expect, type Page } from '@playwright/test';
import { ORG, ORG_NAME, OrganiserFake, json } from './helpers/organiserFake';

// P3 W4b build 2 slice 1: the onboarding person screens 10-19 at the prototype's sizes (screen 20,
// personal email, was dropped by the owner on 2026-10-29), for the FILLED and the EMPTY persona. For each
// screen: NO PAGE SCROLL on the screen shell (scrollHeight <= clientHeight on .p3-ob-main and the
// shell itself) at 390x844, 360x640, 320x568 and at 130% text (--ts, the prototype's own simulator),
// nothing wider than the viewport, every control >= 44x44; the sheet and the toast boxes sit in the
// viewport at 390x844. P3 is mounted only with BOTH flags on:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-w4b2-person.spec.ts --project=chromium
// With organiserP3 off (the e2e gate's server today) each test skips itself, as the build 1 walk does.

const STEPS = ['name', 'photo', 'role', 'nat', 'langs', 'teach', 'levels', 'styles', 'years', 'about'] as const;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
];

async function open(page: Page, filled: boolean) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  // An empty persona (the brand-new prod shape) or a filled one; later routes win in Playwright.
  await page.route('**/rest/v1/rpc/my_dancer_edit_v1*', (r) =>
    json(r, { profile_id: 'p1', first_name: filled ? 'Sam' : null, avatar_url: filled ? 'https://img.example/a.png' : null, dance_role: filled ? 'Follower' : null, nationality: filled ? 'GB' : null, languages: filled ? ['English', 'Spanish', 'Polish'] : [], favorite_styles: [], achievements: [], other_roles: [] }));
  await page.route('**/rest/v1/rpc/my_role_intent_v1*', (r) => json(r, { roles: filled ? ['dancer', 'teacher'] : [], declined: [] }));
  // The prod teacher object today has NO levels_taught (review r1 S1), so the filled persona has no levels either.
  await page.route('**/rest/v1/rpc/my_role_details_v1*', (r) => json(r, { role: 'teacher', person_id: 'p1', details: filled ? { teaching_styles: ['Moderna', 'Bachata sensual'], years_teaching: 4, offers_private: false, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null, partner_role: null } : {} }));
  // The writes the empty walk makes (the fake's default answer [] is not a save result).
  await page.route('**/rest/v1/rpc/save_my_dancer_profile_v2*', (r) => json(r, { profile_id: 'p1', first_name: 'Sam', avatar_url: null, dance_role: null, nationality: null, languages: [], favorite_styles: [], achievements: [], other_roles: [] }));
  await page.route('**/rest/v1/rpc/save_my_role_v1*', (r) => json(r, { role: 'teacher', person_id: 'p1', details: {}, changed: true, changed_keys: [] }));
  await page.route('**/rest/v1/rpc/set_my_role_declined_v1*', (r) => json(r, { roles: [], declined: [], changed: true }));
  await page.route('**/functions/v1/storage-sign-upload*', (r) => json(r, { ok: true, publicUrl: 'https://img.example/n.png' }));
  await page.route('**/rest/v1/organiser_profiles*', (r) => json(r, { id: ORG, name: ORG_NAME, bio: null, organisation_category: 'Promoter', city_id: null }));
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }));
  await page.route('https://flagcdn.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="18"><rect width="24" height="18" fill="#888"/></svg>' }));
  await page.goto(`/account/p3/you/details?o=${ORG}`);
  const mounted = await page.getByTestId('p3-ob-title').waitFor({ timeout: 15_000 }).then(() => true, () => false);
  // Skip ONLY when the flag is off. With it on (e2e-smoke.yml sets it) an unmounted page is a FAILURE,
  // not a skip: scripts/check-p3-specs-not-skipped.mjs holds every P3 skip to this shape.
  test.skip(!mounted && process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', 'organiserP3 is off in this server: /account/p3 is not mounted');
  return fake;
}

/** The least answer that lets Continue on: the empty persona fills each screen only AFTER it was measured. */
async function answer(page: Page, at: string) {
  switch (at) {
    case 'name': return page.getByTestId('p3-ob-name').fill('Sam');
    case 'photo':
      await page.getByTestId('p3-ob-photo-file').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
      return expect(page.getByTestId('p3-ob-ava')).toHaveAttribute('data-has', 'true');
    case 'role': return page.getByTestId('p3-ob-role-Leader').click();
    case 'nat': return page.getByTestId('p3-ob-nat-GB').click();
    case 'teach': return page.getByTestId('p3-ob-teach-yes').click();
    case 'levels': return page.getByTestId('p3-ob-level-Beginner').click();
    case 'styles': return page.getByTestId('p3-ob-styles-Moderna').click();
    case 'years': return page.getByTestId('p3-ob-years').fill('0');
  }
}

/** Walk to a screen the way a person would: answer if Continue is off, then Continue (an untouched screen sends nothing). */
async function walkTo(page: Page, step: (typeof STEPS)[number]) {
  for (let i = 0; i < 20; i++) {
    const at = await page.getByTestId('p3-ob-shell').getAttribute('data-screen');
    if (at === step) return;
    if ((await page.getByTestId('p3-ob-continue').getAttribute('aria-disabled')) === 'true') await answer(page, at ?? '');
    await page.getByTestId('p3-ob-continue').click();
    await expect(page.getByTestId('p3-ob-shell')).not.toHaveAttribute('data-screen', at ?? '');
  }
  throw new Error(`never reached ${step}`);
}

async function fit(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.p3-ob') as HTMLElement;
    const main = document.querySelector('.p3-ob-main') as HTMLElement;
    const small: string[] = [];
    for (const el of Array.from(shell.querySelectorAll('button, input, textarea, [role="radio"], [role="checkbox"]'))) {
      const b = el.getBoundingClientRect();
      if (!b.width || (el as HTMLElement).classList.contains('p3-ob-sr')) continue;
      if (b.height < 43.5 || b.width < 43.5) small.push(`${el.tagName}.${(el as HTMLElement).className} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    return {
      mainScroll: main.scrollHeight - main.clientHeight,
      shellScroll: shell.scrollHeight - shell.clientHeight,
      wide: document.documentElement.scrollWidth - window.innerWidth,
      shellBottom: Math.round(shell.getBoundingClientRect().bottom),
      small,
    };
  });
}

for (const filled of [true, false]) {
  test.describe(`person screens, ${filled ? 'filled' : 'empty'} persona`, () => {
    for (const size of SIZES) {
      for (const ts of [1, 1.3]) {
        test(`no page scroll at ${size.width}x${size.height}, text ${ts * 100}%`, async ({ page }) => {
          await page.setViewportSize(size);
          await open(page, filled);
          await page.addStyleTag({ content: `.p3-ob, .p3-ob-layer { --ts: ${ts} !important; }` });
          const report: string[] = [];
          for (const step of STEPS) {
            await walkTo(page, step);
            await page.waitForTimeout(300); // the slide-in
            const r = await fit(page);
            report.push(`${step}: main ${r.mainScroll} shell ${r.shellScroll} wide ${r.wide}`);
            expect.soft(r.mainScroll, `${step} scrolls by ${r.mainScroll}px`).toBeLessThanOrEqual(0);
            expect.soft(r.shellScroll, `${step} shell scrolls`).toBeLessThanOrEqual(0);
            expect.soft(r.wide, `${step} wider than the viewport`).toBeLessThanOrEqual(0);
            expect.soft(r.shellBottom, `${step} shell taller than the viewport`).toBeLessThanOrEqual(size.height);
            expect.soft(r.small, `${step} small tap targets`).toEqual([]);
          }
          test.info().annotations.push({ type: 'fit', description: report.join(' | ') });
        });
      }
    }
  });
}

test('empty persona: Continue is off with its reason; a tap toasts it inside the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, false);
  await expect(page.getByTestId('p3-ob-continue')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('p3-ob-why')).toHaveText('Type your first name to continue.');
  // aria-disabled (not disabled) so the tap can say why; Playwright's actionability treats it as off.
  await page.getByTestId('p3-ob-continue').click({ force: true });
  const toast = await page.getByTestId('p3-ob-toast').boundingBox();
  expect(toast).not.toBeNull();
  expect(toast!.y).toBeGreaterThanOrEqual(0);
  expect(toast!.y + toast!.height).toBeLessThanOrEqual(844);
  expect(toast!.x).toBeGreaterThanOrEqual(0);
  expect(toast!.x + toast!.width).toBeLessThanOrEqual(390);
});

test('nationality sheet sits in the viewport and the page does not scroll when it opens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, true);
  await walkTo(page, 'nat');
  await expect(page.getByTestId('p3-ob-nat-GB').locator('img')).toHaveAttribute('src', 'https://flagcdn.com/gb.svg');
  await page.getByTestId('p3-ob-more').click();
  await expect(page.getByTestId('p3-ob-nat-row-GB-ENG').locator('img')).toHaveAttribute('src', 'https://flagcdn.com/gb-eng.svg');
  await page.waitForTimeout(400); // the slide-up (translateY 40px) settles before the box is measured
  const sheet = await page.getByTestId('p3-ob-sheet-nat').boundingBox();
  expect(sheet).not.toBeNull();
  expect(sheet!.y).toBeGreaterThanOrEqual(0);
  expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(844 + 1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('p3-ob-sheet-nat')).toHaveCount(0);
  await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'nat');
});
