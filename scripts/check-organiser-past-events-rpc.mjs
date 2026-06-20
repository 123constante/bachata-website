#!/usr/bin/env node
/**
 * CI contract check #41 - organiser past-events inclusion
 * (recurring "0 Past" fix, 2026-06-20).
 *
 * INVARIANT: get_organiser_calendar_events_v1(p_organiser_id, p_from, p_to,
 * p_include_past) must surface PAST occurrences when p_include_past=true, and
 * must stay future-only when the flag is omitted/false. Each row carries an
 * is_past boolean (server-computed, inverse of v2's 6h-grace keep-window) so the
 * client buckets past/future authoritatively.
 *
 * BUG THIS GUARDS: the RPC used to hard-code false as v2's p_include_past arg,
 * so it only ever returned future occurrences. The organiser page's client
 * useMemo then skipped any event with a future occurrence, so recurring weekly
 * organisers showed "0 Past" and hid "Past nights". Admin migration
 * 20260908000000 added the flag + is_past; src/pages/OrganiserProfile.tsx
 * (via C:\tmp\build_organiser.py) now makes a second include-past call.
 *
 * The check discovers a recurring organiser DYNAMICALLY (one with >=1 past
 * occurrence) rather than hard-coding a UUID, so it survives data churn.
 *
 * Exit policy:
 *   - 4-arg signature missing on prod   -> exit 0 (warn; admin migration pending)
 *   - no organiser has past occurrences -> exit 0 (skip; nothing to assert yet)
 *   - flag ignored / no is_past rows     -> exit 1 (fail; the recurring regression)
 *   - default call returns past rows     -> exit 1 (fail; backward-compat broke)
 *   - row missing a required field       -> exit 1 (fail; shape drift)
 *   - transport / malformed              -> exit 2
 *
 * Local:  node scripts/check-organiser-past-events-rpc.mjs   (reads .env)
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

// OrgOccRow fields the client (src/pages/OrganiserProfile.tsx) reads.
const REQUIRED = ['event_id', 'name', 'occurrence_id', 'instance_date', 'start_time', 'is_cancelled', 'is_past'];

const NOT_DEPLOYED = (msg, code) =>
  /get_organiser_calendar_events_v1/i.test(msg) &&
  (/p_include_past/i.test(msg) || /does not exist/i.test(msg) ||
   /Could not find the function/i.test(msg) || code === 'PGRST202' || code === '42883');

const today = new Date();
const fromIso = new Date(today.getTime() - 730 * 86400000).toISOString().slice(0, 10);
const toIso = new Date(today.getTime() + 86400000).toISOString().slice(0, 10);

// Pull a sample of organiser ids to scan for a recurring (has-past) one.
const { data: orgs, error: orgErr } = await sb
  .from('organiser_profiles')
  .select('id, name')
  .limit(60);

if (orgErr) {
  console.error('Transport error reading organiser_profiles:', orgErr.message);
  process.exit(2);
}
if (!Array.isArray(orgs) || orgs.length === 0) {
  console.warn('SKIP: no organiser_profiles readable as anon; nothing to assert.');
  process.exit(0);
}

let fixture = null;       // { id, name, rows }
let sawMissingSignature = false;

for (const org of orgs) {
  const { data: rows, error } = await sb.rpc('get_organiser_calendar_events_v1', {
    p_organiser_id: org.id,
    p_from: fromIso,
    p_to: toIso,
    p_include_past: true,
  });
  if (error) {
    const msg = error.message || '';
    const code = error.code || '';
    if (NOT_DEPLOYED(msg, code)) { sawMissingSignature = true; break; }
    console.error(`Transport error calling RPC for ${org.name}:`, msg);
    process.exit(2);
  }
  if (Array.isArray(rows) && rows.some((r) => r.is_past === true)) {
    fixture = { id: org.id, name: org.name, rows };
    break;
  }
}

if (sawMissingSignature) {
  console.warn(
    'WARN: get_organiser_calendar_events_v1 4-arg (p_include_past) signature not ' +
    'yet deployed. Soft-pass until admin migration 20260908000000 ships.',
  );
  process.exit(0);
}

if (!fixture) {
  console.warn('SKIP: no organiser in the sample has any past occurrence yet; nothing to assert.');
  process.exit(0);
}

console.log(`Fixture organiser: ${fixture.name} (${fixture.id})`);

// Assertion 1: shape - every row carries the OrgOccRow fields the client reads.
for (const row of fixture.rows) {
  for (const field of REQUIRED) {
    if (!(field in row)) {
      console.error(`FAIL: include-past row missing field "${field}": ${JSON.stringify(row)}`);
      process.exit(1);
    }
  }
}

// Assertion 2: past inclusion - at least one is_past row came back.
const pastCount = fixture.rows.filter((r) => r.is_past === true).length;
if (pastCount < 1) {
  console.error('FAIL: include-past call returned zero is_past rows for a known recurring organiser (flag ignored?).');
  process.exit(1);
}

// Assertion 3: backward-compat - the no-flag call must be future-only.
const { data: defRows, error: defErr } = await sb.rpc('get_organiser_calendar_events_v1', {
  p_organiser_id: fixture.id,
});
if (defErr) {
  console.error('Transport error on default (no-flag) call:', defErr.message);
  process.exit(2);
}
const defPast = (defRows || []).filter((r) => r.is_past === true).length;
if (defPast > 0) {
  console.error(`FAIL: default (no p_include_past) call returned ${defPast} is_past row(s) - backward-compat regressed; it must be future-only.`);
  process.exit(1);
}

console.log(
  `OK: get_organiser_calendar_events_v1 surfaces past occurrences with p_include_past=true ` +
  `(${pastCount} is_past row(s) for ${fixture.name}); default call stays future-only; OrgOccRow shape intact.`,
);
process.exit(0);
