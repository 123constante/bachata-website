import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import { OrganiserFake, ORG, PHONE, json, refuse } from './helpers/organiserFake';
import { makeProfile, CITY_LONDON } from '../../src/modules/dancer-app/api/fixtures';

// Walk of PR #1272 (Instagram checklist rows, move link, refusals) at 390x844 (brief walk-instagram-r2).
// Server answers are simulated at the network boundary only. NO product code is touched, no prod access, no sign-in.
// NOT in the CI gate list. The P3 part needs both flags:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-instagram-r2.spec.ts --project=chromium --workers=1
// Pictures: docs/walk/instagram-r2/<nn>-*.png ; measured rows: docs/walk/instagram-r2/rows.tmp
test.use({ viewport: PHONE });

const OUT = 'docs/walk/instagram-r2';
fs.mkdirSync(OUT, { recursive: true });
const ROWS = `${OUT}/rows.tmp`;

const GATE = '**/rest/v1/rpc/dancer_area_gate_v1*';
const EDIT = '**/rest/v1/rpc/my_dancer_edit_v1*';
const SAVE = '**/rest/v1/rpc/save_my_dancer_profile_v2*';

const FOUR = { first_name: 'Sam', based_city_id: CITY_LONDON.id, dance_role: 'Follower' as const, avatar_url: null };

type Body = Record<string, unknown>;

/** Measured on the settled screen: taps under 44px, sideways scroll, lowest text contrast, focused element, console errors. */
async function measure(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
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
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || !node.textContent?.trim()) continue;
      const box = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (!box.width || !box.height || st.visibility === 'hidden' || el.closest('[aria-hidden="true"], .sr-only, .p3-ob-sr, [disabled], [aria-disabled="true"]')) continue;
      const [a, b] = [lum(rgb(st.color).slice(0, 3)), lum(ground(el))].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      if (ratio < minContrast) { minContrast = ratio; worst = node.textContent.trim().slice(0, 40); }
    }
    const small = [...document.querySelectorAll('button, a[href], input, textarea, [role="radio"]')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        // opacity 0 = the shared toast's close button, shown only on hover (not a finger target on a phone; noted in RESULTS.md)
        return r.width > 0 && r.height > 0 && getComputedStyle(e).opacity !== '0' && !e.closest('.sr-only, .p3-ob-sr') && r.bottom > 0 && r.top < innerHeight && (() => {
          // Only what a finger can reach: on top at its centre (the site footer sits under the fixed P3 frame).
          const hit = document.elementFromPoint(r.left + r.width / 2, Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
          return !!hit && (hit === e || e.contains(hit) || (!!e.closest('label') && hit.closest('label') === e.closest('label')));
        })();
      })
      .map((e) => {
        const box = (e as HTMLInputElement).type === 'checkbox' || (e as HTMLInputElement).type === 'radio' ? (e.closest('label') ?? e) : e;
        return { e, r: box.getBoundingClientRect() };
      })
      .filter(({ r }) => r.height < 43.5 || r.width < 43.5)
      .map(({ e, r }) => `${e.tagName.toLowerCase()}${(e as HTMLElement).className ? '.' + String((e as HTMLElement).className).split(' ')[0] : ''}|${e.getAttribute('data-testid') ?? (e as HTMLElement).id ?? ((e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 20))}:${Math.round(r.width)}x${Math.round(r.height)}`);
    const ae = document.activeElement as HTMLElement | null;
    return {
      contrast: Math.round(minContrast * 100) / 100, worst, small,
      hscroll: document.documentElement.scrollWidth > window.innerWidth,
      focus: ae && ae !== document.body ? `${ae.tagName.toLowerCase()}${ae.id ? '#' + ae.id : ''}` : 'none',
    };
  });
}

