#!/usr/bin/env node
/**
 * CI contract check #69: is the OG BAKE pipeline actually producing images?
 *
 * public.og_render is the bake ledger: one row per shareable entity, carrying
 * the pre-baked R2 object every link preview resolves to. When baking stalls,
 * nothing on the site breaks visibly -- pages still render, every OG assertion
 * in check-og-images.mjs still passes against the LAST GOOD image -- while new
 * and changed entities quietly share the wrong picture or none at all.
 *
 * check_og_render_health_v1() has been installed since admin migration
 * 20260814130000 and was called by NO CI until this guard. During the
 * 2026-08-21 WAF incident it reported the outage to nobody. "An installed RPC
 * is not a check."
 *
 * Reads the BAKE half of the payload (ready/pending/error/stuck/sample_errors).
 * The SCRAPE half (`snapshot`, `drain`) belongs to check-og-scrape-evidence.mjs
 * -- same RPC, different question, deliberately not merged.
 *
 * WHY `stuck` IS NOT THE THRESHOLD -- measured, not assumed
 * --------------------------------------------------------
 * The obvious wiring is "the incident reported stuck: 1, so gate on stuck".
 * That is wrong, and the way it is wrong is the whole reason this phase exists.
 *
 * Measured against prod 2026-08-22, in health: ready 279, pending 0, error 1,
 * stuck 1. The incident's own reading was pending 3, stuck 1. `stuck` is
 * IDENTICAL in both states -- it was counting the same single permanent
 * `card-data-unavailable` row (attempts = 5, therefore excluded from _og_sweep's
 * selection, therefore its updated_at is frozen and it is stale for ever).
 *
 * It could not have counted the outage. `stuck` is `status <> 'ready' AND
 * updated_at < now() - 15 minutes`, and _og_sweep sets `updated_at = now()`
 * every time it issues a POST -- every 2 minutes, for as long as attempts < 5.
 * A row being retried is a row whose updated_at is always fresh. A threshold on
 * `stuck` alone is either permanently red (>= 1) or permanently green (>= 2)
 * against every state this pipeline can reach.
 *
 * What made the class measurable is P1 (admin `_og_bake_reconcile`): a non-2xx
 * bake POST now increments attempts, flips status to 'error', and records
 * `bake POST failed: HTTP <code> -- <body>`. That string is this guard's
 * primary signal, and it did not exist during the incident. Read the rules
 * below as "wired to P1's output", never as "would have caught the original".
 *
 * "BUT V1 ALSO STAYS RED FOR EVER" -- yes, and here is why that is not the
 * same defect. Raised in review, and the mechanism is confirmed against prod:
 * a row that exhausts its 5 attempts leaves _og_sweep's pool for good, and
 * _og_enqueue resets attempts ONLY on its INSERT..ON CONFLICT branch, reached
 * when the row is new or the cover HASH changed -- an unrelated write to the
 * entity takes the plain UPDATE branch and never touches attempts. So V1's red
 * outlives the outage that caused it and needs a deliberate repair.
 *
 * The distinction from `stuck` is the one that matters: `stuck` reads 1 on a
 * HEALTHY system, so it can only be thresholded into permanent noise or
 * permanent silence. V1 reads 0 on a healthy system (measured: prod's only
 * error is `card-data-unavailable`, a content reason) and becomes non-zero
 * only when entities are genuinely, permanently unbakeable. That is a real
 * defect with a real remediation, not ordinary work -- so it gates, and the
 * violation text names the repair rather than leaving the operator to find it.
 *
 * WHAT V1 CANNOT SEE, stated rather than discovered later. `sample_errors` is
 * LIMIT 5 ORDER BY updated_at DESC and carries NO timestamp per row. Once a
 * failing row hits attempts = 5 its updated_at freezes, so five NEWER content
 * errors would push the transport errors out of the sample and V1 would go
 * quiet while the parked rows remain. It needs a long outage plus a burst of
 * unrelated content failures, and in that scenario og-image-check's two
 * production arms and check-sitemap-fetchable are all red anyway -- but the
 * hole is real, and closing it needs a counter this RPC does not expose
 * (queued for admin, not faked here from a sample that cannot answer it).
 *
 * EXIT CODES (R3)
 *   0  the bake pipeline is healthy
 *   1  contract violated -- transport failures, a stalled sweep, or an empty ledger
 *   2  infrastructure -- could not measure (no credentials, RPC absent,
 *      un-migrated payload, unreadable counters). Never a green 0.
 *
 * Local:  node scripts/check-og-render-health.mjs        (reads .env)
 * Canary: node scripts/check-og-render-health.mjs --self-test
 * CI:     VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';

/** The payload version whose bake counters this file is written against. A
 *  consumer written against 2 reads every key it does not know as undefined,
 *  and undefined compares false against every threshold -- the fail-open the
 *  marker exists to stop. Shared with check-og-scrape-evidence.mjs by value,
 *  not by import: the two guards read different halves and may diverge. */
