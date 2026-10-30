#!/usr/bin/env node
/**
 * check-onboarding-write-doors.mjs -- every Website call site that writes
 * events goes through a door the onboarding gate guards (scope G1).
 *
 * Design: docs/scoping/g1-write-door-check.md (PR #1189). The live guard
 * check_organiser_onboarding_gate_v1() proves the SERVER doors carry the gate
 * line; it cannot see which RPCs the Website calls. On 2026-10-30 it reported
 * 6 gated and 0 violations while the Website wrote events through a seventh,
 * ungated door (admin_bulk_occurrence_command_p5, flows/change/bulkApi.ts).
 * This check is the Website-side net for that class.
 *
 * Part A, static (always runs; no network):
 *   door-outside-wrapper  a door name (gated or expected-pending) as a string
 *                         literal in a file that is not that door's wrapper
 *   unknown-write-rpc     a write-shaped RPC literal that is not gated, not the
 *                         guard's allow-list, not expected-pending and not a
 *                         listed not-an-event-write -- the "new door" net
 *   stale-entry           a not_event_writes entry or a wrapper's door that no
 *                         longer appears where the config says (ratchet)
 *   refusal-unmapped      selfServeErrors.ts lacks an anchored
 *                         /^onboarding_incomplete/ row FIRST in COMMAND_COPY
 *                         and PROGRAMME_COPY
 *   expected-pending      [WARN] only, never red: the lead removes the entry
 *                         once the admin gate migration (PR #1141) is applied
 *
 * Part B, live (--live; VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY):
 *   calls the guard read-only and is red on healthy !== true, a violation, or
 *   a live gated COUNT below this config's gated list. Counts are derived from
 *   the guard's own report, never pinned: 6 today and 9 after #1141 both pass.
 *   If the report ever carries a gated_names array, names are compared exactly.
 *
 * Comments are recognised by scripts/lib/stripSource.mjs (see literals()), so
 * a door named in a doc comment is not a call site. The RPC spelling through an
 * untyped `const rpc = (fn: string, ...)` helper is caught because the name is
 * still a plain literal at the call.
 *
 * Exit codes (R3): 0 clean, 1 a violation, 2 could not run (unreadable file,
 * scan floor not met, missing creds with --live, RPC missing or transport).
 * Canary: node scripts/check-onboarding-write-doors.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import { stripCommentsAndStrings } from './lib/stripSource.mjs';
import { readEnvFiles } from './lib/dotenv.mjs';
import { isTransient } from './lib/rpc-retry.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';

const RPC = 'check_organiser_onboarding_gate_v1';
const CONFIG_PATH = 'scripts/onboarding-write-doors.json';
const ERRORS_FILE = 'src/modules/organiser/shared/selfServeErrors.ts';
const RPC_TIMEOUT_MS = 20_000;

/** The scan must have read at least this many files, else it measured nothing (R1). */
export const MIN_FILES = 200;

/** Write-shaped RPC names. Tuned against the real tree on 2026-10-30: zero false reds. */
export const WRITE_RE = /^[a-z][a-z0-9_]*_(v|p)\d+$/;
export const WRITE_VERB_RE = /(^|_)(command|save|set|upsert|create|insert|update|delete|remove|add|cancel|publish|unpublish|archive|restore|move|undo|submit|apply)(_|$)/;

/** RPC-shaped (ends _vN or _pN) and carries a write verb. Literals that are not RPC-shaped never trip it. */
export const isWriteShaped = (name) => WRITE_RE.test(name) && WRITE_VERB_RE.test(name);

const EXCLUDED_FILES = new Set([
  'src/integrations/supabase/types.ts',
  'src/types/supabase.ts',
]);

