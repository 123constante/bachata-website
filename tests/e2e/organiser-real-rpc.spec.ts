import { test, expect, type Browser, type Page } from '@playwright/test';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { deflateSync } from 'node:zlib';
import { mkdirSync } from 'node:fs';

/**
 * The organiser editor against the REAL RPCs, with a REAL organiser login, on the E2E project.
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
 * Fixtures: the owner/contributor logins and their organiser come from the admin repo's
 * `node scripts/e2e/seed-organiser-real-rpc.mjs` (idempotent; re-run it before each run, it also
 * deletes the series earlier runs created). Runbook: admin docs/e2e-organiser-real-rpc.md.
 *
 * Run:
 *   E2E_ORGANISER_OWNER_PASSWORD=... E2E_ORGANISER_CONTRIBUTOR_PASSWORD=... \
 *   VITE_SUPABASE_URL=https://srrpvuxldthwumzrngla.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=<E2E anon key> \
 *   npm run test:e2e:organiser-real-rpc
 *
 * Steps that need an unmerged Website PR mark themselves test.fixme AT RUN TIME, naming the PR,
 * when the screen they drive is not in this build: the programme editor is #627 (also carried by
 * #631), the flyer upload is #631 (supersedes #628). Once those merge, the same steps run.
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

const PR_PROGRAMME = 'needs Website PR #627 (per-date programme editor; also in #631): "Change the programme" is not in this build';
const PR_FLYER = 'needs Website PR #631 (flyer upload; supersedes #628): the picture upload is not in this build';

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
  if (!OWNER_PASSWORD || !CONTRIB_PASSWORD) return 'set E2E_ORGANISER_OWNER_PASSWORD and E2E_ORGANISER_CONTRIBUTOR_PASSWORD (admin seed-organiser-real-rpc.mjs)';
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
  // Tomorrow in London: its weekday is the class day, so the first date is in the future.
  const firstDate = londonDate(new Date(Date.now() + 24 * 3600 * 1000));
  const weekday = new Date(`${firstDate}T12:00:00Z`).getUTCDay();

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

  test('1 owner is signed in (real password, real GoTrue) and sees the organiser home', async () => {
    await page.goto('/account');
    await expect(page.getByTestId('organiser-home')).toBeVisible();
    await expect(page.getByTestId('organiser-home')).toContainText(ORG_NAME);
    await shot(page, '01-home');
  });

  test('2 creates a recurring class series through series_command_p5', async () => {
    await page.goto('/account/new');
    await expect(page.getByTestId('account-new-page')).toBeVisible();
    await page.getByTestId('kind-weekly_class').click();
    await page.locator('#create-name').fill(seriesName);
    await page.getByTestId('create-weekday').selectOption(String(weekday));
    await expect(page.locator('#create-date')).toHaveValue(firstDate);
    await page.locator('#create-start').fill('19:00');
    await page.locator('#create-end').fill('21:30');
    const changeVenue = page.getByTestId('create-venue-picker').getByRole('button', { name: /Change venue/ });
    if (await changeVenue.count()) await changeVenue.click();
    await page.locator('#create-venue').fill(VENUE);
    await page.getByTestId('venue-option').filter({ hasText: VENUE }).first().click();
    await shot(page, '02a-create-form');
    const created = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('save-draft').click();
    expect((await created).status()).toBe(200);
    await expect(page).toHaveURL(/\/account\/series\/[0-9a-f-]{36}$/);
    seriesId = page.url().split('/').pop() ?? '';
    await expect(page.getByTestId('series-created')).toContainText('Saved as a draft');
    await expect(page.getByTestId('series-title')).toHaveText(seriesName);
    await expect(page.getByTestId('series-lifecycle')).toHaveText('Draft');
    await expect(page.locator(`[data-testid="series-date-row"][data-date="${firstDate}"]`)).toBeVisible();
    await shot(page, '02b-series-created');
    console.log(`[real-rpc] created series ${seriesId} "${seriesName}", first date ${firstDate}`);
  });

  test('3 opens a date', async () => {
    test.skip(!seriesId, 'no series from step 2');
    await page.locator(`[data-testid="series-date-row"][data-date="${firstDate}"]`).getByTestId('date-open').click();
    await expect(page.getByTestId('date-sheet')).toBeVisible();
    // The menu renders once event_view_p5 has answered; "Add a note" is in every build.
    await expect(page.getByTestId('action-note')).toBeVisible();
    await shot(page, '03-date-sheet');
  });

  test('4 edits the date programme: adds a session with a level (organiser_set_occurrence_programme_v1)', async () => {
    test.skip(!seriesId, 'no series from step 2');
    const entry = page.getByTestId('action-programme');
    test.fixme((await entry.count()) === 0, PR_PROGRAMME);
    await entry.click();
    await expect(page.getByTestId('programme-add')).toBeVisible();
    await page.getByTestId('programme-add').click();
    const row = page.getByTestId('programme-row').last();
    await row.getByTestId('programme-type-select').selectOption('class');
    await row.getByTestId('programme-title').fill(sessionTitle);
    await row.getByTestId('programme-start').fill('20:00');
    await row.getByTestId('programme-end').fill('21:00');
    await row.getByTestId('programme-level-improver').click();
    await expect(row.getByTestId('programme-level-improver')).toHaveAttribute('aria-pressed', 'true');
    await shot(page, '04a-programme-edit');
    const saved = rpcDone(page, '/rest/v1/rpc/organiser_set_occurrence_programme_v1');
    await page.getByTestId('programme-save').click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByTestId('programme-done')).toContainText('is saved');
    await shot(page, '04b-programme-saved');
    programmeSaved = true;
    await page.getByTestId('programme-close').click();
    await expect(page.getByTestId('date-sheet')).toHaveCount(0);
  });

  test('5 uploads a small test flyer (organiser-flyers bucket + series.upsert)', async () => {
    test.skip(!seriesId, 'no series from step 2');
    // Close the date sheet if step 4 did not (fixme or failure) so the editor is reachable.
    if (await page.getByTestId('date-sheet').count()) await page.keyboard.press('Escape');
    const upload = page.getByTestId('flyer-upload');
    test.fixme((await upload.count()) === 0, PR_FLYER);
    await page.getByTestId('flyer-input').setInputFiles({ name: `flyer-${tag}.png`, mimeType: 'image/png', buffer: testFlyerPng() });
    await expect(page.getByTestId('flyer-preview-note')).toBeVisible();
    await shot(page, '05a-flyer-preview');
    const uploaded = rpcDone(page, '/storage/v1/object/organiser-flyers/');
    const upserted = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('flyer-save').click();
    expect((await uploaded).status()).toBe(200);
    expect((await upserted).status()).toBe(200);
    await expect(page.getByTestId('flyer-saved')).toBeVisible();
    await expect(page.getByTestId('flyer-error')).toHaveCount(0);
    await shot(page, '05b-flyer-saved');
    flyerSaved = true;
  });

  test('6 saves a series field (description) through series.upsert', async () => {
    test.skip(!seriesId, 'no series from step 2');
    if (await page.getByTestId('date-sheet').count()) await page.keyboard.press('Escape');
    await page.locator('#series-description').fill(description);
    const upserted = rpcDone(page, '/rest/v1/rpc/series_command_p5');
    await page.getByTestId('basics-save').click();
    expect((await upserted).status()).toBe(200);
    // "Saved" wording differs between builds; the form going clean without an error does not.
    await expect(page.getByTestId('basics-unsaved')).toHaveCount(0);
    await expect(page.getByTestId('basics-error')).toHaveCount(0);
    await shot(page, '06-basics-saved');
  });

  test('7 reload: every value persisted (page AND the same RPCs from Node with the owner token)', async () => {
    test.skip(!seriesId, 'no series from step 2');
    await page.reload();
    await expect(page.getByTestId('series-editor')).toBeVisible();
    await expect(page.getByTestId('series-title')).toHaveText(seriesName);
    await expect(page.getByTestId('series-lifecycle')).toHaveText('Draft');
    await expect(page.locator('#series-description')).toHaveValue(description);
    await expect(page.locator(`[data-testid="series-date-row"][data-date="${firstDate}"]`)).toBeVisible();
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
    expect(String(s.default_local_start_time)).toMatch(/^19:00/);
    expect(s.recurrence_rule?.mode).toBe('weekly');
    expect(s.recurrence_rule?.weekdays).toEqual([weekday]);
    const occ = (ws.data?.occurrences ?? []).find((o: { occurrence_date: string }) => o.occurrence_date === firstDate);
    expect(occ, `occurrence on ${firstDate}`).toBeTruthy();
    occurrenceId = occ.id;
    console.log(`[real-rpc] workspace: v${s.version} ${s.lifecycle_status} weekly ${JSON.stringify(s.recurrence_rule?.weekdays)} desc ok; occurrence ${occurrenceId}`);

    if (flyerSaved) {
      const cover = String(s.default_cover_image_url ?? '');
      expect(cover).toContain(`/storage/v1/object/public/organiser-flyers/${seriesId}/`);
      await expect(page.getByTestId('flyer-hero-image')).toHaveAttribute('src', cover);
      const res = await fetch(cover);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type') ?? '').toMatch(/^image\//);
      console.log(`[real-rpc] flyer persisted: ${cover} (${res.headers.get('content-type')}, ${res.headers.get('content-length')} bytes)`);
    }

    if (programmeSaved) {
      const prog = await owner.client.rpc('organiser_get_occurrence_programme_v1' as never, { p_occurrence_id: occurrenceId } as never);
      expect((prog as { error: { message: string } | null }).error).toBeNull();
      const sessions = ((prog as { data: { sessions?: Array<Record<string, unknown>> } }).data?.sessions ?? []);
      const mine = sessions.find((x) => x.title === sessionTitle);
      expect(mine, `session "${sessionTitle}" in ${JSON.stringify(sessions)}`).toBeTruthy();
      expect(mine?.type).toBe('class');
      expect(String(mine?.start_time)).toMatch(/^20:00/);
      expect(String(mine?.end_time)).toMatch(/^21:00/);
      expect(mine?.level_keys).toEqual(['improver']);
      console.log(`[real-rpc] programme persisted: ${JSON.stringify(mine)}`);

      // And the page shows it again after the reload.
      await page.locator(`[data-testid="series-date-row"][data-date="${firstDate}"]`).getByTestId('date-open').click();
      await page.getByTestId('action-programme').click();
      const row = page.getByTestId('programme-row').filter({ has: page.locator(`[data-testid="programme-title"][value="${sessionTitle}"]`) });
      await expect(row).toHaveCount(1);
      await expect(row.getByTestId('programme-level-improver')).toHaveAttribute('aria-pressed', 'true');
      await expect(row.getByTestId('programme-start')).toHaveValue('20:00');
      await shot(page, '07b-programme-after-reload');
      await page.keyboard.press('Escape');
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('8 a contributor cannot edit the series: clean refusal in the page and from the RPCs', async ({ browser }) => {
    test.skip(!seriesId, 'no series from step 2');
    const contributor = await signIn(CONTRIB_EMAIL, CONTRIB_PASSWORD);
    const cErrors: string[] = [];
    const cPage = await pageAs(browser, contributor.session, cErrors);
    try {
      await cPage.goto(`/account/series/${seriesId}`);
      const refused = cPage.getByTestId('series-unavailable');
      await expect(refused).toBeVisible();
      await expect(refused).toContainText('can\u2019t edit this event');
      await expect(cPage.getByTestId('series-editor')).toHaveCount(0);
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
