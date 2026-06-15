#!/usr/bin/env node
/**
 * CI contract check — P5 ↔ legacy SESSION-PEOPLE parity (M1, 2026-06-15).
 * Calls public.check_p5_session_override_parity_v1(), which multiset-diffs the
 * per-session PEOPLE roster (profile_id / profile_type / role, keyed by
 * legacy_program_item_id) between the P5 store (event_series_program_people_p5)
 * and the legacy store this site renders (event_program_people via
 * get_occurrence_program_v1), for every LIVE bridged series.
 *
 * Why: #35 (check-p5-legacy-program-parity) is PEOPLE-BLIND — it only diffs
 * (type, normalized title), so a person present in one store and missing in the
 * other slips through. Before the §5.7d session-people read flip (#53) can make
 * P5 canonical, we must prove the resolved roster matches both ways, or the flip
 * silently adds/drops line-up people on live pages. The base roster was healed to
 * 0/0 on 2026-06-15 (admin migrations 20260827030000 / 20260827040000).
 *
 * GATING: data.ok === true iff base-roster drifted_series = 0 (legacy_only +
 * p5_only). The per-occurrence overlay (occurrence_overlay in the payload) is
 * reported but NOT gated — converging it is the §5.7d read cutover's job (#53).
 * Repair (base roster): link unlinked P5 items to their legacy items
 * (event_series_program_item_p5.legacy_program_item_id) + re-run the people
 * backfill; pattern in admin migration 20260827040000.
 *
 * Local:  node scripts/check-p5-session-people-parity.mjs
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

const { data, error } = await sb.rpc('check_p5_session_override_parity_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_p5_session_override_parity_v1 not found (${error.message}) -- RPC is missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nP5↔LEGACY SESSION-PEOPLE PARITY FAIL: ${data?.drifted_series ?? '?'} live series ` +
    `have a per-session people roster that differs between the P5 store and the legacy ` +
    `mirror this site renders (legacy_only=${data?.legacy_only_total ?? '?'}, ` +
    `p5_only=${data?.p5_only_total ?? '?'}). Flipping session-people reads to P5 would ` +
    `change the public line-up. Repair: link unlinked P5 items to their legacy items + ` +
    `re-run the people backfill (admin migration 20260827040000). See sample above.`,
  );
  process.exit(1);
}

const ov = data.occurrence_overlay || {};
console.log(
  `\nP5↔legacy session-people parity: ok (base roster 0/0; ${data.total_live_series} live series). ` +
  `Per-occurrence overlay (non-gating, #53): legacy_overrides=${ov.legacy_session_people_overrides ?? 0}, ` +
  `legacy_added_sessions=${ov.legacy_added_sessions ?? 0}, p5_deltas=${ov.p5_session_people_deltas ?? 0}.`,
);
process.exit(0);