const errorsOf = (page: Page) => {
  const errs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Extra attributes from the server|^Query error: Error: no_profile|^Query error: DancerApiError: We could not find your dancer profile|^Mutation error: DancerApiError/.test(m.text())) errs.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message.slice(0, 120)}`));
  return errs;
};

/** One picture + one measured row. Returns the measurement so the test can assert. */
async function shoot(page: Page, errs: string[], name: string, what: string, extra: string, bodies = '') {
  const nn = name;
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  const m = await measure(page);
  const fails: string[] = [];
  if (m.small.length) fails.push(`taps<44: ${m.small.join(' ')}`);
  if (m.hscroll) fails.push('sideways scroll');
  if (m.contrast < 4.5) fails.push(`contrast ${m.contrast} "${m.worst}"`);
  if (errs.length) fails.push(`console: ${errs.join(' | ')}`);
  fs.appendFileSync(ROWS, `| ${nn} | ${what} | ${extra} | ${m.small.length ? m.small.join(', ') : 'none'} | ${m.hscroll ? 'YES' : 'no'} | ${m.contrast} | ${errs.length} | ${m.focus} | ${bodies} |\n`);
  return { m, fails, nn };
}

// ---------- /app/me/edit ----------

type SaveMode = { kind: 'ok' } | { kind: 'refuse'; code: string; message: string; details?: string | null; status?: number };

async function openEdit(page: Page, profile: ReturnType<typeof makeProfile>, mode: SaveMode, path = '/app/me/edit') {
  const fake = new OrganiserFake({ noOrganiser: true });
  await fake.install(page);
  const saves: Body[] = [];
  let current = { ...profile };
  await page.route(GATE, (r) => json(r, { open: false, allowed: true }));
  await page.route(EDIT, (r) => json(r, current));
  await page.route(SAVE, (r: Route) => {
    const payload = (r.request().postDataJSON() as { p_payload: Body }).p_payload;
    saves.push(payload);
    if (mode.kind === 'refuse') return json(r, { code: mode.code, message: mode.message, details: mode.details ?? null, hint: null }, mode.status ?? 400);
    current = { ...current, ...payload } as typeof current;
    return json(r, current);
  });
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }));
  await page.goto(path);
  await page.getByTestId('dancer-screen-edit').waitFor({ timeout: 20_000 });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  return { saves };
}

const shown = async (page: Page, id: string) => {
  const el = page.getByTestId(id);
  return (await el.count()) ? ((await el.first().textContent()) ?? '').trim() : null;
};

const OLD_SITE = 'https://old.example.com';
type Want = 'move' | 'move-clear' | 'clear' | 'nothing' | 'blocked' | 'stay';
const WEBSITE_CASES: { key: string; link: string; instagram: string | null; stored: string | null; want: Want }[] = [];
for (const stored of [null, OLD_SITE]) {
  const sk = stored ? 'stored-site' : 'stored-empty';
  const mv: Want = stored ? 'move-clear' : 'move';
  WEBSITE_CASES.push(
    { key: `profile-link-ig-empty-${sk}`, link: 'https://www.instagram.com/simonliftslife/', instagram: null, stored, want: mv },
    { key: `profile-link-ig-same-${sk}`, link: 'https://www.instagram.com/simonliftslife/', instagram: 'simonliftslife', stored, want: stored ? 'clear' : 'nothing' },
    { key: `profile-link-ig-different-${sk}`, link: 'https://www.instagram.com/simonliftslife/', instagram: 'someoneelse', stored, want: 'blocked' },
    { key: `m-link-ig-empty-${sk}`, link: 'https://m.instagram.com/x', instagram: null, stored, want: mv },
    { key: `post-link-ig-empty-${sk}`, link: 'https://www.instagram.com/p/abc', instagram: null, stored, want: 'stay' },
    { key: `normal-site-ig-empty-${sk}`, link: 'https://simonliftslife.com', instagram: null, stored, want: 'stay' },
  );
}

test.describe('1 Website field: what is sent and what the screen says', () => {
  for (const c of WEBSITE_CASES) {
    test(`website ${c.key}`, async ({ page }) => {
      const errs = errorsOf(page);
      const { saves } = await openEdit(page, makeProfile({ ...FOUR, instagram: c.instagram, website_url: c.stored }), { kind: 'ok' });
      await page.locator('#website_url').fill(c.link);
      await page.locator('#website_url').blur();
      const note = await shown(page, 'note-website_url');
      const err = await shown(page, 'error-website_url');
      const reason = await shown(page, 'edit-save-reason');
      const saveOff = await page.getByTestId('edit-save').isDisabled();
      const what = `Website \`${c.link}\` over ${c.stored ? 'a stored site' : 'an empty Website'}, Instagram ${c.instagram ?? 'empty'}`;
      const before = await shoot(page, errs, `website-${c.key}-typed`, `${what}: typed, before Save`, `note: ${note ?? '-'}; error: ${err ?? '-'}; Save ${saveOff ? 'OFF (' + (reason ?? '') + ')' : 'on'}`);
      if (!saveOff) {
        await page.getByTestId('edit-save').click();
        await page.getByTestId('edit-saved').waitFor({ timeout: 10_000 }).catch(() => undefined);
      }
      const ig = await page.locator('#instagram').inputValue();
      const web = await page.locator('#website_url').inputValue();
      const after = await shoot(page, errs, `website-${c.key}-after`, `same, after Save`, `Instagram box \`${ig}\`; Website box \`${web}\`; error: ${(await shown(page, 'error-website_url')) ?? '-'}`, `calls=${saves.length} body=${JSON.stringify(saves)}`);
      const f: string[] = [...before.fails, ...after.fails];
      const sent = JSON.stringify(saves);
      const handle = c.link.includes('/x') ? 'x' : 'simonliftslife';
      if (c.want === 'move') {
        if (sent !== JSON.stringify([{ instagram: handle }])) f.push(`want [{instagram:"${handle}"}], sent ${sent}`);
        if (ig !== handle || web) f.push(`screen: Instagram \`${ig}\`, Website \`${web}\``);
      } else if (c.want === 'move-clear') {
        if (sent !== JSON.stringify([{ instagram: handle, website_url: null }])) f.push(`want [{instagram:"${handle}",website_url:null}], sent ${sent}`);
        if (ig !== handle || web) f.push(`screen: Instagram \`${ig}\`, Website \`${web}\``);
      } else if (c.want === 'clear') {
        if (sent !== JSON.stringify([{ website_url: null }])) f.push(`want [{website_url:null}], sent ${sent}`);
        if (err) f.push(`error shown: ${err}`);
      } else if (c.want === 'nothing') {
        if (saves.length) f.push(`want no save, sent ${sent}`);
      } else if (c.want === 'blocked') {
        if (saves.length) f.push(`want no save, sent ${sent}`);
        if (!err) f.push('no error under Website');
      } else if (sent !== JSON.stringify([{ website_url: c.link }])) f.push(`want [{website_url: link}] only, sent ${sent}`);
      expect(f).toEqual([]);
    });
  }
});

