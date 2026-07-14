#!/usr/bin/env node
/**
 * CI contract check - festival detail v1/v2 parity (M2c, 2026-07-14).
 *
 * Calls public.check_festival_detail_p5_parity_v1(), which holds
 * get_public_festival_detail (legacy-sourced) == get_public_festival_detail_v2
 * (P5-native schedule + lineup) for as long as BOTH exist.
 *
 * Why this guard exists: the Website was flipped to _v2 on the strength of the two
 * payloads being byte-equal. That equality is the whole safety argument, and nothing was
 * holding it. If P5 and the legacy tables drift apart, a live festival page silently goes
 * wrong (missing session, wrong teacher, wrong start time) and no other check would see
 * it. Retire this the moment v1 is dropped.
 *
 * Guarded dimensions (both must be 0):
 *   - mismatches:        per published festival, FULL payload parity
 *   - lineup_mismatches: `lineup` parity across ALL published events - useEventPage feeds
 *                        this RPC's lineup into NON-festival BentoPages as a fallback, so
 *                        a festivals-only check would miss drift that reaches a standard
 *                        event's page.
 *
 * Deliberately normalized away (and ONLY these two):
 *   - schedule[].section_id  - legitimately changes id-space (legacy event_program_sections
 *                              -> event_series_program_section_p5). parseSchedule never
 *                              reads section_id / section_label / section_kind / lane_index.
 *   - schedule[] array ORDER - the page buckets sessions by the `day` string and the parsed
 *                              hour, never by array position.
 * Element CONTENT is compared byte for byte. Proven both directions against live data: a
 * changed session title and a 1h shift in dates.starts_at are both CAUGHT; a rewritten
 * section_id and a reversed schedule array are both ignored.
 *
 * GATING: ok=true required. Any drift fails the build.
 *
 * Local:  node scripts/check-festival-detail-parity.mjs   (reads .env)
 * CI:     env VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 * See:    admin repo migrations/20260714090000_check_festival_detail_p5_parity_v1.sql
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

// Set process.exitCode and RETURN rather than calling process.exit() after an RPC:
// process.exit() while fetch's keep-alive socket is still closing trips a libuv
// assertion (exit 127) on Windows, which would mask a real pass/fail locally.
const finish = (code) => { process.exitCode = code; };

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await sb.rpc('check_festival_detail_p5_parity_v1');

if (error) {
  if (/function .* does not exist|could not find/i.test(error.message)) {
    console.error(
      `FAIL: check_festival_detail_p5_parity_v1 not found (${error.message}) - the M2c ` +
      `parity guard is missing, so nothing is holding v1 == v2.`,
    );
    finish(1);
  } else {
    console.error('RPC failed:', error.message);
    finish(2);
  }
} else if (!data || typeof data !== 'object') {
  console.error('FAIL: unexpected payload from check_festival_detail_p5_parity_v1:', data);
  finish(2);
} else {
  const {
    ok,
    festivals_checked: festivals = 0,
    mismatches = 0,
    lineup_events_checked: lineupEvents = 0,
    lineup_mismatches: lineupBad = 0,
    sample = [],
  } = data;

  if (festivals === 0) {
    // A guard that silently checks nothing is worse than no guard: with an empty
    // festival set, "0 mismatches" would be a meaningless green.
    console.error('FAIL: 0 published festivals were checked - the guard is vacuous.');
    finish(1);
  } else if (ok === true && mismatches === 0 && lineupBad === 0) {
    console.log(
      `OK: festival detail v1 == v2 (${festivals} festival(s) full-payload, ` +
      `${lineupEvents} published event(s) lineup-only).`,
    );
    finish(0);
  } else {
    console.error(
      `DRIFT: get_public_festival_detail and _v2 disagree - ${mismatches} festival payload ` +
      `mismatch(es), ${lineupBad} lineup mismatch(es).`,
    );
    console.error(
      'The Website reads _v2. A mismatch means a live festival page may be showing the wrong ' +
      'schedule, line-up or start time.',
    );
    for (const s of sample.slice(0, 10)) {
      console.error(`  - ${s.name ?? s.event_id}: ${JSON.stringify(s.differing_keys ?? s.reason)}`);
    }
    finish(1);
  }
}
