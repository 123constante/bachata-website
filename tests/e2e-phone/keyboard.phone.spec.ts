import { test, expect, type Page, type Route } from '@playwright/test';
import { checkOverflow, fakeSupabase, settled } from './helpers';
import { FAKE_ORIGIN, FLAG_DANCER_ID } from './fakeSupabase.mjs';

/**
 * Every text field on a PHONE with the keyboard up (brief site-keyboard-safe):
 * one row per field (the inventory in the PR body), at 390x844 and 360x640
 * (playwright.phone.config.ts projects), with the keyboard simulated BOTH ways
 * a phone does it:
 *   - resize: the page itself shrinks by KEYBOARD px (Android Chrome with the
 *     viewport meta's interactive-widget=resizes-content);
 *   - overlay: the page keeps its height and window.visualViewport shrinks by
 *     KEYBOARD px (iOS Safari and in-app tabs; the keyboard covers the rest).
 * For each: open the route, focus the field, type a few letters, raise the
 * keyboard, then assert the field is fully inside what is still visible, a tap
 * at its centre reaches it, the first result row (fields with results) is
 * visible and tappable too, no fixed bar overlaps either, and no sideways scroll.
 * The owner's case (2026-10-16): the organiser onboarding search sat at the
 * bottom of the screen with every result under the keyboard, and nothing scrolled.
 * Nothing reaches any database (fakeSupabase.mjs); a search answers 22 long names.
 */

/**
 * A phone keyboard is about the same height in CSS px on every phone (keys plus
 * the suggestion strip): 374px leaves the brief's ~470px on a 390x844 phone and
 * 266px on a 360x640 one, the small phone where a field low on the page goes under.
 */
const KEYBOARD = 374;

type Who = 'visitor' | 'owner' | 'newcomer';
interface Row {
  name: string;
  path: string;
  who: Who;
  /** The text field. */
  field: string;
  /** Its first result row, for a field that shows results. */
  result?: string;
  /** What to type. */
  text: string;
  /** Steps that reveal the field (open a sheet, a menu). */
  reveal?: (page: Page) => Promise<void>;
}

const ROWS: Row[] = [
  {
    name: 'header: site search (combobox, results listbox)',
    path: '/',
    who: 'visitor',
    field: '#app-header [role="combobox"], body > [role="dialog"] [role="combobox"]',
    result: '#omnibox-listbox [role="option"]',
    text: 'Ba',
    reveal: (page) => page.getByRole('button', { name: /Search events, venues, people/ }).first().click(),
  },
  { name: 'organisers directory: search by name', path: '/organisers', who: 'visitor', field: 'input[placeholder="Search by name..."]', text: 'Rit' },
  {
    name: 'teachers directory: search by name',
    path: '/teachers',
    who: 'visitor',
    field: 'input[placeholder="Search by name..."]',
    text: 'Ana',
    reveal: (page) => page.getByRole('button', { name: /Name$/ }).click(),
  },
  { name: 'vendors: business name', path: '/vendors', who: 'visitor', field: 'input[placeholder="Search by business name"]', text: 'Sho' },
  {
    name: 'auth: sign-in email',
    path: '/auth',
    who: 'visitor',
    field: '#signin-email',
    text: 'me@',
    reveal: (page) => page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  },
  { name: 'account settings: new email', path: '/account/settings', who: 'newcomer', field: '#settings-email-input', text: 'me@' },
  {
    name: 'organiser page (owner): website sheet',
    path: '/organisers/ritmo-phone-qa',
    who: 'owner',
    field: '[data-testid="eip-sheet"] input',
    text: 'htt',
    reveal: (page) => page.locator('[data-eip-pencil="website"]').click(),
  },
  {
    name: 'organiser onboarding: search organisers',
    path: '/account/o',
    who: 'newcomer',
    field: '[data-testid="onboarding-search"]',
    result: '[data-testid="onboarding-result"]',
    text: 'Sen',
  },
];