// ---------- refusals ----------

const SERVER_CASES: { key: string; mode: SaveMode; wording: string | null; under: 'instagram' | 'top' }[] = [
  { key: 'invalid_instagram', mode: { kind: 'refuse', code: '22023', message: 'invalid_instagram' }, wording: 'Enter your Instagram handle (like @yourname) or a full instagram.com link.', under: 'instagram' },
  { key: 'instagram_taken-23505', mode: { kind: 'refuse', code: '23505', status: 409, message: 'duplicate key value violates unique constraint "dancer_profiles_instagram_normalized_uidx"' }, wording: 'That Instagram is already on another profile. Check the spelling, or message us if it is yours.', under: 'instagram' },
  { key: 'other-23505-slug', mode: { kind: 'refuse', code: '23505', status: 409, message: 'duplicate key value violates unique constraint "dancer_profiles_slug_key"' }, wording: null, under: 'top' },
];

test.describe('2 server refusals: exact wording and where it sits', () => {
  for (const c of SERVER_CASES) {
    test(`refusal ${c.key}`, async ({ page }) => {
      const errs = errorsOf(page);
      const { saves } = await openEdit(page, makeProfile({ ...FOUR, instagram: null }), c.mode);
      await page.locator('#instagram').fill('simon.dances');
      await page.getByTestId('edit-save').click();
      await expect.poll(() => saves.length).toBe(1);
      await page.waitForTimeout(500);
      const under = await shown(page, 'error-instagram');
      const top = await shown(page, 'edit-top-error');
      const r = await shoot(page, errs, `refusal-${c.key}`, `server answers ${c.key}`, `under Instagram: ${under ?? '-'}; top: ${top ?? '-'}`, `body=${JSON.stringify(saves)}`);
      const f = [...r.fails];
      if (c.under === 'instagram') {
        if (under !== c.wording) f.push(`under Instagram = "${under}"`);
        if (top) f.push(`top error also shown: ${top}`);
      } else {
        if (under) f.push(`non-Instagram 23505 reported under Instagram: "${under}"`);
        if (!top) f.push('no top-of-screen message');
        if (top && /instagram/i.test(top)) f.push(`top message names Instagram: ${top}`);
      }
      expect(f).toEqual([]);
    });
  }
});

