#!/usr/bin/env node
/**
 * CI contract check — cancelled-occurrence VISIBILITY on the default detail page
 * (centralized occurrence-policy arc, 2026-06-17).
 *
 * Sibling of #24 (cancelled-occurrence PASSTHROUGH, which covers the
 * explicitly-requested-occurrence case). THIS check covers the DEFAULT /
 * no-occurrence-in-URL case: a public event-detail page loaded by slug must
 * lead with the next chronological occurrence INCLUDING a cancelled imminent
 * date, so the cancellation is visible — not silently skipped to the next live
 * date. The bug it locks: get_event_page_snapshot_v2 / _event_view_snapshot_compat_v1
 * used to pick the default occurrence with "<> 'cancelled'", hiding a cancelled
 * "this Friday" while jumping to the next live date.
 *
 * Calls public.check_cancelled_occurrence_visibility_v1(), which asserts:
 *   1. visibility — every LIVE series whose featured occurrence is cancelled has
 *      event_view_p5(snapshot_compat).occurrence_effective.is_cancelled = true.
 *   2. reason parity — the legacy mirror reason equals the vocabulary-coerced P5
 *      override reason (never silently divergent / NULL).
 *
 * GATING: status is 'ok' iff violations = 0.
 *
 * Local:  node scripts/check-cancelled-occurrence-visibility.mjs
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

const { data, error } = await sb.rpc('check_cancelled_occurrence_visibility_v1');

if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: check_cancelled_occurrence_visibility_v1 not found (${error.message}) -- RPC is missing, contract broken.`);
    process.exit(1);
  }
  console.error('RPC failed:', error.message);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    `\nCANCELLED-OCCURRENCE VISIBILITY FAIL: ${data?.violations ?? '?'} violation(s). ` +
    `A cancelled imminent date is being hidden on a public detail page, or a legacy ` +
    `cancellation reason has drifted from its P5 source. See visibility_violations / ` +
    `reason_parity_violations above. Likely cause: a default-occurrence selector that ` +
    `excludes cancelled rows (must use _public_featured_occurrence_p5_v1).`,
  );
  process.exit(1);
}

console.log(
  `\nCancelled-occurrence visibility: ok (0 violations; ` +
  `${data.checked_featured_cancelled} featured-cancelled series checked).`,
);
process.exit(0);
