#!/usr/bin/env node
/**
 * check-p3-refusal-reasons.mjs -- every refusal the LIVE P3 command doors can
 * raise reaches the organiser as its own reason, never the generic catch-all.
 *
 * Brief: docs/briefs/p3-real-rules-check.md (branch brief/p3-real-rules-check).
 * Snapshot: scripts/p3-refusal-codes.json -- one entry per (mapper, code,
 * snake_case reason) read from pg_get_functiondef on prod (latest definition
 * wins, because it IS the live one). Entries in its known_gaps list are the
 * shrink-only ratchet: today's refusals that still fall to the generic row.
 *
 * Static (default; no secrets):
 *   bundles src/modules/organiser/shared/selfServeErrors.ts with esbuild and
 *   feeds each snapshot entry ("code" or "code: reason", SQLSTATE as code) to
 *   commandErrorMessage (command doors) or teamErrorMessage (team doors).
 *   Red (1) when the copy is the generic fallback, the /^permission_denied/
 *   catch-all row, or "That did not work", and the entry is not a known gap;
 *   red (1) on a STALE known gap (it now has its own copy: delete the line).
 * Live (--live; P3_RULES_DB_URL = a read-only Postgres connection string):
 *   runs LIVE_SQL through psql and diffs the (mapper, code, reason, SQLSTATE)
 *   set against the snapshot. Red (1) on a new or removed live code.
 * Exit: 0 clean, 1 violation, 2 could not run (missing snapshot, bundle
 * failure, empty snapshot, --live without P3_RULES_DB_URL, psql failure).
 * Only an ABSENT secret is a skip (the workflow step checks it). A SET secret
 * with no psql on the runner, or a psql that fails, is a real fault: exit 2.
 * A psql failure logs ONE fixed line from the exit status (psqlFailureLine):
 * never e.message or stderr, which carry the connection string / host / user.
 * Canary: node scripts/check-p3-refusal-reasons.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_FILE = path.join(ROOT, 'scripts/p3-refusal-codes.json');
const ERRORS_FILE = 'src/modules/organiser/shared/selfServeErrors.ts';
export const TEAM_DOORS = ['remove_organiser_member_v1', 'redeem_organiser_invite_v1', 'claim_my_organisers_v1'];
export const BAD_COPY = /That did not work/i;

export const LIVE_SQL = `with f as (
  select p.proname, pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and (p.proname in ('apply_aggregate_write_p5','_require_onboarding_complete_v1','_assert_can_edit_series_p5','remove_organiser_member_v1','redeem_organiser_invite_v1','claim_my_organisers_v1','_account_link_refusal_v1') or p.proname like '\\_cmd\\_%')
), r as (select proname, m[1] stmt from f, regexp_matches(d, '(RAISE\\s+EXCEPTION[^;]*);', 'gi') m),
c as (select proname,
  substring(stmt from $$'([a-z][a-z0-9_]*)$$) code,
  substring(stmt from $$'[a-z][a-z0-9_]*: ([a-z]+_[a-z0-9_]+)$$) reason,
  coalesce(substring(stmt from $$ERRCODE\\s*=\\s*'([0-9A-Z]{5})'$$),'P0001') e from r)
select distinct concat_ws('|', code, coalesce(reason,''), e, proname) from c where code is not null order by 1;`;

export const keyOf = (e) => `${e.mapper}:${e.code}${e.reason ? `: ${e.reason}` : ''}`;

/** "code|reason|SQLSTATE|door" rows (the LIVE_SQL output) -> snapshot entries. */
export function entriesFromRows(rows) {
  const m = new Map();
  for (const line of rows) {
    const [code, reason, errcode, door] = line.split('|');
    if (!code || !door) continue;
    const mapper = TEAM_DOORS.includes(door) ? 'team' : 'command';
    const k = keyOf({ mapper, code, reason });
    if (!m.has(k)) m.set(k, { code, reason: reason || null, mapper, errcode: new Set(), doors: [] });
    m.get(k).errcode.add(errcode);
    m.get(k).doors.push(door);
  }
  return [...m.values()].map((e) => ({ ...e, errcode: [...e.errcode].sort().join(',') }));
}

/**
 * The refusal text a door sends: "code[: reason]: <detail>". The detail is a
 * stand-in for the RAISE's format argument, since mapped rows anchor on the
 * colon after the reason (e.g. /^date_has_people:/). An entry may carry
 * `sample` (the literal RAISE text) when its rows need the prose. Team doors
 * raise the bare code (teamErrorMessage keys on it).
 */
export const sampleOf = (e) => e.sample || (e.mapper === 'team' ? e.code : `${e.code}${e.reason ? `: ${e.reason}` : ''}: X`);

