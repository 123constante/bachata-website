#!/usr/bin/env node
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
  try {
    const body = await r.json();
    detail = JSON.stringify(body);
    refused = typeof body?.refused === 'string' ? body.refused : null;
  } catch { /* ignore */ }
  return { ok, status: r.status, detail, refused };
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

if (!CONFIG_OK) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OG_BAKE_SECRET');
  process.exitCode = 2;
} else {
  main().catch((e) => { console.error('backfill crashed:', e); process.exitCode = 1; });
}
