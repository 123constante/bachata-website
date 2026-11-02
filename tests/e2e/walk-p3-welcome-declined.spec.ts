import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { OrganiserFake, PHONE, expectNoHorizontalScroll, json, type FakeOptions } from './helpers/organiserFake';

// P3 Welcome x declined requests at 390x844, light and dark, on the organiser fake (same mocked API and flags as
// walk-p3-w4b-onboarding.spec.ts: VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true).
// The fake's clock is 2026-10-08 11:00Z. Declined rows carry `decision_note`, as prod's 'mine' read does for
// the caller's own declined rows (docs/review/pr-1236-r1.md).

test.use({ viewport: PHONE });
const OUT = process.env.P3_WALK_DIR ?? 'test-results/p3-declined-walk';
mkdirSync(OUT, { recursive: true });

const C1 = 'a0000000-0000-4000-8000-0000000000c1';
const C2 = 'a0000000-0000-4000-8000-0000000000c2';
const row = (id: string, organiser: string, name: string, status: string, created: string, resolved: string | null, note?: string | null) =>
  ({ request_id: id, organiser_id: organiser, organiser_name: name, status, created_at: created, resolved_at: resolved, ...(note === undefined ? {} : { decision_note: note }) });

type Shape = 'none' | 'note' | 'no_note' | 'old' | 'two' | 'granted' | 'read_failed';

const SHAPES: Record<Shape, Record<string, unknown>[]> = {
  none: [],
  note: [row('r1', C1, 'Ritmo Latino Leeds', 'declined', '2026-10-01T10:00:00Z', '2026-10-05T09:00:00Z', 'We already have an owner for this page')],
  no_note: [row('r1', C1, 'Ritmo Latino Leeds', 'declined', '2026-10-01T10:00:00Z', '2026-10-05T09:00:00Z', null)],
  old: [row('r1', C1, 'Ritmo Latino Leeds', 'declined', '2026-09-01T10:00:00Z', '2026-09-07T10:00:00Z', 'Too long ago to show')],
  two: [
    row('r1', C1, 'Ritmo Latino Leeds', 'declined', '2026-10-01T10:00:00Z', '2026-10-05T09:00:00Z', 'We already have an owner for this page'),
    row('r2', C2, 'Ritmo Manchester', 'declined', '2026-10-02T10:00:00Z', '2026-10-06T09:00:00Z', null),
  ],
  // Declined, then asked again and granted: the newest row per page wins, so no card.
  granted: [
    row('r1', C1, 'Ritmo Latino Leeds', 'declined', '2026-10-01T10:00:00Z', '2026-10-02T09:00:00Z', 'Wrong email'),
    row('r2', C1, 'Ritmo Latino Leeds', 'granted', '2026-10-03T10:00:00Z', '2026-10-04T09:00:00Z', null),
  ],
  read_failed: [],
};

async function open(page: Page, shape: Shape) {
  const opts: FakeOptions = { noOrganiser: true, dancerProfile: 'complete' };
  const fake = new OrganiserFake(opts);
  fake.myRequests.push(...SHAPES[shape]);
  if (shape === 'read_failed') fake.refuse('list_organiser_access_requests_v1', 'permission_denied', 20);
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (route) =>
    json(route, { is_admin: false, person: { missing: [] }, organisers: [] }));
  await page.goto('/account/p3');
  const mounted = await page.getByTestId('p3-shell').waitFor({ timeout: 15_000 }).then(() => true, () => false);
  // Skip ONLY when the flag is off (scripts/check-p3-specs-not-skipped.mjs holds every P3 skip to this shape).
  test.skip(!mounted && process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', 'organiserP3 is off in this server: /account/p3 is not mounted');
  await expect(page.getByTestId('p3-ob-title')).toContainText('Welcome');
  return fake;
}

