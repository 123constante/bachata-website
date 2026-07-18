#!/usr/bin/env node
/**
 * CI contract check — P5 public-read guard (the M2 repoint invariants, 2026-07-17).
 * Calls public.check_p5_public_read_contract_v1(), which asserts what the five
 * P5-backed public read RPCs actually RETURN. Every assertion maps to a bug that
 * shipped in the M2 repoints and was found by hand in an xhigh review, not by CI:
 *
 *   1. FESTIVAL_MISSING_FROM_VENUE_LIST_MID_RUN — a multi-day festival's row ended
 *      on day 1 (start + default_duration), so calendar_events_dto's OVERLAPS window
 *      dropped it from the venue "What's on" once the festival was under way, while
 *      the rest of the site still showed it. Probed per festival over its OWN run:
 *      a 60-day window can't see this, which is exactly why it shipped.
 *   2. FESTIVALS_LIST_GATE_LEAK / CALENDAR_DTO_GATE_LEAK /
 *      ORGANISER_PILL_NOT_BACKED_BY_SCHEDULED_OCCURRENCE — the visibility gate went
 *      fail-open (draft/archived series, dangling legacy links, NULL is_active), so
 *      unpublished and test events could feed public organiser dates.
 *   3. VENUE_WHATS_ON_SHOWS_CANCELLED / MORE_EVENTS_RAIL_SHOWS_CANCELLED — surfaces
 *      with no cancelled badge must not recommend a cancelled night.
 *      get_calendar_events_v2 is exempt BY DESIGN: it emits is_cancelled to label them.
 *   4. VACUOUS_CHECK — every assertion above passes on an empty set, so the RPC fails
 *      if any surface returns nothing or there is no multi-day festival to probe.
 *
 * All six failure modes were verified reachable: each bug was re-introduced against
 * prod inside a rolled-back transaction and this check went red.
 *
 * GATING: ok=true required. Any violation fails the build.
 *
 * Local:  node scripts/check-p5-public-read-contract.mjs
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

const { data, error } = await sb.rpc('check_p5_public_read_contract_v1');

if (error) {
  if (/function .* does not exist|could not find/i.test(error.message)) {
    console.error(
      `FAIL: check_p5_public_read_contract_v1 not found (${error.message}) — the guard is ` +
      `missing, so nothing is holding the P5 public-read invariants.`,
    );
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nP5 PUBLIC-READ GUARD FAIL: a public surface is returning rows it must not, or is ` +
    `dropping rows it must return (see errors above). Each code names the surface and the ` +
    `invariant; the shared visibility predicate is _p5_series_public_visibility_v1 and the ` +
    `festival span fix lives in admin migration 20260717130000.`,
  );
  process.exit(1);
}

const s = data.surfaces ?? {};
console.log(
  `\nP5 public-read guard: ok (festivals ${s.festivals}, venue dto ${s.venue_dto}, ` +
  `organiser pills ${s.organiser_pills}, event rail ${s.event_rail}, ` +
  `multi-day festivals probed ${s.multiday_festivals_probed}).`,
);
process.exit(0);
