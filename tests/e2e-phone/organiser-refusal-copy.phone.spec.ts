import { test, expect, type Page } from '@playwright/test';
import { fakeSupabase, settled } from './helpers';
import { COMMAND_COPY, commandErrorMessage, isVersionConflict } from '../../src/modules/organiser/shared/selfServeErrors';

/**
 * Wave B0 follow-up: every refusal sentence in COMMAND_COPY must fit a phone, in
 * the REAL component that shows it. The change flow's "Take this date off" step
 * (flows/change/TakeOff.tsx, `change-error-message`) renders commandErrorMessage(err) next to its
 * confirm button; the series command is answered with a refusal carrying the row's
 * message, so the sentence reaches the screen through the real mapping.
 *
 * The list comes from the exported array (a new row is covered at once); the count
 * assertion fails if a row is dropped from it. Nothing reaches any Supabase project.
 */

const SERIES = '5e000000-0000-4000-8000-0000000000f1'; // the go-live scenario's series (organiser_home_v1 lists it)
const OCC = '5e000000-0000-4000-8000-000000000002';
const OWN_ORG = '00000000-0000-4000-8000-0000000000a1';

// One sample server message per row: the regex's own literal text is not available, so each
// row is fed a message it matches (see MATCHING below), and the sentence it maps to is read back.
const LONG_TITLE = 'T'.repeat(80);

/** A server message each COMMAND_COPY row matches, built from the row's own pattern. */
function sampleFor(re: RegExp): string {
  // The session-title rule is anchored and takes a title: give it the longest the server sends.
  if (re.source.includes('would delete its per-date changes')) return `permission_denied: removing the session "${LONG_TITLE}" would delete its per-date changes`;
  // Literal parens are escaped in the patterns: park them, flatten the groups, restore them.
  const src = re.source.replace(/^\^/, '').replace(/\\\(/g, '@@LP@@').replace(/\\\)/g, '@@RP@@');
  // Alternations and optional groups: take the first branch (the optional part included).
  const flat = src.replace(/\((?:\?:)?([^()]*)\)\??/g, (_m, g: string) => g.split('|')[0]);
  return flat.split('|')[0].replace(/\.\{0,\d+\}/g, '').replace(/\\\./g, '.').replace(/@@LP@@/g, '(').replace(/@@RP@@/g, ')').replace(/\\/g, '');
}

interface Row { message: string; serverText: string }
const rows: Row[] = [];
const covered = new Set<string>();
for (const c of COMMAND_COPY) {
  const raw = sampleFor(c.match);
  // The sample must reach THIS row through the real mapping (earlier rows win, as in commandErrorMessage).
  const mapped = commandErrorMessage({ code: 'P0001', message: raw });
  const hit = raw.match(c.match);
  const message = typeof c.message === 'string' ? c.message : hit ? c.message(hit) : '';
  if (!message) throw new Error(`cannot build a sample server message for ${c.match}`);
  if (mapped !== message && !covered.has(mapped)) throw new Error(`sample for ${c.match} maps to a different sentence: ${mapped}`);
  covered.add(message);
  if (mapped === message && !rows.some((r) => r.message === message)) rows.push({ message, serverText: raw });
}

const json = (body: unknown, status = 200) => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function openBreakSheet(page: Page, serverText: { current: string }) {
  await fakeSupabase(page, { signedInAsOwner: true, realClock: true, goLive: {} });
  const DATE = '2026-10-30'; // a Friday after the scenario's today (2026-10-23)
  const reads: Record<string, unknown> = {
    organiser_get_occurrence_programme_v1: { occurrence_id: OCC, series_id: SERIES, occurrence_date: DATE, version: 7, editable: true, not_editable_reason: null, sessions: [], session_people: [] },
    event_view_p5: { occurrence: { id: OCC, date: DATE, version: 1, lifecycle_status: 'scheduled' }, event: { venue_id: null }, schedule: {} },
    admin_event_workspace_p5: {
      series: { series: { id: SERIES, organiser_id: OWN_ORG, name: 'Thursday Party', lifecycle_status: 'live', version: 3, default_venue_id: null, default_start_date: '2026-01-01', recurrence_rule: { mode: 'weekly', weekdays: [5] } }, program: [] },
      occurrences: [{ id: OCC, occurrence_date: DATE, lifecycle_status: 'scheduled', version: 1 }],
    },
    get_organiser_venue_options_v1: [],
  };
  // Registered after fakeSupabase's catch-all, so it answers first.
  await page.route('**/rest/v1/rpc/*', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    if (name === 'series_command_p5') return route.fulfill(json({ code: 'P0001', message: serverText.current, details: null, hint: null }, 400));
    if (name in reads) return route.fulfill(json(reads[name]));
    return route.fallback();
  });
  await page.goto(`/account/o/change/${SERIES}/${OCC}/off`);
  await settled(page);
  await page.getByTestId('change-off-screen').waitFor();
}

test('the refusal list is derived from COMMAND_COPY (every row covered, count pinned)', () => {
  // Rows can share a sentence, so the sentences are the distinct ones; a dropped row must be a conscious edit here.
  expect(covered.size).toBeGreaterThanOrEqual(25);
  expect(rows.length).toBe(covered.size);
  expect(rows.length).toBeGreaterThanOrEqual(25);
});

