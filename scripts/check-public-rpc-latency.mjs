#!/usr/bin/env node
/**
 * Public-RPC latency budget (daily DB Contract Check #NN).
 *
 * Guards the two hottest anon reads against a slow-crawl toward the anon
 * `statement_timeout` (3s), which is what surfaced as user-facing
 * "canceling statement due to statement timeout" errors on /city/london-gb
 * (Sentry BACHATA-WEBSITE-2X/-2P). A perf regression on these paths used to be
 * invisible until a real crawler tripped the timeout; this catches it in CI.
 *
 * Probes (client-observed round-trip from the runner, anon key):
 *   1. get_calendar_events_v2  — the /city/:slug feed (London, next 7 days).
 *   2. event_view_p5(snapshot_compat) — the event-page snapshot, on a LIVE
 *      event self-selected from probe 1 (no brittle hardcoded id).
 *
 * Each probe runs a warm-up + N timed samples; we assert the MEDIAN (robust to
 * a single network blip). Budgets sit well under the 3s server timeout so we
 * alarm on the approach, not the cliff. Soft-passes (exit 0) when London has no
 * live events to probe — an empty calendar is not a latency regression.
 *
 * Local:  node scripts/check-public-rpc-latency.mjs   (reads .env)
 * CI:     env via repo secrets: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Tunables via env: RPC_LATENCY_FAIL_MS (default 2000), RPC_LATENCY_WARN_MS
 * (default 800), RPC_LATENCY_SAMPLES (default 5).
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    for (const raw of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
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
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(2);
}

const FAIL_MS = Number(env.RPC_LATENCY_FAIL_MS || 2000);
const WARN_MS = Number(env.RPC_LATENCY_WARN_MS || 800);
const SAMPLES = Math.max(3, Number(env.RPC_LATENCY_SAMPLES || 5));
const CITY = 'london-gb';

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function timeRpc(label, fn) {
  await Promise.resolve(fn()).catch(() => {}); // warm-up (not timed)
  const samples = [];
  let lastData = null;
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now();
    const { data, error } = await fn();
    const dt = performance.now() - t0;
    if (error) {
      console.error(`FAIL: ${label} RPC errored: ${error.message}`);
      process.exit(2);
    }
    samples.push(dt);
    lastData = data;
  }
  const med = median(samples);
  console.log(
    `  ${label}: median ${med.toFixed(0)}ms over ${SAMPLES} ` +
      `(min ${Math.min(...samples).toFixed(0)} / max ${Math.max(...samples).toFixed(0)})`,
  );
  return { med, data: lastData };
}

const nowIso = new Date().toISOString();
const in7Iso = new Date(Date.now() + 7 * 86_400_000).toISOString();

console.log(`Public-RPC latency budget (warn ${WARN_MS}ms / fail ${FAIL_MS}ms):`);

// Probe 1 — city feed.
const feed = await timeRpc('get_calendar_events_v2 [london, +7d]', () =>
  sb.rpc('get_calendar_events_v2', {
    range_start: nowIso,
    range_end: in7Iso,
    city_slug_param: CITY,
  }),
);

const rows = Array.isArray(feed.data) ? feed.data : [];
let snapshot = null;
if (rows.length === 0) {
  console.log(
    `  ℹ No live ${CITY} events in the next 7 days — skipping the snapshot probe (not a regression).`,
  );
} else {
  // Self-select a live event id from the feed.
  const eventId = rows.find((r) => r && r.event_id)?.event_id;
  if (eventId) {
    snapshot = await timeRpc(`event_view_p5(snapshot_compat) [${eventId.slice(0, 8)}…]`, () =>
      sb.rpc('event_view_p5', {
        p_target: { series_id: eventId },
        p_viewer: { role: 'anon', shape: 'snapshot_compat' },
      }),
    );
  }
}

const probes = [
  { label: 'get_calendar_events_v2', med: feed.med },
  ...(snapshot ? [{ label: 'event_view_p5(snapshot_compat)', med: snapshot.med }] : []),
];

const failed = probes.filter((p) => p.med > FAIL_MS);
const warned = probes.filter((p) => p.med > WARN_MS && p.med <= FAIL_MS);

if (warned.length) {
  for (const p of warned) {
    console.warn(`  ⚠ ${p.label} median ${p.med.toFixed(0)}ms exceeds warn budget ${WARN_MS}ms.`);
  }
}

if (failed.length) {
  console.error('\nFAIL: public-RPC latency budget exceeded — approaching the 3s anon statement_timeout.');
  for (const p of failed) {
    console.error(`  • ${p.label}: median ${p.med.toFixed(0)}ms > ${FAIL_MS}ms.`);
  }
  console.error(
    '  Investigate the RPC plan (cold planning / missing index / loop amplification). ' +
      'See the /city/london-gb timeout post-mortem.',
  );
  process.exit(1);
}

console.log(`\nOK: all ${probes.length} public-RPC probe(s) within budget.`);
process.exit(0);
