import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { OrganiserFake, PHONE, json } from './helpers/organiserFake';

// Walk of the About step's first-name help line at 390x844 (brief walk-join-help-r1; PR #1274).
// Server answers are simulated at the network boundary only; NO product code is touched, no prod access, no real tokens.
// NOT in the CI gate list:  npx playwright test tests/e2e/walk-join-firstname-help.spec.ts --project=chromium
// Pictures: docs/walk/join-firstname-help/<nn>-*.png ; measured rows: docs/walk/join-firstname-help/rows.tmp
test.use({ viewport: PHONE });

const TOKEN = 'ab12cd34'.repeat(8);
const OUT = 'docs/walk/join-firstname-help';
const HELP = 'Your own first name, not the page name.';

const INVITES = [
  { id: 'page-cumbaye', org: 'Cumbaye', bound: false },
  { id: 'person-daniel-rivera', org: 'Daniel Rivera', bound: true },
] as const;
const STATES = ['empty', 'typed', 'linked-prefilled'] as const;

async function open(page: Page, org: string, bound: boolean, state: (typeof STATES)[number]) {
  const fake = new OrganiserFake({ signedOut: true });
  await fake.install(page);
  // A person-bound invite only reaches About once the claim linked the profile (no_match is the not_linked safety stop),
  // so for it every state is a linked profile; only the page invite can be unlinked.
  const linked = bound || state === 'linked-prefilled';
  const prefilled = state === 'linked-prefilled';
  const preview = {
    status: 'open', organiser_name: org, inviter_first_name: 'Diego', email_hint: null,
    ...(bound ? { person: { first_name: 'Maria', avatar_url: null, city: 'London' } } : {}),
    ...(prefilled ? { prefill: { first_name: 'Ana', city_id: null } } : {}),
  };
  const rpc = (name: string, body: unknown) => page.route(`**/rest/v1/rpc/${name}*`, (r) => json(r, body));
  await rpc('organiser_invite_preview_v1', preview);
  await rpc('set_my_role_intent_v1', { ok: true, roles: ['dancer', 'organiser'] });
  await rpc('claim_my_dancer_profile_v1', { ok: true, status: linked ? 'linked' : 'no_match', profile_id: linked ? 'p1' : null });
  // After sign-in the person has a profile row that lacks only the first name (and city, role, photo).
  await rpc('_my_dancer_profile_id_v1', 'p1');
  await rpc('profile_complete_v1', false);
  await page.route('**/rest/v1/dancer_profiles*', (r) => json(r, { first_name: '', based_city_id: null, dance_role: null, avatar_url: null }));
  await page.goto(`/invite/${TOKEN}?step=code&email=${encodeURIComponent('diego@ritmo.example')}`);
  await page.getByTestId('join-step').waitFor();
  await page.locator('input[autocomplete="one-time-code"]').fill('12345678');
  await page.getByTestId('join-about-first-name').waitFor({ timeout: 30000 });
  if (state === 'typed') await page.getByTestId('join-about-first-name').fill('Ana');
  // The page fades its content in; a frozen test clock can leave it at opacity 0, so settle animations (test-only CSS).
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  await page.waitForFunction(() => { for (let e: Element | null = document.querySelector('[data-testid="join-about-form"]'); e; e = e.parentElement) if (getComputedStyle(e).opacity !== '1') return false; return true; }, null, { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

let n = 0;
for (const inv of INVITES) {
  for (const state of STATES) {
    const nn = String(++n).padStart(2, '0');
    test(`${nn} ${inv.id} / first name ${state}`, async ({ page }) => {
      await open(page, inv.org, inv.bound, state);
      await page.screenshot({ path: `${OUT}/${nn}-${inv.id}-${state}.png` });
      const m = await page.evaluate(() => {
        const input = document.querySelector('[data-testid="join-about-first-name"]') as HTMLInputElement;
        const ids = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
        const help = ids.map((i) => document.getElementById(i)).find((e) => e?.id === 'join-first-name-help') ?? null;
        const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
        const lum = (rgb: number[]) => { const f = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
        let contrast = 0;
        if (help) {
          const fg = parse(getComputedStyle(help).color);
          let bg = [255, 255, 255]; let e: Element | null = help;
          while (e) { const b = parse(getComputedStyle(e).backgroundColor); if (b.length >= 3 && (b[3] ?? 1) > 0.5) { bg = b.slice(0, 3); break; } e = e.parentElement; }
          const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
          contrast = (a + 0.05) / (b + 0.05);
        }
        const hr = help?.getBoundingClientRect();
        const cont = document.querySelector('[data-testid="join-about-save"]')!.getBoundingClientRect();
        const ir = input.getBoundingClientRect();
        return {
          resolves: !!help, text: help?.textContent ?? '',
          visible: !!hr && hr.width > 0 && hr.height > 0 && hr.left >= 0 && hr.right <= window.innerWidth && hr.top >= 0 && hr.bottom <= window.innerHeight,
          clipped: !!help && help.scrollWidth > help.clientWidth + 1,
          hscroll: document.documentElement.scrollWidth > window.innerWidth,
          contrast: Math.round(contrast * 100) / 100,
          inputH: Math.round(ir.height), continueH: Math.round(cont.height), value: input.value,
        };
      });
      const fails: string[] = [];
      if (!m.resolves) fails.push('aria-describedby does not resolve');
      if (m.text !== HELP) fails.push(`help text = "${m.text}"`);
      if (m.text.includes(inv.org) || m.text.includes('Maria')) fails.push('help names page/person');
      if (!m.visible) fails.push('help not fully visible in 390x844 viewport');
      if (m.clipped) fails.push('help clipped');
      if (m.hscroll) fails.push('sideways scroll');
      if (m.contrast < 4.5) fails.push(`contrast ${m.contrast}`);
      if (m.inputH < 44) fails.push(`input ${m.inputH}px`);
      if (m.continueH < 44) fails.push(`continue ${m.continueH}px`);
      fs.appendFileSync(`${OUT}/rows.tmp`, `| ${nn} | ${inv.org} (${inv.bound ? 'person-bound' : 'page'}) | ${state} | "${m.value}" | ${m.visible ? 'yes' : 'NO'}${m.clipped ? '/clipped' : ''} | ${m.hscroll ? 'YES' : 'no'} | ${m.contrast} | ${m.inputH} | ${m.continueH} | ${m.resolves ? 'yes' : 'NO'} | ${fails.length ? 'FAIL: ' + fails.join('; ') : 'pass'} |\n`);
      expect(fails).toEqual([]);
    });
  }
}
