import { test, expect, type Page, type Route } from '@playwright/test';
import { checkOverflow, fakeSupabase, settled } from './helpers';
import { FAKE_ORIGIN, FLAG_DANCER_ID } from './fakeSupabase.mjs';
import { DANCER_SHAPES, makeProfile } from '../../src/modules/dancer-app/api/fixtures';
import type { MyDancerEdit } from '../../src/modules/dancer-app/api/types';

/**
 * Every text field on a PHONE with the keyboard up (brief site-keyboard-safe):
 * one row per field (the inventory in the PR body), at 390x844 and 360x640
 * (playwright.phone.config.ts projects), with the keyboard simulated BOTH ways
 * a phone does it:
 *   - resize: the page itself shrinks to what the keyboard leaves (Android Chrome with the
 *     viewport meta's interactive-widget=resizes-content);
 *   - overlay: the page keeps its height and window.visualViewport shrinks to
 *     that height (iOS Safari and in-app tabs; the keyboard covers the rest).
 * For each: open the route, focus the field, type a few letters, raise the
 * keyboard, then assert the field is fully inside what is still visible, a tap
 * at its centre reaches it, the first result row (fields with results) is
 * visible and tappable too, no fixed bar overlaps either, and no sideways scroll.
 * The owner's case (2026-10-16): the organiser onboarding search sat at the
 * bottom of the screen with every result under the keyboard, and nothing scrolled.
 * Nothing reaches any database (fakeSupabase.mjs); a search answers 22 long names.
 * A row with a `primary` button (a confirm or Continue right under the field)
 * also asserts that button is visible and tappable with the keyboard up.
 *
 * Red-first switch: KEYBOARD_SAFE_MUTANT=1 serves a do-nothing keyboardSafe
 * module to the browser (the dev server's /src/lib/keyboard/keyboardSafe.ts),
 * so the rows can be seen failing without the helper and without editing src.
 */

/**
 * What the keyboard leaves visible: the brief's ~470px on a 390x844 phone; on a
 * 360x640 phone a keyboard with its suggestion strip is about 300 CSS px, so 340.
 */
const visibleWithKeyboard = (height: number) => Math.min(470, height - 300);

/**
 * visitor: signed out. owner: signed in (organiser owner). newcomer: signed in with a finished
 * dancer profile and no organiser. dancer: signed in, the row's `setup` fakes the dancer reads.
 */
type Who = 'visitor' | 'owner' | 'newcomer' | 'dancer';
interface Row {
  name: string;
  path: string;
  who: Who;
  /** The text field. */
  field: string;
  /** Its first result row, for a field that shows results. */
  result?: string;
  /** The form's primary button, when it sits right under the field (it must stay above the keyboard too). */
  primary?: string;
  /** What to type. */
  text: string;
  /** Steps that reveal the field (open a sheet, a menu). */
  reveal?: (page: Page) => Promise<void>;
  /** The reveal already focuses the field (a picker's search): the person types straight away, no tap on it. */
  focused?: boolean;
  /** Extra page.route fakes for this screen's reads, asked before fakeSupabase's. */
  setup?: (page: Page) => Promise<void>;
}

const RPC = `${FAKE_ORIGIN}/rest/v1/rpc/`;
const reply = (body: unknown) => (route: Route) =>
  route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** The /app/* dancer area (as tests/e2e/dancer-app/*.spec.ts fake it): the gate lets them in, my_dancer_edit_v1 answers `profile`. */
const dancerArea = (profile: MyDancerEdit) => async (page: Page) => {
  await page.route(`${RPC}dancer_area_gate_v1`, reply({ open: false, allowed: true }));
  await page.route(`${RPC}my_dancer_edit_v1`, reply(profile));
};

/**
 * /finish-profile: an incomplete dancer profile; the form asks for each empty field. `row` is what the
 * profile already has (all four empty by default; only the first name missing puts Save right under it).
 */
const FINISH_ID = 'b1000000-0000-4000-8000-0000000000f1';
const EMPTY_FOUR = { first_name: null, based_city_id: null, dance_role: null, avatar_url: null };
const finishProfile = (have: Record<string, string | null> = {}) => async (page: Page) => {
  await page.route(`${RPC}_my_dancer_profile_id_v1`, reply(FINISH_ID));
  await page.route(`${RPC}profile_complete_v1`, reply(false));
  await page.route(`${FAKE_ORIGIN}/rest/v1/dancer_profiles**`, (route: Route) =>
    new URL(route.request().url()).searchParams.get('id') === `eq.${FINISH_ID}`
      ? reply({ ...EMPTY_FOUR, ...have })(route)
      : route.fallback(),
  );
};

