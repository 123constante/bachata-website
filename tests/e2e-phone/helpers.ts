import type { Page, Route } from '@playwright/test';
import {
  answer, FAKE_ORIGIN, FAKE_REF, goLiveRpcs, FLAG_DANCER_ID, FLAG_DJ_ID, FLAG_EVENT_SLUG, FLAG_FESTIVAL_SLUG, ORG_ID, ORG_SLUG, ORG2_ID, ORG2_SLUG, ORG3_SLUG, VENDOR_ID,
} from './fakeSupabase.mjs';

export { ORG_ID, ORG_SLUG, ORG2_ID, ORG2_SLUG };

export const FIXED_NOW = new Date('2026-10-15T11:00:00Z');
const USER_ID = '11111111-1111-4111-8111-111111111111';
const USER = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'owner@ritmo.example', user_metadata: {} };
const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * The browser half of the fake (the server half is fakeSupabasePreload.mjs): every
 * call to the Supabase origin is answered by the same answer(). Writes are refused there.
 */
export type GoLiveScenario = Parameters<typeof goLiveRpcs>[0];

export async function fakeSupabase(page: Page, opts: { signedInAsOwner?: boolean; realClock?: boolean; asDancer?: string; goLive?: GoLiveScenario; contactPhone?: string | null; raffle?: boolean } = {}) {
  const goLive = opts.goLive ? goLiveRpcs(opts.goLive) : null;
  // One fixed "now" in the browser, so date-driven UI (calendar day cells,
  // "today") renders the same every run. Mid-month ON PURPOSE: the calendar's
  // past days include two-digit numbers, and axe reports single-character text
  // as "incomplete" rather than as a violation, so a 1st-9th "now" would hide
  // the past-day contrast failure. `realClock`: Playwright's clock also stalls
  // the idle callback that warms the route-transition chunk, which the Save-bar
  // in-app-navigation case needs (and that spec reads no dates).
  if (!opts.realClock) await page.clock.setFixedTime(FIXED_NOW);
  if (opts.signedInAsOwner) {
    const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: USER_ID, role: 'authenticated', amr: [{ method: 'otp', timestamp: 1 }] })}.sig`;
    await page.addInitScript(
      ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
      { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user: USER }, ref: FAKE_REF },
    );
  }
  await page.route(`${FAKE_ORIGIN}/**`, (route: Route) => {
    const req = route.request();
    if (opts.signedInAsOwner && new URL(req.url()).pathname === '/auth/v1/user') {
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(USER) });
    }
    // `asDancer`: the signed-in user is this dancer, with a complete profile (/account
    // dancer home). Browser side only: those pages are client-rendered.
    const path = new URL(req.url()).pathname;
    if (opts.asDancer && path === '/rest/v1/rpc/_my_dancer_profile_id_v1') {
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(opts.asDancer) });
    }
    if (opts.asDancer && path === '/rest/v1/rpc/profile_complete_v1') {
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: 'true' });
    }
    // `goLive`: the "Almost live" / Go live reads for one scenario (fakeSupabase.mjs goLiveRpcs).
    const rpcName = path.startsWith('/rest/v1/rpc/') ? path.slice('/rest/v1/rpc/'.length) : null;
    // `contactPhone`: the stored contact phone of every organiser (e.g. a legacy number saved without its '+').
    if (opts.contactPhone !== undefined && rpcName === 'get_organiser_contact_settings_v1') {
      const body = { contact_phone: opts.contactPhone, contact_email: 'hello@example.com', show_phone_publicly: true, show_email_publicly: false, show_contact_publicly: true, claim_email: null };
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    }
    // `raffle`: every event has an open raffle (the entry dialog; submit is never pressed).
    if (opts.raffle && rpcName === 'get_event_raffle') {
      const body = {
        enabled: true, config_source: 'custom', entry_count: 3, total_winners: 0, prize_text: 'A free pass', draw_date: null,
        cutoff_at: '2099-11-20T19:00:00.000Z', cutoff_offset_minutes: null, cutoff_time: '19:00', cutoff_passed: false,
        consent_version: 'v1', winner_display: null, my_status: null,
      };
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    }
    if (goLive && rpcName && Object.prototype.hasOwnProperty.call(goLive, rpcName)) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(req.postData() || '{}'); } catch { /* no body */ }
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(goLive[rpcName](args)) });
    }
    const res = answer({ method: req.method(), url: req.url(), headers: req.headers(), body: req.postData() });
    return route.fulfill(res);
  });
}

/** Two animation frames: layout and any fixed-position recalculation have run. */
export const frames = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

export type Box = { x: number; y: number; width: number; height: number };
export const box = async (page: Page, selector: string): Promise<Box> =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

export async function scrollTo(page: Page, where: 'top' | 'bottom') {
  await page.evaluate((w) => window.scrollTo(0, w === 'top' ? 0 : document.documentElement.scrollHeight), where);
  await frames(page);
}

