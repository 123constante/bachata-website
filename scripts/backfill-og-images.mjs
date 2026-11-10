// Run as: node scripts/backfill-og-images.mjs [flags]. No shebang on purpose:
// it makes the file unparseable when vitest imports the pure helpers below.
// One-time backfill: render + store a baked OG image for every active event,
// each per-occurrence flyer, and every festival. Calls og_render_targets_v1 for
// the work list, then POSTs the deployed /api/og/bake for each (the same path the
// DB triggers use). Safe to re-run — bakes are idempotent (content-addressed keys).
//
//   SUPABASE_URL                  Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY     service key (to call the targets RPC)
//   OG_BAKE_SECRET                shared secret for /api/og/bake (Bearer)
//   OG_BAKE_URL                   bake endpoint (default https://www.bachatacalendar.co.uk/api/og/bake)
//   OG_BACKFILL_CONCURRENCY       parallel bakes (default 4)
//
// Whole-flyer flags (docs/design/whatsapp-whole-flyer.CONTRACT.md D7). With NO
// flags the run is exactly what it always was: every target, baked. Any of the
// flags below switches to the batched, skip-filtered run, and then --layout is
// REQUIRED (this script cannot read the Vercel env; the operator states which
// layout the production deployment writes):
//   --layout wf1|legacy   the layout the deployment's ogLayoutFor writes
//   --ids a,b,...         public_event_id list; a series id expands to its
//                         series target AND every occurrence target under it
//   --limit N             at most N BAKES (POSTs) this run, not N ids
//   --dry-run             read-only: print the plan, POST nothing
// Each target's current og_render.image_url is read READ-ONLY and targets whose
// key is already on --layout are SKIPPED, so repeated --limit 25 runs advance.
// The run prints how many in-scope targets are not yet on the layout, before
// and after. A bake whose returned key is not on --layout means the deployment
// mode disagrees with --layout: counted as a failure, never as done.

import { isEntryPoint } from './lib/entry-point.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? '';
const BAKE_SECRET = process.env.OG_BAKE_SECRET ?? '';
const BAKE_URL = process.env.OG_BAKE_URL ?? 'https://www.bachatacalendar.co.uk/api/og/bake';
const CONCURRENCY = Number(process.env.OG_BACKFILL_CONCURRENCY ?? 4);

// Checked here, ACTED ON at the bottom. process.exit(2) stood here and would
// discard the console.error above it on a piped Linux CI stderr -- the very
// truncation the comment further down documents -- leaving an operator a bare
// exit 2 with no cause. Setting exitCode instead means the process must not
// then fall through into main(), hence the flag.
const CONFIG_OK = Boolean(SUPABASE_URL && SERVICE_KEY && BAKE_SECRET);

// ── Whole-flyer batch mode (pure, exported for tests/ogBackfillLayout.test.ts) ──
// MIRRORS app/lib/ogLayout.ts (classifyBakedKey / acceptBakedKey / WF_VERSION /
// the D1 canvas range). This is a plain node script and cannot import the .ts
// module; the parity is pinned by a test that runs both on the same keys.
export const WF_VERSION = 1;
const WF_W = 960;
const WF_MIN_H = 503;
const WF_MAX_H = 1200;
const LEGACY_TAIL_RE = /-[0-9a-f]{16}(?:-[0-9a-f]{12})?[.]jpg$/;
const WF_TAIL_RE = /-[0-9a-f]{16}-wf([0-9]+)-([0-9]{3,4})x([0-9]{3,4})[.]jpg$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const LAYOUTS = ['wf1', 'legacy'];

/** 'legacy' | 'wf1' | null: the layout an image_url's key is ON, by the same
 *  read rule the page applies (last path segment, query stripped, any host). */
