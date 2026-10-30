import { test, expect, type Page } from '@playwright/test';
import { ORG, ORG_NAME, OrganiserFake, json } from './helpers/organiserFake';

// P3 W4b build 2 slices 2+3: the organiser/page screens 1-9 and Review at the prototype's sizes, for a
// FILLED page (a held E.164 number, category, link, logo: 40 of 49 live pages) and an EMPTY one (no number,
// no category / link / logo), plus the no-page path (Welcome, Find, Create name, Create city). For each
// screen: NO PAGE SCROLL on the screen shell (scrollHeight <= clientHeight on .p3-ob-main and the shell)
// at 390x844, 360x640, 320x568 and at 130% text (--ts), nothing wider than the viewport, every control
// >= 44x44; the claim, Review and Settings sheets sit in the viewport at 390x844. P3 mounts only with BOTH flags:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-w4b2-page.spec.ts --project=chromium
// With organiserP3 off (the e2e gate's server today) each test skips itself, as the slice 1 walk does.

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 320, height: 568 },
];
type Persona = 'filled' | 'empty' | 'none';

/** The document is server-rendered, then the client route takes over (a second navigation): wait for both. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  return page.getByTestId('p3-ob-title').waitFor({ timeout: 15_000 }).then(() => true, () => false);
}

async function open(page: Page, persona: Persona, at = '') {
  const fake = new OrganiserFake({ noOrganiser: persona === 'none' });
  await fake.install(page);
  const filled = persona === 'filled';
  await page.route('**/rest/v1/rpc/get_organiser_contact_settings_v1*', (r) =>
    json(r, { contact_phone: filled ? '+447700900123' : null, contact_email: null, show_phone_publicly: true, show_email_publicly: false, claim_email: null }));
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, {
      v: 1, gate_on: false, is_admin: false, complete: false,
      person: { complete: false, missing: filled ? ['dj_answer'] : ['photo', 'nationality', 'teach_answer', 'dj_answer'] },
      organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: false, missing: filled ? [] : ['org_logo', 'org_link', 'org_category', 'contact_confirm'], about: { done: false, skipped: false } }],
    }));
  await page.route('**/rest/v1/rpc/confirm_organiser_contact_v1*', (r) => json(r, { ok: true, changed: true }));
  await page.route('**/rest/v1/rpc/organiser_profile_update_p5_v1*', (r) => json(r, { organiser_id: ORG, changed_keys: [], profile: {} }));
  await page.route('**/rest/v1/rpc/search_cities*', (r) =>
    json(r, [
      { city_id: 'c1', display_name: 'Harrogate, United Kingdom' }, { city_id: 'c2', display_name: 'Harlow, United Kingdom' },
      { city_id: 'c3', display_name: 'Harwich, United Kingdom' }, { city_id: 'c4', display_name: 'Harpenden, United Kingdom' },
    ]));
  await page.route(`**/rest/v1/organiser_profiles?*id=eq.${ORG}*`, (r) =>
    json(r, { id: ORG, name: ORG_NAME, avatar_url: filled ? 'https://img.example/l.png' : null, website: filled ? 'https://ritmo.example' : null, instagram: filled ? 'ritmo' : null, socials: null, organisation_category: filled ? 'Promoter' : null, city_id: null }));
  await page.route('**/functions/v1/storage-sign-upload*', (r) => json(r, { ok: true, publicUrl: 'https://img.example/n.png' }));
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }));
  await page.goto(`/account/p3/start${persona === 'none' ? '' : `?o=${ORG}`}${at ? `${persona === 'none' ? '?' : '&'}at=${at}` : ''}`);
  const mounted = await settle(page);
  test.skip(!mounted, 'organiserP3 is off in this server: /account/p3 is not mounted');
  return fake;
}

/** The least answer that lets Continue on: each screen is measured BEFORE it is answered. */
async function answer(page: Page, at: string) {
  switch (at) {
    case 'contact-phone': return page.getByTestId('p3-ob-phone').fill('07700 900123');
    case 'whatsapp': return page.getByTestId('p3-ob-wa-no').click();
    case 'cat': return page.getByTestId('p3-ob-cat-Promoter').click();
    case 'link': return page.getByTestId('p3-ob-link').fill('@ritmo');
    case 'logo':
      await page.getByTestId('p3-ob-logo-file').setInputFiles({ name: 'l.png', mimeType: 'image/png', buffer: PNG });
      return expect(page.getByTestId('p3-ob-logo')).toHaveAttribute('data-has', 'true');
    case 'create-name': return page.getByTestId('p3-ob-page-name').fill('Bachata Nights Harrogate');
  }
}

