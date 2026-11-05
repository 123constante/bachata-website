import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { FRIDAY, ORG, ORG_NAME, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of brief fix-gate-lost-edit at 390x844: Repeat Save refused (onboarding_incomplete, MOCKED) -> gate ->
// Continue -> checklist with "Back to your event" -> the event, Repeat sheet reopened pre-filled, "We kept your
// changes". Harness copied from walk-invite-recheck (heading + finished animations, full page height). Every
// server answer is a page.route mock; no prod access. NOT in the CI gate list. Needs the P3 flags:
//   VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true npx playwright test tests/e2e/walk-fix-gate-lost-edit.spec.ts --project=chromium
test.use({ viewport: PHONE, reducedMotion: 'reduce' });

const OUT = 'docs/walk/fix-gate-lost-edit';
fs.mkdirSync(OUT, { recursive: true });

async function snap(page: Page, name: string, extra: Record<string, unknown> = {}) {
  await page.locator('h1,h2,h3').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => undefined);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }).catch(() => undefined);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), undefined, { timeout: 10000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const full = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: PHONE.width, height: Math.max(full, PHONE.height) });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.setViewportSize(PHONE);
  const text = await page.evaluate(() => (document.body.innerText || '').replace(/\n{2,}/g, '\n'));
  if (/Something went wrong|couldn.t reach Bachata Calendar/i.test(text)) throw new Error('ERROR CARD on ' + name);
  const controls = await page.evaluate(() => Array.from(document.querySelectorAll('button,a')).filter((e) => (e as HTMLElement).offsetWidth > 0).map((e) => `${(e.textContent ?? '').trim()} [${Math.round((e as HTMLElement).getBoundingClientRect().height)}px]`).filter((s) => !s.startsWith(' [')));
  fs.appendFileSync(`${OUT}/texts.jsonl`, JSON.stringify({ name, url: page.url(), text, controls, ...extra }) + '\n');
  return text;
}

const CODES = {
  10: { person: ['first_name', 'city', 'dance_role', 'photo', 'nationality', 'languages', 'teach_answer', 'dj_answer'], org: ['org_logo', 'contact_confirm'] },
  6: { person: ['first_name', 'city', 'dance_role', 'photo'], org: ['org_logo', 'contact_confirm'] },
  3: { person: ['first_name', 'photo'], org: ['org_logo'] },
  2: { person: ['photo'], org: ['org_logo'] },
  1: { person: [], org: ['org_logo'] },
} as const;
type N = keyof typeof CODES;
const statusFor = (n: N) => ({
  v: 1, gate_on: true, is_admin: false, complete: false,
  person: { complete: CODES[n].person.length === 0, missing: CODES[n].person },
  organisers: [{ id: ORG, name: ORG_NAME, role: 'owner', lifecycle: 'live', complete: false, missing: CODES[n].org, about: { done: false, skipped: false } }],
});
const REFUSAL = (n: N) => ({ code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: [...CODES[n].person, ...CODES[n].org], organiser_id: ORG }), hint: null });

test.describe('fix-gate-lost-edit: refused Repeat -> gate -> checklist -> back, edit kept', () => {
  for (const n of [10, 6, 3, 2, 1] as const) {
    test(`${n} left`, async ({ page }) => {
      const fake = new OrganiserFake({});
      await fake.install(page);
      await page.route('**/rest/v1/rpc/organiser_onboarding_status_v1*', (r) => json(r, statusFor(n)));
      const saves: string[] = [];
      await page.route('**/rest/v1/rpc/series_command_p5*', (r) => {
        const body = r.request().postData() ?? '';
        if (!/"dry_run":true/.test(body)) saves.push(body);
        return json(r, REFUSAL(n), 400);
      });
      await page.route('**/rest/v1/rpc/get_organiser_contact_settings_v1*', (r) => json(r, { contact_phone: null, contact_email: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null }));
      await page.goto(`/account/p3/events/${FRIDAY}`);
      await page.getByTestId('p3-event').waitFor({ timeout: 30000 });
      await page.getByTestId('p3-open-repeat').click();
      await page.getByRole('button', { name: 'Monday' }).click();
      await page.getByTestId('p3-repeat-save').click();
      await page.getByTestId('p3-gate').waitFor({ timeout: 10000 });
      await snap(page, `01-gate-${n}-left`, { savesSent: saves.length });
      await page.getByTestId('p3-gate-go').click();
      await page.getByTestId('p3-ob-title').waitFor({ timeout: 20000 });
      await page.waitForTimeout(600);
      const list = await snap(page, `02-checklist-${n}-left`);
      if (!list.includes('Back to your event') || list.includes('Go to Home')) throw new Error(`checklist ${n}: no way back to the event`);
      await page.getByText('Back to your event', { exact: true }).click();
      await page.getByTestId('p3-repeat-kept').waitFor({ timeout: 20000 });
      const ev = await snap(page, `03-event-kept-${n}-left`, { savesSent: saves.length });
      if (!/Every Monday and Friday/.test(ev)) throw new Error('Repeat sheet not pre-filled');
      // the status read predicts the refusal (F-12): Save is held, nothing is ever written, before or after
      if (saves.length !== 0) throw new Error(`a save was sent: ${saves.length}`);
    });
  }
});