/** The city picker's popover: its trigger opens it, the search field and its first option are the row. */
const CITY_SEARCH = '[cmdk-input]';
const CITY_OPTION = '[cmdk-item]';

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
  {
    name: 'account settings: delete confirm word + Delete button',
    path: '/account/settings/delete',
    who: 'newcomer',
    field: '#delete-type-input',
    primary: '[data-testid="delete-confirm"]',
    text: 'DELETE',
    setup: (page) => page.route(`${RPC}my_account_erase_check_v1`, reply({ can_erase: true, blockers: [], code: null })),
  },
  {
    name: 'dancer setup: first name',
    path: '/app/welcome',
    who: 'dancer',
    field: '#ob-first',
    text: 'Ana',
    setup: dancerArea(DANCER_SHAPES.emptyStub.profile!),
  },
  {
    name: 'dancer setup: shown name + Continue',
    path: '/app/welcome',
    who: 'dancer',
    field: '#ob-display',
    primary: '[data-testid="onboarding-continue"]',
    text: 'Ana',
    setup: dancerArea(DANCER_SHAPES.emptyStub.profile!),
  },
  {
    name: 'dancer setup: city search (combobox, results)',
    path: '/app/welcome',
    who: 'dancer',
    field: CITY_SEARCH,
    result: CITY_OPTION,
    text: 'Lon',
    setup: dancerArea(makeProfile({ first_name: 'Ana' })),
    reveal: (page) => page.locator('[data-testid="onboarding-city"] button[role="combobox"]').click(),
    focused: true,
  },
  {
    name: 'dancer edit: first name',
    path: '/app/me/edit',
    who: 'dancer',
    field: '#first_name',
    text: 'a',
    setup: dancerArea(DANCER_SHAPES.fourFieldComplete.profile!),
  },
  {
    name: 'dancer edit: city search (combobox, results)',
    path: '/app/me/edit',
    who: 'dancer',
    field: CITY_SEARCH,
    result: CITY_OPTION,
    text: 'Lon',
    setup: dancerArea(DANCER_SHAPES.fourFieldComplete.profile!),
    reveal: (page) => page.getByRole('combobox', { name: 'City', exact: true }).click(),
    focused: true,
  },
  {
    name: 'dancer edit: website (last field) + Save',
    path: '/app/me/edit',
    who: 'dancer',
    field: '#website_url',
    primary: '[data-testid="edit-save"]',
    text: 'htt',
    setup: dancerArea(DANCER_SHAPES.fourFieldComplete.profile!),
  },
  {
    name: 'finish profile: first name + Save (only the name missing)',
    path: '/finish-profile',
    who: 'dancer',
    field: '#finish-first-name',
    primary: 'main form button[type="submit"]',
    text: 'Ana',
    setup: finishProfile({ based_city_id: 'c1000000-0000-4000-8000-000000000001', dance_role: 'Follower', avatar_url: 'https://img.example/a.jpg' }),
  },
  {
    name: 'finish profile: first name (all four missing)',
    path: '/finish-profile',
    who: 'dancer',
    field: '#finish-first-name',
    text: 'Ana',
    setup: finishProfile(),
  },
  {
    name: 'finish profile: city search (combobox, results)',
    path: '/finish-profile',
    who: 'dancer',
    field: CITY_SEARCH,
    result: CITY_OPTION,
    text: 'Lon',
    setup: finishProfile(),
    reveal: (page) => page.locator('main form').getByRole('combobox').first().click(),
    focused: true,
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
  // dancer: signed in; the row's setup answers the dancer reads.
  await fakeSupabase(page, { signedInAsOwner: row.who !== 'visitor', realClock: true, asDancer: row.who === 'newcomer' ? FLAG_DANCER_ID : undefined });
  // Registered after fakeSupabase, so it is asked first: a name search answers MANY.
  await page.route(`${FAKE_ORIGIN}/rest/v1/organiser_profiles**`, (route: Route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.get('name')?.startsWith('ilike.')) return route.fallback();
    const limit = Number(url.searchParams.get('limit')) || MANY.length;
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(MANY.slice(0, limit)) });
  });
  await row.setup?.(page);
  if (process.env.KEYBOARD_SAFE_MUTANT) {
    await page.route(/\/src\/lib\/keyboard\/keyboardSafe\.ts/, (route: Route) =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: 'export const installKeyboardSafe = () => () => {};\nexport const isTextField = () => false;\n' }),
    );
  }
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
    ({ field, result, primary, bottom }) => {
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
      if (primary) {
        const button = document.querySelector<HTMLElement>(primary);
        if (!button) out.push('no primary button');
        else check(button, 'primary button');
      }
      return out;
    },
    { field: row.field, result: row.result, primary: row.primary, bottom },
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
        if (row.focused) await expect(field).toBeFocused();
        else await field.click();
        await field.pressSequentially(row.text, { delay: 30 });
        if (row.result) await page.locator(row.result).first().waitFor();
        if (row.primary) await page.locator(row.primary).first().waitFor();
        const visible = visibleWithKeyboard(vp.height);
        if (mode === 'resize') await page.setViewportSize({ width: vp.width, height: visible });
        else await page.evaluate((px) => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(px), vp.height - visible);
        await expect.poll(() => problems(page, row, visible), { timeout: 4_000 }).toEqual([]);
        expect(await checkOverflow(page), 'no sideways scroll with the keyboard up').toEqual([]);
      });
    }
  });
}