async function fit(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.p3-ob') as HTMLElement;
    const main = document.querySelector('.p3-ob-main') as HTMLElement;
    const small: string[] = [];
    for (const el of Array.from(shell.querySelectorAll('button, input, textarea, a, [role="radio"], [role="checkbox"]'))) {
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

const PATHS: Record<Persona, string[]> = {
  filled: ['welcome', 'contact', 'whatsapp', 'cat', 'link', 'logo'],
  empty: ['welcome', 'contact-phone', 'whatsapp', 'cat', 'link', 'logo'],
  none: ['welcome', 'find', 'create-name', 'create-city'],
};

async function measure(page: Page, step: string, size: { height: number }, report: string[]) {
  await page.waitForTimeout(300); // the slide-in
  const r = await fit(page);
  report.push(`${step}: main ${r.mainScroll} shell ${r.shellScroll} wide ${r.wide}`);
  expect.soft(r.mainScroll, `${step} scrolls by ${r.mainScroll}px`).toBeLessThanOrEqual(0);
  expect.soft(r.shellScroll, `${step} shell scrolls`).toBeLessThanOrEqual(0);
  expect.soft(r.wide, `${step} wider than the viewport`).toBeLessThanOrEqual(0);
  expect.soft(r.shellBottom, `${step} shell taller than the viewport`).toBeLessThanOrEqual(size.height);
  expect.soft(r.small, `${step} small tap targets`).toEqual([]);
}

for (const persona of ['filled', 'empty', 'none'] as const) {
  test.describe(`page screens, ${persona}`, () => {
    for (const size of SIZES) {
      for (const ts of [1, 1.3]) {
        test(`no page scroll at ${size.width}x${size.height}, text ${ts * 100}%`, async ({ page }) => {
          await page.setViewportSize(size);
          await open(page, persona);
          await page.addStyleTag({ content: `.p3-ob, .p3-ob-layer { --ts: ${ts} !important; }` });
          const report: string[] = [];
          for (const step of PATHS[persona]) {
            await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', step);
            if (step === 'find') {
              await measure(page, 'find (empty)', size, report);
              await page.getByTestId('p3-ob-find-q').fill('Ritmo');
              await expect(page.getByTestId('p3-ob-find-results').locator('.p3-ob-row').first()).toBeVisible();
            }
            if (step === 'create-city') {
              await page.getByTestId('p3-ob-city-q').fill('Har');
              await expect(page.getByTestId('p3-ob-city-c1')).toBeVisible();
            }
            await measure(page, step, size, report);
            if (step === 'create-city') break;
            if (step === 'find') {
              await page.getByTestId('p3-ob-continue').click();
              continue;
            }
            if ((await page.getByTestId('p3-ob-continue').getAttribute('aria-disabled')) === 'true') await answer(page, step);
            await page.getByTestId('p3-ob-continue').click();
            await expect(page.getByTestId('p3-ob-shell')).not.toHaveAttribute('data-screen', step);
          }
          if (persona !== 'none') {
            await page.goto(`/account/p3/start?o=${ORG}&at=review`);
            await settle(page);
            await page.addStyleTag({ content: `.p3-ob, .p3-ob-layer { --ts: ${ts} !important; }` });
            await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'review');
            await measure(page, 'review', size, report);
          }
          test.info().annotations.push({ type: 'fit', description: report.join(' | ') });
        });
      }
    }
  });
}

async function inViewport(page: Page, testId: string, w: number, h: number) {
  await page.waitForTimeout(400); // the slide-up settles before the box is measured
  const box = await page.getByTestId(testId).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(h + 1);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(w + 1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
}

test('claim sheet, Review sheet, Settings sheet and the toast sit in the viewport at 390x844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'none', 'find');
  await page.getByTestId('p3-ob-find-q').fill('Ritmo');
  await page.getByTestId('p3-ob-find-results').locator('.p3-ob-row').first().click();
  await inViewport(page, 'p3-ob-sheet-claim', 390, 844);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('p3-ob-sheet-claim')).toHaveCount(0);
  await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'find');

  await open(page, 'empty', 'review');
  await page.getByTestId('p3-ob-review-all').click();
  await inViewport(page, 'p3-ob-sheet-review', 390, 844);
  await page.keyboard.press('Escape');
  await page.getByTestId('p3-ob-continue').click({ force: true }).catch(() => undefined);

  await open(page, 'empty', 'cat');
  await page.getByTestId('p3-ob-continue').click({ force: true });
  await inViewport(page, 'p3-ob-toast', 390, 844);

  await open(page, 'filled');
  await page.getByTestId('p3-ob-notyou').click();
  await inViewport(page, 'p3-ob-sheet-settings', 390, 844);
  await page.getByTestId('p3-ob-dark').click();
  await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-theme', 'dark');
});
