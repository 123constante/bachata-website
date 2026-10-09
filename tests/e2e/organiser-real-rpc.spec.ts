import { test, expect, type Browser, type Page } from '@playwright/test';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { deflateSync } from 'node:zlib';
import { mkdirSync } from 'node:fs';

/**
 * The organiser area (/account/o) against the REAL RPCs, with a REAL organiser login, on the E2E project.
 *
 * Every other organiser spec mocks /rest/v1 and /auth/v1, so it proves the screens only. This one
 * mocks NOTHING: the owner signs in with a password against E2E GoTrue, and every read and write
 * the page makes (series_command_p5, occurrence_command_p5, admin_event_workspace_p5,
 * organiser_get/set_occurrence_programme_v1, the organiser-flyers bucket) hits the E2E database.
 * Persistence is then proved twice: by the page after a reload, and by calling the same RPCs from
 * Node with the owner's own access token.
 *
 * The site has no password form (sign-in is by email code), so the password sign-in runs here in
 * Node (supabase-js signInWithPassword, i.e. real GoTrue) and the session is placed in the
 * browser's localStorage key `sb-<ref>-auth-token`, exactly where supabase-js keeps it.
 *
 * NOT in `npm run test:e2e` and NOT in e2e-smoke.yml: it needs E2E credentials and writes to the
 * E2E database. It refuses to run against prod (stsdtacfauprzrdebmzg) or any non-E2E project.
 *
 * Fixtures: the owner/contributor logins and their organiser come from
 * `npm run seed:e2e:organiser-real-rpc` (scripts/e2e/seed-organiser-real-rpc.mjs; idempotent; re-run
 * it before each run, it also deletes the series earlier runs created). Runbook: docs/e2e-organiser-real-rpc.md.
 *
 * Run:
 *   E2E_ORGANISER_OWNER_PASSWORD=... E2E_ORGANISER_CONTRIBUTOR_PASSWORD=... \
 *   VITE_SUPABASE_URL=https://srrpvuxldthwumzrngla.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=<E2E anon key> \
 *   npm run test:e2e:organiser-real-rpc
 *
 * Rewritten for the new organiser area (/account/o, organiser rebuild W5b-1); the old /account
 * screens it drove are deleted. First run 2026-10-09 (8/8 green once step 2 picks a type).
 */

const PROD_REF = 'stsdtacfauprzrdebmzg';
const E2E_REF = process.env.E2E_PROJECT_REF || 'srrpvuxldthwumzrngla';
const URL_ = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const ANON = process.env.E2E_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const OWNER_EMAIL = process.env.E2E_ORGANISER_OWNER_EMAIL || 'e2e-organiser-owner@fixtures.bachata-admin.test';
const OWNER_PASSWORD = process.env.E2E_ORGANISER_OWNER_PASSWORD || '';
const CONTRIB_EMAIL = process.env.E2E_ORGANISER_CONTRIBUTOR_EMAIL || 'e2e-organiser-contributor@fixtures.bachata-admin.test';
const CONTRIB_PASSWORD = process.env.E2E_ORGANISER_CONTRIBUTOR_PASSWORD || '';
const ORG_NAME = 'E2E Real RPC Organiser';
const VENUE = 'E2E Test Venue';
const SHOTS = 'test-results/organiser-real-rpc';


const refOf = (u: string) => /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(u)?.[1] ?? null;
const keyRef = (k: string) => {
  try {
    return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString()).ref ?? null;
  } catch {
    return null;
  }
};
const REF = refOf(URL_);

/** Why this spec must not run here, or null. Prod is refused outright, never skipped quietly past. */
function refusal(): string | null {
  if (process.env.ORGANISER_REAL_RPC_CONFIG !== '1') return 'run it with its own config: npm run test:e2e:organiser-real-rpc';
  if (!OWNER_PASSWORD || !CONTRIB_PASSWORD) return 'set E2E_ORGANISER_OWNER_PASSWORD and E2E_ORGANISER_CONTRIBUTOR_PASSWORD (see docs/e2e-organiser-real-rpc.md)';
  if (!URL_ || !ANON) return 'set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the E2E project';
  return null;
}
if (process.env.ORGANISER_REAL_RPC_CONFIG === '1') {
  // Under its own config a wrong target is an error, not a skip.
  if (URL_.includes(PROD_REF) || ANON.includes(PROD_REF) || REF === PROD_REF || keyRef(ANON) === PROD_REF) {
    throw new Error(`REFUSED: the target resolves to PROD (${PROD_REF}). This spec writes; it runs on E2E only.`);
  }
  if (URL_ && REF !== E2E_REF) throw new Error(`REFUSED: ${URL_} is not the E2E project ${E2E_REF}.`);
  if (ANON && keyRef(ANON) !== E2E_REF) throw new Error(`REFUSED: the anon key is for ${keyRef(ANON)}, not E2E ${E2E_REF}.`);
}