export const MIN_SCHEMA_VERSION = 3;

/** P1's own vocabulary (_og_bake_reconcile, admin 20260817xxxxxx): the prefix
 *  it writes into og_render.error for ANY non-2xx / transport-dead bake POST.
 *  Anchored at the start so a content-level reason that merely quotes the
 *  phrase cannot fire it, and case-insensitive because the message is
 *  assembled from a literal we do not own the casing of for ever. */
export const BAKE_TRANSPORT_RE = /^\s*bake POST failed: HTTP/i;

/** Extracts the status code out of that message, for the operator reading the
 *  red. `none (no response)` is what the reconciler writes for a transport
 *  death, and it must survive into the output rather than becoming NaN. */
export const BAKE_CODE_RE = /^\s*bake POST failed: HTTP (\S+)/i;

/** Hard bound on the one RPC call. See fetchHealthLive for why the budget this
 *  protects is the JOB's, not this step's. */
export const RPC_TIMEOUT_MS = 20000;

export class CannotMeasure extends Error {}

/** Reads a counter that MUST be a finite non-negative integer. A missing or
 *  non-numeric counter is CannotMeasure, never a 0 -- storing "could not
 *  measure" as the healthy extreme is how a guard stops gating in silence. */
function counter(payload, key) {
  const v = payload[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new CannotMeasure(
      '`' + key + '` is ' + JSON.stringify(v) + ', expected a non-negative number. ' +
      'The bake counters could not be read; treating this as measured would compare ' +
      'undefined against every threshold and pass.'
    );
  }
  return v;
}

/**
 * The whole decision, as a pure function of the payload. No network, no
 * filesystem, no clock beyond `now` -- so the canary drives exactly this and
 * every branch is reachable from a fixture.
 *
 * Returns { code, violations, notes, checks }. `checks` counts the assertions
 * actually EVALUATED; main() floors it, because a guard that returns 0 having
 * evaluated nothing is the failure mode this whole suite exists to prevent.
 */
