#!/usr/bin/env node
/**
 * CI contract check #64 -- festival DETAIL date-span (2026-08-06).
 *
 * Calls public.check_festival_detail_span_v1(), which asserts that
 * get_public_festival_detail_v2(...).dates matches the canonical program-day
 * span (_p5_festival_span_v1) for every LIVE festival.
 *
 * Why this exists SEPARATELY from check #40: #40
 * (check_festival_occurrence_span_v1) measures the CALENDAR read path
 * (get_calendar_events_v2), which was moved onto the program-day canon by the
 * program-day-canonical rework and is correct. The DETAIL read path never
 * got that fix. On 2026-08-06 #40 reported "7 live festivals, 0 drift" while
 * three detail pages rendered the wrong span:
 *
 *   AB Intl Congress     dates 2027-03-26..2027-03-27, program 26..29 (2 lost)
 *   London Sensual Days  dates 2026-06-19..2026-06-22, program 19..21 (phantom)
 *   BOS Mallorca         dates 2026-10-22..2026-10-26, program 22..25 (phantom)
 *
 * A green #40 next to three broken pages is the exact gap this closes: the
 * two public read paths must agree about the same festival.
 *
 * The wrong span is not cosmetic -- dates.endsAt also feeds the page JSON-LD
 * endDate (Google) and the .ics / Google / Outlook calendar exports.
 *
 * GATING: status must be 'ok' (drift_count = 0). no_program_days and
 * no_anchor are REPORTED, never gating -- an indeterminate span is check
 * #40's to own, and failing twice for one data problem just teaches people
 * to ignore a red.
 *
 * Exit codes (repo convention, R3): 0 contract holds, 1 contract violated,
 * 2 the check could not run (credentials, network, timeout). A thrown error
 * anywhere is 2, not a stack-trace masquerading as drift.
 *
 * Local:  node scripts/check-festival-detail-span.mjs     (reads .env)
 * Canary: node scripts/check-festival-detail-span.mjs --self-test
 * CI:     env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
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

// The anon 3s statement_timeout (57014) and network blips are infra noise,
// not gate drift -- retry once. Kept narrow on purpose: a bare "timeout"
// substring would over-match genuine errors. Same helper as
// check-venue-publish-gate.mjs, which calls a comparably heavy anon RPC.
export function isTransient(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    code === '57014' ||
    msg.includes('statement timeout') ||
    msg.includes('canceling statement') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network')
  );
}

// PGRST202 arrives in error.code, not error.message, on some PostgREST
// versions -- classify over both (the sibling check-map-events-rpc.mjs
// pattern).
export function isFunctionMissing(err) {
  if (!err) return false;
  return /PGRST202|could not find the function|schema cache|does not exist/i.test(
    `${err.code ?? ''} ${err.message ?? ''}`,
  );
}

/**
 * Pure verdict over the RPC payload. Returns { code, out, err } where out/err
 * are the lines to print on stdout/stderr. Exercised by the self-test; main()
 * only does I/O around it.
 */
export function evaluate(data) {
  const out = [];
  const err = [];

  if (data == null) {
    err.push(
      'FAIL: check_festival_detail_span_v1 returned NULL -- the guard broke, ' +
        'which is a contract violation in itself.',
    );
    return { code: 1, out, err };
  }

  out.push(JSON.stringify(data, null, 2));

  const total = data.festivals_total ?? 0;
  if (total === 0) {
    // Non-vacuity: zero live festivals is a legitimate state (so this does
    // not gate), but say it loudly -- a green over an empty population is a
    // different claim than a green over 7 measured festivals.
    out.push('\nnote: 0 live festivals measured -- the check is green over an EMPTY population.');
  }

  if ((data.no_program_days ?? 0) > 0) {
    out.push(
      `\nnote: ${data.no_program_days} live festival(s) have no program days, ` +
        'so their span is indeterminate here. Non-gating -- check #40 owns that.',
    );
  }

  // Emitted by the guard from 20260807110000 onward; absent before that.
  if ((data.no_anchor ?? 0) > 0) {
    out.push(
      `\nnote: ${data.no_anchor} live festival(s) have program days but no anchor date ` +
        '(no default_start_date, no occurrence rows), so the canon is indeterminate ' +
        'and the page serves its occurrence-derived fallback. Non-gating; fix the data.',
    );
  }

  if (data.status !== 'ok') {
    err.push(
      `\nFESTIVAL DETAIL SPAN FAIL: ${data.drift_count ?? '?'} live festival(s) ` +
        'have a detail-page date span that disagrees with their program-day ' +
        'structure. See drift_sample above: detail_* is what the festival page ' +
        '(and its JSON-LD endDate and .ics export) is publishing; canonical_* is ' +
        'what the program days say.\n' +
        '      Two known shapes: an end that crosses midnight leaks a phantom ' +
        'trailing day, and a multi-occurrence festival truncates to day 0.\n' +
        '      Fix the read path, not the data -- see admin ' +
        'docs/festival-detail-span-delta.md.',
    );
    return { code: 1, out, err };
  }

  out.push(
    `\nfestival detail span: ok (${total} live festivals, 0 drift; ` +
      'each detail page publishes its program-day span).',
  );
  return { code: 0, out, err };
}

