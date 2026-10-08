import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { SURVEY_FILE } from './global-setup';
import type { Shape, Survey } from './lib/shapes';
import { visit } from './lib/visit';

// LAYER 1 -- the shape matrix. Every real event shape production has today
// (from the read-only survey in global-setup) x every public screen that shows
// it: event page, organiser page, search, and the city list.
//
// THE RULES (CLAUDE.md "Definition of done", step 2):
//   - the same fact reads the same on every screen (title, next date, whether
//     it is still running), checked against the database's own answer;
//   - no copy points at a control that is not on screen  (visit(), all pages);
//   - every empty state says what the person CAN do;
//   - a control that cannot work is disabled WITH a reason (visit(), all pages);
//     a ticket link with nothing behind it is not shown at all.
//
// SCOPE CUT, ON PURPOSE. For paused / archived / draft / ended series and for
// cancelled dates, the page state (HTTP status, JSON-LD offers/eventStatus,
// banners) is being changed by another worker right now. For those shapes this
// spec asserts only what holds whatever that work decides: the page renders
// without client errors and passes the per-page checks. Their copy findings go
// in the PR body, not in assertions.
//
// Every page goes through visit(), so all of it also gets Layer 3.

function loadSurvey(): Survey | null {
  const raw = JSON.parse(readFileSync(SURVEY_FILE, 'utf8')) as Survey | { skip: string };
  return 'skip' in raw ? null : raw;
}
const SURVEY = loadSurvey();
const SHAPES = SURVEY?.shapes ?? [];

const isLive = (s: Shape) => s.lifecycle === 'live';
const liveFuture = SHAPES.filter((s) => isLive(s) && s.n_future_live > 0);
const livePastOnly = SHAPES.filter((s) => isLive(s) && s.n_future_live === 0 && s.n_future_cancelled === 0);
const stateNeutral = SHAPES.filter((s) => !isLive(s));

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/**
 * "2026-10-10" -> matches "10 Oct", "10\nOCTOBER", "10 / OCT", and the first
 * day of a festival range "THU 10 \u2013 SUN 13 OCTOBER".
 */
function dayMonthPattern(isoDate: string): RegExp {
  const [, m, d] = isoDate.split('-').map(Number);
  const mon = MONTHS[m - 1];
  return new RegExp(`(^|[^0-9])0?${d}(\\s*(?:/\\s*)?${mon}|\\s*[-\u2013]\\s*(?:[a-z]{3}\\s+)?\\d{1,2}\\s+${mon})`, 'i');
}

const ENDED_COPY = /has ended|has finished|no longer running/i;
const norm = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase();

/** Links on the page that point at this event, by slug or any of its ids. */
function eventLinks(page: Page, scope: string, s: Shape) {
  const sel = [s.slug, ...s.ids]
    .flatMap((k) => [`${scope} a[href="/event/${k}"]`, `${scope} a[href^="/event/${k}?"]`])
    .join(', ');
  return page.locator(sel);
}

/**
 * Text of the smallest card-like element inside `scope` whose text contains
 * `name` (case-insensitive), or null when the name is not there at all.
 */
async function cardText(page: Page, scope: string, name: string): Promise<string | null> {
  return page.evaluate(([sc, nm]) => {
    const root = document.querySelector(sc);
    if (!root) return null;
    const want = nm.replace(/\s+/g, ' ').trim().toLowerCase();
    const has = (el: Element) => ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').toLowerCase().includes(want);
    if (!has(root)) return null;
    let best: HTMLElement | null = null;
    for (const el of Array.from(root.querySelectorAll('a, button, li, article, [role="button"], [data-occ]'))) {
      if (!has(el)) continue;
      if (!best || (el as HTMLElement).innerText.length < best.innerText.length) best = el as HTMLElement;
    }
    return (best ?? (root as HTMLElement)).innerText;
  }, [scope, name] as const);
}

test.beforeEach(() => {
  test.skip(!SURVEY, 'No shape survey (SUPABASE_ACCESS_TOKEN unset): the matrix does not guess shapes.');
});