export function evaluate(payload, now = Date.now()) {
  const violations = [];
  const notes = [];
  let checks = 0;

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CannotMeasure('the RPC returned ' + JSON.stringify(payload) + ', expected an object');
  }

  const version = Number(payload.schema_version);
  if (!Number.isFinite(version)) {
    throw new CannotMeasure('payload carries no numeric schema_version; this is not check_og_render_health_v1');
  }
  if (version < MIN_SCHEMA_VERSION) {
    throw new CannotMeasure(
      'payload schema_version is ' + version + ', need >= ' + MIN_SCHEMA_VERSION +
      '. Admin migration 20260814130000 has not been applied.'
    );
  }
  checks++;

  const ready = counter(payload, 'ready');
  const pending = counter(payload, 'pending');
  const errored = counter(payload, 'error');
  const stuck = counter(payload, 'stuck');
  checks++;

  // ARITHMETIC NON-VACUITY, the same rule the sample_errors check below
  // applies, and for the same reason. og_render.status is CHECK-constrained to
  // exactly {pending, ready, error}, and `stuck` counts a SUBSET of the
  // non-ready rows, so stuck <= pending + error holds for every reading one
  // scan of the table can produce. A payload that breaks it is a broken READ,
  // not a sick pipeline -- and V2 below would otherwise print
  // "at least 4 pending rows ... with pending = 3" and call that a violation.
  // Raised in review; the first draft's canary had pinned exactly that
  // unreachable state as a valid red.
  if (stuck > pending + errored) {
    throw new CannotMeasure(
      'stuck = ' + stuck + ' exceeds pending + error = ' + (pending + errored) + '. `stuck` counts a ' +
      'subset of the non-ready rows and og_render.status admits only pending/ready/error, so one scan ' +
      'of the table cannot produce this. The counters disagree, which means the read is broken.'
    );
  }
  checks++;

  const sample = payload.sample_errors;
  if (!Array.isArray(sample)) {
    throw new CannotMeasure('`sample_errors` is ' + JSON.stringify(sample) + ', expected an array');
  }
  // NON-VACUITY, the check-override-mirror-ghost lesson: sample_errors is
  // LIMIT 5 over status = 'error', so error > 0 with an EMPTY sample is not a
  // healthier reading, it is a BROKEN one -- the count and the sample come
  // from the same scan and cannot disagree. Exit 2, never a quiet pass on the
  // rule that depends on the sample.
  if (errored > 0 && sample.length === 0) {
    throw new CannotMeasure(
      'error = ' + errored + ' but sample_errors is empty. Those two come from one scan of ' +
      'og_render and cannot disagree, so the read is broken -- and the transport rule below ' +
      'reads the sample, so a pass here would be a pass that measured nothing.'
    );
  }
  checks++;

  // ---- V1: transport-level bake failures (THE INCIDENT CLASS) -------------
  // The only rule here that fires on an edge/WAF outage. Content failures
  // (`card-data-unavailable` and friends) are a different class with a
  // different owner and are reported as notes, never as a red.
  const transport = sample.filter((e) => e && BAKE_TRANSPORT_RE.test(String(e.error ?? '')));
  if (transport.length > 0) {
    const codes = [...new Set(transport.map((e) => (BAKE_CODE_RE.exec(String(e.error)) || [, '?'])[1]))];
    violations.push(
      transport.length + ' of the ' + sample.length + ' most recent og_render errors are BAKE TRANSPORT ' +
      'failures (HTTP ' + codes.join(', ') + '). These entities have NO baked OG image. A 429 is the ' +
      '2026-08-21 shape: a Vercel WAF control challenging pg_net -- check `npm run check:firewall-drift` ' +
      'first, because while that is live every retry burns an attempt. ' +
      'First error: ' + JSON.stringify(String(transport[0].error).slice(0, 160)) + '. ' +
      'THIS DOES NOT CLEAR ITSELF. _og_sweep only selects rows with attempts < 5, and _og_enqueue ' +
      'resets attempts ONLY on its INSERT..ON CONFLICT branch -- reached when the row is new or the ' +
      'COVER HASH actually changed, never on an unrelated write to the entity. A row parked at ' +
      'attempts = 5 is therefore retried only by a real cover change or a deliberate repair: ' +
      "UPDATE og_render SET status='pending', attempts=0, error=NULL, bake_request_id=NULL " +
      "WHERE status='error' AND error LIKE 'bake POST failed:%'; -- after the transport fault is fixed."
    );
  }
  checks++;

  // ---- V2: the bake sweep has stopped touching its backlog ----------------
  // `stuck - errored` is a LOWER BOUND on non-ready rows that are NOT errors
  // and have been untouched for 15+ minutes, because status is CHECK-
  // constrained to exactly {pending, ready, error} (og_render_status_check),
  // so non-ready = pending + error and at most `errored` of the stuck rows can
  // be error rows. It self-gates: when pending = 0, stuck <= errored, so the
  // difference cannot be positive. That is why no magic number appears here --
  // the permanent stale error row cancels itself out.
  //
  // THE UNDER-COUNT, stated rather than hidden: when stale ERROR rows and
  // stale PENDING rows coexist, the error rows absorb the subtraction and this
  // can read 0 while pending rows really are stale. The bias is toward false
  // GREEN, not false red. V1 is what covers the loud case; this rule exists
  // for the quiet one -- a dead og-render-sweep cron job, which nothing else
  // in CI observes at all (check_og_render_health_v1's `drain`/`snapshot` cron
  // objects track the SCRAPE jobs, not the sweep).
  const stalePending = stuck - errored;
  if (stalePending > 0) {
    violations.push(
      'at least ' + stalePending + ' pending og_render row(s) have not been touched for 15+ minutes ' +
      '(stuck ' + stuck + ' - error ' + errored + '), with pending = ' + pending + '. _og_sweep restamps ' +
      'updated_at on every POST it issues, so a pending row can only go stale if the sweep is not ' +
      'running, not selecting it, or has exhausted its 5-attempt budget. Check: SELECT jobname, active ' +
      "FROM cron.job WHERE command LIKE '%_og_sweep%';"
    );
  }
  checks++;

  // ---- V3: the ledger is empty -------------------------------------------
  // No amount of quiet explains this. An idle site stops ADDING baked rows; it
  // does not lose the ones it has. Every page silently falls back to live
  // rendering and every assertion in check-og-images.mjs still passes -- which
  // is why that guard carries its own MIN_BAKED_PAGES floor. This is the same
  // hole seen from the database side.
  if (ready === 0) {
    violations.push(
      'og_render holds ZERO ready rows (' + pending + ' pending, ' + errored + ' error). Nothing is ' +
      'pre-baked, so every link preview is being rendered live or not at all.'
    );
  }
  checks++;

  // ---- notes: reported, never gating -------------------------------------
  const content = sample.filter((e) => e && !BAKE_TRANSPORT_RE.test(String(e.error ?? '')));
  if (content.length > 0) {
    notes.push(
      content.length + ' CONTENT-level error(s) in the sample (' +
      [...new Set(content.map((e) => String(e.error ?? '').slice(0, 60)))].join('; ') +
      '). Not gated here: a per-entity bake refusal is an entity problem, not a pipeline one.'
    );
  }
  notes.push('ledger: ' + ready + ' ready, ' + pending + ' pending, ' + errored + ' error, ' + stuck + ' stale.');

  // checked_at is the DATABASE's clock. A wide disagreement with the runner's
  // is reported, never floored to 0 -- a negative age would read as "very
  // fresh" for ever, which is the unknown-as-healthy-extreme failure again.
  const stamped = payload.checked_at;
  if (stamped === null || stamped === undefined) {
    throw new CannotMeasure('payload carries no checked_at; the reading cannot be dated');
  }
  const t = Date.parse(String(stamped));
  if (!Number.isFinite(t)) {
    throw new CannotMeasure('checked_at is not a parseable timestamp: ' + JSON.stringify(stamped));
  }
  const skewMin = Math.round((now - t) / 60000);
  if (Math.abs(skewMin) > 10) {
    notes.push('checked_at is ' + skewMin + ' minute(s) from the runner clock; runner and database disagree.');
  }
  checks++;

  return { code: violations.length ? 1 : 0, violations, notes, checks };
}