export function isScanned(rel) {
  if (!/\.(ts|tsx|js|jsx|mjs)$/.test(rel)) return false;
  if (EXCLUDED_FILES.has(rel)) return false;
  if (/(^|\/)__tests__\//.test(rel)) return false;
  if (/\.(test|spec)\.(ts|tsx|js|jsx|mjs)$/.test(rel)) return false;
  return true;
}

/**
 * Every identifier-shaped string literal ('x', "x" or `x`) with its 1-based
 * line. The spans come from the shared stripper's onString hook, so a name in a
 * comment, or quoted inside another string, is never a call site, and the file
 * is stripped once.
 */
export function literals(text) {
  const out = [];
  stripCommentsAndStrings(text, {
    onString: (start, end) => {
      const value = text.slice(start + 1, end - 1);
      if (text[end - 1] === text[start] && /^[A-Za-z0-9_]+$/.test(value)) {
        out.push({ value, line: text.slice(0, start).split('\n').length });
      }
    },
  });
  return out;
}

/** The required first row of each copy table, and the one shared pattern both rows use. */
export const REFUSAL_ROW = { match: 'ONBOARDING_REFUSAL_MATCH', message: 'ONBOARDING_REFUSAL' };
export const REFUSAL_PATTERN = '/^(permission_denied: )?onboarding_incomplete/';

/**
 * The `match` and `message` identifiers of the FIRST row of `export const NAME
 * = [`, read from comment-stripped text. The row must open the array, so a
 * spread or any other row ahead of it is not "first". null when no such row.
 */
export function firstRow(text, name) {
  const stripped = stripCommentsAndStrings(text);
  const start = stripped.search(new RegExp(`export const ${name}\\b`));
  if (start < 0) return null;
  // The type annotation can hold `=>`, so the initialiser is the first `= [`.
  const rest = stripped.slice(start);
  const init = /=\s*\[/.exec(rest);
  if (!init) return null;
  const m = /^\s*\{\s*match:\s*([A-Za-z_$][\w$]*)\s*,\s*message:\s*([A-Za-z_$][\w$]*)\s*[,}]/.exec(rest.slice(init.index + init[0].length));
  return m ? { match: m[1], message: m[2] } : { match: null, message: null };
}

/** The source of `export const ONBOARDING_REFUSAL_MATCH = /.../;`, or null. */
export function refusalPattern(text) {
  const m = /export const ONBOARDING_REFUSAL_MATCH\s*=\s*(\/(?:\\.|[^/\n])+\/[a-z]*)\s*;/.exec(stripCommentsAndStrings(text));
  return m ? m[1] : null;
}

export function validateConfig(cfg) {
  const problems = [];
  const arr = (k) => Array.isArray(cfg?.[k]);
  if (!arr('gated') || cfg.gated.length === 0) problems.push('gated must be a non-empty array');
  if (!arr('guard_allow_list')) problems.push('guard_allow_list must be an array');
  if (!arr('expected_pending')) problems.push('expected_pending must be an array');
  if (!arr('not_event_writes')) problems.push('not_event_writes must be an array');
  if (!cfg?.wrappers || typeof cfg.wrappers !== 'object' || Object.keys(cfg.wrappers).length === 0) {
    problems.push('wrappers must be a non-empty object');
  }
  const doorNames = new Set([...(arr('gated') ? cfg.gated : []), ...(arr('expected_pending') ? cfg.expected_pending.map((e) => e?.name) : [])]);
  for (const [w, names] of Object.entries(cfg?.wrappers ?? {})) {
    if (!Array.isArray(names)) { problems.push(`wrappers['${w}'] must be an array`); continue; }
    for (const n of names) if (!doorNames.has(n)) problems.push(`wrappers['${w}'] lists '${n}', which is neither gated nor expected_pending`);
  }
  for (const k of ['expected_pending', 'not_event_writes']) {
    for (const e of arr(k) ? cfg[k] : []) {
      if (!e?.name || !e?.reason) problems.push(`${k} entry needs name and reason: ${JSON.stringify(e)}`);
    }
  }
  return problems;
}

/**
 * Part A. `files` is [{ path, text }] (repo-relative, forward slashes).
 * Returns { code, lines }; code 2 only for the scan floor.
 */
export function checkStatic(files, cfg) {
  const lines = [];
  const violations = [];
  const pending = cfg.expected_pending.map((e) => e.name);
  const doors = new Set([...cfg.gated, ...pending]);
  const accepted = new Set([...doors, ...cfg.guard_allow_list, ...cfg.not_event_writes.map((e) => e.name)]);
  const seenAnywhere = new Set();
  const seenInWrapper = new Map(Object.keys(cfg.wrappers).map((w) => [w, new Set()]));

  const scanned = files.filter((f) => isScanned(f.path));
  for (const f of scanned) {
    const own = cfg.wrappers[f.path] ?? [];
    for (const { value, line } of literals(f.text)) {
      if (doors.has(value) || isWriteShaped(value) || accepted.has(value)) seenAnywhere.add(value);
      if (doors.has(value)) {
        if (own.includes(value)) seenInWrapper.get(f.path).add(value);
        else violations.push(`door-outside-wrapper: ${f.path}:${line} names '${value}'; call it only through ${wrapperOf(cfg, value)}`);
      } else if (isWriteShaped(value) && !accepted.has(value)) {
        violations.push(`unknown-write-rpc: ${f.path}:${line} names '${value}', which the onboarding guard neither gates nor allow-lists. Gate it in the ADMIN repo and add it to gated, or add it to not_event_writes with a reason`);
      }
    }
  }

  if (scanned.length < MIN_FILES) {
    return { code: 2, lines: [`CANNOT RUN: scanned ${scanned.length} file(s), floor is ${MIN_FILES}; the walk measured nothing`] };
  }

  for (const [w, names] of Object.entries(cfg.wrappers)) {
    if (!scanned.some((f) => f.path === w)) {
      violations.push(`stale-entry: wrapper ${w} is not in the scanned tree; update ${CONFIG_PATH}`);
      continue;
    }
    for (const n of names) {
      if (!seenInWrapper.get(w).has(n)) violations.push(`stale-entry: wrapper ${w} no longer names '${n}'; update ${CONFIG_PATH}`);
    }
  }
  for (const e of cfg.not_event_writes) {
    if (!seenAnywhere.has(e.name)) violations.push(`stale-entry: not_event_writes '${e.name}' no longer appears in src/; remove it from ${CONFIG_PATH}`);
  }

  const errorsFile = scanned.find((f) => f.path === ERRORS_FILE);
  if (!errorsFile) {
    violations.push(`refusal-unmapped: ${ERRORS_FILE} is not in the scanned tree`);
  } else {
    const pattern = refusalPattern(errorsFile.text);
    if (pattern !== REFUSAL_PATTERN) {
      violations.push(`refusal-unmapped: ${ERRORS_FILE} ONBOARDING_REFUSAL_MATCH is ${pattern ?? '(not found)'}, expected ${REFUSAL_PATTERN}`);
    }
    for (const table of ['COMMAND_COPY', 'PROGRAMME_COPY']) {
      const row = firstRow(errorsFile.text, table);
      if (!row || row.match !== REFUSAL_ROW.match || row.message !== REFUSAL_ROW.message) {
        violations.push(`refusal-unmapped: the first ${table} row in ${ERRORS_FILE} is not { match: ${REFUSAL_ROW.match}, message: ${REFUSAL_ROW.message} } (found ${row ? `match: ${row.match}, message: ${row.message}` : 'no table'}); the gate's refusal would show another line`);
      }
    }
  }

  for (const e of cfg.expected_pending) {
    lines.push(`[WARN] expected-pending: '${e.name}' is a Website door the live guard does not gate yet. ${e.reason}`);
  }
  for (const v of violations) lines.push(`FAIL ${v}`);
  const wired = [...seenInWrapper.values()].reduce((n, s) => n + s.size, 0);
  lines.push(`Part A: ${scanned.length} files, ${wired} door call(s) in ${seenInWrapper.size} wrapper(s), ${violations.length} violation(s).`);
  return { code: violations.length ? 1 : 0, lines };
}

function wrapperOf(cfg, name) {
  const w = Object.entries(cfg.wrappers).find(([, ns]) => ns.includes(name));
  return w ? w[0] : `a wrapper listed in ${CONFIG_PATH}`;
}

/** Part B verdict over the guard's report. */
export function checkLive(report, cfg) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return { code: 2, lines: [`CANNOT RUN: ${RPC} returned ${JSON.stringify(report)}, not a report object`] };
  }
  const lines = [];
  const bad = [];
  if (report.healthy !== true) bad.push(`healthy is ${JSON.stringify(report.healthy)}`);
  if (report.violation_count !== 0) bad.push(`violation_count is ${JSON.stringify(report.violation_count)}`);
  if (!Number.isInteger(report.gated)) bad.push(`gated is ${JSON.stringify(report.gated)}, not a count`);
  else if (report.gated < cfg.gated.length) {
    bad.push(`the guard gates ${report.gated} door(s) but this check relies on ${cfg.gated.length}; a gate line was dropped or a door renamed`);
  }
  if (Array.isArray(report.gated_names)) {
    for (const n of cfg.gated) if (!report.gated_names.includes(n)) bad.push(`'${n}' is not in the guard's gated_names`);
    for (const e of cfg.expected_pending) {
      if (report.gated_names.includes(e.name)) lines.push(`[WARN] '${e.name}' is now gated live; move it from expected_pending to gated`);
    }
  } else if (Number.isInteger(report.gated) && report.gated > cfg.gated.length) {
    // Count-only until the guard lists names (scope Q3): a later drop is red only
    // once gated here matches the guard, so keep this WARN loud until it does.
    lines.push(`[WARN] the guard gates ${report.gated} door(s) but ${CONFIG_PATH} lists ${cfg.gated.length}; add the extra names to gated (and empty expected_pending) so a later drop goes red`);
  }
  for (const b of bad) lines.push(`FAIL live: ${b}`);
  lines.push(`Part B: guard reports gated=${report.gated}, violation_count=${report.violation_count}, healthy=${report.healthy}, flag_on=${report.flag_on}.`);
  return { code: bad.length ? 1 : 0, lines };
}

