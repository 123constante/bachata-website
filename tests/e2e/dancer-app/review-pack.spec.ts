import { writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { NOW, PHONE, OrganiserFake, json } from '../helpers/organiserFake';
import { DANCER_SHAPES, withDerived } from '../../../src/modules/dancer-app/api/fixtures';

// R1a review pack: every dancer-app screen x six profile shapes at 390x844, MOCKED RPCs (the
// organiser fake + page.route; no real backend). NOT in `test:e2e`: it only runs when
// REVIEW_PACK_DIR is set, e.g.
//   REVIEW_PACK_DIR=docs/review-pack/r1a npx playwright test tests/e2e/dancer-app/review-pack.spec.ts --project=chromium
// Writes <screen>--<shape>.png plus measurements.json (scrollWidth, controls under 44px,
// elementFromPoint at the primary button's centre).

const DIR = process.env.REVIEW_PACK_DIR;
const rpc = (name: string) => `**/rest/v1/rpc/${name}`;
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (offset: number) => {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + offset);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const night = (id: string, name: string, offset: number, status = 'going') => ({
  event_id: id, status, updated_at: null, name, occurrence_date: dayKey(offset), city_name: 'Camden', start_time: '21:00:00', type: 'party', is_active: true,
});
const ROWS = [night('s1', 'Soho Sensual Thursdays', 4), night('s2', 'Camden Social', 9, 'interested'), night('s3', 'Brixton Bachata Night', -3)];

const base = DANCER_SHAPES.fourFieldComplete.profile!;
const extras = DANCER_SHAPES.completeAllExtras.profile!;
// Every shape goes through withDerived (the server's strength rule, mirrored for the fake), so no
// shape can show a state the server never returns (review B1: the old no-photo shape was 70% with
// no photo). The long-name shape re-sets city_name AFTER withDerived (display-only field).
const SHAPES = [
  { name: 'new-stub', profile: DANCER_SHAPES.emptyStub.profile!, rows: [] },
  { name: 'partial', profile: DANCER_SHAPES.nameCityOnly.profile!, rows: [] },
  { name: 'complete-extras', profile: extras, rows: ROWS },
  {
    name: 'long-name-city',
    profile: {
      ...withDerived({ ...extras, first_name: 'Maximiliana-Esperanza', surname: 'Fernandez de la Cruz Villanueva', display_name: null }),
      city_name: 'Llanfairpwllgwyngyll-on-the-Menai-Strait',
    },
    rows: ROWS,
  },
  { name: 'no-photo', profile: withDerived({ ...base, avatar_url: null }), rows: [] },
  // Real-data fixes F1-F3: a link but no bio, a website stored without https://, no WhatsApp number.
  { name: 'link-no-bio', profile: DANCER_SHAPES.linkNoBio.profile, rows: ROWS },
  { name: 'legacy-photo', profile: withDerived({ ...base, avatar_url: 'https://legacy-cdn.example.net/uploads/2019/old-photo.jpg' }), rows: ROWS },
];
/** Where each screen shows the next step (the shared api/nextStep.ts sentence). */
const NEXT_STEP_TESTID: Record<string, string> = { home: 'tile-strength-next', me: 'me-next-step', welcome: 'onboarding-next-step' };

const SCREENS = [
  ['welcome', '/app/welcome'],
  ['home', '/app/home'],
  ['nights', '/app/nights'],
  ['me', '/app/me'],
  ['edit', '/app/me/edit'],
  ['photo', '/app/me/photo'],
  ['options', '/app/options'],
] as const;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#d58be6"/><circle cx="200" cy="160" r="70" fill="#fff"/></svg>`;

async function open(page: Page, path: string, shape: (typeof SHAPES)[number]) {
  const fake = new OrganiserFake({ noOrganiser: true });
  await fake.install(page);
  await page.route('**/img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }));
  await page.route('**/legacy-cdn.example.net/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG }));
  await page.route(rpc('dancer_area_gate_v1'), (r) => json(r, { open: false, allowed: true }));
  await page.route(rpc('my_dancer_edit_v1'), (r) => json(r, shape.profile));
  await page.route(rpc('get_my_event_attendance_v2'), (r) => json(r, shape.rows));
  await page.route(rpc('get_calendar_events_v2'), (r) => json(r, []));
  await page.route(rpc('series_level_summary_p5_v1'), (r) => {
    const id = JSON.parse(r.request().postData() ?? '{}').p_series_id as string;
    return json(r, { series_id: id, vote_count: 1, threshold: 7, counts: null, derived_level: null, my_level: null });
  });
  await page.goto(path);
}

/** scrollWidth, every visible control under 44px, and what elementFromPoint finds at the primary button. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-profile="dancer"]') ?? document.body;
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const label = (el: Element) => ((el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32));
    const controls = Array.from(root.querySelectorAll('a, button, input:not([type=hidden]), select, textarea, [role=button], [role=switch]')).filter(visible);
    const short = controls
      .filter((el) => !(el instanceof HTMLInputElement && (el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') && el.closest('label')))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 43.5 || r.width < 43.5)
      .map(({ el, r }) => `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    const main = root.querySelector('main') ?? root;
    const nav = root.querySelector('nav');
    const candidates = Array.from(main.querySelectorAll('button, a, label.da-tap')).filter((el) => visible(el) && !(nav && nav.contains(el)) && !el.closest('header'));
    const primary =
      candidates.find((el) => /(^|-)(primary|save|use|continue|cta|finish|main-action)$/i.test(el.getAttribute('data-testid') || '')) ??
      candidates.find((el) => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)' && el.tagName === 'BUTTON') ??
      candidates[0];
    let hit: { primary: string; hitIsPrimary: boolean; hitTag: string } | null = null;
    if (primary) {
      primary.scrollIntoView({ block: 'center' });
      const r = primary.getBoundingClientRect();
      const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      hit = { primary: label(primary), hitIsPrimary: !!at && (at === primary || primary.contains(at)), hitTag: at ? `${at.tagName.toLowerCase()}${at.getAttribute('data-testid') ? `[${at.getAttribute('data-testid')}]` : ''}` : 'none' };
      window.scrollTo(0, 0);
    }
    return { url: location.pathname, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, short, hit };
  });
}

test.describe('R1a review pack 390x844 (MOCKED RPCs)', () => {
  test.skip(!DIR, 'set REVIEW_PACK_DIR to write the review pack');
  test.use({ viewport: PHONE });
  const results: Record<string, unknown> = {};

  test('every pack shape is one the server can return (pct >= 70 <=> complete)', () => {
    for (const shape of SHAPES) expect(shape.profile.strength.pct >= 70, shape.name).toBe(shape.profile.complete);
    const noPhoto = SHAPES.find((x) => x.name === 'no-photo')!.profile;
    expect(noPhoto.strength).toMatchObject({ pct: 55, next_step: 'photo' });
  });

  for (const shape of SHAPES) {
    for (const [screen, path] of SCREENS) {
      test(`${screen} x ${shape.name}`, async ({ page }) => {
        await open(page, path, shape);
        await expect(page.locator('[data-testid^="dancer-screen-"]').first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: `${DIR}/${screen}--${shape.name}.png`, fullPage: true });
        results[`${screen}--${shape.name}`] = await measure(page);
        // B1: the 55% person is told to add a photo, in the same words, on Home, Me and Onboarding.
        if (shape.name === 'no-photo' && NEXT_STEP_TESTID[screen]) {
          await expect(page.getByTestId(NEXT_STEP_TESTID[screen])).toHaveText('Add your photo to reach 70%.');
        }
        // F1: the person with links and no bio is asked for the bio only (Home and Me; Welcome is past the line).
        if (shape.name === 'link-no-bio' && (screen === 'home' || screen === 'me')) {
          await expect(page.getByTestId(NEXT_STEP_TESTID[screen])).toHaveText('Add a short bio towards 100%.');
        }
        // F2 + F3: the stored website gets a calm hint, nothing blocks a save but "nothing changed", the switch says why it is off.
        if (shape.name === 'link-no-bio' && screen === 'edit') {
          await expect(page.getByTestId('note-website_url')).toBeVisible();
          await expect(page.getByTestId('error-website_url')).toHaveCount(0);
          await expect(page.getByTestId('edit-save-reason')).toHaveText('Nothing has changed yet. Edit a field above to save.');
          await expect(page.getByTestId('whatsapp-switch-reason')).toBeVisible();
        }
      });
    }
  }

  test.afterAll(() => {
    if (DIR) writeFileSync(`${DIR}/measurements.json`, `${JSON.stringify(results, null, 1)}\n`);
  });
});