/** Client-side (router) navigation, as a tap on an in-app link does. */
export async function routerNavigate(page: Page, path: string) {
  await page.waitForFunction(() => !!(window as unknown as { __reactRouterDataRouter?: unknown }).__reactRouterDataRouter);
  await page.evaluate(
    (p) => (window as unknown as { __reactRouterDataRouter: { navigate: (to: string) => Promise<void> } }).__reactRouterDataRouter.navigate(p),
    path,
  );
}

/** The page has hydrated and stopped fetching. */
export async function settled(page: Page) {
  await page.waitForFunction(() => !!(window as unknown as { __reactRouterDataRouter?: unknown }).__reactRouterDataRouter);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await frames(page);
}

/**
 * Entrance fades are over. framer-motion drives them from JS, so
 * document.getAnimations() does not see them, and some decorations pulse their
 * opacity forever, so "nothing is changing" never becomes true. The entrance
 * fades on these pages run under a second; this waits for fonts, then 2.5s.
 * axe mis-measures text that is still fading in.
 */
export async function animationsDone(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(2_500);
}

export interface CoveredControl { label: string; hit: string }

/**
 * Every visible button/link inside a position:fixed element that sits in the
 * bottom half of the screen: a tap at its centre must reach it (elementFromPoint
 * returns the control or something inside it). Returns the controls that are
 * covered, with what covers them.
 */
export async function coveredFixedBottomControls(page: Page): Promise<CoveredControl[]> {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const fixed = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((el) => {
      if (getComputedStyle(el).position !== 'fixed') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > vh / 2 && r.top < vh;
    });
    const describe = (el: Element | null) => {
      if (!el) return 'nothing';
      const h = el as HTMLElement;
      return `${el.tagName.toLowerCase()}${h.id ? `#${h.id}` : ''}${h.dataset?.testid ? `[data-testid=${h.dataset.testid}]` : ''}`;
    };
    const out: { label: string; hit: string }[] = [];
    const seen = new Set<Element>();
    const CONTROL = 'button, a[href], [role="button"]';
    for (const layer of fixed) {
      // The layer itself counts when it IS a control (a floating fixed button).
      const controls = [...(layer.matches(CONTROL) ? [layer] : []), ...Array.from(layer.querySelectorAll<HTMLElement>(CONTROL))];
      for (const c of controls) {
        if (seen.has(c)) continue;
        seen.add(c);
        const s = getComputedStyle(c);
        if (s.visibility === 'hidden' || s.display === 'none' || s.pointerEvents === 'none') continue;
        const r = c.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue; // off-screen: not a tap target right now
        const el = document.elementFromPoint(cx, cy);
        if (el && (el === c || c.contains(el))) continue;
        const label = (c.getAttribute('aria-label') || c.textContent || describe(c)).trim().replace(/\s+/g, ' ').slice(0, 60);
        out.push({ label, hit: describe(el) });
      }
    }
    return out;
  });
}

/**
 * Horizontal page scroll, measured against the DEVICE width (page.viewportSize),
 * never window.innerWidth: under isMobile emulation Chrome widens the layout
 * viewport to fit overflowing content, so innerWidth grows with the bug and a
 * comparison against it can never fail. Reuses the live suite's check
 * (tests/e2e/live/lib/pageChecks.ts), which learned that first.
 */
export { checkOverflow } from '../e2e/live/lib/pageChecks';

/**
 * The public routes every phone check walks. Framework (SSR) routes render from
 * the fake; the organiser page is walked as a visitor and as its owner (the
 * edit-in-place layer, with a draft so its Save bar is up).
 */
export const PUBLIC_ROUTES = [
  '/city/london-gb',
  '/festivals',
  '/parties',
  '/classes',
  '/faq',
  '/organisers',
  `/organisers/${ORG_SLUG}`,
  '/london-bachata-guide',
  '/learn-bachata-london',
  '/bachata-parties-london',
  '/auth',
] as const;

/**
 * The routes people-nationality-flag.phone.spec.ts visits. Not in PUBLIC_ROUTES (the
 * contrast ratchet walks those); the warm-up loads them too, so a cold dependency
 * optimiser cannot reload a page mid-test.
 */
export const FLAG_ROUTES = [
  '/djs', `/djs/${FLAG_DJ_ID}`, `/vendors/${VENDOR_ID}`, '/search?q=a', `/organisers/${ORG3_SLUG}`, '/teachers', '/dancers', `/dancers/${FLAG_DANCER_ID}`,
  '/all-profiles', '/practice-partners', `/event/${FLAG_EVENT_SLUG}`, `/festival/${FLAG_FESTIVAL_SLUG}`, '/account',
] as const;

/** Signed in as the owner, with one drafted field so the Save bar is showing. */
export async function openOrganiserAsOwnerWithDraft(page: Page) {
  await fakeSupabase(page, { signedInAsOwner: true });
  await page.goto(`/organisers/${ORG_SLUG}`);
  await page.locator('[data-eip-pencil="website"]').click();
  const sheet = page.getByTestId('eip-sheet');
  await sheet.getByRole('textbox').fill('https://example.org/e2e-draft');
  await sheet.getByRole('button', { name: 'Done' }).click();
  await sheet.waitFor({ state: 'detached' });
  await page.getByTestId('eip-bar').waitFor();
  await settled(page);
}
