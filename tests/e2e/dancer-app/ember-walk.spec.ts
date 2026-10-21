import { test, expect, type Page } from '@playwright/test';
import { NOW, OrganiserFake, json } from '../helpers/organiserFake';

// D115 restyle walk: every /app/* route and the prototype's jump-list states at 390x844 and 1280x800 on MOCKED data
// (the lineup RPC is not on prod yet, so it is answered here). Per visit: zero console errors, no horizontal scroll,
// the primary control is not covered (elementFromPoint at its centre), the tab bar does not cover the last row.
// Screenshots at 390x844 go to docs/people-arc/restyle-b/. Not in the e2e-smoke list: a worker-run evidence spec.

const SHOTS = 'docs/people-arc/restyle-b';
const rpc = (name: string) => `**/rest/v1/rpc/${name}`;
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (offset: number) => {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + offset);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const PROFILE = {
  profile_id: 'b1000000-0000-4000-8000-000000000001', user_id: 'a1000000-0000-4000-8000-000000000001',
  display_name: null, first_name: 'Ana', surname: null, hide_surname_publicly: false,
  based_city_id: 'c1000000-0000-4000-8000-000000000001', city_name: 'London', dance_role: 'Follower',
  nationality: null, languages: [], bio: null, instagram: null, facebook: null, website_url: null, whatsapp: null,
  show_whatsapp_publicly: true, avatar_url: 'https://media.bachatacalendar.co.uk/walk-avatar.png', dance_started_year: null, favorite_styles: [], favorite_songs: [],
  achievements: [], other_roles: [], is_active: true, erase_requested_at: null, linked_from_admin: false, complete: true,
  strength: { pct: 70, next_step: 'started_year', missing: ['started_year', 'styles', 'bio_social'] },
};
const night = (id: string, name: string, offset: number, status = 'going') => ({
  event_id: id, status, updated_at: null, name, occurrence_date: dayKey(offset), city_name: 'Camden', start_time: '21:00:00', type: 'party', is_active: true,
});
const NIGHTS = [night('s1', 'Soho Sensual Thursdays', 4), night('s2', 'Camden Social', 9, 'interested'), night('s3', 'Sensual Sundays', -3), night('s4', 'Brixton Bachata', -17, 'interested')];
const PEOPLE = {
  total: 3,
  people: [
    { profile_id: 'p1', roles: ['teacher', 'dj'], display_name: 'Lena Ortiz', avatar_url: null, public_path: '/teachers/lena-ortiz', last_night: { series_id: 's3', event_name: 'Sensual Sundays', slug: null, on_date: dayKey(-3) } },
    { profile_id: 'p2', roles: ['dj'], display_name: 'Marco Vidal', avatar_url: null, public_path: '/djs/marco-vidal', last_night: { series_id: 's4', event_name: 'Brixton Bachata', slug: null, on_date: dayKey(-17) } },
    { profile_id: 'p3', roles: ['teacher'], display_name: 'Sofia Reyes', avatar_url: null, public_path: '/teachers/sofia-reyes', last_night: { series_id: 's4', event_name: 'Brixton Bachata', slug: null, on_date: dayKey(-17) } },
  ],
};
const STATS = { profile_id: PROFILE.profile_id, member_since: '2026-09-01T10:00:00Z', nights_going_upcoming: 1, nights_went: 2, interested_upcoming: 1, level_votes: 1, views_30_days: 4, views_total: 9 };
const VIEWS = { profile_id: PROFILE.profile_id, total: 9, last_7_days: 3, last_30_days: 4, previous_30_days: 1, last_viewed_at: null };