test('every refusal sentence fits the phone: no overflow, fully visible, control reachable, readable contrast', async ({ page }) => {
  test.setTimeout(180_000);
  const vp = page.viewportSize()!;
  const serverText = { current: '' };
  await openBreakSheet(page, serverText);
  const problems: string[] = [];

  for (const row of rows) {
    // A version conflict is its own screen (EventConflict), not a line under the button.
    if (isVersionConflict({ code: 'P0001', message: row.serverText })) continue;
    serverText.current = row.serverText;
    await page.getByTestId('change-off-confirm').click();
    const note = page.getByTestId('change-error-message');
    await expect(note).toHaveText(row.message);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    const m = await page.evaluate(() => {
      const note = document.querySelector<HTMLElement>('[data-testid="change-error-message"]')!;
      const btn = document.querySelector<HTMLElement>('[data-testid="change-off-confirm"]')!;
      const scroller = (() => { for (let n: HTMLElement | null = note; n; n = n.parentElement) { if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n; } return null; })();
      // The person scrolls the sheet if it is taller than the screen: scroll so the note and the control are both in reach.
      note.scrollIntoView({ block: 'nearest' });
      const nr = note.getBoundingClientRect();
      const br = btn.getBoundingClientRect();
      const hitEl = document.elementFromPoint(br.x + br.width / 2, br.y + br.height / 2);
      // Clipping: every ancestor up to the body that clips overflow must contain the note's rect.
      let clipped = false;
      for (let n: HTMLElement | null = note.parentElement; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) {
          const r = n.getBoundingClientRect();
          if (nr.left < r.left - 0.5 || nr.right > r.right + 0.5) clipped = true;
        }
      }
      const ns = getComputedStyle(note);
      // Colour contrast: composite the background down the ancestors, then WCAG ratio.
      const toRgba = (c: string): [number, number, number, number] => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1;
        const ctx = cv.getContext('2d', { willReadFrequently: true })!;
        ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
      };
      let bg: [number, number, number] = [255, 255, 255];
      const layers: Array<[number, number, number, number]> = [];
      for (let n: HTMLElement | null = note; n; n = n.parentElement) {
        const c = toRgba(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      }
      for (const [r, g, b, a] of layers.reverse()) bg = [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)];
      const fg = toRgba(ns.color);
      const comp = [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
      const lum = (c: number[]) => { const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const [l1, l2] = [lum(comp), lum(bg)].sort((a, b) => b - a);
      return {
        noteBox: { x: nr.x, y: nr.y, w: nr.width, h: nr.height }, btnBox: { x: br.x, y: br.y, w: br.width, h: br.height },
        noteScrollW: note.scrollWidth, noteClientW: note.clientWidth,
        pageScrollW: document.documentElement.scrollWidth, pageClientW: document.documentElement.clientWidth,
        scrollerOverflowX: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : false,
        lineClamp: ns.webkitLineClamp !== 'none' || ns.textOverflow === 'ellipsis',
        clipped, btnHit: !!hitEl && (hitEl === btn || btn.contains(hitEl)),
        contrast: (l1 + 0.05) / (l2 + 0.05),
      };
    });

    const fail = (what: string) => problems.push(`[${vp.width}x${vp.height}] ${what}: "${row.message.slice(0, 60)}"`);
    if (m.noteScrollW > m.noteClientW + 0.5) fail(`note overflows its box (${m.noteScrollW}>${m.noteClientW})`);
    if (m.pageScrollW > m.pageClientW) fail(`page scrolls sideways (${m.pageScrollW}>${m.pageClientW})`);
    if (m.scrollerOverflowX) fail('sheet scrolls sideways');
    if (m.lineClamp) fail('note is ellipsised');
    if (m.clipped) fail('note is clipped by an ancestor');
    if (m.noteBox.x < -0.5 || m.noteBox.x + m.noteBox.w > vp.width + 0.5) fail(`note outside the viewport horizontally (${m.noteBox.x}..${m.noteBox.x + m.noteBox.w})`);
    if (m.noteBox.y < 0 || m.noteBox.y + m.noteBox.h > vp.height + 0.5) fail(`note outside the viewport vertically (${m.noteBox.y}..${m.noteBox.y + m.noteBox.h})`);
    if (m.btnBox.h < 44) fail(`confirm button ${m.btnBox.h}px tall (<44)`);
    if (m.btnBox.y < 0 || m.btnBox.y + m.btnBox.h > vp.height + 0.5 || m.btnBox.x < -0.5 || m.btnBox.x + m.btnBox.w > vp.width + 0.5) fail('confirm button outside the viewport');
    if (!m.btnHit) fail('confirm button is covered at its centre');
    if (m.contrast < 4.5) fail(`contrast ${m.contrast.toFixed(2)}:1 (<4.5)`);
  }
  await page.screenshot({ path: test.info().outputPath(`refusal-copy-${vp.width}x${vp.height}.png`) });
  expect(problems, `${rows.length} messages at ${vp.width}x${vp.height}`).toEqual([]);
});
