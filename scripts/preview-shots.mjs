#!/usr/bin/env node
// preview-shots.mjs -- advisory PR screenshots of the Vercel preview at 390x844
// (deviceScaleFactor 2). Read-only against prod data: one anon RPC SELECT to find
// an upcoming event id, no sign-in, no storage seeding.
//
// Exit: 0 shots taken, or a PROVEN protection wall (::warning:: skip);
//       1 any other failure (preview never ready, a page failed to load);
//       2 cannot run (missing Supabase env / Playwright).
// This job is advisory: it is never a required check.
//
//   node scripts/preview-shots.mjs [--out <dir>]
//   node scripts/preview-shots.mjs --self-test
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isEntryPoint } from './lib/entry-point.mjs';
import { bypassHeaders, isPreviewHost, previewIsWalled, resolvePreviewUrl } from './lib/previewProbe.mjs';
import { parsePreviewRoutes, pickUpcomingEventId, shotName } from './lib/previewShotsRoutes.mjs';

const VIEWPORT = { width: 390, height: 844 };

function prBodyFromEvent(env) {
  if (env.PR_BODY != null) return env.PR_BODY;
  try {
    return JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))?.pull_request?.body ?? '';
  } catch {
    return '';
  }
}

async function findUpcomingEventId(env, fetchFn) {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const now = new Date();
  const res = await fetchFn(`${url.replace(/\/$/, '')}/rest/v1/rpc/get_calendar_events_v2`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      range_start: now.toISOString(),
      range_end: new Date(now.getTime() + 21 * 86400e3).toISOString(),
      city_slug_param: null,
      p_include_past: false,
    }),
  });
  if (!res.ok) throw new Error(`get_calendar_events_v2 -> HTTP ${res.status}`);
  return pickUpcomingEventId(await res.json());
}

/** Real browser capture. Injected in the self-test. */
async function playwrightCapture({ base, bypass, targets, outDir }) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  const taken = [];
  try {
    const ctx = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      extraHTTPHeaders: bypass ?? {},
    });
    for (const t of targets) {
      const page = await ctx.newPage();
      const resp = await page.goto(base + t.route, { waitUntil: 'networkidle', timeout: 45_000 });
      if (!resp || resp.status() >= 400) throw new Error(`${t.route} -> HTTP ${resp ? resp.status() : 'none'}`);
      if (t.menu) {
        await page.click('[data-testid="header-menu-button"]');
        await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
        await page.waitForTimeout(400);
      }
      const file = join(outDir, t.file);
      await page.screenshot({ path: file });
      taken.push(t.file);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return taken;
}

export async function main(argv, deps = {}) {
  const {
    env = process.env,
    resolve = resolvePreviewUrl,
    walled = previewIsWalled,
    bypassFor = () => bypassHeaders({ required: true }),
    fetchFn = fetch,
    capture = playwrightCapture,
    log = console.log,
    write = (p, s) => writeFileSync(p, s),
    mkdir = (d) => mkdirSync(d, { recursive: true }),
  } = deps;
  const known = new Set(['--out']);
  let outDir = 'preview-shots';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out' && argv[i + 1]) outDir = argv[++i];
    else if (!known.has(argv[i])) {
      console.error(`unknown argument: ${argv[i]}`);
      return 2;
    }
  }
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }
  try {
    const base = (await resolve()).replace(/\/$/, '');
    const bypass = bypassFor();
    mkdir(outDir);
    if (isPreviewHost(base) && (await walled(base, { bypass }))) {
      log(
        '::warning title=Preview shots skipped::The Vercel preview is behind Deployment Protection and the ' +
          'automation bypass did not open it, so no screenshots were taken.',
      );
      write(join(outDir, 'status.json'), JSON.stringify({ base, skipped: 'walled', shots: [] }));
      return 0;
    }

    const targets = [
      { route: '/', file: 'home.png' },
      { route: '/city/london-gb', file: shotName('/city/london-gb') },
    ];
    const eventId = await findUpcomingEventId(env, fetchFn);
    if (eventId) targets.push({ route: `/event/${encodeURIComponent(eventId)}`, file: 'event.png' });
    else log('note: no upcoming public event found -- event shot skipped');
    targets.push({ route: '/', file: 'menu-sheet.png', menu: true });
    const parsed = parsePreviewRoutes(prBodyFromEvent(env));
    if (parsed.rejected.length) log(`::warning title=Preview routes::${parsed.rejected.length} unsafe route token(s) rejected`);
    if (parsed.overflow.length) log(`::warning title=Preview routes::only the first 6 routes are captured (${parsed.overflow.length} ignored)`);
    for (const r of parsed.routes) targets.push({ route: r, file: shotName(r) });

    const shots = await capture({ base, bypass, targets, outDir });
    if (shots.length < targets.length) throw new Error(`captured ${shots.length}/${targets.length} shots`);
    write(join(outDir, 'status.json'), JSON.stringify({ base, shots }));
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `## Preview shots\n\n${base}\n\n${shots.map((s) => `- ${s}`).join('\n')}\n`);
    log(`preview-shots: ${shots.length} shots from ${base}`);
    return 0;
  } catch (e) {
    console.error(`preview-shots: ${e.message}`);
    return 1;
  }
}

export async function selfTest() {
  const quiet = () => {};
  const env = { VITE_SUPABASE_URL: 'https://x.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'k', PR_BODY: 'Preview routes: /a, /b' };
  const rows = [{ event_id: 'e1', occurrence_starts_at: new Date(Date.now() + 86400e3).toISOString() }];
  const base = {
    env,
    resolve: async () => 'https://p.vercel.app',
    walled: async () => false,
    bypassFor: () => null,
    fetchFn: async () => ({ ok: true, json: async () => rows }),
    log: quiet,
    write: quiet,
    mkdir: quiet,
  };
  let seen = [];
  const ok = await main(['--out', '/tmp/ps-selftest'], { ...base, capture: async ({ targets }) => ((seen = targets), targets.map((t) => t.file)) });
  const wall = await main([], { ...base, walled: async () => true, capture: async () => { throw new Error('must not capture'); } });
  const fail = await main([], { ...base, capture: async () => { throw new Error('boom'); } });
  const short = await main([], { ...base, capture: async () => [] });
  const noEnv = await main([], { ...base, env: {} });
  const badFlag = await main(['--nope'], base);
  return (
    ok === 0 && seen.length === 6 && seen.some((t) => t.menu) && seen.some((t) => t.route === '/event/e1') &&
    wall === 0 && fail === 1 && short === 1 && noEnv === 2 && badFlag === 2
  );
}

if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === '--self-test') {
    selfTest().then((okay) => {
      process.exitCode = okay ? 0 : 1;
    });
  } else {
    main(argv).then((code) => {
      process.exitCode = code;
    });
  }
}