/** The floor R1 asks for. Every valid payload takes the same straight-line
 *  path through evaluate(), so this is the count, not a guess -- and the
 *  canary pins it to a measured minimum in both directions. */
export const MIN_CHECKS = 8;

export function loadEnv(readFile = fs.readFileSync, exists = fs.existsSync, base = process.env) {
  const env = { ...base };
  if (exists('.env')) {
    for (const raw of String(readFile('.env', 'utf8')).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      if (env[k] === undefined) env[k] = line.slice(idx + 1).replace(/^"|"$/g, '');
    }
  }
  return env;
}

/**
 * Default collaborator. Injected so the canary never opens a socket.
 *
 * Returns the payload AND the host that answered. Reporting the measured
 * target is not decoration: this arc's RC5 is a guard that was green because
 * it measured the wrong surface, so every guard it produces has to say what it
 * pointed at. The payload's own `ran_as` cannot serve -- check_og_render_health_v1
 * is SECURITY DEFINER, so `ran_as` is the function OWNER (postgres) for every
 * caller including anon, and it would report "postgres" just as happily
 * against a staging project. The host is the only field that distinguishes a
 * wrong-target run.
 */
export async function fetchHealthLive(env) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Missing credentials are 2, never a green skip (R1/R3).
    throw new CannotMeasure('missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  }
  let target;
  try {
    target = new URL(url).host;
  } catch {
    throw new CannotMeasure('VITE_SUPABASE_URL is not a parseable URL: ' + JSON.stringify(url));
  }
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  // BOUNDED, because the budget is SHARED. supabase-js sets no default
  // timeout, so a contended Postgres could hold this open for the step's whole
  // timeout-minutes -- and db-contract-check.yml's job budget is 5 minutes for
  // ~70 steps, with the live image-reference sweep behind us explicitly sized
  // against that same 5 minutes. An unbounded call here could push the job
  // into a CANCELLED with no named cause and take that sweep down with it.
  // Raised in review. 20s matches the inventory RPC cap that sweep already
  // uses; the step's own timeout-minutes is the backstop that cannot be
  // defeated from inside this file.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  let data, error;
  try {
    ({ data, error } = await sb.rpc('check_og_render_health_v1').abortSignal(ctrl.signal));
  } finally {
    clearTimeout(timer);
  }
  if (error) {
    // Not swallowed (R2). PGRST202 means the schema cache has not caught up
    // with a just-applied migration -- infrastructure, not drift.
    throw new CannotMeasure('RPC check_og_render_health_v1 failed against ' + target + ': ' + error.code + ' ' + error.message);
  }
  return { payload: data, target };
}