// ---------- P3 Review rows ----------

type State = 'base-incomplete' | 'base-complete' | 'no_profile';
const STATES: State[] = ['base-incomplete', 'base-complete', 'no_profile'];
const CODES = ['instagram', 'dj_answer', 'dj_genres', 'later_item'] as const;
const PROFILES: Record<State, ReturnType<typeof makeProfile> | null> = {
  'base-incomplete': makeProfile({ ...FOUR, based_city_id: null }),
  'base-complete': makeProfile({ ...FOUR }),
  no_profile: null,
};

type P3 = { saves: Body[]; calls: { rpc: string; body: Body }[]; missing: string[] };

async function openReview(page: Page, state: State, missingCodes: string[], opts: { genres?: string[] } = {}): Promise<P3> {
  const fake = new OrganiserFake({ dancerProfile: state === 'no_profile' ? 'none' : 'complete' });
  await fake.install(page);
  const p3: P3 = { saves: [], calls: [], missing: [...missingCodes] };
  const profile = PROFILES[state];
  let current = profile ? { ...profile } : null;
  const watch = (name: string, body: unknown) =>
    page.route(`**/rest/v1/rpc/${name}*`, (r) => { p3.calls.push({ rpc: name, body: (r.request().postDataJSON?.() ?? {}) as Body }); return json(r, body); });
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) =>
    json(r, { v: 1, is_admin: false, person: { complete: false, missing: p3.missing }, organisers: [{ id: ORG, name: 'Leeds Nights', role: 'owner', lifecycle: 'draft', complete: true, missing: [], about: { done: true, skipped: false } }] }));
  await page.route(GATE, (r) => json(r, { open: false, allowed: true }));
  await page.route(EDIT, (r) => (current ? json(r, current) : refuse(r, 'no_profile')));
  await page.route(SAVE, (r) => {
    const payload = (r.request().postDataJSON() as { p_payload: Body }).p_payload;
    p3.saves.push(payload);
    current = { ...current, ...payload } as typeof current;
    if (payload.instagram) p3.missing = p3.missing.filter((c) => c !== 'instagram');
    return json(r, current);
  });
  if (state === 'base-incomplete') await page.route('**/rest/v1/rpc/profile_complete_v1*', (r) => json(r, false));
  const hasDj = missingCodes.includes('dj_genres');
  await page.route('**/rest/v1/rpc/my_role_intent_v1*', (r) => json(r, { roles: hasDj ? ['dj'] : [], declined: [] }));
  await page.route('**/rest/v1/rpc/my_role_details_v1*', (r) => {
    const role = (r.request().postDataJSON() as { p_role: string }).p_role;
    return json(r, { role, person_id: 'p1', details: role === 'dj' ? { genres: opts.genres ?? [] } : {} });
  });
  await watch('set_my_role_intent_v1', { roles: ['dj'], declined: [], changed: true });
  await watch('set_my_role_declined_v1', { roles: [], declined: ['dj'], changed: true });
  await watch('save_my_role_v1', { role: 'dj', person_id: 'p1', details: {}, changed: true, changed_keys: ['genres'] });
  await page.route('https://img.example/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>' }));
  await page.route('**/rest/v1/organiser_profiles*', (r) => json(r, { id: ORG, name: 'Leeds Nights', bio: null, organisation_category: 'Promoter', city_id: null }));
  await page.goto(`/account/p3/start?o=${ORG}&at=review`);
  const mounted = await page.getByTestId('p3-ob-shell').waitFor({ timeout: 15_000 }).then(() => true, () => false);
  test.skip(!mounted && process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', 'organiserP3 is off in this server');
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  return p3;
}

const screenOf = (page: Page) => page.getByTestId('p3-ob-shell').getAttribute('data-screen').catch(() => null);

async function tapRow(page: Page, code: string) {
  await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'review');
  if (!(await page.getByTestId(`p3-ob-review-${code}`).count())) await page.getByTestId('p3-ob-review-all').click();
  await page.getByTestId(`p3-ob-review-${code}`).click();
}

