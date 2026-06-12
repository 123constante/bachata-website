#!/usr/bin/env node
/**
 * CI contract check — P5 ↔ legacy program parity (2026-06-12).
 * Calls public.check_p5_legacy_program_parity_v1(), which diffs the multiset of
 * (type, normalized title) between the P5 series program tree (what the admin
 * editor reads/writes) and the legacy event_program_items mirror (what THIS
 * site's schedule reads via get_occurrence_program_v1) for every LIVE bridged
 * series.
 *
 * Why: series.set_program only started mirroring P5→legacy on 2026-06-02, and
 * events.meta_data.program used to resurrect stale programs via
 * trg_sync_event_program → replace_event_program on any legacy meta_data save.
 * That combination put phantom sessions on live event pages (e.g. the BOS
 * "DOMInation Team" showcase that survived its deletion in the editor) and
 * left one series with NO public schedule at all. 11/49 live series were
 * drifted when first swept; all were reconciled on 2026-06-12 (admin
 * migrations 20260821000000–20260821030000) and the mirror now keeps the
 * relational tables, meta_data.program and per-date session overrides in
 * lockstep. This gate keeps drift at zero until the Phase 1E read cutover
 * retires the legacy dependency.
 *
 * GATING: data.ok === true iff drifted_series = 0. Any drift fails the build.
 * Repair: run admin _mirror_p5_program_to_legacy_v1(series_id) when P5 is
 * truth, or _seed_p5_program_from_legacy_v1(series_id) when the P5 tree was
 * never seeded (the mirror refuses to wipe a populated legacy program from an
 * empty P5 tree).
 *
 * Local:  node scripts/check-p5-legacy-program-parity.mjs
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

const { data, error } = await sb.rpc('check_p5_legacy_program_parity_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_p5_legacy_program_parity_v1 not found (${error.message}) -- RPC is missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nP5↔LEGACY PROGRAM PARITY FAIL: ${data?.drifted_series ?? '?'} live series have ` +
    `programs that differ between the P5 editor tree and the legacy mirror this site ` +
    `renders. The editor and the public schedule are showing different sessions. ` +
    `Repair: _mirror_p5_program_to_legacy_v1(series_id) (P5 is truth) or ` +
    `_seed_p5_program_from_legacy_v1(series_id) (P5 tree never seeded). See sample above.`,
  );
  process.exit(1);
}

console.log(
  `\nP5↔legacy program parity: ok (0 drifted; ${data.total_live_series} live series tracked).`,
);
process.exit(0);