/** London's calendar date for an instant, as YYYY-MM-DD. */
const londonDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);

/** A real 900x600 PNG (solid colour + a stripe), small on disk, valid for the magic-byte check and canvas decode. */
function testFlyerPng(): Buffer {
  const w = 900;
  const h = 600;
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    const stripe = y > 250 && y < 350;
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = stripe ? 255 : 180;
      raw[row + 2 + x * 3] = stripe ? 200 : 30;
      raw[row + 3 + x * 3] = stripe ? 40 : 90;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function signIn(email: string, password: string): Promise<{ session: Session; client: SupabaseClient }> {
  const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`password sign-in for ${email} refused: ${error?.message ?? 'no session'}`);
  return { session: data.session, client };
}

async function pageAs(browser: Browser, session: Session, errors: string[]): Promise<Page> {
  const ctx = await browser.newContext();
  await ctx.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) },
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return page;
}

/** The next POST to a real RPC / Storage path, its status logged as the step's key line. */
const rpcDone = (page: Page, path: string) =>
  page.waitForResponse((r) => r.url().includes(path) && r.request().method() === 'POST').then(async (r) => {
    console.log(`[real-rpc] ${path} -> HTTP ${r.status()}`);
    return r;
  });

const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

test.describe.configure({ mode: 'serial' });