type Land = { path?: RegExp; screen?: string; testId?: string; focusId?: string };
function landing(code: string, state: State): Land {
  if (code === 'instagram') return state === 'no_profile' ? { path: /^\/app\/me\/edit\?focus=instagram&returnTo=/, testId: 'load-error' } : { path: /^\/app\/me\/edit\?focus=instagram&returnTo=/, testId: 'dancer-screen-edit', focusId: 'instagram' };
  if (code === 'later_item') return { screen: 'elsewhere', testId: 'p3-ob-elsewhere-edit' };
  if (state === 'no_profile') return { screen: 'person-nodancer', testId: 'p3-ob-nodancer-contact' };
  return code === 'dj_answer' ? { screen: 'dj', testId: 'p3-ob-dj-yes' } : { screen: 'djgenres', testId: 'p3-ob-djgenres' };
}

test.describe('3 checklist rows x person state', () => {
  for (const state of STATES) {
    for (const code of CODES) {
      test(`row ${code} / ${state}`, async ({ page }) => {
        const errs = errorsOf(page);
        await openReview(page, state, [code]);
        const want = landing(code, state);
        await tapRow(page, code);
        if (want.path) await expect.poll(() => new URL(page.url()).pathname + new URL(page.url()).search).toMatch(want.path);
        if (want.screen) await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', want.screen);
        const f: string[] = [];
        await page.getByTestId(want.testId!).waitFor({ timeout: 8000 }).catch(() => f.push(`control ${want.testId} not on screen`));
        // No bounce: still here a moment later.
        await page.waitForTimeout(1500);
        const where = new URL(page.url()).pathname + new URL(page.url()).search;
        const scr = await screenOf(page);
        if (want.path && !want.path.test(where)) f.push(`bounced to ${where}`);
        if (want.screen && scr !== want.screen) f.push(`screen is ${scr}, want ${want.screen}`);
        if (!want.path && !/\/account\/p3\/start/.test(where)) f.push(`left the flow: ${where}`);
        const r = await shoot(page, errs, `row-${code}-${state}`, `row \`${code}\` / ${state}`, `landed ${where}${scr ? ' [' + scr + ']' : ''}`);
        if (want.focusId && !r.m.focus.endsWith('#' + want.focusId)) f.push(`focus is ${r.m.focus}, want #${want.focusId}`);
        expect([...f, ...r.fails]).toEqual([]);
      });
    }
  }

  test('instagram row -> type a handle -> Save -> Review without the row, no reload', async ({ page }) => {
    const errs = errorsOf(page);
    const p3 = await openReview(page, 'base-complete', ['instagram', 'dj_genres']);
    let reloads = 0;
    page.on('load', () => { reloads += 1; });
    reloads = 0;
    await tapRow(page, 'instagram');
    await page.locator('#instagram').waitFor();
    await page.locator('#instagram').fill('simon.dances');
    await page.getByTestId('edit-save').click();
    await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'review', { timeout: 10_000 });
    await expect(page.getByTestId('p3-ob-review-instagram')).toHaveCount(0);
    const r = await shoot(page, errs, 'instagram-saved-back-on-review', 'Instagram saved, back on Review', `row gone: yes; page loads after tap: ${reloads}`, `body=${JSON.stringify(p3.saves)}`);
    expect([...(reloads ? [`reloaded ${reloads}x`] : []), ...r.fails]).toEqual([]);
    expect(p3.saves).toEqual([{ instagram: 'simon.dances' }]);
  });
});

// ---------- DJ steps ----------

const items = (k: number, len = 5) => Array.from({ length: k }, (_, i) => `${String.fromCharCode(97 + (i % 26))}${i}`.padEnd(len, 'x')).join(', ');