/** Every visible text's contrast against the first opaque background up its ancestors; every control's box. */
async function audit(page: Page) {
  return page.evaluate(() => {
    const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ground = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        if (c.length >= 3 && (c.length === 3 || c[3] > 0.95)) return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    let minContrast = 99;
    let worst = '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim()) continue;
      const box = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (!box.width || !box.height || st.visibility === 'hidden' || el.closest('[aria-hidden="true"], .sr-only, [disabled], [aria-disabled="true"]')) continue;
      // Text under an open sheet's scrim is dimmed on purpose.
      if (document.querySelector('[role="dialog"]') && !el.closest('[role="dialog"]')) continue;
      const fg = rgb(st.color).slice(0, 3);
      const [a, b] = [lum(fg), lum(ground(el))].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      if (ratio < minContrast) { minContrast = ratio; worst = n.textContent.trim().slice(0, 40); }
    }
    const scope = document.querySelector('[role="dialog"]') ?? document.body;
    const small = [...scope.querySelectorAll('button, a[href], input, textarea')]
      // Only what a finger can reach: on screen and on top at its centre (the site's own footer sits under the fixed P3 frame).
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || e.closest('.sr-only') || r.bottom <= 0 || r.top >= innerHeight) return false;
        const hit = document.elementFromPoint(r.left + r.width / 2, Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
        return !!hit && (hit === e || e.contains(hit));
      })
      .filter((e) => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; })
      .map((e) => `${e.getAttribute('data-testid') ?? e.tagName}:${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
    return { minContrast: Math.round(minContrast * 100) / 100, worst, small, width: document.documentElement.scrollWidth };
  });
}

async function inViewport(page: Page, testId: string) {
  const b = await page.getByTestId(testId).boundingBox();
  expect(b, `${testId} has a box`).not.toBeNull();
  const box = b as NonNullable<typeof b>;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width + 0.5);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height + 0.5);
}

async function check(page: Page, name: string) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  const a = await audit(page);
  console.log(`[declined] ${name}: contrast ${a.minContrast} (${a.worst}), under-44 ${a.small.length} ${a.small.join(' ')}, width ${a.width}`);
  expect(a.minContrast, `${name}: lowest contrast "${a.worst}"`).toBeGreaterThanOrEqual(4.5);
  expect(a.small, `${name}: controls under 44px`).toEqual([]);
  expect(a.width).toBeLessThanOrEqual(PHONE.width);
  await expectNoHorizontalScroll(page);
  await inViewport(page, 'p3-ob-continue');
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

/** The card's copy points at controls that are on screen: no "note" as an instruction, Find your page is the button. */
async function expectCopyNamesOnlyScreenControls(page: Page) {
  const next = page.getByTestId('p3-ob-declined-next');
  await expect(next).toContainText('Find your page');
  await expect(next).not.toContainText(/\bnote\b/i);
  await expect(page.getByTestId('p3-ob-continue')).toHaveText('Find your page');
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('no requests: no declined card', async ({ page }) => {
      await open(page, 'none');
      await expect(page.getByTestId('p3-ob-declined')).toHaveCount(0);
      await check(page, `${scheme}-1-none`);
    });

    test('one declined with a note: date and note shown, card inside the phone', async ({ page }) => {
      await open(page, 'note');
      await expect(page.getByTestId('p3-ob-declined-row')).toHaveCount(1);
      await expect(page.getByTestId('p3-ob-declined-row')).toContainText('Ritmo Latino Leeds said no on');
      await expect(page.getByTestId('p3-ob-declined-row')).toContainText('5 Oct');
      await expect(page.getByTestId('p3-ob-declined-row')).toContainText('We already have an owner for this page');
      await inViewport(page, 'p3-ob-declined');
      await expectCopyNamesOnlyScreenControls(page);
      await check(page, `${scheme}-2-note`);
      // Tapping Find your page opens the find step.
      await page.getByTestId('p3-ob-continue').click();
      await expect(page.getByTestId('p3-ob-find-q')).toBeVisible();
    });

    test('one declined without a note: the date, no note line', async ({ page }) => {
      await open(page, 'no_note');
      await expect(page.getByTestId('p3-ob-declined-row')).toContainText('said no on');
      await expect(page.getByTestId('p3-ob-declined-row')).not.toContainText('Their note');
      await inViewport(page, 'p3-ob-declined');
      await expectCopyNamesOnlyScreenControls(page);
      await check(page, `${scheme}-3-no-note`);
    });

    test('declined 31 days ago: card hidden', async ({ page }) => {
      await open(page, 'old');
      await expect(page.getByTestId('p3-ob-declined')).toHaveCount(0);
      await check(page, `${scheme}-4-old`);
    });

    test('two declined: both rows, one next line', async ({ page }) => {
      await open(page, 'two');
      await expect(page.getByTestId('p3-ob-declined-row')).toHaveCount(2);
      await expect(page.getByTestId('p3-ob-declined')).toContainText('Ritmo Manchester said no on');
      await expect(page.getByTestId('p3-ob-declined')).toContainText('We already have an owner for this page');
      await expect(page.getByTestId('p3-ob-declined-next')).toHaveCount(1);
      await inViewport(page, 'p3-ob-declined');
      await expectCopyNamesOnlyScreenControls(page);
      await check(page, `${scheme}-5-two`);
    });

    test('declined then granted: no card', async ({ page }) => {
      await open(page, 'granted');
      await expect(page.getByTestId('p3-ob-declined')).toHaveCount(0);
      await check(page, `${scheme}-6-granted`);
    });

    test('requests read failed: no card, Find your page still works', async ({ page }) => {
      await open(page, 'read_failed');
      await expect(page.getByTestId('p3-ob-declined')).toHaveCount(0);
      await check(page, `${scheme}-7-read-failed`);
      await page.getByTestId('p3-ob-continue').click();
      await expect(page.getByTestId('p3-ob-find-q')).toBeVisible();
    });
  });
}