// NOTE: main() RETURNS its exit code rather than calling process.exit().
// process.exit() truncates buffered stdout on Linux CI (it does not on
// Windows), which silently swallowed most of a guard's output once already.
async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const callGuard = () => sb.rpc('check_festival_detail_span_v1');

  let { data, error } = await callGuard();
  if (error && isTransient(error)) {
    console.error(
      `Transient error (${error.code || '?'}: ${error.message}); retrying once in 2s...`,
    );
    await new Promise((r) => setTimeout(r, 2000));
    ({ data, error } = await callGuard());
  }

  if (error) {
    if (isFunctionMissing(error)) {
      console.error(
        `FAIL: check_festival_detail_span_v1 not found (${error.code ?? '?'}: ${error.message}).\n` +
          '      Apply admin migration\n' +
          '      20260807082141_festival_span_canonical_helper_and_guard_v1.sql\n' +
          '      (already live on prod since 2026-08-07 -- if this fires, the\n' +
          '      guard was dropped or the PostgREST schema cache is stale).',
      );
      return 1;
    }
    console.error(`Transport/unexpected error: ${error.code ?? '?'}: ${error.message}`);
    return 2;
  }

  const verdict = evaluate(data);
  for (const line of verdict.out) console.log(line);
  for (const line of verdict.err) console.error(line);
  return verdict.code;
}

// Canary (rule R4): prove the verdict logic can fail before trusting it to
// pass. Pure -- no network, no credentials.
export function selfTest(log = console.log) {
  const cases = [];
  const add = (name, actual, expected) => cases.push({ name, actual, expected });

  const clean = { status: 'ok', festivals_total: 7, no_program_days: 0, drift_count: 0 };
  const drifting = {
    status: 'drift',
    festivals_total: 7,
    no_program_days: 0,
    drift_count: 3,
    drift_sample: [{ name: 'AB Intl' }],
  };

  // --- evaluate(), both directions ---
  add('a clean payload passes', evaluate(clean).code, 0);
  add('drift status FAILS with exit 1', evaluate(drifting).code, 1);
  add('the failure names its drift count', evaluate(drifting).err.join('\n').includes('3 live festival(s)'), true);
  add('a NULL payload is a contract violation (1), not a pass', evaluate(null).code, 1);
  add('no_program_days alone does NOT gate', evaluate({ ...clean, no_program_days: 2 }).code, 0);
  add('no_program_days is still reported', evaluate({ ...clean, no_program_days: 2 }).out.join('\n').includes('no program days'), true);
  add('no_anchor alone does NOT gate', evaluate({ ...clean, no_anchor: 1 }).code, 0);
  add('no_anchor is still reported', evaluate({ ...clean, no_anchor: 1 }).out.join('\n').includes('no anchor'), true);
  add('an empty population is announced, not hidden', evaluate({ ...clean, festivals_total: 0 }).out.join('\n').includes('EMPTY population'), true);
  add('an unknown status gates (fail-closed)', evaluate({ ...clean, status: 'wat' }).code, 1);

  // --- error classification, both directions ---
  add('57014 is transient', isTransient({ code: '57014', message: 'x' }), true);
  add('statement timeout text is transient', isTransient({ message: 'canceling statement due to statement timeout' }), true);
  add('a genuine SQL error is NOT transient', isTransient({ code: '42883', message: 'operator does not exist' }), false);
  add('PGRST202 in error.CODE is function-missing', isFunctionMissing({ code: 'PGRST202', message: 'x' }), true);
  add('schema-cache text is function-missing', isFunctionMissing({ message: 'Could not find the function in the schema cache' }), true);
  add('a permission error is NOT function-missing', isFunctionMissing({ code: '42501', message: 'permission denied' }), false);

  let failed = 0;
  for (const c of cases) {
    const ok = c.actual === c.expected;
    if (!ok) failed++;
    log(`${ok ? '  ok  ' : '  FAIL'} ${c.name}${ok ? '' : ` (got ${JSON.stringify(c.actual)}, want ${JSON.stringify(c.expected)})`}`);
  }
  log(
    failed === 0
      ? `PASS self-test -- ${cases.length} cases, the contract proven in both directions.`
      : `FAIL self-test -- ${failed} of ${cases.length} case(s).`,
  );
  return failed === 0;
}

if (process.argv.includes('--self-test')) {
  process.exitCode = selfTest() ? 0 : 1;
} else {
  // A throw anywhere (malformed secret crashing createClient, DNS/TLS failure
  // surfacing as a TypeError) is "the check could not run" -- exit 2, never 1.
  process.exitCode = await main().catch((e) => {
    console.error(`Transport/unexpected error: ${e?.message ?? e}`);
    return 2;
  });
}