export function loadEnv(base = process.env, readFiles = null) {
  return { ...(readFiles ? readFiles() : readEnvFiles(process.cwd())), ...Object.fromEntries(Object.entries(base).filter(([, v]) => String(v ?? '').trim() !== '')) };
}

/** Every Website source root that can call Supabase. A missing root is skipped; src/ must exist (floor). */
export const SCAN_ROOTS = ['src', 'app', 'api', 'components'];

/** Reads the scan roots from disk. Any unreadable file throws, and main() turns that into exit 2 (R2). */
function readTreeFromDisk(roots = SCAN_ROOTS) {
  const out = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      const rel = p.split(path.sep).join('/');
      const isDir = ent.isDirectory() || (ent.isSymbolicLink() && fs.statSync(p).isDirectory());
      if (isDir) { if (ent.name !== 'node_modules') walk(p); }
      else if (isScanned(rel)) out.push({ path: rel, text: fs.readFileSync(p, 'utf8') });
    }
  };
  for (const r of roots) if (r === 'src' || fs.existsSync(r)) walk(r);
  return out;
}

function makeCall(url, key, createClient, rpcName) {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return () => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), RPC_TIMEOUT_MS);
    return sb.rpc(rpcName).abortSignal(ac.signal).then((r) => r).finally(() => clearTimeout(timer));
  };
}

