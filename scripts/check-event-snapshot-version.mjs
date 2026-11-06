#!/usr/bin/env node
/**
 * CI contract check: event_view_p5(snapshot_compat) carries a top-level
 * `version` -- a non-negative safe-integer JSON number -- on live events.
 *
 * Why: live-now slice 2 (docs/briefs/live-now-s2web.md). The Website reads
 * `payload.version` in parseEventPageSnapshot (src/modules/event-page/
 * useEventPageQuery.ts, parseSnapshotVersion) and the /event loader dehydrates
 * it into the public /event/<slug>.data twin, which slice 3 ("Live now" on the
 * Done screen) reads. The parser maps an absent or malformed version to null
 * on purpose (it must never block the page), so a DB regression that drops the
 * key would be SILENT on the site. This check is where it goes red instead.
 * Admin authority: 20270312410000_live_now_state_change_version_v1 (native
 * shape) and admin #1280 (snapshot_compat shape).
 *
 * Sample: calendar_events_dto (anon) over -30/+60 days, one occurrence per
 * event, up to SAMPLE events; each probed on the landing call AND pinned by
 * occurrence id -- the two calls the Website makes. A null payload (event not
 * public) is skipped, not counted. Fewer than MIN_PROBED payloads measured is
 * exit 2: an empty sample must never read as green.
 *
 * Exit codes: 0 every payload carries a valid version; 1 contract violated;
 * 2 cannot run (creds, rpc error, network, sample below the floor, bad flag).
 *
 * Local:  node scripts/check-event-snapshot-version.mjs        (reads .env)
 * Canary: node scripts/check-event-snapshot-version.mjs --self-test
 * CI:     db-contract-check.yml, VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY.
 */
import { readEnvFiles, firstValue } from './lib/dotenv.mjs';
import { isTransient } from './lib/rpc-retry.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';

const SAMPLE = 12;
const MIN_PROBED = 3;
const RANGE_BACK_DAYS = 30;
const RANGE_FWD_DAYS = 60;

/** The verdict for one payload: null = ok, else the reason it violates. */
export function versionProblem(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 'payload is not an object';
  if (!Object.prototype.hasOwnProperty.call(payload, 'version')) return 'no top-level `version` key';
  const v = payload.version;
  if (typeof v !== 'number') return `version is ${v === null ? 'null' : typeof v}, not a number`;
  if (!Number.isSafeInteger(v) || v < 0) return `version ${v} is not a non-negative safe integer`;
  return null;
}

async function callWithRetry(call, sleep, err) {
  let res = await call();
  if (res.error && isTransient(res.error)) {
    err(`Transient error (${res.error.code || '?'}: ${res.error.message}); retrying once in 2s...`);
    await sleep(2000);
    res = await call();
  }
  return res;
}