/** 22 organisers with long names, so a search's results run past the keyboard. */
const MANY = Array.from({ length: 22 }, (_, i) => ({
  id: `0a000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  name: `Sensual Bachata Collective of North London and Friends Number ${i + 1}`,
  slug: `sensual-collective-${i + 1}`,
  avatar_url: null,
  city_id: null,
}));

async function open(page: Page, row: Row) {
  // newcomer: signed in with a finished dancer profile and no organiser yet (organiser_home_v1 answers none).
  await fakeSupabase(page, { signedInAsOwner: row.who !== 'visitor', realClock: true, asDancer: row.who === 'newcomer' ? FLAG_DANCER_ID : undefined });
  // Registered after fakeSupabase, so it is asked first: a name search answers MANY.
  await page.route(`${FAKE_ORIGIN}/rest/v1/organiser_profiles**`, (route: Route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.get('name')?.startsWith('ilike.')) return route.fallback();
    const limit = Number(url.searchParams.get('limit')) || MANY.length;
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(MANY.slice(0, limit)) });
  });
  await page.goto(row.path);
  await settled(page);
  await row.reveal?.(page);
}

/** The overlay keyboard: a visualViewport the test can shrink, as iOS does. */
async function fakeVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const vv = new EventTarget();
    let keyboard = 0;
    const get = (fn: () => number) => ({ get: fn, configurable: true });
    Object.defineProperties(vv, {
      width: get(() => window.innerWidth),
      height: get(() => window.innerHeight - keyboard),
      offsetTop: get(() => 0),
      offsetLeft: get(() => 0),
      pageTop: get(() => window.scrollY),
      pageLeft: get(() => window.scrollX),
      scale: get(() => 1),
    });
    Object.defineProperty(window, 'visualViewport', { get: () => vv, configurable: true });
    window.addEventListener('resize', () => vv.dispatchEvent(new Event('resize')));
    (window as unknown as { __keyboard: (px: number) => void }).__keyboard = (px) => {
      keyboard = px;
      vv.dispatchEvent(new Event('resize'));
    };
  });
}

/** What is wrong with the field and its first result, with `bottom` px still visible. */
function problems(page: Page, row: Row, bottom: number) {
  return page.evaluate(
    ({ field, result, bottom }) => {
      const out: string[] = [];
      const f = document.querySelector<HTMLElement>(field);
      if (!f) return ['field not found'];
      if (document.activeElement !== f) out.push('field lost focus');
      const check = (el: HTMLElement, label: string) => {
        const r = el.getBoundingClientRect();
        if (r.top < -0.5 || r.bottom > bottom + 0.5) out.push(`${label} outside the visible area: top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)}, visible 0-${bottom}`);
        // A tap anywhere on it (centre and four inset corners) reaches it: nothing
        // fixed (a bar, a toast, a header) is painted over any part of it.
        const ys = [r.top + 6, r.top + r.height / 2, r.bottom - 6].map((y) => Math.min(y, bottom - 1));
        const xs = [r.left + 14, r.left + r.width / 2, r.right - 14]; // clear of rounded corners
        for (const [x, y] of [[xs[1], ys[1]], [xs[0], ys[0]], [xs[2], ys[0]], [xs[0], ys[2]], [xs[2], ys[2]]]) {
          const hit = document.elementFromPoint(x, y);
          // A field's own wrapper (its clear button) counts as the field.
          const own = label === 'field' ? el.parentElement ?? el : el;
          if (hit && (hit === el || own.contains(hit))) continue;
          const name = (n: Element | null) => (n ? `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${(n as HTMLElement).dataset?.testid ? `[${(n as HTMLElement).dataset.testid}]` : ''}` : 'nothing');
          let layer: Element | null = hit;
          while (layer && !/^(?:fixed|sticky)$/.test(getComputedStyle(layer).position)) layer = layer.parentElement;
          out.push(`${label}: a tap at (${Math.round(x)}, ${Math.round(y)}) hits ${name(hit)}${layer ? ` in a ${getComputedStyle(layer).position} ${name(layer)}` : ''}`);
          break;
        }
      };
      check(f, 'field');
      if (result) {
        const first = document.querySelector<HTMLElement>(result);
        if (!first) out.push('no result row');
        else check(first, 'first result');
      }
      return out;
    },
    { field: row.field, result: row.result, bottom },
  );
}

for (const mode of ['resize', 'overlay'] as const) {
  test.describe(`keyboard (${mode})`, () => {
    for (const row of ROWS) {
      test(row.name, async ({ page }) => {
        const vp = page.viewportSize()!;
        if (mode === 'overlay') await fakeVisualViewport(page);
        await open(page, row);
        const field = page.locator(row.field).first();
        await field.click();
        await field.pressSequentially(row.text, { delay: 30 });
        if (row.result) await page.locator(row.result).first().waitFor();
        const visible = vp.height - KEYBOARD;
        if (mode === 'resize') await page.setViewportSize({ width: vp.width, height: visible });
        else await page.evaluate((px) => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(px), KEYBOARD);
        await expect.poll(() => problems(page, row, visible), { timeout: 4_000 }).toEqual([]);
        expect(await checkOverflow(page), 'no sideways scroll with the keyboard up').toEqual([]);
      });
    }
  });
}