/**
 * The exit owner. Everything the canary needs is injected, so the canary
 * drives THIS function -- not a re-implementation of it -- with no network, no
 * credentials and no filesystem (R5).
 */
export async function main(argv = [], deps = {}) {
  const out = deps.log || console.log;
  const err = deps.err || console.error;
  const now = deps.now || Date.now();

  if (argv.includes('--self-test')) return selfTest({ log: out, err });

  let reading;
  try {
    const env = deps.env || loadEnv();
    reading = await (deps.fetchHealth || fetchHealthLive)(env);
  } catch (error) {
    err('og-render health: CANNOT MEASURE -- ' + error.message);
    err('  This is exit 2, not a pass. Nothing was checked.');
    return 2;
  }

  // Printed BEFORE the verdict, on every path, so a wrong-target run is
  // visible in the log even when the verdict is a green.
  out('og-render health: measured ' + reading.target + ' (RPC check_og_render_health_v1, anon key).');

  const assess = deps.evaluate || evaluate;
  let result;
  try {
    result = assess(reading.payload, now);
  } catch (error) {
    if (error instanceof CannotMeasure) {
      err('og-render health: CANNOT MEASURE -- ' + error.message);
      err('  This is exit 2, not a pass. Nothing was checked.');
      return 2;
    }
    throw error;
  }

  if (result.checks < MIN_CHECKS) {
    err('og-render health: CANNOT MEASURE -- only ' + result.checks + ' assertion(s) evaluated, floor is ' + MIN_CHECKS + '.');
    return 2;
  }

  for (const n of result.notes) out('  note: ' + n);

  if (result.code === 0) {
    out('og-render bake pipeline: OK (' + result.checks + ' assertions).');
    return 0;
  }

  err('og-render bake pipeline: CONTRACT VIOLATED');
  for (const v of result.violations) err('  - ' + v);
  return 1;
}

