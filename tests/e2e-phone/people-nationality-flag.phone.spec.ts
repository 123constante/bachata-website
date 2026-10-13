import { test, expect, type Page } from '@playwright/test';
import { checkOverflow, fakeSupabase, frames, settled } from './helpers';
import {
  FLAG_DANCER_ID, FLAG_DJ_ID, FLAG_EVENT_SLUG, FLAG_FESTIVAL_HEADLINERS, FLAG_FESTIVAL_SLUG, FLAG_PEOPLE, FLAG_PROGRAMME_CODES, ORG3_SLUG, ORG3_TEAM_CODES, VENDOR_ID,
} from './fakeSupabase.mjs';

/**
 * The nationality sticker on person photos (owner decision 2026-10-13: style "Sticker"),
 * on a PHONE at 390x844 and 360x640 (each size runs once, in the 390x844 project, with
 * its own viewport), on prod-shaped data (fakeSupabase.mjs: 120 DJs, about 1 in 8 with
 * a code, the codes in use on prod, some with no photo, some long names, some with
 * typed text the read maps to null).
 *
 * The sticker stands OUT of the photo (top -6%, right -14%, tilted 9deg, 2px white
 * edge), so on every one of the 15 surfaces, for every sticker, scrolled to the middle
 * of the screen:
 *   - exactly the coded people carry one, with "Nationality: <country>" and the title;
 *   - the sticker (with its white edge) is fully on screen and NOT cut by any ancestor
 *     with overflow hidden/auto/scroll/clip (ancestors walked, rects compared);
 *   - it covers no text (the person's name, a role) and no neighbouring sticker;
 *   - a tap at its centre goes through to the photo's link (pointer-events: none);
 *   - nothing animates; no sideways page scroll.
 * Measured numbers are logged ([sticker ...]) for the PR. SHOTS=<dir> writes screenshots.
 * The organiser owner case also proves the photo pencil stays reachable and clear.
 */

const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];
const country = new Intl.DisplayNames(['en-GB'], { type: 'region' });
const codesOf = (people: { nationality_code: string | null }[]) => people.map((p) => p.nationality_code).filter((c): c is string => !!c);
const storedCodes = (people: { nationality: string | null }[]) => people.map((p) => p.nationality).filter((c): c is string => !!c && /^[A-Z]{2}$/.test(c));

type Surface = {
  key: string;
  name: string;
  url: string;
  opts?: Parameters<typeof fakeSupabase>[1];
  /** Codes the surface must show (sorted compare); null = at least one. */
  codes: string[] | null;
  /** Opens the surface after the page loads (the header search). */
  open?: (page: Page) => Promise<void>;
  /** The photo is too small for a 20px sticker to stay in its corner: reported, not hidden. */
  tooSmall?: boolean;
};

const SURFACES: Surface[] = [
  { key: 'djs', name: '/djs list (64px)', url: '/djs', codes: codesOf(FLAG_PEOPLE) },
  { key: 'teachers', name: '/teachers list (56px)', url: '/teachers', codes: codesOf(FLAG_PEOPLE.slice(0, 40)) },
  { key: 'dancers', name: '/dancers list (32px)', url: '/dancers', codes: storedCodes(FLAG_PEOPLE.slice(0, 30)) },
  { key: 'all-profiles', name: '/all-profiles cards (inset)', url: '/all-profiles', codes: null },
  { key: 'videographers', name: '/videographers cards (inset)', url: '/videographers', codes: null },
  { key: 'vendor-team', name: '/vendors/:id team (20px)', url: `/vendors/${VENDOR_ID}`, codes: codesOf(FLAG_PEOPLE.slice(0, 9)), tooSmall: true },
  { key: 'practice-partners', name: '/practice-partners (56px, signed in)', url: '/practice-partners', opts: { signedInAsOwner: true }, codes: storedCodes(FLAG_PEOPLE.slice(0, 30)) },
  { key: 'dj-hero', name: '/djs/:id hero (132px)', url: `/djs/${FLAG_DJ_ID}`, codes: ['ES'] },
  { key: 'dancer-hero', name: '/dancers/:id hero (inset)', url: `/dancers/${FLAG_DANCER_ID}`, codes: ['ES'] },
  { key: 'event-programme', name: '/event/:id programme (PersonChip)', url: `/event/${FLAG_EVENT_SLUG}`, codes: FLAG_PROGRAMME_CODES },
  { key: 'festival-headliners', name: '/festival/:id headliners (inset)', url: `/festival/${FLAG_FESTIVAL_SLUG}`, codes: codesOf(FLAG_FESTIVAL_HEADLINERS) },
  {
    key: 'header-search',
    name: 'header search rows (36px)',
    url: '/djs',
    codes: null,
    open: async (page) => {
      // Only the header's search: /djs's own stickers are out of the way under the open panel.
      await page.locator('button[aria-label="Search events, venues, people"]').first().click();
      await page.getByRole('combobox', { name: 'Search events, venues and people' }).fill('Lucia');
      await page.locator('#omnibox-listbox [data-nationality-flag]').first().waitFor();
    },
  },
  { key: 'search', name: '/search result cards (inset)', url: '/search?q=a', codes: null },
  { key: 'organiser-team', name: '/organisers/:id Teachers & DJs (80px)', url: `/organisers/${ORG3_SLUG}`, codes: ORG3_TEAM_CODES },
  { key: 'account', name: '/account dancer home (56px, own photo)', url: '/account', opts: { signedInAsOwner: true, asDancer: FLAG_DANCER_ID }, codes: ['ES'] },
];