export function keyLayout(imageUrl) {
  if (!imageUrl) return null;
  const seg = String(imageUrl).split('#')[0].split('?')[0].split('/').pop() ?? '';
  const wf = WF_TAIL_RE.exec(seg);
  if (wf) {
    const [v, w, h] = [Number(wf[1]), Number(wf[2]), Number(wf[3])];
    return v === WF_VERSION && w === WF_W && h >= WF_MIN_H && h <= WF_MAX_H ? 'wf1' : null;
  }
  return LEGACY_TAIL_RE.test(seg) ? 'legacy' : null;
}

/** argv -> options. { batch: false } when no flag at all (today's run). */
export function parseBackfillArgs(argv) {
  const errors = [];
  if (argv.length === 0) return { batch: false, errors };
  const opts = { batch: true, layout: null, ids: null, limit: null, dryRun: false, errors };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.indexOf('=');
    const flag = eq > 0 ? a.slice(0, eq) : a;
    const inline = eq > 0 ? a.slice(eq + 1) : null;
    const value = () => (inline ?? argv[++i] ?? '');
    if (flag === '--dry-run') opts.dryRun = true;
    else if (flag === '--layout') {
      const v = value();
      if (!LAYOUTS.includes(v)) errors.push(`--layout must be one of ${LAYOUTS.join('|')}, got "${v}"`);
      else opts.layout = v;
    } else if (flag === '--ids') {
      const ids = value().split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      const bad = ids.filter((x) => !UUID_RE.test(x));
      if (ids.length === 0) errors.push('--ids needs at least one public_event_id');
      if (bad.length) errors.push(`--ids: not a uuid: ${bad.join(', ')}`);
      opts.ids = new Set(ids);
    } else if (flag === '--limit') {
      const v = value();
      const n = Number(v);
      if (!/^[0-9]+$/.test(v) || n < 1) errors.push(`--limit must be a positive integer, got "${v}"`);
      else opts.limit = n;
    } else errors.push(`unknown flag: ${a}`);
  }
  if (!opts.layout && !errors.some((e) => e.startsWith('--layout'))) {
    errors.push('--layout wf1|legacy is required with any batch flag (this script cannot read the Vercel env)');
  }
  return opts;
}

const rowKey = (t) => `${t.entity_type}|${String(t.entity_id).toLowerCase()}|${t.occurrence_id ? String(t.occurrence_id).toLowerCase() : '-'}`;

/** The batch plan. `rows` are og_render rows (read-only). A target is ON the
 *  layout only when its row is ready AND its key is on the layout. */
export function planBackfill(targets, rows, { layout, ids = null, limit = null }) {
  const byKey = new Map(rows.map((r) => [rowKey(r), r]));
  const inScope = targets.filter((t) => !ids || ids.has(String(t.entity_id).toLowerCase()));
  const notOnLayout = inScope.filter((t) => {
    const r = byKey.get(rowKey(t));
    return !(r && r.status === 'ready' && keyLayout(r.image_url) === layout);
  });
  const toBake = limit == null ? notOnLayout : notOnLayout.slice(0, limit);
  return { inScope, onLayout: inScope.length - notOnLayout.length, notOnLayout, toBake };
}

async function readOgRenderRows() {
  // READ-ONLY: a PostgREST select, paged. No write of any kind.
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/og_render?select=entity_type,entity_id,occurrence_id,image_url,status&order=entity_id`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Range: `${from}-${from + 999}` },
    });
    if (!r.ok) throw new Error(`og_render read -> HTTP ${r.status}: ${await r.text().catch(() => '')}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) throw new Error(`${fn} -> HTTP ${r.status}: ${await r.text().catch(() => '')}`);
  return r.json();
}