type State = { id: string; path: string; profile?: Record<string, unknown> | 'none'; rows?: unknown[]; lineup?: 'ok' | 'empty' | 'error'; primary?: string; contrast?: string; act?: (p: Page) => Promise<void> };
const STATES: State[] = [
  { id: 'home-filled', path: '/app/home', rows: NIGHTS, primary: '[data-testid="home-hero"] a' },
  { id: 'home-empty', path: '/app/home', rows: [], lineup: 'empty' },
  { id: 'home-lineup-error', path: '/app/home', rows: NIGHTS, lineup: 'error', primary: '[data-testid="home-hero"] a' },
  { id: 'home-hidden-profile', path: '/app/home', profile: { ...PROFILE, is_active: false }, rows: NIGHTS },
  { id: 'home-no-profile', path: '/app/home', profile: 'none' },
  { id: 'nights-filled', path: '/app/nights', rows: NIGHTS },
  { id: 'nights-empty', path: '/app/nights', rows: [] },
  { id: 'me', path: '/app/me', rows: NIGHTS, primary: '[data-testid="me-main-action"]', contrast: '[data-testid="me-main-action"]' },
  { id: 'me-no-profile', path: '/app/me', profile: 'none' },
  { id: 'edit', path: '/app/me/edit', primary: '[data-testid="edit-save"]' },
  {
    id: 'edit-discard-sheet', path: '/app/me/edit',
    act: async (p) => {
      await p.getByLabel(/^Display name/).fill('Changed');
      await p.getByTestId('edit-header-back').click();
      await expect(p.getByText('Discard changes?')).toBeVisible();
    },
  },
  { id: 'photo', path: '/app/me/photo', primary: '[data-testid="photo-pick"] label' },
  { id: 'page', path: '/app/page', rows: NIGHTS },
  { id: 'page-no-profile', path: '/app/page', profile: 'none' },
  { id: 'options', path: '/app/options', primary: '[data-testid="opt-share"]' },
  { id: 'options-no-profile', path: '/app/options', profile: 'none' },
  { id: 'welcome', path: '/app/welcome', profile: { ...PROFILE, complete: false, avatar_url: null, strength: { pct: 40, next_step: 'photo', missing: ['photo'] } } },
];

async function install(page: Page, s: State) {
  const fake = new OrganiserFake({ noOrganiser: true });
  await fake.install(page);
  // 1x1 PNG for the avatar host the site's CSP allows.
  await page.route('https://media.bachatacalendar.co.uk/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
  await page.route(rpc('dancer_area_gate_v1'), (r) => json(r, { open: false, allowed: true }));
  await page.route(rpc('my_dancer_edit_v1'), (r) =>
    s.profile === 'none' ? r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'no_profile', code: 'P0001' }) }) : json(r, s.profile ?? PROFILE));
  await page.route(rpc('get_my_event_attendance_v2'), (r) => json(r, s.rows ?? []));
  await page.route(rpc('get_calendar_events_v2'), (r) => json(r, []));
  await page.route(rpc('my_dancer_stats_v1'), (r) => json(r, STATS));
  await page.route(rpc('my_profile_views_v1'), (r) => json(r, VIEWS));
  await page.route(rpc('my_feature_interest_v1'), (r) => json(r, { features: [] }));
  await page.route(rpc('series_level_summary_p5_v1'), (r) => json(r, { series_id: 's', vote_count: 1, threshold: 7, counts: null, derived_level: null, my_level: null }));
  await page.route(rpc('my_nights_lineup_people_v1'), (r) =>
    s.lineup === 'error'
      ? r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'function public.my_nights_lineup_people_v1() does not exist' }) })
      : json(r, s.lineup === 'empty' ? { total: 0, people: [] } : PEOPLE));
}