test.describe('4 DJ steps', () => {
  test('Do you DJ? yes -> Music you play; no; untouched sends nothing', async ({ page }) => {
    const errs = errorsOf(page);
    const p3 = await openReview(page, 'base-complete', ['dj_answer']);
    await tapRow(page, 'dj_answer');
    await page.getByTestId('p3-ob-dj-yes').waitFor();
    // Untouched: Continue is off with its reason, a tap sends nothing.
    const off = await page.getByTestId('p3-ob-continue').getAttribute('aria-disabled');
    const why = await shown(page, 'p3-ob-why');
    await page.getByTestId('p3-ob-continue').click({ force: true });
    await page.waitForTimeout(400);
    const untouchedCalls = p3.calls.length + p3.saves.length;
    const a = await shoot(page, errs, 'dj-yesno-untouched', 'Do you DJ? untouched, Continue tapped', `Continue aria-disabled=${off}; reason: ${why}; calls sent: ${untouchedCalls}`, `calls=${JSON.stringify(p3.calls)}`);
    await page.getByTestId('p3-ob-dj-no').click();
    const b = await shoot(page, errs, 'dj-no-selected', 'Do you DJ? "No" chosen', 'before Continue');
    await page.getByTestId('p3-ob-continue').click();
    await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'review');
    const noCalls = JSON.stringify(p3.calls);
    expect([...a.fails, ...b.fails]).toEqual([]);
    expect(off).toBe('true');
    expect(untouchedCalls).toBe(0);
    expect(p3.calls.map((c) => c.rpc)).toEqual(['set_my_role_declined_v1']);
    fs.appendFileSync(ROWS, `| - | "No" Continue | one command | - | - | - | - | - | calls=${noCalls} |\n`);
  });

  test('Do you DJ? yes -> Music you play -> saved', async ({ page }) => {
    const errs = errorsOf(page);
    const p3 = await openReview(page, 'base-complete', ['dj_answer']);
    await tapRow(page, 'dj_answer');
    await page.getByTestId('p3-ob-dj-yes').click();
    await page.getByTestId('p3-ob-continue').click();
    await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'djgenres');
    const a = await shoot(page, errs, 'dj-yes-then-genres', 'after "Yes": Music you play', `calls: ${p3.calls.map((c) => c.rpc).join(',')}`);
    await page.getByTestId('p3-ob-djgenres').fill('Bachata, Kizomba');
    await page.getByTestId('p3-ob-continue').click();
    await expect(page.getByTestId('p3-ob-shell')).toHaveAttribute('data-screen', 'review');
    fs.appendFileSync(ROWS, `| - | yes + genres | saved | - | - | - | - | - | calls=${JSON.stringify(p3.calls)} |\n`);
    expect(a.fails).toEqual([]);
    expect(p3.calls.map((c) => c.rpc)).toEqual(['set_my_role_intent_v1', 'save_my_role_v1']);
  });

  const LIMITS: { key: string; text: string; reason: string }[] = [
    { key: 'empty', text: '', reason: 'Type at least one to continue.' },
    { key: '21-items', text: items(21), reason: 'Up to 20, separated by commas.' },
    { key: '20-items-ok', text: items(20), reason: '' },
    { key: 'item-81-chars', text: 'x'.repeat(81), reason: 'Keep each one to 80 characters or fewer.' },
    { key: 'item-80-chars-ok', text: 'x'.repeat(80), reason: '' },
  ];
  for (const l of LIMITS) {
    test(`Music you play limits: ${l.key}`, async ({ page }) => {
      const errs = errorsOf(page);
      const p3 = await openReview(page, 'base-complete', ['dj_genres']);
      await tapRow(page, 'dj_genres');
      await page.getByTestId('p3-ob-djgenres').fill(l.text);
      await page.getByTestId('p3-ob-djgenres').blur();
      const off = await page.getByTestId('p3-ob-continue').getAttribute('aria-disabled');
      const why = (await shown(page, 'p3-ob-why')) ?? '';
      const r = await shoot(page, errs, `genres-${l.key}`, `Music you play: ${l.key}`, `Continue ${off === 'true' ? 'OFF' : 'on'}; reason: "${why}"; calls: ${p3.calls.length}`);
      expect(r.fails).toEqual([]);
      if (l.reason) {
        expect(off).toBe('true');
        expect(why).toBe(l.reason);
      } else {
        expect(off).not.toBe('true');
      }
      expect(p3.calls).toEqual([]);
    });
  }

  test('Music you play untouched (already has genres) sends nothing', async ({ page }) => {
    const errs = errorsOf(page);
    const p3 = await openReview(page, 'base-complete', ['dj_genres'], { genres: ['Bachata'] });
    await tapRow(page, 'dj_genres');
    await expect(page.getByTestId('p3-ob-djgenres')).toHaveValue('Bachata');
    await shoot(page, errs, 'genres-untouched', 'Music you play: stored genres, untouched', 'Continue tapped');
    await page.getByTestId('p3-ob-continue').click();
    await page.waitForTimeout(600);
    fs.appendFileSync(ROWS, `| - | genres untouched, Continue | calls ${p3.calls.length} | - | - | - | - | - | calls=${JSON.stringify(p3.calls)} |\n`);
    expect(p3.calls).toEqual([]);
  });
});
