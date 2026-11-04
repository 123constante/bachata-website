import { test, expect, type Page } from '@playwright/test';
import { ORG, ORG_NAME, OrganiserFake, json } from './helpers/organiserFake';

// New event kind picker (brief p3-create-event-fix-2): all nine tiles at 390x844, 360x740 and 430x932. A
// "Coming soon" pill must sit BELOW the tile's description in normal flow: their boxes never overlap, the pill
// is not absolutely positioned, nothing in a tile is clipped by the tile, every tile is >= 44x44 and the page is
// never wider than the viewport. Read-only: every RPC is fulfilled by the fake. P3 mounts only with BOTH flags:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-create-kinds.spec.ts --project=chromium
// Without VITE_ENABLE_ORGANISER_P3=true (the e2e gate's server today) each test skips at once, so in that gate
// this spec checks nothing. Screenshots are written only with WALK_SHOTS=1, so a routine run never rewrites
// the committed walk pictures.

const SHOTS = 'docs/design/p3-create-event/walk';
const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
  { width: 430, height: 932 },
];

async function open(page: Page, path = `/account/p3/create?o=${ORG}`, ready = 'p3-new-kinds') {
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, {
      v: 1, gate_on: false, is_admin: false, complete: true,
      person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }],
    }));
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const mounted = await page.getByTestId(ready).waitFor({ timeout: 15_000 }).then(() => true, () => false);
  // In the CI geometry step (e2e-smoke.yml sets P3_GEOMETRY_REQUIRED and VITE_ENABLE_ORGANISER_P3) a missing mount is a FAILURE, never a skip (r4).
  if (process.env.P3_GEOMETRY_REQUIRED) expect(mounted, '/account/p3/create must mount in CI').toBe(true);
  test.skip(!mounted && process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', 'organiserP3 is off in this server: /account/p3/create is not mounted');
  // the slide-in: measure only once no animation is still running
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), undefined, { timeout: 5_000 }).catch(() => undefined);
}

for (const size of SIZES) {
  test(`kind picker tiles at ${size.width}x${size.height}: pill below the text, nothing clipped`, async ({ page }) => {
    if (process.env.P3_GEOMETRY_REQUIRED) expect(process.env.VITE_ENABLE_ORGANISER_P3, 'e2e-smoke.yml must set VITE_ENABLE_ORGANISER_P3=true').toBe('true');
    test.skip(process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', 'organiserP3 is off: /account/p3 is not mounted');
    await page.setViewportSize(size);
    await open(page);
    const r = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="p3-new-kinds"] .p3-new-kind'));
      const problems: string[] = [];
      let pills = 0;
      for (const tile of tiles) {
        const id = tile.dataset.testid ?? '?';
        const t = tile.getBoundingClientRect();
        if (t.width < 43.5 || t.height < 43.5) problems.push(`${id} tap ${Math.round(t.width)}x${Math.round(t.height)}`);
        const kids = Array.from(tile.children) as HTMLElement[];
        for (const k of kids) {
          const b = k.getBoundingClientRect();
          if (b.top < t.top - 0.5 || b.bottom > t.bottom + 0.5 || b.left < t.left - 0.5 || b.right > t.right + 0.5) problems.push(`${id} ${k.className} outside the tile`);
          // a child's own content spilling out of its box (e.g. a fixed-height pill whose text wrapped); 2px absorbs rounding
          if (k.scrollHeight > k.clientHeight + 2 || k.scrollWidth > k.clientWidth + 2) problems.push(`${id} ${k.className} content overflows its box`);
        }
        const pill = tile.querySelector<HTMLElement>('.p3-tag');
        if (!pill) continue;
        pills++;
        const desc = tile.querySelector<HTMLElement>('.p3-new-kind-s')!;
        if (getComputedStyle(pill).position === 'absolute' || getComputedStyle(pill).position === 'fixed') problems.push(`${id} pill is out of flow`);
        if (kids.indexOf(pill) < kids.indexOf(desc)) problems.push(`${id} pill comes before the description`);
        const p = pill.getBoundingClientRect();
        const d = desc.getBoundingClientRect();
        if (p.top < d.bottom - 0.5) problems.push(`${id} pill top ${p.top.toFixed(1)} above description bottom ${d.bottom.toFixed(1)}`);
        // the pill's text itself (not just its box) stays below the description's last line
        const range = document.createRange();
        range.selectNodeContents(pill);
        const text = range.getBoundingClientRect();
        if (text.top < d.bottom - 0.5) problems.push(`${id} pill text top ${text.top.toFixed(1)} above description bottom ${d.bottom.toFixed(1)}`);
        if (text.bottom > t.bottom + 0.5) problems.push(`${id} pill text below the tile`);
      }
      return { count: tiles.length, pills, problems, wide: document.documentElement.scrollWidth - window.innerWidth };
    });
    expect.soft(r.count, 'nine kind tiles').toBe(9);
    expect.soft(r.pills, 'at least one coming-soon tile to measure').toBeGreaterThan(0);
    expect.soft(r.wide, 'wider than the viewport').toBeLessThanOrEqual(0);
    expect.soft(r.problems).toEqual([]);
    if (process.env.WALK_SHOTS === '1') await page.screenshot({ path: `${SHOTS}/00-kind-picker-${size.width}x${size.height}.png`, fullPage: true });
  });
}

// review r1 F7: the FORM at 360 wide (the narrowest), whose .p3-new-time grids hold date/time inputs with an
// intrinsic width: the page is never wider than the viewport, with the form and with the Sessions sheet open.
test('form at 360x740: no sideways scroll (form and Sessions sheet)', async ({ page }) => {
  test.skip(process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', 'organiserP3 is off: /account/p3 is not mounted');
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, `/account/p3/create?at=form&kind=other_dates&o=${ORG}`, 'p3-new-name');
  const wide = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect.soft(await page.getByTestId('p3-new-add-date').count(), 'the add-date grid is on the form').toBe(1);
  expect.soft(await wide(), 'form wider than the viewport').toBeLessThanOrEqual(0);
  if (process.env.WALK_SHOTS === '1') await page.screenshot({ path: `${SHOTS}/01-form-other-dates-360x740.png`, fullPage: true });
  await page.getByTestId('p3-new-row-sessions').click();
  await page.getByTestId('p3-new-sess-start').first().waitFor();
  expect.soft(await wide(), 'Sessions sheet wider than the viewport').toBeLessThanOrEqual(0);
});