/** Owns the exit code: it RETURNS the integer and the CLI tail assigns it (R5). */
export async function main(argv = [], deps = {}) {
  const {
    env: baseEnv = process.env,
    readEnvFile = null,
    readConfig = () => JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')),
    readTree = readTreeFromDisk,
    makeRpcCall = null,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    out = console.log,
    err = console.error,
  } = deps ?? {};

  const KNOWN_FLAGS = ['--self-test', '--live'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length > 0) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1;

  let cfg;
  let files;
  try {
    cfg = readConfig();
    files = readTree();
  } catch (e) {
    err(`CANNOT RUN: could not read the config or the tree: ${e?.message ?? String(e)}`);
    return 2;
  }
  const problems = validateConfig(cfg);
  if (problems.length) {
    for (const p of problems) err(`CANNOT RUN: ${CONFIG_PATH}: ${p}`);
    return 2;
  }

  const a = checkStatic(files, cfg);
  for (const l of a.lines) (a.code === 0 || l.startsWith('[WARN]') ? out : err)(l);
  if (!argv.includes('--live')) return a.code;

  const b = await runLive(cfg, { baseEnv, readEnvFile, makeRpcCall, sleep, err });
  for (const l of b.lines) (b.code === 0 || l.startsWith('[WARN]') ? out : err)(l);
  if (a.code === 1 || b.code === 1) return 1;
  return a.code === 2 || b.code === 2 ? 2 : 0;
}