// ---------------------------------------------------------------------------
// CANARY (R4). Every case drives main() -- the function whose return value
// becomes process.exitCode -- with injected collaborators, so the EXIT CODES
// are measured and not merely asserted (R5).
//
// Each case pins WHICH BRANCH produced its code by matching the message. Eight
// different branches here return 2; a case asserting only "it returned 2"
// passes for the wrong reason.
//
// THE FIXTURES ARE MEASURED, NOT INVENTED. `healthy()` is prod as read on
// 2026-08-22 (ready 279, pending 0, error 1, stuck 1, one card-data-unavailable
// row). `staleBacklog()` and `wafOutage()` are the payloads
// check_og_render_health_v1() actually returned when those shapes were forced
// into og_render inside a ROLLED-BACK transaction against the same database
// on the same day -- not hand-built states. That distinction matters: a
// hand-built state can be one production cannot reach.
// ---------------------------------------------------------------------------
const NOW = Date.parse('2026-08-22T19:20:00Z');

/** Prod, healthy, 2026-08-22T19:18Z. */
function healthy() {
  return {
    schema_version: 3,
    ready: 279, pending: 0, error: 1, stuck: 1,
    sample_errors: [
      { entity_id: '4f1d7ac6-96ac-4bfd-aad3-76d00c9398e2', occurrence_id: null, error: 'card-data-unavailable' },
    ],
    checked_at: '2026-08-22T19:18:44.278324+00:00',
  };
}

/** Measured: 7 pending rows aged 3h inside a rolled-back transaction.
 *  stuck 8 - error 1 = 7 stale pending rows. */
function staleBacklog() {
  return { ...healthy(), ready: 272, pending: 7, error: 1, stuck: 8, checked_at: '2026-08-22T19:20:23.766726+00:00' };
}

/** Measured: _og_bake_reconcile's own 429 string, written into 7 rows inside a
 *  rolled-back transaction. Note stuck stays 1 -- the outage is invisible to
 *  it, which is this file's header argument, held as a fixture. */
function wafOutage() {
  const msg = 'bake POST failed: HTTP 429 -- <!doctype html><html><head><title>Vercel Security Checkpoint</title>';
  return {
    ...healthy(), ready: 272, pending: 0, error: 8, stuck: 1,
    sample_errors: Array.from({ length: 5 }, (_, i) => ({
      entity_id: '0000e780-3fa7-40b2-bbb8-59b66feb8324', occurrence_id: 'occ-' + i, error: msg,
    })),
    checked_at: '2026-08-22T19:20:38.682129+00:00',
  };
}

