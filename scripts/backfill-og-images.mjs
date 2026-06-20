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

if (!SUPABASE_URL || !SERVICE_KEY || !BAKE_SECRET) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OG_BAKE_SECRET');
  process.exit(2);
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
  try { detail = JSON.stringify(await r.json()); } catch { /* ignore */ }
  return { ok, status: r.status, detail };
}

async function main() {
  console.log(`OG backfill — targets via og_render_targets_v1, baking at ${BAKE_URL}`);
  const targets = await rpc('og_render_targets_v1');
  if (!Array.isArray(targets) || targets.length === 0) {
    console.log('No targets.'); return;
  }
  console.log(`${targets.length} targets, concurrency ${CONCURRENCY}\n`);

  let ok = 0, fail = 0, i = 0;
  async function worker() {
    while (i < targets.length) {
      const idx = i++;
      const t = targets[idx];
      try {
        const r = await bakeOne(t);
        if (r.ok) { ok++; console.log(`  OK   ${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'}`); }
        else { fail++; console.log(`  FAIL ${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'} (${r.status}) ${r.detail}`); }
      } catch (e) {
        fail++; console.log(`  ERR  ${t.entity_type} ${t.entity_id} ${t.occurrence_id ?? '-'}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  console.log(`\n${ok} baked, ${fail} failed, ${targets.length} total.`);
  try {
    const health = await rpc('check_og_render_health_v1');
    console.log('og_render health:', JSON.stringify(health));
  } catch (e) { console.log('health check skipped:', e.message); }
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('backfill crashed:', e); process.exit(1); });