async function runLive(cfg, { baseEnv, readEnvFile, makeRpcCall, sleep, err }) {
  const env = loadEnv(baseEnv, readEnvFile);
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) return { code: 2, lines: ['CANNOT RUN (creds): --live needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY'] };
  // Scratch-run override for the red-first proof (a wrong name must be exit 2); never set in CI.
  const rpcName = env.ONBOARDING_GATE_RPC_OVERRIDE || RPC;
  let data;
  let error;
  try {
    let call;
    if (makeRpcCall) call = makeRpcCall(url, key, rpcName);
    else {
      const { createClient } = await import('@supabase/supabase-js');
      call = makeCall(url, key, createClient, rpcName);
    }
    ({ data, error } = await call());
    if (error && isTransient(error)) {
      err(`Transient error (${error.code || '?'}: ${error.message}); retrying once in 2s...`);
      await sleep(2000);
      ({ data, error } = await call());
    }
  } catch (e) {
    return { code: 2, lines: [`CANNOT RUN (network): ${e?.message ?? String(e)}`] };
  }
  if (error) {
    // supabase-js returns transport failures and timeouts as `error`, so this
    // branch covers a missing function, a revoked grant, a timeout and a dropped
    // connection alike: all infrastructure for this check, all exit 2.
    return { code: 2, lines: [`CANNOT RUN (rpc): ${rpcName} failed with the publishable key (${error.code || 'no code'}: ${error.message})`] };
  }
  return checkLive(data, cfg);
}

// ---------------------------------------------------------------------------
// Canary (R4/R5). Injected fixtures only: never the live tree, never the DB.
// ---------------------------------------------------------------------------

const FIXTURE_CFG = {
  gated: ['series_command_p5', 'occurrence_command_p5', 'organiser_set_occurrence_programme_v1', 'organiser_undo_last_change_v1'],
  guard_allow_list: ['series_leave_v1'],
  expected_pending: [{ name: 'admin_bulk_occurrence_command_p5', reason: 'fixture' }],
  wrappers: {
    'src/m/selfServeApi.ts': ['series_command_p5', 'occurrence_command_p5', 'organiser_set_occurrence_programme_v1'],
    'src/m/bulkApi.ts': ['admin_bulk_occurrence_command_p5'],
  },
  not_event_writes: [{ name: 'ticket_type_upsert_v1', reason: 'fixture' }],
};

const ERRORS_OK = [
  '// COMMAND_COPY rows: { match: /^permission_denied/ } in a comment must not count',
  'export const ONBOARDING_REFUSAL_MATCH = /^(permission_denied: )?onboarding_incomplete/;',
  "export const ONBOARDING_REFUSAL = 'Finish your details first.';",
  "export const COMMAND_COPY: Array<{ match: RegExp; message: string | ((h: string[]) => string) }> = [",
  "  // first and anchored",
  "  { match: ONBOARDING_REFUSAL_MATCH, message: ONBOARDING_REFUSAL },",
  "  { match: /^permission_denied/, message: 'No.' },",
  '];',
  "export const PROGRAMME_COPY: Array<{ match: RegExp; message: string }> = [",
  "  { match: ONBOARDING_REFUSAL_MATCH, message: ONBOARDING_REFUSAL },",
  "  { match: /^version_conflict/, message: 'Reload.' },",
  '];',
].join('\r\n');