export function canaryCases() {
  return [
    // --- silent on health, in every shape health actually takes -------------
    { name: 'prod as measured 2026-08-22 -> 0', payload: healthy(), code: 0, expect: /pipeline: OK/ },
    { name: 'the permanent stale error row does NOT red (stuck 1 - error 1 = 0) -> 0',
      payload: healthy(), code: 0, expect: /CONTENT-level error\(s\)/ },
    { name: 'a fresh pending batch mid-sweep is not a stall -> 0',
      payload: { ...healthy(), ready: 275, pending: 4, error: 1, stuck: 1 }, code: 0, expect: /pipeline: OK/ },
    { name: 'a clean ledger with no errors at all -> 0',
      payload: { ...healthy(), error: 0, stuck: 0, sample_errors: [] }, code: 0, expect: /pipeline: OK/ },

    // --- red on the outage shapes, measured ---------------------------------
    { name: 'WAF 429 outage -> 1 (transport branch)',
      payload: wafOutage(), code: 1, expect: /BAKE TRANSPORT failures \(HTTP 429\)/ },
    { name: 'a transport death with no response -> 1 (transport branch, no-code arm)',
      payload: { ...wafOutage(), sample_errors: [{ entity_id: 'e', occurrence_id: null,
        error: 'bake POST failed: HTTP none (no response) -- timeout' }] },
      code: 1, expect: /HTTP none/ },
    { name: 'stalled sweep -> 1 (stale-backlog branch)',
      payload: staleBacklog(), code: 1, expect: /at least 7 pending og_render row\(s\)/ },
    { name: 'empty ledger -> 1 (zero-ready branch)',
      payload: { ...healthy(), ready: 0, pending: 0, error: 0, stuck: 0, sample_errors: [] },
      code: 1, expect: /ZERO ready rows/ },
    // stuck 10 <= pending 3 + error 8, so this is a state one scan of
    // og_render can actually produce. The first draft used stuck 12 against
    // pending 3 + error 8 = 11 and pinned an ARITHMETICALLY IMPOSSIBLE payload
    // as a valid red; review caught it, and it is now exit 2 (below).
    { name: 'both outage shapes at once -> 1, both named',
      payload: { ...wafOutage(), pending: 3, stuck: 10 }, code: 1, expect: /BAKE TRANSPORT[\s\S]*at least 2 pending/ },

    // --- the boundary, in both directions -----------------------------------
    { name: 'stuck == error is the boundary and stays green -> 0',
      payload: { ...healthy(), pending: 2, error: 3, stuck: 3,
        sample_errors: [{ entity_id: 'e', occurrence_id: null, error: 'card-data-unavailable' }] },
      code: 0, expect: /pipeline: OK/ },
    { name: 'stuck one past error reds -> 1',
      payload: { ...healthy(), pending: 2, error: 3, stuck: 4,
        sample_errors: [{ entity_id: 'e', occurrence_id: null, error: 'card-data-unavailable' }] },
      code: 1, expect: /at least 1 pending og_render row\(s\)/ },
    // A content reason that merely QUOTES the transport phrase must not fire
    // the transport rule -- the anchor is load-bearing, not decoration.
    { name: 'a quoted transport phrase mid-message does NOT fire V1 -> 0',
      payload: { ...healthy(), sample_errors: [{ entity_id: 'e', occurrence_id: null,
        error: 'card-data-unavailable (previously: bake POST failed: HTTP 500)' }] },
      code: 0, expect: /pipeline: OK/ },

    // --- THE EXIT-CODE CONTRACT ITSELF: eight distinct roads to 2 -----------
    { name: 'un-migrated payload -> 2 (schema_version branch)',
      payload: { schema_version: 2, ready: 1 }, code: 2, expect: /schema_version is 2, need >= 3/ },
    { name: 'not the right function -> 2 (no version branch)',
      payload: { hello: 'world' }, code: 2, expect: /no numeric schema_version/ },
    { name: 'null payload -> 2 (shape branch)',
      payload: null, code: 2, expect: /expected an object/ },
    { name: 'an unreadable counter -> 2, never a 0 (counter branch)',
      payload: { ...healthy(), stuck: null }, code: 2, expect: /`stuck` is null, expected a non-negative number/ },
    { name: 'counters that one scan cannot produce -> 2 (arithmetic branch)',
      payload: { ...healthy(), pending: 3, error: 8, stuck: 12 }, code: 2,
      expect: /stuck = 12 exceeds pending \+ error = 11/ },
    { name: 'sample_errors not an array -> 2 (sample shape branch)',
      payload: { ...healthy(), sample_errors: null }, code: 2, expect: /`sample_errors` is null, expected an array/ },
    { name: 'errors counted but none sampled -> 2 (broken-read branch)',
      payload: { ...healthy(), error: 4, sample_errors: [] }, code: 2, expect: /cannot disagree, so the read is broken/ },
    { name: 'undated reading -> 2 (checked_at branch)',
      payload: { ...healthy(), checked_at: null }, code: 2, expect: /no checked_at/ },
    { name: 'unparseable checked_at -> 2 (parse branch)',
      payload: { ...healthy(), checked_at: 'soon' }, code: 2, expect: /not a parseable timestamp/ },
    { name: 'missing credentials -> 2, never a green skip',
      throws: new CannotMeasure('missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY'),
      code: 2, expect: /missing VITE_SUPABASE_URL/ },
    // Drives the floor itself. No valid payload can evaluate below MIN_CHECKS,
    // so without an injected assessor this branch is unreachable and deleting
    // it scores zero failing cases -- the blind spot, not a pass.
    { name: 'short-circuited assessment -> 2 (measurement floor branch)',
      payload: healthy(), code: 2, expect: /assertion\(s\) evaluated, floor is 8/,
      evaluate: () => ({ code: 0, violations: [], notes: [], checks: 1 }) },
  ];
}