for (const [label, viewport, shoot] of [['390x844', { width: 390, height: 844 }, true], ['360x640', { width: 360, height: 640 }, false], ['1280x800', { width: 1280, height: 800 }, false]] as const) {
  test.describe(`ember walk ${label}`, () => {
    test.use({ viewport });
    for (const s of STATES) {
      test(s.id, async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(String(e)));
        await install(page, s);
        await page.goto(s.path);
        await expect(page.getByTestId('dancer-app-shell')).toBeVisible();
        await expect(page.getByTestId('site-home-link')).toBeVisible();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(400);
        if (s.act) await s.act(page);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(wide, 'horizontal scroll').toBeLessThanOrEqual(0);
        if (s.primary) {
          const covered = await page.evaluate((sel) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return 'missing';
            el.scrollIntoView({ block: 'center' });
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return hit && (hit === el || el.contains(hit)) ? 'ok' : `covered by ${hit?.tagName}.${hit?.className}`;
          }, s.primary);
          expect(covered, `primary ${s.primary}`).toBe('ok');
        }
        // Review B3: every filled ember control (the primary, as a button OR a link) reads at 4.5:1 or better. The
        // background is resolved up the tree; a gradient or image surface is skipped (checked by eye, see the handover).
        const lowContrast = await page.evaluate(() => {
          const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
          const lum = ([r, g, b]: number[]) => {
            const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const bgOf = (el: Element | null): number[] | null => {
            for (let e = el; e; e = e.parentElement) {
              const cs = getComputedStyle(e);
              if (cs.backgroundImage !== 'none') return null;
              const c = rgb(cs.backgroundColor);
              if (c.length >= 3 && (c.length < 4 || c[3] > 0)) return c.slice(0, 3);
            }
            return [255, 255, 255];
          };
          const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
          return Array.from(document.querySelectorAll('[data-testid="dancer-app-content"] a, [data-testid="dancer-app-content"] button, [data-testid="dancer-app-content"] label'))
            .filter((e) => (e as HTMLElement).offsetHeight > 0 && (e.textContent ?? '').trim() && !(e as HTMLButtonElement).disabled)
            .filter((e) => getComputedStyle(e).backgroundColor === 'rgb(240, 112, 58)')
            .map((e) => ({ text: (e.textContent ?? '').trim().slice(0, 30), r: ratio(rgb(getComputedStyle(e).color).slice(0, 3), bgOf(e) ?? [0, 0, 0]) }))
            .filter((x) => x.r < 4.5)
            .map((x) => `${x.text} ${x.r.toFixed(2)}:1`);
        });
        expect(lowContrast, 'ember fills under 4.5:1').toEqual([]);
        if (s.contrast) {
          const r = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return 0;
            const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3);
            const lum = ([r, g, b]: number[]) => {
              const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
              return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
            };
            const cs = getComputedStyle(el);
            const [x, y] = [lum(rgb(cs.color)), lum(rgb(cs.backgroundColor))].sort((m, n) => n - m);
            return (x + 0.05) / (y + 0.05);
          }, s.contrast);
          expect(r, `contrast of ${s.contrast}`).toBeGreaterThanOrEqual(4.5);
        }
        // The tab bar must not cover the last row once scrolled to the bottom.
        const overlap = await page.evaluate(() => {
          const tabs = document.querySelector('[data-testid="dancer-app-tabs"]') as HTMLElement | null;
          const content = document.querySelector('[data-testid="dancer-app-content"]') as HTMLElement | null;
          if (!tabs || !content) return 0;
          window.scrollTo(0, document.body.scrollHeight);
          const kids = Array.from(content.querySelectorAll('*')).filter((e) => (e as HTMLElement).getBoundingClientRect().height > 0);
          const bottom = Math.max(0, ...kids.map((e) => (e as HTMLElement).getBoundingClientRect().bottom));
          return bottom - tabs.getBoundingClientRect().top;
        });
        expect(overlap, 'last row under the tab bar').toBeLessThanOrEqual(0);
        // "Extra attributes from the server: nonce" is the dev server's own SSR hydration warning (root.tsx), on every page.
        // The failed-read states fail ON PURPOSE; react-query logs those as "Query error:" -- allowed there and nowhere else.
        const deliberate = s.profile === 'none' || s.lineup === 'error';
        expect(errors.filter((e) => !/Failed to load resource|fonts\.g|net::ERR|Extra attributes from the server/.test(e) && !(deliberate && /^Query error:/.test(e))), 'console errors').toEqual([]);
        if (shoot) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `${SHOTS}/${s.id}.png`, fullPage: false });
        }
      });
    }
  });
}