function fixtureTree(overrides = {}) {
  const base = {
    'src/m/selfServeApi.ts': [
      "export const a = () => supabase.rpc('series_command_p5', {});",
      'export const b = () => supabase.rpc("occurrence_command_p5", {});',
      "type Fn = 'organiser_get_occurrence_programme_v1' | 'organiser_set_occurrence_programme_v1';",
    ].join('\r\n'),
    'src/m/bulkApi.ts': "export const c = () => supabase.rpc('admin_bulk_occurrence_command_p5', {});",
    'src/m/tickets.ts': "export const t = () => db().rpc('ticket_type_upsert_v1', {});\r\nconst w = \"it's fine\";",
    'src/m/team.ts': "const rpc = (fn: string, args: unknown) => sb.rpc(fn, args);\nexport const l = () => rpc('series_leave_v1', {});",
    [ERRORS_FILE]: ERRORS_OK,
    'src/m/__tests__/x.test.ts': "rpc('organiser_save_workshop_v1')",
    'src/integrations/supabase/types.ts': "organiser_save_event_v1: { Args: {} }; 'organiser_save_workshop_v1'",
  };
  for (let i = 0; i < MIN_FILES; i += 1) base[`src/pad/f${i}.ts`] = `export const v${i} = 'organiser_get_x_v1';`;
  const merged = { ...base, ...overrides };
  return Object.entries(merged).filter(([, t]) => t !== null).map(([p, text]) => ({ path: p, text }));
}

const HEALTHY = { gated: 4, probes: 39, flag_on: false, healthy: true, discovered: 9, violations: [], violation_count: 0 };

