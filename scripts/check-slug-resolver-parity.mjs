#!/usr/bin/env node
/**
 * CI contract check - P5 slug-resolver parity (M2 caller-zero keystone, 2026-07-25).
 * Calls public.check_slug_resolver_p5_parity_v1(), which asserts the pure-P5
 * identity resolver resolve_public_event_ref_v1 returns exactly what the legacy
 * `.from('events').select('id, slug')` read returned, for every anon-visible event.
 *
 * WHY THIS EXISTS. The keystone repointed the /event and /festival identity resolve
 * (app/detailLoader.ts, app/routes/event.tsx, src/lib/seo/useEntitySlugOrId.ts,
 * app/lib/ogCardRender.ts) off legacy `events` onto resolve_public_event_ref_v1,
 * which reads the now-canonical event_series_p5.slug. This guard HOLDS the two
 * reads byte-equal until legacy `events` is dropped (Phase 1E #2 Stage E) - a slug
 * that stops resolving, or resolves to the wrong id, silently 404s a live page.
 *
 * Four-direction discipline (asserted inside the RPC): positive (every active event
 * round-trips through its slug), fidelity (the anon EXECUTE grant on the resolver -
 * the DEFINER guard calls the DEFINER resolver as OWNER, so a botched grant would
 * pass here while the live anon Website 403s), non-vacuity (checked > 0 from a real
 * row count), and current_user reported.
 *
 * GATING: ok=true required. Soft-passes only if the RPC is not yet on prod (the
 * admin migration 20260725110000 not applied) - same idiom as check #34.
 *
 * Local:  node scripts/check-slug-resolver-parity.mjs   (reads .env)
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

const { data, error } = await sb.rpc('check_slug_resolver_p5_parity_v1');

if (error) {
  const msg = error.message || '';
  const code = error.code || '';
  if (
    /check_slug_resolver_p5_parity_v1/i.test(msg) &&
    (/does not exist/i.test(msg) || /Could not find the function/i.test(msg) || code === 'PGRST202' || code === '42883')
  ) {
    console.warn(
      'WARN: check_slug_resolver_p5_parity_v1 is not yet deployed to this project. ' +
      'Soft-pass until admin migration 20260725110000 ships.',
    );
    process.exit(0);
  }
  console.error('RPC failed:', msg);
  process.exit(2);
}

console.log(JSON.stringify(data, null, 2));

if (data?.ok !== true) {
  console.error(
    '\nSLUG-RESOLVER PARITY FAIL: resolve_public_event_ref_v1 no longer matches the legacy ' +
    'events read for at least one anon-visible event (see mismatches above). A slug that stops ' +
    'resolving, or resolves to the wrong id, 404s a live /event or /festival page. Check the ' +
    'event_series_p5.slug backfill/trigger (admin migration 20260725100000) and the anon EXECUTE ' +
    'grant on the resolver.',
  );
  process.exit(1);
}

console.log(
  `\nSlug-resolver parity: ok (checked ${data.checked}, anon_can_execute ${data.anon_can_execute}, ` +
  `measured_by ${data.measured_by}).`,
);
process.exit(0);
