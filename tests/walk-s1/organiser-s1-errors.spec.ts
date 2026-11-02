import AxeBuilder from '@axe-core/playwright';
import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fakeSupabase } from '../e2e-phone/helpers';
import { FAKE_ORIGIN } from '../e2e-phone/fakeSupabase.mjs';
import { STATES, walkAnswer } from './states.mjs';

// Walk S1 (PR #1282, /organisers/:slug feed errors) at 390x844. Mocked network only
// (SSR: preload.mjs; browser: page.route). Writes docs/walk/s1-errors-r1/{results.json,*.png}.
// It records and judges; it asserts nothing, so every state is walked even after a finding.
const OUT = 'docs/walk/s1-errors-r1';
test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: 'serial' });
mkdirSync(OUT, { recursive: true });
const results: Record<string, unknown>[] = [];

const FEEDS = ['calendar', 'events', 'team'];
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const t = (e: Element | null) => (e ? (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim() : null);
    const strip = document.querySelector('div.flex.justify-around.py-3.px-5');
    const stats = Array.from(strip?.children ?? []).map((c) => t(c));
    const errs = ['upcoming', 'past', 'team'].filter((f) => document.querySelector(`[data-testid="org-feed-error-${f}"]`));
    const empty = document.querySelector('[data-testid="org-public-empty"]');
    return {
      stats, errs, emptyKind: empty?.getAttribute('data-kind') ?? null, emptyText: t(empty),
      errText: errs.map((f) => t(document.querySelector(`[data-testid="org-feed-error-${f}"]`))),
      upcomingList: document.querySelectorAll('#upcoming a[href*="/event"]').length, upcomingSection: !!document.querySelector('#upcoming'),
      pastSection: !!document.querySelector('#past'), teamSection: /Teachers & DJs/i.test(document.body.innerText),
    };
  });
}

for (const s of STATES) {
  test(`${s.tag} ${s.label}`, async ({ page }) => {
    test.setTimeout(150_000);
    let healed = false;
    const consoleErrors: string[] = []; const failedLoads: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') (/Failed to load resource/.test(m.text()) ? failedLoads : consoleErrors).push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`));
    await fakeSupabase(page, { realClock: true, signedInAsOwner: !!s.owner });
    await page.route(`${FAKE_ORIGIN}/**`, (route) => {
      const r = route.request(); const u = new URL(r.url());
      if (!/get_organiser_(calendar|public)_events_v1|\/organiser_team_members$/.test(u.pathname)) return route.fallback();
      return route.fulfill(walkAnswer({ method: r.method(), url: r.url(), headers: r.headers(), body: r.postData() }, healed));
    });
    let nav = 0;
    for (; nav < 3; nav++) { try { await page.goto(`/organisers/${s.slug}`); await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 40_000 }); break; } catch { /* cold dev server: retry */ } }
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1500); // let React Query's retries on a failing feed run out
    await page.screenshot({ path: `${OUT}/${s.tag}-${s.key}.png`, fullPage: true });
    const before = await snapshot(page);

    const small = await page.evaluate(() => Array.from(document.querySelectorAll('a[href], button, [role=button]')).map((e) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { el: `${e.tagName.toLowerCase()} "${((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').trim().slice(0, 28)}"`, w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden', inline: cs.display === 'inline' };
    }).filter((x) => x.vis && (x.h < 44 || x.w < 44) && !x.inline));
    const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, w: window.innerWidth }));
    const axe = await new AxeBuilder({ page }).options({ preload: false }).withRules(['color-contrast']).analyze();
    const ratios = axe.violations.flatMap((v) => v.nodes.flatMap((n) => n.any.map((a) => ({ ratio: a.data?.contrastRatio as number | undefined, target: String(n.target).slice(0, 60), inc: v === undefined }))))
      .filter((x) => typeof x.ratio === 'number').sort((a, b) => a.ratio! - b.ratio!);

    // Tap Try again once, with the mock now healthy.
    let retry: unknown = 'n/a (no error line)';
    if (before.errs.length) {
      healed = true;
      const btn = page.getByRole('button', { name: 'Try again' }).first();
      const box = await btn.boundingBox();
      await btn.tap();
      await page.waitForTimeout(2500);
      const after = await snapshot(page);
      await page.screenshot({ path: `${OUT}/${s.tag}-${s.key}-after-retry.png`, fullPage: true });
      retry = { tapBox: box && { w: Math.round(box.width), h: Math.round(box.height) }, errsAfter: after.errs, statsAfter: after.stats, upcomingSection: after.upcomingSection, pastSection: after.pastSection, emptyKind: after.emptyKind };
    }
    const f = s.fail as string[];
    const upFail = f.includes('cal') || f.includes('events'); const pastFail = f.includes('past') || f.includes('events');
    const labelIn = (re: RegExp) => before.stats.some((t) => t && re.test(t));
    const problems: string[] = [];
    if (upFail && labelIn(/Upcoming dates/)) problems.push('stats strip shows Upcoming dates for a failed feed');
    if (pastFail && labelIn(/Past nights/)) problems.push('stats strip shows Past nights for a failed feed');
    if (upFail !== before.errs.includes('upcoming')) problems.push(`upcoming error line ${upFail ? 'missing' : 'unexpected'}`);
    if (pastFail !== before.errs.includes('past')) problems.push(`past error line ${pastFail ? 'missing' : 'unexpected'}`);
    if (f.includes('team') !== before.errs.includes('team')) problems.push(`team error line ${f.includes('team') ? 'missing' : 'unexpected'}`);
    if (f.length && before.emptyKind) problems.push(`false empty box (${before.emptyKind}) while a feed failed`);
    if (!f.length && s.key.startsWith('empty') && !before.emptyKind) problems.push('real empty organiser shows no empty box');
    if (!f.length && !s.key.startsWith('empty') && before.emptyKind) problems.push('false empty box on a healthy organiser');
    if (before.stats.some((t) => t && /^0\b/.test(t)) && f.length) problems.push('a "0" stat is shown while a feed failed');
    if (before.errs.length && (typeof retry === 'string' || (retry as any).errsAfter.includes(before.errs[0]))) problems.push('Try again did not clear the tapped error line');
    if (overflow.scrollWidth > overflow.w + 1) problems.push(`sideways scroll ${overflow.scrollWidth}>${overflow.w}`);
    results.push({ ...s, fail: f, before, retry, small, overflow, lowestContrast: ratios[0] ?? null, contrastIncomplete: axe.incomplete.reduce((n, v) => n + v.nodes.length, 0), contrastBelow45: ratios.filter((r) => r.ratio! < 4.5).length, consoleErrors, failedLoads: failedLoads.length, problems, nav });
    writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
  });
}
