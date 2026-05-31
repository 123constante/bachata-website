#!/usr/bin/env node
/**
 * CI contract check: event_view_p5(snapshot_compat) must surface
 * cancelled calendar_occurrences in occurrences[] with is_cancelled=true.
 *
 * Background: until admin migration
 * 20260531210000_get_event_page_snapshot_v2_include_cancelled, the
 * snapshot RPC silently filtered cancelled rows out of occurrences[]
 * AND skipped occurrence_effective when the requested occurrence was
 * cancelled. That left every Website-side cancellation UI (DateBlock
 * pill, DatesBlock badge, ScheduleBlock chip, StickyTicketButton hide,
 * EventActionBar disable, EventCancelledBanner) inert in production.
 *
 * This check guards against the filter being re-introduced.
 *
 * Local:  node scripts/check-cancelled-occurrence-passthrough.mjs
 * CI:     same; env supplied as repo secrets.
 *
 * See .github/workflows/db-contract-check.yml.
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

const RED = '[31m';
const GREEN = '[32m';
const YELLOW = '[33m';
const RESET = '[0m';

async function main() {
  // Find a future cancelled occurrence on a published event. Two-query probe:
  // calendar_occurrences has multiple FKs to events, so PostgREST embedded join
  // fails with "more than one relationship was found". Probe occurrences then
  // filter by event lifecycle separately.
  const { data: candidateRows, error: probeErr } = await sb
    .from('calendar_occurrences')
    .select('id, event_id, lifecycle_status, cancellation_reason_label, instance_start')
    .eq('lifecycle_status', 'cancelled')
    .gt('instance_start', new Date().toISOString())
    .order('instance_start', { ascending: true })
    .limit(20);

  if (probeErr) {
    console.error(`${RED}FAIL${RESET}: could not probe calendar_occurrences: ${probeErr.message}`);
    process.exit(1);
  }

  if (!candidateRows || candidateRows.length === 0) {
    console.log(
      `${YELLOW}SKIP${RESET}: no future cancelled occurrences in calendar_occurrences ` +
        '(contract cannot be exercised this run). Re-evaluates next CI tick.',
    );
    process.exit(0);
  }

  const eventIds = [...new Set(candidateRows.map((r) => r.event_id))];
  const { data: pubEvents, error: pubErr } = await sb
    .from('events')
    .select('id')
    .eq('lifecycle_status', 'published')
    .in('id', eventIds);

  if (pubErr) {
    console.error(`${RED}FAIL${RESET}: could not filter to published events: ${pubErr.message}`);
    process.exit(1);
  }

  const pubIds = new Set((pubEvents || []).map((e) => e.id));
  const rows = candidateRows.filter((r) => pubIds.has(r.event_id)).slice(0, 5);

  if (rows.length === 0) {
    console.log(
      `${YELLOW}SKIP${RESET}: cancelled occurrences exist but none belong to published events ` +
        '(contract cannot be exercised this run).',
    );
    process.exit(0);
  }

  let failures = 0;
  for (const row of rows) {
    const { data: snap, error: rpcErr } = await sb.rpc('event_view_p5', {
      p_target: { series_id: row.event_id, occurrence_id: row.id },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    });

    if (rpcErr) {
      console.error(`${RED}FAIL${RESET}: RPC errored for event ${row.event_id}: ${rpcErr.message}`);
      failures++;
      continue;
    }

    const occurrences = Array.isArray(snap?.occurrences) ? snap.occurrences : [];
    const match = occurrences.find((o) => o.occurrence_id === row.id);

    if (!match) {
      console.error(
        `${RED}FAIL${RESET}: cancelled occurrence ${row.id} (event ${row.event_id}) ` +
          'is NOT present in snapshot.occurrences[]. The RPC is filtering cancelled rows. ' +
          'See admin migration 20260531210000_get_event_page_snapshot_v2_include_cancelled.',
      );
      failures++;
      continue;
    }

    if (match.is_cancelled !== true) {
      console.error(
        `${RED}FAIL${RESET}: cancelled occurrence ${row.id} surfaces but is_cancelled=${match.is_cancelled} ` +
          '(expected true).',
      );
      failures++;
      continue;
    }

    const effective = snap?.occurrence_effective;
    if (!effective || effective.occurrence_id !== row.id) {
      console.error(
        `${RED}FAIL${RESET}: occurrence_effective for cancelled occurrence ${row.id} ` +
          `is ${effective?.occurrence_id ?? 'null'} (expected ${row.id}). ` +
          'When ?occurrence_id is explicitly passed, the RPC must pin occurrence_effective to that row even when cancelled.',
      );
      failures++;
      continue;
    }

    console.log(
      `${GREEN}OK${RESET}: cancelled occurrence ${row.id} surfaces in snapshot with ` +
        `is_cancelled=true, reason=${JSON.stringify(match.cancellation_reason_label)}, ` +
        `occurrence_effective pinned.`,
    );
  }

  if (failures > 0) {
    console.error(`
${RED}${failures} contract violation(s) detected.${RESET}`);
    process.exit(1);
  }
  console.log(`
${GREEN}cancelled-occurrence passthrough contract OK.${RESET}`);
}

main().catch((err) => {
  console.error(`${RED}FAIL${RESET}: unexpected error: ${err?.stack || err}`);
  process.exit(1);
});