test.describe('organiser editor on the real RPCs (E2E project)', () => {
  test.skip(refusal() !== null, refusal() ?? '');

  const tag = Date.now().toString(36);
  const seriesName = `RPC Journey ${tag}`;
  const description = `Real RPC journey ${tag}: weekly class, friendly crowd.`;
  const sessionTitle = `Improvers ${tag}`;
  // The name-only New event starts a week from today (London), weekly on that weekday, 8 dates.
  const firstDate = londonDate(new Date(Date.now() + 7 * 24 * 3600 * 1000));
  const weekday = new Date(`${firstDate}T12:00:00Z`).getUTCDay();
  const dateRow = () => page.locator(`[data-testid="org-date-row"][data-date="${firstDate}"]`);
  const sessionRow = () => page.getByTestId('session-row').filter({ has: page.getByTestId('session-row-name').getByText(sessionTitle, { exact: true }) });

  let owner: { session: Session; client: SupabaseClient };
  let page: Page;
  const errors: string[] = [];
  let seriesId = '';
  let occurrenceId = '';
  let programmeSaved = false;
  let flyerSaved = false;

  test.beforeAll(async ({ browser }) => {
    mkdirSync(SHOTS, { recursive: true });
    owner = await signIn(OWNER_EMAIL, OWNER_PASSWORD);
    page = await pageAs(browser, owner.session, errors);
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test('1 owner is signed in (real password, real GoTrue) and sees the organiser Home', async () => {
    await page.goto('/account/o');
    await expect(page.getByTestId('org-page-home')).toBeVisible();
    await expect(page.getByTestId('org-onboarding')).toHaveCount(0);
    await expect(page.getByTestId('home-new-event')).toHaveCount(1);
    await page.goto('/account/o/profile');
    await expect(page.getByTestId('profile-name')).toHaveValue(ORG_NAME);
    await shot(page, '01-home');
  });

  test('2 creates a weekly event by name through series_command_p5, then sets its venue', async () => {
    await page.goto('/account/o/events/new');
    await expect(page.getByTestId('org-page-new-event')).toBeVisible();
    await page.getByTestId('org-new-event-name').fill(seriesName);
    await page.getByTestId('org-new-event-type-class').click();
    const created = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('org-new-event-create').click();
    expect((await created).status()).toBe(200);
    await expect(page).toHaveURL(/\/account\/o\/events\/[0-9a-f-]{36}$/);
    seriesId = page.url().split('/').pop() ?? '';
    await expect(page.getByTestId('org-event-editor')).toBeVisible();
    await expect(page.getByTestId('org-event-name')).toHaveValue(seriesName);
    await expect(page.getByTestId('org-event-status')).toHaveText('Draft');
    await expect(dateRow()).toBeVisible();

    await page.getByTestId('org-row-venue').click();
    await page.getByTestId('org-venue-search-open').click();
    await page.getByTestId('org-venue-query').fill(VENUE);
    await page.getByTestId('org-venue-result').filter({ hasText: VENUE }).first().click();
    await page.getByTestId('org-sheet-done').click();
    const saved = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('org-preview-bar-action').click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByTestId('org-row-venue-value')).toHaveText(VENUE);
    await expect(page.getByTestId('org-save-error')).toHaveCount(0);
    await shot(page, '02-event-created');
    console.log(`[real-rpc] created series ${seriesId} "${seriesName}", first date ${firstDate}`);
  });

  test('3 opens a date', async () => {
    test.skip(!seriesId, 'no series from step 2');
    await dateRow().click();
    await expect(page.getByTestId('org-page-date')).toBeVisible();
    await expect(page.getByTestId('date-schedule')).toBeVisible();
    await shot(page, '03-date');
  });

  test('4 edits the date programme: adds a session with a level (organiser_set_occurrence_programme_v1)', async () => {
    test.skip(!seriesId, 'no series from step 2');
    await page.getByTestId('date-add-session').click();
    await page.getByTestId('session-type-class').click();
    await page.getByTestId('session-name').fill(sessionTitle);
    await page.getByTestId('session-start').fill('20:00');
    await page.getByTestId('session-end').fill('21:00');
    await page.getByTestId('session-level-improver').click();
    await expect(page.getByTestId('session-level-improver')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('date-sheet-done').click();
    await shot(page, '04a-programme-edit');
    const saved = rpcDone(page, '/rest/v1/rpc/organiser_set_occurrence_programme_v1');
    await page.getByTestId('date-preview-bar-action').click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByTestId('date-preview-bar-action')).toBeDisabled();
    await expect(page.getByTestId('date-save-error')).toHaveCount(0);
    await expect(sessionRow()).toHaveCount(1);
    await shot(page, '04b-programme-saved');
    programmeSaved = true;
  });

  test('5 uploads a small test cover (organiser-flyers bucket + series.upsert)', async () => {
    test.skip(!seriesId, 'no series from step 2');
    await page.goto(`/account/o/events/${seriesId}`);
    await expect(page.getByTestId('org-event-editor')).toBeVisible();
    const uploaded = rpcDone(page, '/storage/v1/object/organiser-flyers/');
    await page.getByTestId('org-cover-file').setInputFiles({ name: `flyer-${tag}.png`, mimeType: 'image/png', buffer: testFlyerPng() });
    expect((await uploaded).status()).toBe(200);
    const upserted = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('org-preview-bar-action').click();
    expect((await upserted).status()).toBe(200);
    await expect(page.getByTestId('org-save-error')).toHaveCount(0);
    await shot(page, '05-cover-saved');
    flyerSaved = true;
  });

  test('6 saves a series field (description) through series.upsert', async () => {
    test.skip(!seriesId, 'no series from step 2');
    await page.getByTestId('org-row-description').click();
    await page.getByTestId('org-description-input').fill(description);
    await page.getByTestId('org-sheet-done').click();
    const upserted = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('org-preview-bar-action').click();
    expect((await upserted).status()).toBe(200);
    await expect(page.getByTestId('org-preview-bar-action')).toBeDisabled();
    await expect(page.getByTestId('org-save-error')).toHaveCount(0);
    await shot(page, '06-description-saved');
  });

  test('7 reload: every value persisted (page AND the same RPCs from Node with the owner token)', async () => {
    test.skip(!seriesId, 'no series from step 2');
    await page.reload();
    await expect(page.getByTestId('org-event-editor')).toBeVisible();
    await expect(page.getByTestId('org-event-name')).toHaveValue(seriesName);
    await expect(page.getByTestId('org-event-status')).toHaveText('Draft');
    await expect(dateRow()).toBeVisible();
    await page.getByTestId('org-row-description').click();
    await expect(page.getByTestId('org-description-input')).toHaveValue(description);
    await page.getByTestId('org-sheet-done').click();
    await shot(page, '07a-reloaded');

    // The server's own answer, read with the owner's access token: no browser cache involved.
    const ws = await owner.client.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
    expect(ws.error, ws.error?.message).toBeNull();
    const s = ws.data?.series?.series ?? {};
    expect(s.name).toBe(seriesName);
    expect(s.format).toBe('recurring');
    expect(s.category).toBe('class');
    expect(s.lifecycle_status).toBe('draft');
    expect(s.default_description).toBe(description);
    expect(s.recurrence_rule?.mode).toBe('weekly');
    expect(s.recurrence_rule?.weekdays).toEqual([weekday]);
    const occ = (ws.data?.occurrences ?? []).find((o: { occurrence_date: string }) => o.occurrence_date === firstDate);
    expect(occ, `occurrence on ${firstDate}`).toBeTruthy();
    occurrenceId = occ.id;
    console.log(`[real-rpc] workspace: v${s.version} ${s.lifecycle_status} weekly ${JSON.stringify(s.recurrence_rule?.weekdays)} desc ok; occurrence ${occurrenceId}`);

    if (flyerSaved) {
      const cover = String(s.default_cover_image_url ?? '');
      expect(cover).toContain(`/storage/v1/object/public/organiser-flyers/${seriesId}/`);
      const res = await fetch(cover);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type') ?? '').toMatch(/^image\//);
      console.log(`[real-rpc] cover persisted: ${cover} (${res.headers.get('content-type')}, ${res.headers.get('content-length')} bytes)`);
    }

    if (programmeSaved) {
      // Not in the generated types until admin #668 reaches prod, so plain PostgREST with the owner's token.
      const progRes = await fetch(`${URL_}/rest/v1/rpc/organiser_get_occurrence_programme_v1`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: `Bearer ${owner.session.access_token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ p_occurrence_id: occurrenceId }),
      });
      const prog = (await progRes.json()) as { sessions?: Array<Record<string, unknown>>; message?: string };
      expect(progRes.status, prog.message).toBe(200);
      const sessions = prog.sessions ?? [];
      const mine = sessions.find((x) => x.title === sessionTitle);
      expect(mine, `session "${sessionTitle}" in ${JSON.stringify(sessions)}`).toBeTruthy();
      expect(mine?.type).toBe('class');
      expect(String(mine?.start_time)).toMatch(/^20:00/);
      expect(String(mine?.end_time)).toMatch(/^21:00/);
      expect(mine?.level_keys).toEqual(['improver']);
      console.log(`[real-rpc] programme persisted: ${JSON.stringify(mine)}`);

      // And the page shows it again after the reload.
      await dateRow().click();
      await expect(sessionRow()).toHaveCount(1);
      await expect(sessionRow().getByTestId('session-row-meta')).toContainText('20:00');
      await expect(sessionRow().getByTestId('session-row-meta')).toContainText('Improver');
      await shot(page, '07b-programme-after-reload');
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('8 a contributor cannot edit the series: clean refusal in the page and from the RPCs', async ({ browser }) => {
    test.skip(!seriesId, 'no series from step 2');
    const contributor = await signIn(CONTRIB_EMAIL, CONTRIB_PASSWORD);
    const cErrors: string[] = [];
    const cPage = await pageAs(browser, contributor.session, cErrors);
    try {
      await cPage.goto(`/account/o/events/${seriesId}`);
      await expect(cPage.getByTestId('org-editor-error')).toBeVisible();
      await expect(cPage.getByTestId('org-event-editor')).toHaveCount(0);
      await shot(cPage, '08-contributor-refused');
      expect(cErrors, cErrors.join('\n')).toEqual([]);

      // The owner-only write itself, sent by the contributor: refused with a code, not a crash.
      const ws = await owner.client.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
      const version = ws.data?.series?.series?.version;
      const cmd = await contributor.client.rpc('series_command_p5', {
        p_envelope: {
          target_id: seriesId,
          expected_version: version,
          idempotency_key: crypto.randomUUID(),
          command: { kind: 'series.upsert', payload: { name: `${seriesName} hijacked` } },
        },
      } as never);
      expect(cmd.error?.message ?? '').toMatch(/^permission_denied/);
      console.log(`[real-rpc] contributor series.upsert refused: ${cmd.error?.message}`);
      // And the flyer bucket refuses the contributor's upload (owner/manager only).
      const up = await contributor.client.storage
        .from('organiser-flyers')
        .upload(`${seriesId}/${crypto.randomUUID().replace(/-/g, '')}.png`, testFlyerPng(), { contentType: 'image/png', upsert: false });
      expect(up.error, 'contributor flyer upload must be refused').not.toBeNull();
      console.log(`[real-rpc] contributor flyer upload refused: ${up.error?.message}`);
      const after = await owner.client.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
      expect(after.data?.series?.series?.name).toBe(seriesName);
    } finally {
      await cPage.context().close();
    }
  });
});