test.describe('event page x shape', () => {
  test('live, with upcoming dates: title, next date, tickets and "still running" agree with the database', async ({ page }, testInfo) => {
    test.skip(liveFuture.length === 0, 'no live series with upcoming dates today');
    for (const [i, s] of liveFuture.entries()) {
      await test.step(`${s.shape_key} /event/${s.slug}`, async () => {
        await visit(page, testInfo, `/event/${s.slug}`, i === 0 ? { screenshot: 'event-live-future' } : {});
        const label = `/event/${s.slug} (${s.shape_key})`;
        const h1 = await page.getByRole('heading', { level: 1 }).first().innerText();
        expect.soft(norm(h1), `${label}: page title is the event name`).toBe(norm(s.name));
        const body = await page.locator('body').innerText();
        expect.soft(ENDED_COPY.test(body), `${label}: a running event must not say it has ended`).toBe(false);
        expect.soft(await page.getByTestId('event-ended-record').count(), `${label}: no "finished" record on a running event`).toBe(0);
        if (s.next_live_date) {
          expect.soft(dayMonthPattern(s.next_live_date).test(body), `${label}: shows its next date ${s.next_live_date}`).toBe(true);
        }
        const tickets = page.getByRole('link', { name: /get tickets/i }).filter({ visible: true });
        if (s.has_ticket) {
          expect.soft(await tickets.count(), `${label}: has a ticket link, so "Get Tickets" is on screen`).toBeGreaterThan(0);
          for (const href of await tickets.evaluateAll((n) => n.map((a) => a.getAttribute('href')))) {
            expect.soft(href, `${label}: every "Get Tickets" goes somewhere`).toMatch(/^https?:\/\//);
          }
        } else {
          await expect.soft(tickets, `${label}: no ticket link, so no "Get Tickets" control`).toHaveCount(0);
        }
      });
    }
  });

  test('live, every date past: reads as over, offers no tickets, and says what to do instead', async ({ page }, testInfo) => {
    test.skip(livePastOnly.length === 0, 'no live series with only past dates today');
    for (const [i, s] of livePastOnly.entries()) {
      await test.step(`${s.shape_key} /event/${s.slug}`, async () => {
        await visit(page, testInfo, `/event/${s.slug}`, i === 0 ? { screenshot: 'event-live-past-only' } : {});
        const label = `/event/${s.slug} (${s.shape_key})`;
        const body = await page.locator('body').innerText();
        expect.soft(ENDED_COPY.test(body), `${label}: every date is past, so the page says so`).toBe(true);
        await expect.soft(page.getByRole('link', { name: /get tickets/i }).filter({ visible: true }), `${label}: no tickets for a past date`).toHaveCount(0);
        // Empty state: no upcoming date -> something the person can do next.
        const next = page.locator('main a[href*="/event/"], main a[href^="/organisers/"], main a[href^="/city/"], main a[href="/"]').filter({ visible: true });
        expect.soft(await next.count(), `${label}: no upcoming dates, so the page links somewhere to go next`).toBeGreaterThan(0);
      });
    }
  });

  test('paused / archived / draft / ended: renders without client errors (state-neutral)', async ({ page }, testInfo) => {
    test.skip(stateNeutral.length === 0, 'no such shapes today');
    for (const [i, s] of stateNeutral.entries()) {
      await test.step(`${s.shape_key} /event/${s.slug}`, async () => {
        // visit() asserts: no error boundary, no client/hydration errors, no
        // prod writes, no new page-check findings. Nothing about status/state.
        await visit(page, testInfo, `/event/${s.slug}`, i === 0 ? { screenshot: `event-${s.lifecycle}` } : {});
      });
    }
  });
});

test.describe('organiser page x shape', () => {
  test('a live series is listed under Upcoming on its organiser page exactly when it has a future date, with the same name and date', async ({ page }, testInfo) => {
    const rows = [...liveFuture, ...livePastOnly].filter((s) => s.organiser_slugs.length > 0);
    test.skip(rows.length === 0, 'no live series with an organiser today');
    for (const [i, s] of rows.entries()) {
      const org = s.organiser_slugs[0];
      await test.step(`${s.shape_key} /organisers/${org} -> ${s.slug}`, async () => {
        await visit(page, testInfo, `/organisers/${org}`, i === 0 ? { screenshot: 'organiser' } : {});
        const label = `/organisers/${org} for ${s.slug} (${s.shape_key})`;
        // A multi-date series is one expandable card (not a link), so the
        // card is found by the event's NAME -- which is the fact under test.
        const card = await cardText(page, 'section#upcoming', s.name);
        if (s.n_future_live > 0) {
          expect.soft(card, `${label}: listed under Upcoming by its name`).not.toBeNull();
          if (card && s.next_live_date) {
            expect.soft(dayMonthPattern(s.next_live_date).test(card), `${label}: card shows the next date ${s.next_live_date} (card: "${card.replace(/\s+/g, ' ').slice(0, 120)}")`).toBe(true);
          }
        } else {
          expect.soft(card, `${label}: every date past, so NOT under Upcoming`).toBeNull();
          expect.soft(await eventLinks(page, 'section#upcoming', s).count(), `${label}: and no Upcoming link opens it`).toBe(0);
        }
      });
    }
  });

  test('an organiser with no events says what the visitor can do instead', async ({ page }, testInfo) => {
    const empty = (SURVEY?.empty_organisers ?? []).slice(0, 2);
    test.skip(empty.length === 0, 'no organiser without events today');
    for (const o of empty) {
      await test.step(`/organisers/${o.slug}`, async () => {
        await visit(page, testInfo, `/organisers/${o.slug}`);
        const label = `/organisers/${o.slug} (no events)`;
        const main = page.locator('main');
        expect.soft(/browse|check back|follow|see what|find/i.test(await main.innerText()), `${label}: empty state says what to do`).toBe(true);
        const go = main.locator('a[href^="/"], button').filter({ hasText: /browse|upcoming|events|nights|calendar/i }).filter({ visible: true });
        expect.soft(await go.count(), `${label}: and offers a control to do it`).toBeGreaterThan(0);
      });
    }
  });
});

test.describe('search x shape', () => {
  test('search finds a live series by name with the same name and next date; past-only ones under All time', async ({ page }, testInfo) => {
    const rows = [...liveFuture, ...livePastOnly];
    test.skip(rows.length === 0, 'no live series today');
    for (const [i, s] of rows.entries()) {
      const past = s.n_future_live === 0;
      const q = `/search?q=${encodeURIComponent(s.name)}${past ? '&time=all' : ''}`;
      await test.step(`${s.shape_key} ${q}`, async () => {
        await visit(page, testInfo, q, i === 0 ? { screenshot: 'search-results' } : {});
        const label = `${q} (${s.shape_key})`;
        const hits = eventLinks(page, 'main', s);
        expect.soft(await hits.count(), `${label}: the event is in the results`).toBeGreaterThan(0);
        if (await hits.count()) {
          const text = await hits.first().innerText();
          expect.soft(norm(text), `${label}: result names the event as its page does`).toContain(norm(s.name));
          if (!past && s.next_live_date) {
            expect.soft(dayMonthPattern(s.next_live_date).test(text), `${label}: result shows the next date ${s.next_live_date}`).toBe(true);
          }
        }
      });
    }
  });

  test('search with no results says what the person can do, and that control is on screen', async ({ page }, testInfo) => {
    await visit(page, testInfo, '/search?q=zzqxjv-no-such-event', { screenshot: 'search-empty' });
    const main = page.locator('main');
    const text = await main.innerText();
    expect(/no results/i.test(text), 'empty search says it found nothing').toBe(true);
    expect.soft(/try|switch|browse|open/i.test(text), 'and says what to try instead').toBe(true);
    expect.soft(await main.getByRole('button').filter({ visible: true }).count() + await main.getByRole('link').filter({ visible: true }).count(),
      'and a control to do it is visible').toBeGreaterThan(0);
  });
});

test.describe('lists x event page', () => {
  test('each card on the city page names the event its link opens', async ({ page }, testInfo) => {
    await visit(page, testInfo, '/city/london-gb', { screenshot: 'city-london' });
    const cards = page.locator('a[data-occ][href*="/event/"]');
    const n = Math.min(await cards.count(), 4);
    expect.soft(n, 'the city page lists events').toBeGreaterThan(0);
    const picks: { href: string; text: string }[] = [];
    for (let i = 0; i < n; i++) {
      picks.push({ href: (await cards.nth(i).getAttribute('href')) as string, text: await cards.nth(i).innerText() });
    }
    for (const c of picks) {
      await test.step(`card -> ${c.href}`, async () => {
        await visit(page, testInfo, c.href);
        const h1 = await page.getByRole('heading', { level: 1 }).first().innerText().catch(() => '');
        expect.soft(norm(c.text), `card for ${c.href} names the event as its page does ("${h1}")`).toContain(norm(h1));
      });
    }
  });
});