type StickerAudit = {
  code: string;
  label: string | null;
  title: string | null;
  pe: string;
  animations: number;
  /** Rendered sticker width (untransformed), and the tilted box with its 2px white edge. */
  stickerW: number;
  w: number;
  h: number;
  photo: number;
  photoCover: number;
  offScreen: number;
  clippedPx: number;
  clippedBy: string;
  textOverlap: { text: string; px: number }[];
  stickerOverlap: number;
  throughTo: string;
};

/** Runs in the page: every rendered sticker (within `scope`), measured where it sits. */
function auditStickers(scope: string): StickerAudit[] {
  const EDGE = 2; // the white edge (box-shadow spread) is part of what must not be cut
  const els = Array.from(document.querySelectorAll<HTMLElement>(`${scope} [data-nationality-flag]`)).filter((el) => el.getClientRects().length > 0);
  const vw = document.documentElement.clientWidth;
  type Box = { l: number; t: number; r: number; b: number };
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { l: r.left - EDGE, t: r.top - EDGE, r: r.right + EDGE, b: r.bottom + EDGE };
  };
  const inter = (a: Box, b: Box) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
  const describe = (el: Element) => {
    const cls = typeof (el as HTMLElement).className === 'string' ? (el as HTMLElement).className.split(/\s+/).filter((c) => /overflow|rounded|card|clip|nl-/.test(c)).slice(0, 3).join('.') : '';
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`;
  };
  const visuallyHidden = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return cs.visibility === 'hidden' || r.width <= 1 || r.height <= 1 || cs.clip.startsWith('rect(0');
  };
  const out: StickerAudit[] = [];
  for (const el of els) {
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    const s = box(el);
    const photoEl = el.parentElement as HTMLElement;
    const p = photoEl.getBoundingClientRect();
    const offScreen = Math.max(0, -s.l, s.r - vw, -s.t, s.b - innerHeight);
    let clippedPx = 0;
    let clippedBy = '';
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const clipX = cs.overflowX !== 'visible';
      const clipY = cs.overflowY !== 'visible';
      if (!clipX && !clipY) continue;
      const r = a.getBoundingClientRect();
      const inner = { l: r.left + a.clientLeft, t: r.top + a.clientTop, r: r.left + a.clientLeft + a.clientWidth, b: r.top + a.clientTop + a.clientHeight };
      const cut = Math.max(clipX ? Math.max(0, inner.l - s.l, s.r - inner.r) : 0, clipY ? Math.max(0, inner.t - s.t, s.b - inner.b) : 0);
      if (cut > clippedPx) {
        clippedPx = cut;
        clippedBy = describe(a);
      }
    }
    const textOverlap: { text: string; px: number }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? '').trim();
      if (!t || el.contains(n) || photoEl.contains(n) || !n.parentElement || visuallyHidden(n.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const rr of Array.from(range.getClientRects())) {
        const px = inter(s, { l: rr.left, t: rr.top, r: rr.right, b: rr.bottom });
        if (px > 0.5) textOverlap.push({ text: t.slice(0, 40), px: Math.round(px) });
      }
    }
    let stickerOverlap = 0;
    for (const other of els) if (other !== el) stickerOverlap = Math.max(stickerOverlap, inter(s, box(other)));
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const link = at?.closest('a, button');
    out.push({
      code: el.dataset.nationalityFlag ?? '',
      label: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      pe: getComputedStyle(el).pointerEvents,
      animations: el.getAnimations({ subtree: true }).length,
      stickerW: el.offsetWidth,
      w: Math.round((s.r - s.l) * 10) / 10,
      h: Math.round((s.b - s.t) * 10) / 10,
      photo: Math.round(p.width),
      photoCover: Math.round((inter(s, { l: p.left, t: p.top, r: p.right, b: p.bottom }) / Math.max(1, p.width * p.height)) * 100) / 100,
      offScreen: Math.round(offScreen * 10) / 10,
      clippedPx: Math.round(clippedPx * 10) / 10,
      clippedBy,
      textOverlap,
      stickerOverlap: Math.round(stickerOverlap),
      throughTo: at && el.contains(at) ? 'STICKER' : link ? `${link.tagName.toLowerCase()}:${link.getAttribute('href') ?? ''}` : at ? at.tagName.toLowerCase() : 'nothing',
    });
  }
  return out;
}

const shot = async (page: Page, name: string) => {
  if (!process.env.SHOTS) return;
  await page.locator('[data-nationality-flag]').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await frames(page);
  await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, scale: 'css' });
};

for (const vp of SIZES) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });
    test.beforeEach(({ page: _page }, info) => {
      test.skip(info.project.name !== 'phone-390x844', 'each size runs once, with its own viewport');
    });

    for (const s of SURFACES) {
      test(`${s.name}: sticker on screen, not clipped, clear of names and neighbours, taps go through`, async ({ page }) => {
        await fakeSupabase(page, { realClock: true, ...s.opts });
        await page.goto(s.url);
        await page.locator('[data-nationality-flag]').first().waitFor();
        await settled(page);
        const scope = s.open ? '#omnibox-listbox' : 'body';
        if (s.open) await s.open(page);
        else expect(await checkOverflow(page), 'no sideways scroll').toEqual([]);
        const all = await page.evaluate(auditStickers, scope);

        if (s.codes) expect(all.map((f) => f.code).sort(), 'one sticker per coded person, none for null / typed text').toEqual([...s.codes].sort());
        else expect(all.length).toBeGreaterThan(0);

        const max = (k: 'offScreen' | 'clippedPx' | 'photoCover' | 'stickerOverlap') => Math.max(...all.map((f) => f[k]));
        const line = `[sticker ${s.key} ${vp.width}x${vp.height}] n=${all.length} sticker=${all[0].stickerW}px box=${all[0].w}x${all[0].h} photo=${all[0].photo}px ` +
          `cover=${max('photoCover')} offScreen=${max('offScreen')} clipped=${max('clippedPx')}${all.find((f) => f.clippedPx)?.clippedBy ? ` by ${all.find((f) => f.clippedPx)!.clippedBy}` : ''} ` +
          `textOverlap=${all.reduce((n, f) => n + f.textOverlap.length, 0)} neighbour=${max('stickerOverlap')}`;
        console.log(line);
        test.info().annotations.push({ type: 'sticker', description: line });

        for (const f of all) {
          const at = `${f.code} on ${s.key}`;
          expect(f.label, `aria-label ${at}`).toBe(`Nationality: ${country.of(f.code)}`);
          expect(f.title, `title ${at}`).toBe(country.of(f.code));
          expect(f.pe, `never takes a tap (${at})`).toBe('none');
          expect(f.animations, `static (${at})`).toBe(0);
          expect(f.stickerW, `at least 20px wide, so the stripes read (${at})`).toBeGreaterThanOrEqual(20);
          expect(f.offScreen, `fully on screen (${at})`).toBe(0);
          expect(f.clippedPx, `not clipped by ${f.clippedBy} (${at})`).toBe(0);
          expect(f.textOverlap, `covers no text (${at})`).toEqual([]);
          expect(f.stickerOverlap, `clear of the neighbouring sticker (${at})`).toBe(0);
          expect(f.throughTo, `a tap goes through (${at})`).not.toBe('STICKER');
          if (!s.tooSmall) expect(f.photoCover, `covers only the corner (${at})`).toBeLessThanOrEqual(0.4);
        }
        // A tap on a linked photo's sticker lands on that photo's link.
        if (s.key === 'djs') expect(all[0].throughTo).toBe(`a:/djs/${FLAG_PEOPLE[0].id}`);
        await shot(page, `${s.key}-${vp.width}x${vp.height}`);
      });
    }

    test('/organisers/:id as the owner: the photo pencil stays reachable and clear of every sticker', async ({ page }) => {
      await fakeSupabase(page, { signedInAsOwner: true, realClock: true });
      await page.goto(`/organisers/${ORG3_SLUG}`);
      await page.locator('[data-nationality-flag]').first().waitFor();
      await settled(page);
      const all = await page.evaluate(auditStickers, 'body');
      expect(all.map((f) => f.code).sort()).toEqual([...ORG3_TEAM_CODES].sort());
      for (const f of all) expect(f.clippedPx + f.offScreen, `${f.code} sticker whole`).toBe(0);
      const pencil = page.locator('[data-eip-pencil="avatar_url"]').first();
      await pencil.scrollIntoViewIfNeeded();
      const r = (await pencil.boundingBox())!;
      const hit = await pencil.evaluate((node) => {
        const b = node.getBoundingClientRect();
        const at = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return !!at && (at === node || node.contains(at));
      });
      expect(hit, 'photo pencil reachable (elementFromPoint)').toBe(true);
      const boxes = await page.evaluate(() => Array.from(document.querySelectorAll('[data-nationality-flag]')).map((el) => {
        const b = el.getBoundingClientRect();
        return { code: (el as HTMLElement).dataset.nationalityFlag, x: b.x - 2, y: b.y - 2, w: b.width + 4, h: b.height + 4 };
      }));
      for (const f of boxes) {
        const overlap = !(f.x + f.w <= r.x || r.x + r.width <= f.x || f.y + f.h <= r.y || r.y + r.height <= f.y);
        expect(overlap, `${f.code} sticker clear of the pencil`).toBe(false);
      }
      await shot(page, `organiser-team-owner-${vp.width}x${vp.height}`);
    });
  });
}