export async function main(argv = [], deps = {}) {
  const {
    env = { ...readEnvFiles(process.cwd()), ...process.env },
    makeRpc = null,
    now = () => Date.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    out = console.log,
    err = console.error,
  } = deps ?? {};

  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length > 0) {
    err('CANNOT RUN: unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1;

  const url = firstValue([env], 'VITE_SUPABASE_URL', 'SUPABASE_URL');
  const key = firstValue([env], 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
  if (!url || !key) {
    err('CANNOT RUN (creds): needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  let rpc;
  if (makeRpc) rpc = makeRpc(url, key);
  else {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    rpc = (fn, args) => sb.rpc(fn, args);
  }

  const run = async (fn, args) => {
    try {
      return await callWithRetry(() => rpc(fn, args), sleep, err);
    } catch (e) {
      return { data: null, error: { code: 'NETWORK', message: e?.message ?? String(e) }, network: true };
    }
  };

  const t = now();
  const cal = await run('calendar_events_dto', {
    p_from: new Date(t - RANGE_BACK_DAYS * 86400e3).toISOString(),
    p_to: new Date(t + RANGE_FWD_DAYS * 86400e3).toISOString(),
  });
  if (cal.error) {
    err(`CANNOT RUN (${cal.network ? 'network' : 'rpc'}): calendar_events_dto failed (${cal.error.code || 'no code'}: ${cal.error.message})`);
    return 2;
  }
  const rows = Array.isArray(cal.data) ? cal.data : [];
  const byEvent = new Map();
  for (const r of rows) {
    if (r && r.event_id && r.occurrence_id && !byEvent.has(r.event_id)) byEvent.set(r.event_id, r.occurrence_id);
  }
  const sample = [...byEvent.entries()].slice(0, SAMPLE);

  const violations = [];
  let probed = 0;
  for (const [eventId, occurrenceId] of sample) {
    for (const [label, target] of [
      ['landing', { series_id: eventId }],
      ['pinned', { series_id: eventId, occurrence_id: occurrenceId }],
    ]) {
      const res = await run('event_view_p5', { p_target: target, p_viewer: { role: 'anon', shape: 'snapshot_compat' } });
      if (res.error) {
        err(`CANNOT RUN (${res.network ? 'network' : 'rpc'}): event_view_p5 failed for ${eventId} ${label} (${res.error.code || 'no code'}: ${res.error.message})`);
        return 2;
      }
      if (res.data == null) continue; // not public: nothing to assert
      probed += 1;
      const problem = versionProblem(res.data);
      if (problem) violations.push(`${eventId} ${label}: ${problem}`);
    }
  }

  out(JSON.stringify({ events_in_window: byEvent.size, sampled: sample.length, payloads_probed: probed, violations: violations.length }));
  if (violations.length > 0) {
    err(`FAIL: ${violations.length} snapshot_compat payload(s) without a valid top-level version:`);
    for (const v of violations) err(`  - ${v}`);
    err('Contract: event_view_p5(snapshot_compat) returns `version` as a non-negative safe integer (admin #1280).');
    return 1;
  }
  if (probed < MIN_PROBED) {
    err(`CANNOT RUN (floor): measured ${probed} payload(s), floor is ${MIN_PROBED} -- an empty sample is not a pass.`);
    return 2;
  }
  out(`OK: ${probed} snapshot_compat payload(s) over ${sample.length} live event(s) carry a valid top-level version.`);
  return 0;
}

// ---------------------------------------------------------------------------
// Canary (R4/R5): drives main() with injected collaborators. No network.
// ---------------------------------------------------------------------------

const GOOD = { event_id: 'e', event: {}, version: 1793435959737933 };

export async function selfTest(log = console.log) {
  const cases = [];
  const creds = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' };
  const calRows = (n) => Array.from({ length: n }, (_, i) => ({ event_id: `ev${i}`, occurrence_id: `oc${i}` }));
  const fake = ({ cal = { data: calRows(5), error: null }, view = () => ({ data: GOOD, error: null }) } = {}) =>
    () => async (fn, args) => {
      if (fn === 'calendar_events_dto') return typeof cal === 'function' ? cal() : cal;
      if (fn === 'event_view_p5') return view(args);
      throw new Error(`unexpected rpc ${fn}`);
    };
  const run = async (argv, { env = creds, makeRpc = fake() } = {}) => {
    const lines = [];
    const code = await main(argv, {
      env, makeRpc, now: () => Date.parse('2026-11-06T00:00:00Z'), sleep: async () => {},
      out: (l) => lines.push(l), err: (l) => lines.push(l),
    });
    return { code, text: lines.join('\n') };
  };
  const expect = (name, got, code, needle) => {
    const ok = got.code === code && got.text.includes(needle);
    cases.push({ name, ok, got: `${got.code} ${ok ? '' : got.text.slice(0, 300)}` });
  };
  const withPayload = (p) => fake({ view: () => ({ data: p, error: null }) });

  // Pass.
  expect('1 every payload carries a number -> 0', await run([], {}), 0, 'OK: 10 snapshot_compat payload(s)');
  expect('1b non-public (null) payloads skipped, rest valid -> 0', await run([], { makeRpc: fake({ view: (a) => ({ data: a.p_target.series_id === 'ev0' ? null : GOOD, error: null }) }) }), 0, 'OK: 8 ');
  expect('1c version 0 is valid -> 0', await run([], { makeRpc: withPayload({ ...GOOD, version: 0 }) }), 0, 'OK:');

  // Contract violated: every shape the parser maps to null.
  const { version: _drop, ...noVersion } = GOOD;
  expect('2 key absent -> 1', await run([], { makeRpc: withPayload(noVersion) }), 1, 'no top-level `version` key');
  expect('3 version null -> 1', await run([], { makeRpc: withPayload({ ...GOOD, version: null }) }), 1, 'version is null, not a number');
  expect('4 version numeric string -> 1', await run([], { makeRpc: withPayload({ ...GOOD, version: '17' }) }), 1, 'version is string, not a number');
  expect('5 version object -> 1', await run([], { makeRpc: withPayload({ ...GOOD, version: { v: 1 } }) }), 1, 'version is object');
  expect('6 version fraction -> 1', await run([], { makeRpc: withPayload({ ...GOOD, version: 1.5 }) }), 1, 'not a non-negative safe integer');
  expect('7 version negative -> 1', await run([], { makeRpc: withPayload({ ...GOOD, version: -1 }) }), 1, 'not a non-negative safe integer');
  expect('8 version past 2^53 -> 1', await run([], { makeRpc: withPayload({ ...GOOD, version: 2 ** 53 + 2 }) }), 1, 'not a non-negative safe integer');
  expect('9 only the pinned call drops it -> 1', await run([], { makeRpc: fake({ view: (a) => ({ data: a.p_target.occurrence_id ? noVersion : GOOD, error: null }) }) }), 1, 'pinned: no top-level');
  expect('10 payload an array -> 1', await run([], { makeRpc: withPayload([GOOD]) }), 1, 'payload is not an object');
  expect('10b violation outranks the floor -> 1', await run([], { makeRpc: fake({ cal: { data: calRows(1), error: null }, view: () => ({ data: noVersion, error: null }) }) }), 1, 'FAIL: 2 ');

  // Cannot run: each exit-2 branch pinned to the branch that produced it.
  expect('11 no creds -> 2 (creds)', await run([], { env: {} }), 2, 'CANNOT RUN (creds)');
  expect('12 calendar rpc error -> 2 (rpc)', await run([], { makeRpc: fake({ cal: { data: null, error: { code: 'PGRST202', message: 'nf' } } }) }), 2, 'CANNOT RUN (rpc): calendar_events_dto');
  expect('13 calendar throws -> 2 (network)', await run([], { makeRpc: fake({ cal: () => { throw new Error('ECONNRESET'); } }) }), 2, 'CANNOT RUN (network): calendar_events_dto');
  expect('14 view rpc error -> 2 (rpc)', await run([], { makeRpc: fake({ view: () => ({ data: null, error: { code: '42883', message: 'gone' } }) }) }), 2, 'CANNOT RUN (rpc): event_view_p5');
  expect('15 view throws -> 2 (network)', await run([], { makeRpc: fake({ view: () => { throw new Error('ETIMEDOUT'); } }) }), 2, 'CANNOT RUN (network): event_view_p5');
  expect('16 empty calendar -> 2 (floor)', await run([], { makeRpc: fake({ cal: { data: [], error: null } }) }), 2, 'measured 0 payload(s)');
  expect('17 every payload null -> 2 (floor)', await run([], { makeRpc: withPayload(null) }), 2, 'measured 0 payload(s)');
  expect('18 one event = 2 payloads, under floor -> 2 (floor)', await run([], { makeRpc: fake({ cal: { data: calRows(1), error: null } }) }), 2, 'measured 2 payload(s)');
  expect('19 unknown flag -> 2', await run(['--selftest']), 2, 'unknown flag');
  // Transient once, then good: the retry path is real.
  let n = 0;
  expect('20 transient then ok -> 0', await run([], { makeRpc: fake({ cal: () => (n++ === 0 ? { data: null, error: { code: '57014', message: 'statement timeout' } } : { data: calRows(5), error: null }) }) }), 0, 'retrying once');

  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.ok ? '' : ` -- got ${c.got}`}`);
  log(failed.length === 0
    ? `PASS self-test -- ${cases.length} cases, the contract proven in both directions.`
    : `FAIL self-test -- ${failed.length} failure(s) over ${cases.length} case(s).`);
  return failed.length === 0;
}

if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit(): supabase-js leaves a fetch handle open.
  process.exitCode = await main(process.argv.slice(2));
}