export async function selfTest({ log = console.log, err = console.error } = {}) {
  const cases = canaryCases();
  let failed = 0;
  let extra = 0;

  for (const c of cases) {
    const lines = [];
    const sink = (s) => lines.push(String(s));
    const code = await main([], {
      log: sink, err: sink, now: NOW, env: {},
      evaluate: c.evaluate,
      fetchHealth: async () => {
        if (c.throws) throw c.throws;
        return { payload: c.payload, target: 'canary.invalid' };
      },
    });
    const text = lines.join('\n');
    const codeOk = code === c.code;
    const msgOk = c.expect.test(text);
    if (codeOk && msgOk) {
      log('  PASS  ' + c.name);
    } else {
      failed++;
      err('  FAIL  ' + c.name);
      if (!codeOk) err('        expected exit ' + c.code + ', got ' + code);
      if (!msgOk) err('        exit code was right but no branch matched ' + c.expect + '\n        got: ' + text);
    }
  }

  // The measured-target line is the RC5 fix in miniature: a guard that does
  // not say what it pointed at is a guard whose green means nothing. Asserted
  // on a GREEN run specifically -- that is the run where a wrong target is
  // invisible, and a violation path printing it proves nothing about the pass
  // path.
  extra++;
  {
    const lines = [];
    const sink = (s) => lines.push(String(s));
    await main([], { log: sink, err: sink, now: NOW, env: {},
      fetchHealth: async () => ({ payload: healthy(), target: 'db.example.invalid' }) });
    if (!/measured db\.example\.invalid/.test(lines.join('\n'))) {
      failed++;
      err('  FAIL  a GREEN run must still name the host it measured');
    } else {
      log('  PASS  a GREEN run names the host it measured');
    }
  }

  // Positive control on the floor. Every valid payload runs the same
  // straight-line path, so the sparsest and the richest must BOTH equal
  // MIN_CHECKS -- pinning both edges, because a floor set below what the code
  // can produce is a floor that never fires.
  extra++;
  const fewest = evaluate({ ...healthy(), error: 0, stuck: 0, sample_errors: [] }, NOW).checks;
  const most = evaluate(wafOutage(), NOW).checks;
  if (fewest !== MIN_CHECKS || most !== MIN_CHECKS) {
    failed++;
    err('  FAIL  MIN_CHECKS is ' + MIN_CHECKS + ' but payloads evaluate ' + fewest + '..' + most);
  } else {
    log('  PASS  MIN_CHECKS equals what every valid payload evaluates (' + fewest + ')');
  }

  const total = cases.length + extra;
  if (failed) {
    err('canary: ' + failed + ' of ' + total + ' FAILED');
    return 2;
  }
  log('canary: ' + total + '/' + total + ' passed');
  return 0;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs) -- R6. A hand-rolled
// import.meta/argv[1] compare mispredicts through a junction and the whole
// guard, canary included, prints nothing and exits 0.
if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit() after printing: on Linux CI a
  // process.exit truncates buffered stdout.
  process.exitCode = await main(process.argv.slice(2));
}
