import { test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of PR #1278 save toasts at 390x844 against the organiser fake (mocked network, no prod).
// Writes docs/walk/walk-save-copy-r1/{*.png,results.json}. It RECORDS; RESULTS.md judges.
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-p3-save-copy-r1.spec.ts --project=chromium

const OUT = 'docs/walk/walk-save-copy-r1';
const RULE = { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2026-11-27' } };
const WORDS: Record<string, Record<string, { details: string; prices: string; added: string }>> = {
  draft: {
    one: { details: 'Saved as a draft. Dancers do not see it yet.', prices: 'Saved as a draft. Dancers do not see it yet.', added: 'Session added to every date as a draft. Dancers do not see it yet.' },
    several: { details: 'Saved for all dates as a draft. Dancers do not see it yet. A date with its own pictures keeps them.', prices: 'Prices saved as a draft. Dancers do not see them yet.', added: 'Session added to every date as a draft. Dancers do not see it yet.' },
  },
  live: {
    one: { details: 'Saved. Dancers see it now.', prices: 'Saved. Dancers see it now.', added: 'Session added to every date. Dancers see it now.' },
    several: { details: 'Saved for all dates. Dancers see it now. A date with its own pictures keeps them.', prices: 'Prices saved. Dancers see them now.', added: 'Session added to every date. Dancers see it now.' },
  },
  paused: {
    one: { details: 'Saved. It is hidden from the calendar.', prices: 'Saved. It is hidden from the calendar.', added: 'Session added to every date. It is hidden from the calendar.' },
    several: { details: 'Saved for all dates. It is hidden from the calendar. A date with its own pictures keeps them.', prices: 'Prices saved. The event is hidden from the calendar.', added: 'Session added to every date. It is hidden from the calendar.' },
  },
};

const results: unknown[] = [];
test.use({ viewport: PHONE });
test.afterAll(() => { mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2)); });

let n = 0;
async function open(page: Page, life: string, dates: string, screen: string) {
  n += 1;
  const id = `b0000000-0000-4000-8000-0000000b${String(n).padStart(4, '0')}`;
  const fake = new OrganiserFake({});
  await fake.install(page);
  fake.addSeries(fake.organisers[0], {
    id, name: `Walk ${life} ${dates}`, category: 'party', format: dates === 'one' ? 'one_off' : 'recurring', lifecycle_status: life,
    default_start_date: '2026-10-16', recurrence_rule: dates === 'one' ? null : (RULE as never),
  });
  await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, {
    v: 1, gate_on: false, is_admin: false, complete: true, person: { complete: true, missing: [] },
    organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: true, missing: [], about: { done: true, skipped: false } }],
  }));
  await page.goto(`/account/p3/events/${id}${screen === 'session' ? '' : '/' + screen}?o=${ORG}`);
  return fake;
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const r = (e: Element) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const t = document.querySelector('[data-testid="p3-toast"]');
    if (!t) return null;
    const b = t.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    const taps = [...t.querySelectorAll('button,a')].map((e) => r(e));
    const tray = document.querySelector('[data-testid="p3-tray"]')?.getBoundingClientRect();
    const sheet = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
    const ov = (o?: DOMRect) => !!o && o.left < b.right && b.left < o.right && o.top < b.bottom && b.top < o.bottom;
    return {
      text: (t.textContent ?? '').trim(), box: r(t),
      inViewport: b.left >= -0.5 && b.top >= -0.5 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5,
      topmost: hit === t || t.contains(hit), overTray: ov(tray), overSheet: ov(sheet),
      textClipped: t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1,
      tapTargets: taps, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

async function record(page: Page, life: string, dates: string, screen: string, expected: string, errors: string[], extra: Record<string, unknown> = {}) {
  let m = null;
  try { await page.getByTestId('p3-toast').waitFor({ timeout: 8000 }); await page.waitForTimeout(400); m = await measure(page); } catch { /* no toast */ }
  const file = `${life}-${dates}-${screen}.png`;
  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/${file}` });
  results.push({ life, dates, screen, expected, file, toast: m, consoleErrors: [...errors], ...extra });
}

for (const life of ['draft', 'live', 'paused']) {
  for (const dates of ['one', 'several']) {
    const exp = WORDS[life][dates];
    test(`${life} / ${dates} date(s)`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));

      // Details
      await open(page, life, dates, 'details');
      await page.getByTestId('p3-d-name').waitFor({ timeout: 20_000 });
      await page.getByTestId('p3-d-name').fill(`Renamed ${life} ${dates}`);
      const save = page.getByTestId('p3-save');
      const saveBox = await save.boundingBox();
      const saveLabel = (await save.textContent())?.trim();
      await save.click();
      errors.length = 0;
      await record(page, life, dates, 'details', exp.details, errors, { saveLabel, saveBox });

      // Prices
      await open(page, life, dates, 'prices');
      await page.getByTestId('p3-prices').waitFor({ timeout: 20_000 });
      let pricesNote = '';
      try {
        await page.getByTestId('p3-price-add').click({ timeout: 5000 });
        await page.getByTestId('p3-price-name').first().fill('Entry');
        await page.getByTestId('p3-price-amount').first().fill('10');
        const s2 = page.getByTestId('p3-save');
        const b2 = await s2.boundingBox(); const l2 = (await s2.textContent())?.trim();
        await s2.click({ timeout: 5000 });
        await record(page, life, dates, 'prices', exp.prices, errors, { saveLabel: l2, saveBox: b2 });
      } catch (e) {
        pricesNote = String(e).slice(0, 200);
        await record(page, life, dates, 'prices', exp.prices, errors, { note: pricesNote });
      }

      // Session sheet: add
      await open(page, life, dates, 'session');
      try {
        await page.getByTestId('p3-add-session').click({ timeout: 20_000 });
        await page.getByTestId('p3-sess-name').fill('Late social');
        await page.getByTestId('p3-sess-kind-party').click();
        const s3 = page.getByTestId('p3-sess-save');
        const b3 = await s3.boundingBox(); const l3 = (await s3.textContent())?.trim();
        await s3.click({ timeout: 5000 });
        await record(page, life, dates, 'session', exp.added, errors, { saveLabel: l3, saveBox: b3 });
      } catch (e) {
        await record(page, life, dates, 'session', exp.added, errors, { note: String(e).slice(0, 200) });
      }
    });
  }
}
