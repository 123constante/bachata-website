#!/usr/bin/env node
/**
 * CI contract check — reverse-orphan occurrence guard (duplicate-date cancel-400 fix,
 * 2026-06-24). Calls public.check_reverse_orphan_occurrence_v1(), which detects, on
 * legacy-backed P5 series:
 *   - reverse-orphans: legacy calendar_occurrences rows with NO event_occurrence_p5
 *     mirror (informational; past/archived/test rows are harmless).
 *   - collisions: a reverse-orphan that ALSO has an unlinked pure-P5 occ on the same
 *     date. This is what makes admin_event_workspace emit a DUPLICATE date row carrying
 *     a legacy id, which the P5 command path rejects with 'not_found' -> the editor's
 *     "That event or date no longer exists" 400 on cancel-occurrence.
 *
 * Root cause was _cmd_series_add_date_p5 minting a P5 occ + legacy mirror without
 * linking them (admin migrations 20261001000000 heal / 20261001010000 prevention /
 * 20261001020000 workspace dedupe / 20261001030000 this guard).
 *
 * GATING: status is 'ok' iff collision_count = 0. reverse_orphan_count is reported but
 * non-gating (harmless past/draft rows).
 *
 * Local:  node scripts/check-reverse-orphan-occurrence.mjs
 * CI:     same, env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(2);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await sb.rpc('check_reverse_orphan_occurrence_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_reverse_orphan_occurrence_v1 not found (${error.message}) -- RPC is missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.status !== 'ok') {
  console.error(
    `\nREVERSE-ORPHAN OCCURRENCE GUARD FAIL: ${data?.collision_count ?? '?'} same-date ` +
    `collision(s) — a pure-P5 occ and an unlinked legacy occurrence share a date, so the ` +
    `editor shows that date twice and cancel 400s on the legacy-id row. Heal by re-running ` +
    `the link UPDATE from admin migration 20261001000000 (or link the pure-P5 occ's ` +
    `legacy_occurrence_id to its same-date twin). See collision_sample above.`,
  );
  process.exit(1);
}

console.log(
  `\nReverse-orphan occurrence guard: ok (0 collisions; ${data.reverse_orphan_count} ` +
  `non-colliding reverse-orphan(s) reported, non-gating).`,
);
process.exit(0);
