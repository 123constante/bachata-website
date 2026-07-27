#!/usr/bin/env node
/**
 * CI contract check - event_series_p5 slug presence (M2 caller-zero keystone,
 * 2026-07-25). Calls public.check_event_series_p5_slug_presence_v1(), which flags
 * any LIVE event_series_p5 with a NULL/empty slug - a live event unresolvable by
 * slug, i.e. a writer the auto-populate trigger did not cover.
 *
 * REPORT-ONLY BY DESIGN. Following the enforce-don't-repair sequencing
 * (reference_close_seams_by_enforcement_not_repair): ship the presence report
 * first, soak, let runtime truth produce any missed-writer worklist, THEN promote
 * to a hard NOT NULL / DEFERRABLE constraint in a later soak-gated migration. So
 * this step WARNS on offenders and stays green - it is a visibility surface, not a
 * gate.
 *
 * NB: the sibling parity check (check-slug-resolver-parity.mjs, #56) is NOT a
 * backstop for this one, and it is wrong to read it as the hard gate behind this
 * report. check_slug_resolver_p5_parity_v1 drives BOTH its loops
 * `FROM public.events`, so it only ever probes series that still have a legacy
 * row. A P5-NATIVE series (event_series_p5.legacy_event_id IS NULL) with a null
 * slug is never probed there and cannot turn it red - and P5-native is precisely
 * the shape the self-serve writers produce, i.e. the population this presence
 * report exists for. So for those rows this report-only WARN is the ONLY signal
 * until the hard NOT NULL constraint (migration C) lands.
 *
 * Exit policy:
 *   - RPC missing on prod   -> exit 0 (warn; admin migration 20260725100000 pending)
 *   - ok true / 0 offenders -> exit 0 (pass)
 *   - offenders > 0         -> exit 0 (WARN only - report-only soak)
 *   - malformed payload     -> exit 2
 *
 * Local:  node scripts/check-slug-presence.mjs   (reads .env)
 * CI:     env VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
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

const { data, error } = await sb.rpc('check_event_series_p5_slug_presence_v1');

if (error) {
  const msg = error.message || '';
  const code = error.code || '';
  if (
    /check_event_series_p5_slug_presence_v1/i.test(msg) &&
    (/does not exist/i.test(msg) || /Could not find the function/i.test(msg) || code === 'PGRST202' || code === '42883')
  ) {
    console.warn(
      'WARN: check_event_series_p5_slug_presence_v1 is not yet deployed to this project. ' +
      'Soft-pass until admin migration 20260725100000 ships.',
    );
    process.exit(0);
  }
  console.error('RPC failed:', msg);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const offenders = Number.isFinite(data?.offender_count) ? data.offender_count : NaN;
if (!Number.isFinite(offenders)) {
  console.error('\nFAIL: presence RPC returned malformed payload (offender_count missing).');
  process.exit(2);
}

if (data.ok === true || offenders === 0) {
  console.log(`\nOK: no live event_series_p5 with a missing slug (live_series ${data.live_series}).`);
  process.exit(0);
}

console.warn(
  `\nWARN (report-only): ${offenders} live event_series_p5 row(s) have a NULL/empty slug - a ` +
  `writer the auto-populate trigger did not cover. Their /event or /festival page cannot be ` +
  `reached by slug. Offenders printed above. This does NOT fail the build during the soak, and ` +
  `for a P5-NATIVE series (legacy_event_id IS NULL) nothing else catches it - the parity guard ` +
  `(check-slug-resolver-parity, #56) loops FROM public.events and never probes those rows. Add ` +
  `the missing writer to the worklist before promoting slug to a hard NOT NULL constraint ` +
  `(migration C).`,
);
process.exit(0);
