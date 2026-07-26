#!/usr/bin/env node
/**
 * CI contract check: the event-page payload never says "an occurrence is selected"
 * while omitting its detail.
 *
 * event_view_p5(snapshot_compat) returns occurrence_id (the effective occurrence)
 * and occurrence_effective (its detail object). DateBlock renders "TBA" when
 * occurrence_effective is null. In 2026-07 a pinned NULL-materialised (or archived,
 * or beyond-window) occurrence echoed occurrence_id NON-null with
 * occurrence_effective NULL -- self-inconsistent, and the tile showed TBA. The fix
 * (admin 20260726015000) holds the invariant: occurrence_id non-null =>
 * occurrence_effective non-null.
 *
 * This guard asserts that invariant for a sample of live events, on BOTH the default
 * landing (featured occurrence) AND with the occurrence pinned by id -- the path the
 * venue What's-On link exercises, and the one that regressed.
 *
 * Local:  node scripts/check-compat-payload-consistency.mjs      (reads .env)
 * CI:     VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY as repo secrets.
 *
 * See admin migration 20260726015000 and db-contract-check.yml.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const RANGE_DAYS = 120;
const SAMPLE = 30;

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    const file = fs.readFileSync('.env', 'utf8');
    for (const raw of file.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).replace(/^"|"$/g, '');
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function isTransient(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return code === '57014' || msg.includes('statement timeout') || msg.includes('canceling statement') ||
    msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('network');
}

async function rpc(fn, args) {
  let { data, error } = await sb.rpc(fn, args);
  if (error && isTransient(error)) {
    await new Promise((r) => setTimeout(r, 2000));
    ({ data, error } = await sb.rpc(fn, args));
  }
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

const epoch = (v) => (v == null ? Infinity : Date.parse(v));
const nowIso = new Date().toISOString();
const endIso = new Date(Date.now() + RANGE_DAYS * 86400e3).toISOString();

const calRows = await rpc('get_calendar_events_v2', {
  range_start: nowIso, range_end: endIso, city_slug_param: null, p_include_past: false,
});

// One occurrence per event: the soonest upcoming.
const soonestByEvent = new Map();
for (const r of calRows || []) {
  const prev = soonestByEvent.get(r.event_id);
  if (!prev || epoch(r.occurrence_starts_at) < epoch(prev.occurrence_starts_at)) soonestByEvent.set(r.event_id, r);
}
const sample = [...soonestByEvent.values()].slice(0, SAMPLE);

const violations = [];
let probed = 0;

function assertInvariant(label, payload, row) {
  if (payload == null) return; // event not live / not found -> nothing to assert
  const occId = payload.occurrence_id ?? null;
  const eff = payload.occurrence_effective ?? null;
  if (occId != null && eff == null) {
    violations.push(`${row.name} [${row.event_id}] ${label}: occurrence_id=${occId} but occurrence_effective is null (would render TBA)`);
  }
}

for (const row of sample) {
  try {
    const landing = await rpc('event_view_p5', {
      p_target: { series_id: row.event_id },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    });
    assertInvariant('landing', landing, row);

    const pinned = await rpc('event_view_p5', {
      p_target: { series_id: row.event_id, occurrence_id: row.occurrence_id },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    });
    assertInvariant('pinned', pinned, row);
    probed++;
  } catch (e) {
    violations.push(`${row.name} [${row.event_id}]: event_view_p5 error: ${e.message}`);
  }
}

console.log(JSON.stringify({
  events_in_window: soonestByEvent.size, sampled: probed, violations: violations.length,
}, null, 2));

if (violations.length) {
  console.error(`\nFAIL: ${violations.length} payload self-consistency violation(s):`);
  for (const v of violations) console.error(`  - ${v}`);
  console.error('\nInvariant: a non-null occurrence_id must carry a non-null occurrence_effective (else the date tile renders TBA).');
  process.exit(1);
}

if (probed === 0) {
  console.warn('\nWARN: no live events in the window to probe -- nothing asserted.');
  process.exit(0);
}

console.log(`\nOK: ${probed} live event(s) hold occurrence_id => occurrence_effective (landing + pinned).`);
process.exit(0);