/** Pure: the copy check. mapper = { commandErrorMessage, teamErrorMessage, COMMAND_COPY }. */
export function checkCopy(snapshot, mapper) {
  const lines = [];
  const bad = [];
  const gaps = new Map((snapshot.known_gaps || []).map((g) => [g.key, g]));
  const generic = mapper.commandErrorMessage({ message: '\u0000no-such-code', code: 'P0001' });
  const catchAll = mapper.COMMAND_COPY.find((c) => String(c.match) === '/^permission_denied/')?.message;
  const seen = new Set();
  for (const e of snapshot.codes) {
    const key = keyOf(e);
    seen.add(key);
    const err = { message: sampleOf(e), code: e.errcode.split(',')[0] };
    const copy = e.mapper === 'team' ? mapper.teamErrorMessage(err) : mapper.commandErrorMessage(err);
    const why = !copy || !copy.trim() ? 'empty copy'
      : copy === generic ? `the generic fallback ("${generic}")`
      : copy === catchAll ? 'the /^permission_denied/ catch-all row'
      : BAD_COPY.test(copy) ? '"That did not work"'
      : null;
    if (why && !gaps.has(key)) bad.push(`'${key}' (${e.doors.join(', ')}) shows ${why}. Add a row for it in ${ERRORS_FILE}.`);
    if (!why && gaps.has(key)) bad.push(`stale known gap '${key}': it now has its own copy. Delete it from known_gaps.`);
  }
  for (const k of gaps.keys()) if (!seen.has(k)) bad.push(`stale known gap '${k}': no such code in the snapshot. Delete it.`);
  lines.push(`refusal copy: ${snapshot.codes.length} live code(s), ${gaps.size} known gap(s), ${bad.length} violation(s)`);
  return { bad, lines };
}

/** Pure: snapshot vs live. */
export function diffLive(snapshot, liveEntries) {
  const sig = (e) => `${keyOf(e)} [${e.errcode}]`;
  const snap = new Set(snapshot.codes.map(sig));
  const live = new Set(liveEntries.map(sig));
  const bad = [];
  for (const s of live) if (!snap.has(s)) bad.push(`live raises ${s}, the snapshot does not list it. Regenerate scripts/p3-refusal-codes.json and give it copy.`);
  for (const s of snap) if (!live.has(s)) bad.push(`the snapshot lists ${s}, live no longer raises it. Regenerate scripts/p3-refusal-codes.json.`);
  return bad;
}