export async function selfTest(log = console.log) {
  const cases = [];
  const run = async (name, { argv = [], tree = {}, cfg = FIXTURE_CFG, env = {}, rpc, readTree } = {}) => {
    const lines = [];
    const deps = {
      env,
      readEnvFile: () => ({}),
      sleep: async () => {},
      readConfig: () => structuredClone(cfg),
      readTree: readTree ?? (() => fixtureTree(tree)),
      makeRpcCall: rpc ? () => rpc : () => async () => ({ data: HEALTHY, error: null }),
      out: (l) => lines.push(l),
      err: (l) => lines.push(l),
    };
    const code = await main(argv, deps);
    return { code, text: lines.join('\n') };
  };
  const expect = (name, got, code, needle) => {
    const ok = got.code === code && (needle === null || got.text.includes(needle));
    cases.push({ name, ok, got: `${got.code} ${ok ? '' : got.text.slice(0, 400)}` });
  };
  const creds = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' };
  const rpcOf = (data, error = null) => async () => ({ data, error });

  // 11. clean fixture: 0, with the pending WARN printed and no FAIL line.
  const clean = await run('clean');
  expect('11 clean fixture -> 0 (and WARNs the pending door)', clean, 0, '[WARN] expected-pending');
  cases.push({ name: '11b clean prints no FAIL', ok: !clean.text.includes('FAIL'), got: clean.text.slice(0, 200) });
  expect('11c clean --live with a healthy 4-gated report -> 0', await run('', { argv: ['--live'], env: creds }), 0, 'Part B: guard reports gated=4');
  expect('11d live count above config (9 after #1141) -> 0 with WARN', await run('', { argv: ['--live'], env: creds, rpc: rpcOf({ ...HEALTHY, gated: 9 }) }), 0, 'add the extra names to gated');

  // 1-3, 5: the mutants a new ungated door would arrive as.
  expect('1 supabase.rpc door outside wrapper -> door-outside-wrapper', await run('', { tree: { 'src/x/a.ts': "supabase.rpc('series_command_p5', {})" } }), 1, 'door-outside-wrapper: src/x/a.ts:1');
  expect('2 untyped rpc helper -> door-outside-wrapper', await run('', { tree: { 'src/x/b.ts': "const rpc = (fn: string, a: unknown) => s.rpc(fn, a);\r\nrpc('occurrence_command_p5', args)" } }), 1, 'door-outside-wrapper: src/x/b.ts:2');
  expect('3 backtick spelling -> door-outside-wrapper', await run('', { tree: { 'src/x/c.ts': 'rpc(`organiser_set_occurrence_programme_v1`)' } }), 1, "door-outside-wrapper: src/x/c.ts:1 names 'organiser_set_occurrence_programme_v1'");
  expect('3b pending door outside its wrapper -> door-outside-wrapper', await run('', { tree: { 'src/x/d.ts': "s.rpc('admin_bulk_occurrence_command_p5')" } }), 1, 'door-outside-wrapper: src/x/d.ts:1');
  expect('3c a door in the WRONG wrapper -> door-outside-wrapper', await run('', { tree: { 'src/m/bulkApi.ts': "s.rpc('admin_bulk_occurrence_command_p5'); s.rpc('series_command_p5')" } }), 1, 'door-outside-wrapper: src/m/bulkApi.ts:1');
  expect('5 a made-up ungated write RPC -> unknown-write-rpc', await run('', { tree: { 'src/x/e.ts': "rpc('organiser_save_workshop_v1', {})" } }), 1, "unknown-write-rpc: src/x/e.ts:1 names 'organiser_save_workshop_v1'");
  expect('5b a made-up *_command_p5 -> unknown-write-rpc', await run('', { tree: { 'src/x/f.ts': "rpc(\"venue_command_p5\")" } }), 1, 'unknown-write-rpc');

  // 4: comments and non-literals are not call sites (a false-red guard is worse than none).
  expect('4 door only in comments -> 0', await run('', { tree: { 'src/x/g.ts': "// supabase.rpc('series_command_p5')\r\n/* rpc(`organiser_save_workshop_v1`) */\r\nexport {};" } }), 0, null);
  expect('4b interpolated template is not a literal -> 0', await run('', { tree: { 'src/x/h.ts': 'const n = `${a}_command_p5`;' } }), 0, null);
  expect('4c guard allow-list name outside a wrapper -> 0', await run('', { tree: { 'src/x/i.ts': "rpc('series_leave_v1')" } }), 0, null);

  // 6-7: the refusal mapping.
  const ROW = '{ match: ONBOARDING_REFUSAL_MATCH, message: ONBOARDING_REFUSAL },';
  const firstOnly = (t) => { const k = t.indexOf(ROW); return t.slice(0, k) + t.slice(k + ROW.length + 2); };
  expect('6 onboarding row deleted from COMMAND_COPY -> refusal-unmapped', await run('', { tree: { [ERRORS_FILE]: firstOnly(ERRORS_OK) } }), 1, 'the first COMMAND_COPY row');
  expect('7 row present but not first -> refusal-unmapped', await run('', { tree: { [ERRORS_FILE]: ERRORS_OK.replace("  { match: /^version_conflict/, message: 'Reload.' },\r\n", '').replace("message: string }> = [\r\n  { match: ONBOARDING", "message: string }> = [\r\n  { match: /^version_conflict/, message: 'Reload.' },\r\n  { match: ONBOARDING") } }), 1, 'the first PROGRAMME_COPY row in');
  expect('7b pattern drifts (unanchored) -> refusal-unmapped', await run('', { tree: { [ERRORS_FILE]: ERRORS_OK.replace('/^(permission_denied: )?onboarding_incomplete/', '/onboarding_incomplete/') } }), 1, 'ONBOARDING_REFUSAL_MATCH is /onboarding_incomplete/');
  expect('7d a spread ahead of the row is not first -> refusal-unmapped', await run('', { tree: { [ERRORS_FILE]: ERRORS_OK.replace("message: string }> = [\r\n  { match: ONBOARDING", "message: string }> = [\r\n  ...EXTRA,\r\n  { match: ONBOARDING") } }), 1, 'the first PROGRAMME_COPY row');
  expect('7e right match, wrong message -> refusal-unmapped', await run('', { tree: { [ERRORS_FILE]: ERRORS_OK.replace(ROW, '  { match: ONBOARDING_REFUSAL_MATCH, message: SESSION_ENDED },') } }), 1, 'message: SESSION_ENDED');
  expect('4d a door quoted inside another string -> 0', await run('', { tree: { 'src/x/j.ts': "throw new Error(\"call 'series_command_p5' only via the wrapper\");" } }), 0, null);
  expect('5c a new delete-verb door -> unknown-write-rpc', await run('', { tree: { 'src/x/k.ts': "rpc('organiser_delete_occurrence_v1')" } }), 1, "names 'organiser_delete_occurrence_v1'");
  expect('5d a non-RPC-shaped key is not a write -> 0', await run('', { tree: { 'src/x/l.ts': "localStorage.getItem('organiser_set_up_done')" } }), 0, null);
  expect('5e a door in app/ is scanned -> door-outside-wrapper', await run('', { tree: { 'app/routes/x.tsx': "rpc('series_command_p5')" } }), 1, 'door-outside-wrapper: app/routes/x.tsx:1');
  expect('10i wrapper lists a non-door -> 2 (config branch)', await run('', { cfg: { ...FIXTURE_CFG, wrappers: { ...FIXTURE_CFG.wrappers, 'src/m/bulkApi.ts': ['admin_bulk_occurrence_command_p5', 'organiser_get_x_v1'] } } }), 2, "lists 'organiser_get_x_v1'");
  expect('7c errors file missing -> refusal-unmapped', await run('', { tree: { [ERRORS_FILE]: null } }), 1, 'refusal-unmapped: src/modules');

  // 8: ratchet.
  expect('8 stale not_event_writes entry -> stale-entry', await run('', { tree: { 'src/m/tickets.ts': 'export {};' } }), 1, "stale-entry: not_event_writes 'ticket_type_upsert_v1'");
  expect('8b wrapper stops naming its door -> stale-entry', await run('', { tree: { 'src/m/bulkApi.ts': 'export {};' } }), 1, "no longer names 'admin_bulk_occurrence_command_p5'");

  // 9: live verdicts (three cases + names + garbage).
  const live = (data) => run('', { argv: ['--live'], env: creds, rpc: rpcOf(data) });
  expect('9a healthy:false -> 1', await live({ ...HEALTHY, healthy: false }), 1, 'FAIL live: healthy is false');
  expect('9b violation_count:1 -> 1', await live({ ...HEALTHY, violation_count: 1 }), 1, 'FAIL live: violation_count is 1');
  expect('9c gated below config -> 1', await live({ ...HEALTHY, gated: 3 }), 1, 'the guard gates 3 door(s) but this check relies on 4');
  expect('9d gated_names missing a config door -> 1', await live({ ...HEALTHY, gated_names: ['series_command_p5'] }), 1, "'occurrence_command_p5' is not in the guard's gated_names");
  expect('9e null report -> 2', await live(null), 2, 'not a report object');

  // 10: every exit-2 branch, pinned to the branch that produced it.
  expect('10a --live without creds -> 2 (creds branch)', await run('', { argv: ['--live'] }), 2, 'CANNOT RUN (creds)');
  expect('10b RPC 404 -> 2 (rpc branch)', await run('', { argv: ['--live'], env: creds, rpc: rpcOf(null, { code: 'PGRST202', message: 'not found' }) }), 2, 'CANNOT RUN (rpc)');
  expect('10c transport throw -> 2 (network branch)', await run('', { argv: ['--live'], env: creds, rpc: async () => { throw new Error('ECONNRESET'); } }), 2, 'CANNOT RUN (network)');
  expect('10d empty file list -> 2 (floor branch)', await run('', { readTree: () => [] }), 2, 'floor is');
  expect('10e unreadable tree -> 2 (read branch)', await run('', { readTree: () => { throw new Error('EACCES'); } }), 2, 'could not read the config or the tree');
  expect('10f bad config -> 2 (config branch)', await run('', { cfg: { ...FIXTURE_CFG, gated: [] } }), 2, 'gated must be a non-empty array');
  expect('10g unknown flag -> 2', await run('', { argv: ['--liev'] }), 2, 'Unknown flag');
  expect('10h a Part A violation outranks a Part B exit 2 -> 1', await run('', { argv: ['--live'], tree: { 'src/x/a.ts': "rpc('series_command_p5')" } }), 1, 'CANNOT RUN (creds)');

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
