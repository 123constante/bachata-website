#!/usr/bin/env node
/**
 * CI integrity check #34 - organiser-link contract (P5 <-> event_entities).
 *
 * INVARIANT: every ACTIVE event whose organiser is set in the canonical P5
 * surface (event_series_p5.organiser_ids[]) MUST also have a matching
 * public.event_entities row (role='organiser', entity_id=organiser_profile_id).
 * The public organiser page (src/pages/OrganiserProfile.tsx) plus
 * MoreEventsSection and FestivalDetail read event_entities EXCLUSIVELY, so an
 * event whose organiser lives only in the P5 array is invisible on the
 * organiser's own page - it renders "No upcoming events" (the 2026-06-11 bug).
 *
 * ROOT CAUSE this guards against: the editor-v2 save path
 * (_cmd_series_upsert_p5) writes organisers ONLY to event_series_p5.organiser_ids
 * and never to event_entities. See docs/organiser-link-fix-plan.md.
 *
 * WHY AN RPC, NOT A DIRECT TABLE READ: event_series_p5 is RLS-gated
 * (policy event_series_p5_ss_select) behind feature flag FF_DB_SELF_SERVE_RLS,
 * which is OFF in production - so the anon key this workflow uses cannot read
 * organiser_ids at all (it would see zero rows and silently false-pass).
 * Detection therefore requires the anon-EXECUTE SECURITY DEFINER health RPC
 * check_organiser_link_contract_v1(), authored in the admin repo
 * (bachata-admin-11april) as a read-only function. Until that migration ships,
 * this check SOFT-PASSES (warn, exit 0) - same pattern as check #17.
 *
 * Expected RPC payload (jsonb):
 *   { ok: boolean,
 *     active_orphan_count: integer,   // active events: P5 organiser set, event_entities empty
 *     total_orphan_count: integer,    // including inactive
 *     samples: [{ event_id, event_name, organiser_ids, organiser_names }] }
 *
 * Exit policy:
 *   - RPC missing on prod        -> exit 0 (warn; admin migration not yet shipped)
 *   - ok === true / count 0      -> exit 0 (pass)
 *   - active_orphan_count > 0    -> exit 1 (fail; new orphans - run the backfill / fix write-through)
 *   - malformed payload          -> exit 2
 *
 * Local:  node scripts/check-organiser-link-contract.mjs   (reads .env)
 * CI:     env VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * See: docs/organiser-link-fix-plan.md and .github/workflows/db-contract-check.yml.
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

const { data, error } = await sb.rpc('check_organiser_link_contract_v1');

if (error) {
  // Tolerate the function not yet being on prod (admin migration pending).
  const msg = error.message || '';
  const code = error.code || '';
  if (
    /check_organiser_link_contract_v1/i.test(msg) &&
    (/does not exist/i.test(msg) || /Could not find the function/i.test(msg) || code === 'PGRST202' || code === '42883')
  ) {
    console.warn(
      'WARN: check_organiser_link_contract_v1 is not yet deployed to this project. ' +
      'Soft-pass until the admin migration ships (see docs/organiser-link-fix-plan.md).',
    );
    process.exit(0);
  }
  console.error('RPC failed:', msg);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

const active = Number.isFinite(data?.active_orphan_count) ? data.active_orphan_count : NaN;

if (!Number.isFinite(active)) {
  console.error('\nFAIL: contract RPC returned malformed payload (active_orphan_count missing).');
  process.exit(2);
}

if (data.ok === true || active === 0) {
  console.log('\nOK: every active event with a P5 organiser has a matching event_entities row.');
  process.exit(0);
}

console.error(
  `\nFAIL: ${active} active event(s) have an organiser in event_series_p5 but no ` +
  `event_entities role='organiser' row - their public organiser pages show ` +
  `"No upcoming events". Run the backfill and confirm the _cmd_series_upsert_p5 ` +
  `write-through is live (docs/organiser-link-fix-plan.md). Samples printed above.`,
);
process.exit(1);