async function bakeOne(t) {
  const r = await fetch(BAKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BAKE_SECRET}` },
    body: JSON.stringify({ entity_type: t.entity_type, entity_id: t.entity_id, occurrence_id: t.occurrence_id }),
  });
  const ok = r.ok;
  let detail = '';
  let refused = null;
  let imageUrl = null;
  try {
    const body = await r.json();
    detail = JSON.stringify(body);
    refused = typeof body?.refused === 'string' ? body.refused : null;
    imageUrl = typeof body?.image_url === 'string' ? body.image_url : null;
  } catch { /* ignore */ }
  return { ok, status: r.status, detail, refused, imageUrl };
}

async function main() {
  console.log(`OG backfill — targets via og_render_targets_v1, baking at ${BAKE_URL}`);
  const targets = await rpc('og_render_targets_v1');
  if (!Array.isArray(targets) || targets.length === 0) {
    console.log('No targets.'); return;
  }
  console.log(`${targets.length} targets, concurrency ${CONCURRENCY}\n`);

  // REFUSED is not FAILED -- but only for ONE of the two refusal reasons, and
  // conflating them would have been a green run over a broken pipeline.
  //
  // /api/og/bake answers 422 when an entity cannot be baked into a real card,
  // because persisting the branded fallback under an immutable cover-keyed
  // name is the defect finding 1f closed (app/lib/ogBakePolicy.ts). The two
  // reasons are not the same kind of thing:
  //   cover-absent      steady state. og_render_targets_v1's first arm is
  //                     EVERY active event with no cover filter at all, so
  //                     flyer-less events answer 422 on every run for ever.
  //                     Counted, printed, and NOT a failure.
  //   cover-unfetchable a defect. The cover URL exists and will not load --
  //                     404, an origin slower than 5s, or a body over 12MB.
  //                     CI #65 sees only the first of those three (finding
  //                     1i), so this runner is the one place a CDN outage or a
  //                     bad storage migration shows up across EVERY entity.
  //                     Counted separately and it DOES decide the exit code.
  // A 5xx, a crash or a transport error still fails as before.
  // Keyed by reason, NOT a single counter labelled for one of them. A first
  // cut counted card-data-unavailable in a bucket printed as "cover
  // unfetchable", which would send an operator to storage during an RPC
  // outage -- the same misrouting ogBakePolicy.ts orders its checks to avoid.
  const broken = Object.create(null);
  let ok = 0, fail = 0, absent = 0, i = 0;
  async function worker() {
    while (i < targets.length) {
      const idx = i++;
      const t = targets[idx];
      try {
        const r = await bakeOne(t);
        if (r.ok) { ok++; console.log(`  OK   ${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'}`); }
        else if (r.refused === 'cover-absent') { absent++; console.log(`  SKIP ${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'} no cover to bake`); }
        else if (r.refused) { broken[r.refused] = (broken[r.refused] ?? 0) + 1; console.log(`  DEAD ${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'} ${r.refused}`); }
        else { fail++; console.log(`  FAIL ${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'} (${r.status}) ${r.detail}`); }
      } catch (e) {
        fail++; console.log(`  ERR  ${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  const brokenTotal = Object.values(broken).reduce((a, b) => a + b, 0);
  const brokenLine = Object.entries(broken).map(([k, v]) => `${v} ${k}`).join(', ') || '0 refused-as-broken';
  console.log(`\n${ok} baked, ${absent} no cover (expected), ${brokenLine}, ${fail} failed, ${targets.length} total.`);
  // A FLOOR, because "nothing failed" and "nothing worked" print the same
  // summary otherwise. If event_view_p5 stops returning cover_image_url at
  // all, every target answers cover-absent -- the one bucket that is not a
  // failure -- and this run would exit 0 having baked nothing. That is the
  // vacuous green PR #233 added floors for, in the one runner that touches
  // EVERY entity.
  if (targets.length > 0 && ok === 0) {
    console.error(`\nNothing baked across ${targets.length} targets -- treating as failure ` +
      '(a run that persists no card has not verified the pipeline, whatever the refusal mix).');
    process.exitCode = 1;
  }
  try {
    const health = await rpc('check_og_render_health_v1');
    console.log('og_render health:', JSON.stringify(health));
  } catch (e) { console.log('health check skipped:', e.message); }
  // process.exitCode, NOT process.exit(). Repo-measured on Linux CI: the bare
  // exit discards buffered piped stdout (904 lines became 194), and this
  // script prints one line PER TARGET -- so it would eat exactly the FAIL and
  // DEAD lines that name the cause and leave an operator with a bare exit 1.
  if (fail > 0 || brokenTotal > 0) process.exitCode = 1;
}

async function batchMain(opts) {
  const tag = opts.dryRun ? 'DRY RUN (nothing is baked)' : `baking at ${BAKE_URL}`;
  console.log(`OG backfill, layout ${opts.layout} -- ${tag}`);
  const [targets, rows] = await Promise.all([rpc('og_render_targets_v1'), readOgRenderRows()]);
  if (!Array.isArray(targets)) throw new Error('og_render_targets_v1 did not return a list');
  const plan = planBackfill(targets, rows, opts);
  if (opts.ids) {
    const matched = new Set(plan.inScope.map((t) => String(t.entity_id).toLowerCase()));
    const unmatched = [...opts.ids].filter((id) => !matched.has(id));
    if (unmatched.length) console.log(`--ids with no render target (not public, or not an event): ${unmatched.join(', ')}`);
  }
  console.log(`${plan.inScope.length} targets in scope; ${plan.onLayout} already on ${opts.layout}; ` +
    `${plan.notOnLayout.length} NOT yet on ${opts.layout}; this run bakes ${plan.toBake.length}` +
    `${opts.limit != null ? ` (--limit ${opts.limit})` : ''}.\n`);
  if (opts.dryRun) {
    for (const t of plan.toBake) console.log(`  PLAN ${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'}`);
    return;
  }
  const counts = { ok: 0, absent: 0, mismatch: 0, fail: 0 };
  const broken = Object.create(null);
  let i = 0;
  async function worker() {
    while (i < plan.toBake.length) {
      const t = plan.toBake[i++];
      const label = `${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'}`;
      try {
        const r = await bakeOne(t);
        if (r.ok && keyLayout(r.imageUrl) === opts.layout) { counts.ok++; console.log(`  OK   ${label}`); }
        else if (r.ok) { counts.mismatch++; console.log(`  MODE ${label} baked ${r.imageUrl} -- NOT ${opts.layout}: the deployment mode disagrees with --layout`); }
        else if (r.refused === 'cover-absent') { counts.absent++; console.log(`  SKIP ${label} no cover to bake`); }
        else if (r.refused) { broken[r.refused] = (broken[r.refused] ?? 0) + 1; console.log(`  DEAD ${label} ${r.refused}`); }
        else { counts.fail++; console.log(`  FAIL ${label} (${r.status}) ${r.detail}`); }
      } catch (e) {
        counts.fail++; console.log(`  ERR  ${label}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  const brokenTotal = Object.values(broken).reduce((a, b) => a + b, 0);
  const brokenLine = Object.entries(broken).map(([k, v]) => `${v} ${k}`).join(', ') || '0 refused-as-broken';
  const left = plan.notOnLayout.length - counts.ok;
  console.log(`\n${counts.ok} baked on ${opts.layout}, ${counts.absent} no cover (expected), ${brokenLine}, ` +
    `${counts.mismatch} baked on the WRONG layout, ${counts.fail} failed. ${left} in-scope targets still not on ${opts.layout}.`);
  console.log('Next: read-only counts of og_render by status (include status=error rows this batch created).');
  if (plan.toBake.length > 0 && counts.ok === 0) process.exitCode = 1;
  if (counts.fail > 0 || brokenTotal > 0 || counts.mismatch > 0) process.exitCode = 1;
}

if (isEntryPoint(import.meta.url)) {
  const opts = parseBackfillArgs(process.argv.slice(2));
  if (opts.errors.length) {
    console.error(opts.errors.join('\n'));
    process.exitCode = 2;
  } else if (!CONFIG_OK) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OG_BAKE_SECRET');
    process.exitCode = 2;
  } else if (opts.batch) {
    batchMain(opts).catch((e) => { console.error('backfill crashed:', e); process.exitCode = 1; });
  } else {
    main().catch((e) => { console.error('backfill crashed:', e); process.exitCode = 1; });
  }
}
