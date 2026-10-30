import { test, expect, type Page } from '@playwright/test';
import { ORG, ORG_NAME, OrganiserFake, json } from './helpers/organiserFake';

// New event kind picker (brief p3-create-event-fix-2): all nine tiles at 390x844, 360x740 and 430x932. A
// "Coming soon" pill must sit BELOW the tile's description in normal flow: their boxes never overlap, the pill
// is not absolutely positioned, nothing in a tile is clipped by the tile, every tile is >= 44x44 and the page is
// never wider than the viewport. Read-only: every RPC is fulfilled by the fake. P3 mounts only with BOTH flags:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-create-kinds.spec.ts --project=chromium
// With organiserP3 off each test skips itself, as the other P3 walks do.

const SHOTS = 'docs/design/p3-create-event/walk';
const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
  { width: 430, height: 932 },
];

async function open(page: Page) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, {
      v: 1, gate_on: false, is_admin: false, complete: true,
      person: { complete: true, missing: [] },
      organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }],
    }));
  await page.goto(`/account/p3/create?o=${ORG}`);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const mounted = await page.getByTestId('p3-new-kinds').waitFor({ timeout: 15_000 }).then(() => true, () => false);
  test.skip(!mounted, 'organiserP3 is off in this server: /account/p3/create is not mounted');
}

for (const size of SIZES) {
  test(`kind picker tiles at ${size.width}x${size.height}: pill below the text, nothing clipped`, async ({ page }) => {
    await page.setViewportSize(size);
    await open(page);
    await page.waitForTimeout(400); // the slide-in
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
          // a child's own content spilling out of its box (e.g. a fixed-height pill whose text wrapped)
          if (k.scrollHeight > k.clientHeight + 1 || k.scrollWidth > k.clientWidth + 1) problems.push(`${id} ${k.className} content overflows its box`);
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
    expect(r.count, 'nine kind tiles').toBe(9);
    expect(r.pills, 'three coming-soon tiles').toBe(3);
    expect.soft(r.wide, 'wider than the viewport').toBeLessThanOrEqual(0);
    expect.soft(r.problems).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/00-kind-picker-${size.width}x${size.height}.png`, fullPage: true });
  });
}