async function loadMapperDefault() {
  const esbuild = await import('esbuild');
  const out = await esbuild.build({
    entryPoints: [path.join(ROOT, ERRORS_FILE)], bundle: true, write: false, format: 'esm',
    platform: 'node', alias: { '@': path.join(ROOT, 'src') }, logLevel: 'silent',
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}

/**
 * The ONE line printed when psql cannot answer, built from the exit status
 * only. execFileSync's e.message begins "Command failed: psql <url> ..." and
 * psql's stderr names host and user, so neither may ever reach a CI log.
 */
export function psqlFailureLine(e) {
  if (e && e.code === 'ENOENT') {
    return 'CANNOT RUN (psql): psql is not installed on this runner, but P3_RULES_DB_URL is set. '
      + 'Install postgresql-client in the step; a configured secret with no psql is a fault, not a skip.';
  }
  // Fixed texts only: e.code is a Node errno token, never caller text.
  const FIXED = { ETIMEDOUT: 'timed out after 60s', ENOBUFS: 'output over the buffer limit', EACCES: 'psql is not executable' };
  if (e && FIXED[e.code]) return `CANNOT RUN (psql): psql failed (${FIXED[e.code]})`;
  // psql's own exit codes (man psql): 1 fatal, 2 connection bad, 3 script error.
  const MEANS = { 1: 'fatal error', 2: 'connection refused or lost', 3: 'LIVE_SQL error' };
  const status = e && Number.isInteger(e.status) ? `exit ${e.status}${MEANS[e.status] ? `, ${MEANS[e.status]}` : ''}`
    : e && typeof e.signal === 'string' && /^SIG[A-Z0-9]+$/.test(e.signal) ? `signal ${e.signal}`
    : 'exit unknown';
  return `CANNOT RUN (psql): psql failed (${status})`;
}

/** The live reader; `run`/`bin` are injectable so the canary drives a real failing child. */
export const makeReadLive = (run = execFileSync, bin = 'psql') => (url) =>
  // stdio piped (never inherited): psql's stderr must not echo into the job log.
  run(bin, [url, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', LIVE_SQL], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] })
    .split('\n').map((s) => s.trim()).filter(Boolean);

const DEFAULT_DEPS = {
  readSnapshot: () => JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')),
  loadMapper: loadMapperDefault,
  readLive: makeReadLive(),
  env: process.env,
  log: console.log,
};

/** Returns the exit code (0 / 1 / 2); the entry point assigns it to process.exitCode. */
export async function main(argv, deps = {}) {
  const d = { ...DEFAULT_DEPS, ...deps };
  const KNOWN_FLAGS = ['--self-test', '--live'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length) { d.log(`CANNOT RUN (args): unknown flag(s) ${unknown.join(' ')}`); return 2; }
  if (argv.includes('--self-test')) return (await selfTest(d.log)) ? 0 : 1;
  let snapshot;
  try { snapshot = d.readSnapshot(); } catch (e) { d.log(`CANNOT RUN (snapshot): ${e.message}`); return 2; }
  if (!snapshot || !Array.isArray(snapshot.codes) || snapshot.codes.length === 0) {
    d.log('CANNOT RUN (floor): the snapshot lists no codes, so nothing would be measured'); return 2;
  }
  let mapper;
  try { mapper = await d.loadMapper(); } catch (e) { d.log(`CANNOT RUN (bundle): ${e.message}`); return 2; }
  const { bad, lines } = checkCopy(snapshot, mapper);
  lines.forEach((l) => d.log(l));
  bad.forEach((b) => d.log(`FAIL copy: ${b}`));
  let code = bad.length ? 1 : 0;
  if (!argv.includes('--live')) return code;
  const url = d.env.P3_RULES_DB_URL;
  if (!url) { d.log('CANNOT RUN (creds): --live needs P3_RULES_DB_URL (a read-only Postgres connection string)'); return code || 2; }
  let rows;
  try { rows = d.readLive(url); } catch (e) { d.log(psqlFailureLine(e)); return code || 2; }
  const live = entriesFromRows(rows);
  if (live.length === 0) { d.log('CANNOT RUN (floor): live returned no codes'); return code || 2; }
  const drift = diffLive(snapshot, live);
  drift.forEach((b) => d.log(`FAIL live: ${b}`));
  d.log(`live: ${live.length} code(s), ${drift.length} drift line(s)`);
  if (drift.length) code = 1;
  return code;
}

// Canary (R4/R5): injected snapshot, mapper and live rows; drives main().
export async function selfTest(log = console.log) {
  const cases = [];
  const GENERIC = 'Something went wrong. Please try again.';
  const CATCH = 'You cannot make that change here. Ask the Bachata Calendar team.';
  const mapper = {
    COMMAND_COPY: [{ match: /^past_date/, message: 'Already happened.' }, { match: /^permission_denied/, message: CATCH }],
    commandErrorMessage: ({ message }) => (/^past_date/.test(message) ? 'Already happened.'
      : /^permission_denied/.test(message) ? CATCH : /^oops/.test(message) ? 'That did not work.' : GENERIC),
    teamErrorMessage: ({ message }) => (message === 'last_owner' ? 'Hand the page over first.' : GENERIC),
  };
  const E = (code, reason, mapperName = 'command', errcode = 'P0001') => ({ code, reason, mapper: mapperName, errcode, doors: ['_cmd_x_p5'] });
  const snap = (codes, known_gaps = []) => ({ codes, known_gaps });
  const run = async (argv, s, extra = {}) => {
    const out = [];
    const code = await main(argv, { readSnapshot: () => s, loadMapper: async () => mapper, env: {}, log: (l) => out.push(l), ...extra });
    return { code, out: out.join('\n') };
  };
  const expect = async (name, p, code, needle, forbid = []) => {
    const r = await p;
    const leaked = forbid.filter((f) => r.out.includes(f));
    const ok = r.code === code && (!needle || r.out.includes(needle)) && leaked.length === 0;
    cases.push({ name, ok });
    // Output is printed only for cases with no secret in play (forbid empty).
    if (!ok) log(`  FAIL ${name}: exit ${r.code} (want ${code}), needle ${JSON.stringify(needle)}, leaked ${leaked.length} URL part(s)${forbid.length ? '' : `\n${r.out}`}`);
  };
  const clean = snap([E('past_date', null), E('last_owner', null, 'team')]);
  await expect('1 every code has own copy -> 0', run([], clean), 0, '2 live code(s)');
  await expect('2 code falls to the generic fallback -> 1', run([], snap([E('daily_limit', null)])), 1, 'generic fallback');
  await expect('3 reason falls to the permission_denied catch-all -> 1', run([], snap([E('permission_denied', 'slug_admin_only')])), 1, 'catch-all');
  await expect('4 "That did not work" copy -> 1', run([], snap([E('oops', null)])), 1, 'That did not work');
  await expect('5 team code with no TEAM_COPY row -> 1', run([], snap([E('not_a_member', null, 'team')])), 1, "'team:not_a_member'");
  await expect('6 generic code listed as known gap -> 0', run([], snap([E('daily_limit', null)], [{ key: 'command:daily_limit' }])), 0, '1 known gap');
  await expect('7 stale known gap (now has copy) -> 1', run([], snap([E('past_date', null)], [{ key: 'command:past_date' }])), 1, 'stale known gap');
  await expect('8 known gap for a code not in snapshot -> 1', run([], snap([E('past_date', null)], [{ key: 'command:gone' }])), 1, 'no such code');
  await expect('9 empty snapshot -> 2 (floor)', run([], snap([])), 2, 'CANNOT RUN (floor)');
  await expect('10 unreadable snapshot -> 2', run([], null, { readSnapshot: () => { throw new Error('ENOENT'); } }), 2, 'CANNOT RUN (snapshot)');
  await expect('11 bundle failure -> 2', run([], clean, { loadMapper: async () => { throw new Error('esbuild'); } }), 2, 'CANNOT RUN (bundle)');
  await expect('12 unknown flag -> 2', run(['--nope'], clean), 2, 'CANNOT RUN (args)');
  await expect('13 --live without creds -> 2', run(['--live'], clean), 2, 'CANNOT RUN (creds)');
  const env = { P3_RULES_DB_URL: 'postgres://ro@x/db' };
  const liveRows = ['past_date||P0001|_cmd_x_p5', 'last_owner||P0001|remove_organiser_member_v1'];
  await expect('14 --live equal to snapshot -> 0', run(['--live'], clean, { env, readLive: () => liveRows }), 0, '0 drift');
  await expect('15 --live new code -> 1', run(['--live'], clean, { env, readLive: () => [...liveRows, 'new_code||P0001|_cmd_x_p5'] }), 1, 'live raises command:new_code');
  await expect('16 --live removed code -> 1', run(['--live'], clean, { env, readLive: () => liveRows.slice(0, 1) }), 1, 'live no longer raises');
  await expect('17 --live SQLSTATE drift (42501 vs P0001) -> 1', run(['--live'], clean, { env, readLive: () => ['past_date||42501|_cmd_x_p5', liveRows[1]] }), 1, '[42501]');
  await expect('18 --live psql failure -> 2', run(['--live'], clean, { env, readLive: () => { throw new Error('connection refused'); } }), 2, 'CANNOT RUN (psql)');
  await expect('19 --live empty result -> 2 (floor)', run(['--live'], clean, { env, readLive: () => [] }), 2, 'CANNOT RUN (floor)');
  await expect('20 a copy violation outranks a live exit 2 -> 1', run(['--live'], snap([E('daily_limit', null)])), 1, 'CANNOT RUN (creds)');
  // Secret hygiene: a fake URL with a fake password; no part of it may be printed.
  const FAKE_URL = 'postgres://p3fakeuser:FAKEpw0nly4test@p3-fake-host.invalid:5432/p3fakedb';
  const fakeEnv = { P3_RULES_DB_URL: FAKE_URL };
  const PARTS = [FAKE_URL, 'p3fakeuser', 'FAKEpw0nly4test', 'p3-fake-host.invalid', 'p3fakedb'];
  const execShaped = () => { // the shape execFileSync throws: URL in message AND stderr
    const e = new Error(`Command failed: psql ${FAKE_URL} -X -A -t\npsql: error: connection to server at "p3-fake-host.invalid" failed for user "p3fakeuser"`);
    e.status = 2; e.stderr = `psql: error: ${FAKE_URL}`; throw e;
  };
  await expect('21 --live psql fails (URL in message+stderr) -> 2, prints no URL part', run(['--live'], clean, { env: fakeEnv, readLive: execShaped }), 2, 'psql failed (exit 2, connection refused or lost)', PARTS);
  await expect('22 --live real failing child (node given the URL) -> 2, prints no URL part', run(['--live'], clean, { env: fakeEnv, readLive: makeReadLive(execFileSync, process.execPath) }), 2, 'psql failed (exit ', PARTS);
  await expect('23 --live secret set but psql not installed -> 2, says so', run(['--live'], clean, { env: fakeEnv, readLive: makeReadLive(execFileSync, 'psql-not-installed-p3-canary') }), 2, 'psql is not installed on this runner', PARTS);
  const timeout = () => { const e = new Error(`spawnSync psql ETIMEDOUT ${FAKE_URL}`); e.code = 'ETIMEDOUT'; e.signal = 'SIGTERM'; e.status = null; throw e; };
  await expect('24 --live psql timeout -> 2, names the timeout, prints no URL part', run(['--live'], clean, { env: fakeEnv, readLive: timeout }), 2, 'psql failed (timed out after 60s)', PARTS);
  const failed = cases.filter((c) => !c.ok);
  log(failed.length === 0
    ? `PASS self-test -- ${cases.length} cases, the contract proven in both directions.`
    : `FAIL self-test -- ${failed.length} failure(s) over ${cases.length} case(s).`);
  return failed.length === 0;
}

if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit(): let stdout flush.
  process.exitCode = await main(process.argv.slice(2));
}
