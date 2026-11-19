import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, OrganiserFake, PHONE, json } from './helpers/organiserFake';

// WALK (report only, not in the gate): organiser R4 slice d, Team "Invited" rows, 390x844, every answer route-mocked.
//   WALK_OUT=<dir> VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_DASH=true \
//   VITE_ENABLE_ORGANISER_R4=true VITE_ENABLE_ORGANISER_TICKETING=true npx playwright test tests/e2e/walk-r4-team-invited.spec.ts --project=chromium --workers=1 --trace off
const OUT = process.env.WALK_OUT ?? 'docs/walk/r4-team-invited';
mkdirSync(`${OUT}/pics`, { recursive: true });
test.use({ viewport: PHONE, reducedMotion: 'reduce' });

// The fake pins the browser clock to NOW, so times are relative to it, not to the machine.
const ago = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const ahead = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();
const team = (id: string, label: string | null, role: string, h: number) => ({ invite_id: id, kind: 'team', role, invitee_label: label, sent_at: ago(h), expires_at: ahead(150), occurrence_id: null, occurrence_date: null });
// Every label shape the server's B1 rule returns, plus a long email to prove it never pushes the page sideways.
const ROWS = [
  team('t1', 'a.really.long.dancer.address@example-mail.test', 'owner', 3),
  team('t2', 'Ana', 'manager', 30),
  team('t3', null, 'contributor', 80),
  { invite_id: 'door:abcdef0123456789', kind: 'door_seat', role: 'door', invitee_label: null, sent_at: ago(1), expires_at: ahead(36), occurrence_id: 'o1', occurrence_date: '2026-11-20' },
];

async function facts(page: Page, name: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/pics/${name}.png`, fullPage: true });
  return page.evaluate(() => {
    const small: string[] = [];
    for (const el of Array.from(document.querySelectorAll('[data-testid="r4-team"] button, [data-testid="r4-team"] a'))) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.height < 43.5) small.push(`${(el.textContent || '').trim().slice(0, 30)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    return { small, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
}

async function open(page: Page, answer: () => { status: number; body: unknown }) {
  const fake = new OrganiserFake({});
  await fake.install(page);
  await page.route('**/rest/v1/rpc/list_organiser_invites_sent_v1*', (r) => {
    const a = answer();
    return a.status === 200 ? json(r, a.body) : r.fulfill({ status: a.status, contentType: 'application/json', body: JSON.stringify(a.body) });
  });
  await page.goto('/account/p3/you/team');
  await expect(page.getByTestId('r4-team')).toBeVisible({ timeout: 45_000 });
}

test('Invited rows: email, first name, NULL label, door seat', async ({ page }) => {
  await open(page, () => ({ status: 200, body: { ok: true, rows: ROWS } }));
  await expect(page.getByTestId('r4-team-invited')).toBeVisible({ timeout: 20_000 });
  const rows = page.getByTestId('r4-team-invited-row');
  await expect(rows).toHaveCount(4);
  await expect(page.getByTestId('r4-team-invited-label').nth(2)).toHaveText('Invited person');
  await expect(rows.nth(3).getByTestId('r4-team-invited-label')).toHaveText('Invited person');
  await expect(rows.nth(3).getByTestId('r4-team-invited-role')).toHaveText('Door, one night');
  await expect(rows.nth(3).getByTestId('r4-team-invited-when')).toContainText('Ends ');
  await expect(rows.nth(0).getByTestId('r4-team-invited-when')).toHaveText('Sent 3 hours ago');
  const f = await facts(page, '01-invited-rows');
  console.log('rows', JSON.stringify(f), await page.getByTestId('r4-team-invited').innerText());
  expect(f.sideways).toBe(0);
});

test('empty: no Invited section', async ({ page }) => {
  await open(page, () => ({ status: 200, body: { ok: true, rows: [] } }));
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('r4-team-invited')).toHaveCount(0);
  await expect(page.getByTestId('r4-team-invited-error')).toHaveCount(0);
  console.log('empty', JSON.stringify(await facts(page, '02-invited-empty')));
});

test('read error: plain words, Try again loads the rows', async ({ page }) => {
  let fixed = false;
  await open(page, () => (fixed ? { status: 200, body: { ok: true, rows: ROWS.slice(1, 2) } } : { status: 500, body: { message: 'boom' } }));
  await expect(page.getByTestId('r4-team-invited-error')).toBeVisible({ timeout: 30_000 });
  console.log('error', JSON.stringify(await facts(page, '03-invited-error')), await page.getByTestId('r4-team-invited-error').innerText());
  fixed = true;
  await page.getByTestId('r4-team-invited-retry').click();
  await expect(page.getByTestId('r4-team-invited-row')).toHaveCount(1, { timeout: 20_000 });
  console.log('retried', JSON.stringify(await facts(page, '04-invited-retried')));
});
