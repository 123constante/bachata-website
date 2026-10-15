#!/usr/bin/env node
/**
 * check-journey-grid.mjs -- the account journey grid as a CI gate.
 *
 * WHAT IT GUARDS. docs/account-system/journey-grid.json is the model of every
 * way a person can enter, and sign in to, an account. Each row names the tests
 * and walks that cover it (`covered_by`). Without a gate those names rot: a
 * test is renamed and the grid still claims it. This check resolves every
 * claim against the tree. Rules (JOURNEY-GRID.md, "The proposed CI check"):
 *
 *   1. Structure: schema version 1, no duplicate id, entry/kind known, and a
 *      `state` that starts with an S- id from the ACCOUNT-MODEL.md state table
 *      (or `any`; `S-ADMIN-*` style prefixes match any defined S- id).
 *   2. Every covered_by ref resolves. J = id in tests/journeys/publicEntryJourneys.ts;
 *      R = a FULL test title in tests/e2e-build/*.build.spec.ts (template titles
 *      are expanded from the spec's `for (const [a, b] of [...])` table);
 *      E = tests/e2e/<ref>.spec.ts, listed in package.json test:e2e;
 *      U = file exists and holds an it( / test( ; OTP = file under tests/e2e-otp/;
 *      W = a walk: a path (optionally #anchor or :line) to a file or folder.
 *   3. Coverage: `required` = one test of any kind AND one walk (J, R, E, OTP, W);
 *      `optional` = one test. A row whose `built` is not BUILT is exempt.
 *   4. Ratchet: scripts/journey-grid-baseline.json lists today's known gaps as
 *      { id, reason } entries (a reason is required: which PR covers it, and
 *      why not now). A NEW uncovered row fails; a baseline id that is now
 *      covered (or unknown, listed twice, or without a reason) fails. The
 *      baseline only shrinks. Rows whose `built` is not BUILT are exempt and
 *      are not written to it.
 *   5. Reverse: every J id in publicEntryJourneys.ts is referenced by a grid row.
 *
 * The check cannot see whether a walk asserts the stated END; that is review.
 *
 * HARD LINK. When the grid file is absent the check FAILS (exit 1). There is no
 * skip: the slice-1a `--skip-if-absent` escape existed only until the grid
 * landed, and was removed at integration. Passing it now changes nothing (the
 * self-test proves a missing grid still exits 1 with it).
 *
 * Exit codes: 0 pass / 1 contract violated / 2 infrastructure (unreadable file).
 * Flags: --self-test, --write-baseline, --root <dir>.
 */
import { existsSync, readFileSync, readdirSync, mkdtempSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(HERE);
const GRID_REL = 'docs/account-system/journey-grid.json';
const MODEL_REL = 'docs/account-system/ACCOUNT-MODEL.md';
const BASELINE_REL = 'scripts/journey-grid-baseline.json';
const JOURNEYS_REL = 'tests/journeys/publicEntryJourneys.ts';
const BUILD_DIR_REL = 'tests/e2e-build';
const WALK_KINDS = new Set(['J', 'R', 'E', 'OTP', 'W']);
const KINDS = new Set(['J', 'R', 'E', 'U', 'OTP', 'W']);

/** Thrown for a file that exists but cannot be read or parsed: exit 2, not 1. */
export class InfraError extends Error {}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch (err) {
    throw new InfraError('cannot read ' + file + ': ' + err.message);
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (err) {
    if (err instanceof InfraError) throw err;
    throw new InfraError('cannot parse ' + file + ': ' + err.message);
  }
}

/** Read a quoted string literal starting at src[i] (the opening quote). */
function readLiteral(src, i) {
  const q = src[i];
  let out = '';
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') {
      out += src[j + 1];
      j++;
    } else if (c === q) {
      return { value: out, end: j + 1 };
    } else {
      out += c;
    }
  }
  return null;
}

/** Split the text of an array literal (after its `[`) into top-level elements. */
function splitTopLevel(src, start) {
  const items = [];
  let depth = 0;
  let cur = '';
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const lit = readLiteral(src, i);
      if (!lit) break;
      cur += src.slice(i, lit.end);
      i = lit.end - 1;
      continue;
    }
    if (c === '[' || c === '(' || c === '{') depth++;
    if (c === ']' || c === ')' || c === '}') {
      if (depth === 0) {
        if (cur.trim()) items.push(cur.trim());
        return items;
      }
      depth--;
    }
    if (c === ',' && depth === 0) {
      items.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  return items;
}

function unquote(token) {
  const t = token.trim();
  if (!/^["'`]/.test(t)) return null;
  const lit = readLiteral(t, 0);
  return lit && lit.end === t.length ? lit.value : null;
}

/** All test titles in a spec; template titles expanded from the nearest `for ([..] of [..])`. */
export function extractTitles(src) {
  const titles = new Set();
  const re = /\btest(?:\.\w+)?\(\s*(['"`])/g;
  let m;
  while ((m = re.exec(src))) {
    const lit = readLiteral(src, m.index + m[0].length - 1);
    if (!lit) continue;
    titles.add(lit.value);
    if (m[1] !== '`' || !lit.value.includes('${')) continue;
    const head = src.slice(0, m.index);
    const loops = [...head.matchAll(/for\s*\(\s*const\s*\[([^\]]+)\]\s*of\s*\[/g)];
    const loop = loops[loops.length - 1];
    if (!loop) continue;
    const names = loop[1].split(',').map((s) => s.trim());
    for (const row of splitTopLevel(src, loop.index + loop[0].length)) {
      if (!row.startsWith('[')) continue;
      const cells = splitTopLevel(row, 1).map(unquote);
      let title = lit.value;
      names.forEach((n, k) => {
        if (cells[k] != null) title = title.split('${' + n + '}').join(cells[k]);
      });
      titles.add(title);
    }
  }
  return titles;
}

function journeyIds(src) {
  return [...src.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]);
}

function hasTest(file) {
  return /\b(?:it|test)(?:\.\w+)?\(/.test(readText(file));
}

/** Resolve one covered_by ref. Returns an error string or null. */
function resolveRef(ctx, kind, ref) {
  const clean = String(ref).replace(/#.*$/, '').replace(/:\d+(-\d+)?$/, '');
  const at = (rel) => path.join(ctx.root, rel);
  switch (kind) {
    case 'J':
      return ctx.journeyIds.has(ref) ? null : 'no id: \'' + ref + '\' in ' + JOURNEYS_REL;
    case 'R':
      return ctx.titles.has(ref) ? null : 'no test titled "' + ref + '" in ' + BUILD_DIR_REL + '/*.build.spec.ts';
    case 'E': {
      const rel = 'tests/e2e/' + clean + '.spec.ts';
      if (!existsSync(at(rel))) return rel + ' does not exist';
      return ctx.testE2e.includes(rel) ? null : rel + ' is not listed in package.json test:e2e';
    }
    case 'U':
      if (!existsSync(at(clean))) return clean + ' does not exist';
      return hasTest(at(clean)) ? null : clean + ' has no it( / test(';
    case 'OTP': {
      const rel = clean.startsWith('tests/e2e-otp/') ? clean : 'tests/e2e-otp/' + clean;
      return existsSync(at(rel)) || existsSync(at(rel + '.spec.ts')) ? null : rel + ' does not exist';
    }
    case 'W':
      return existsSync(at(clean)) ? null : 'walk path ' + clean + ' does not exist';
    default:
      return 'unknown kind ' + kind;
  }
}

function stateOk(state, defined) {
  if (typeof state !== 'string') return false;
  if (/^any\b/.test(state)) return true;
  const m = state.match(/^S-[A-Z0-9*-]+/);
  if (!m) return false;
  const id = m[0].replace(/-$/, '');
  if (id.endsWith('*')) return [...defined].some((d) => d.startsWith(id.slice(0, -1)));
  return defined.has(id);
}

/** The whole check, pure over a root directory. Returns {exit, lines, gaps}. */
export function checkGrid({ root = REPO_ROOT } = {}) {
  const at = (rel) => path.join(root, rel);
  if (!existsSync(at(GRID_REL))) {
    return { exit: 1, gaps: [], lines: ['FAIL: ' + GRID_REL + ' not found. The journey grid is required; this check will not pass without it.'] };
  }
  const grid = readJson(at(GRID_REL));
  const errors = [];
  const rows = Array.isArray(grid.rows) ? grid.rows : [];
  if (grid.version !== 1) errors.push('grid version must be 1, found ' + JSON.stringify(grid.version));
  if (!rows.length) errors.push('grid has no rows');

  const defined = new Set([...readText(at(MODEL_REL)).matchAll(/^\|\s*`(S-[A-Z0-9-]+)`/gm)].map((m) => m[1]));
  if (!defined.size) errors.push(MODEL_REL + ' defines no S- states (Named states table)');
  const entries = new Set((grid.groups || []).map((g) => g.entry));

  const journeysSrc = readText(at(JOURNEYS_REL));
  const jIds = journeyIds(journeysSrc);
  const titles = new Set();
  const buildDir = at(BUILD_DIR_REL);
  for (const f of existsSync(buildDir) ? readdirSync(buildDir).sort() : []) {
    if (f.endsWith('.build.spec.ts')) for (const t of extractTitles(readText(path.join(buildDir, f)))) titles.add(t);
  }
  const pkg = readJson(at('package.json'));
  const testE2e = String((pkg.scripts || {})['test:e2e'] || '').split(/\s+/);
  const ctx = { root, journeyIds: new Set(jIds), titles, testE2e };

  const seen = new Set();
  const referencedJ = new Set();
  const verdicts = new Map();
  for (const row of rows) {
    const id = row.id;
    if (seen.has(id)) errors.push('duplicate id ' + id);
    seen.add(id);
    if (!entries.has(row.entry)) errors.push(id + ': unknown entry ' + row.entry);
    if (!stateOk(row.state, defined)) errors.push(id + ': state "' + row.state + '" does not start with an S- id defined in ' + MODEL_REL);
    if (row.coverage !== 'required' && row.coverage !== 'optional') errors.push(id + ': coverage must be required or optional');
    let tests = 0;
    let walks = 0;
    for (const c of row.covered_by || []) {
      if (!KINDS.has(c.kind)) {
        errors.push(id + ': unknown kind ' + c.kind);
        continue;
      }
      if (c.kind === 'J') referencedJ.add(c.ref);
      const bad = resolveRef(ctx, c.kind, c.ref);
      if (bad) {
        errors.push(id + ': dangling ' + c.kind + ' ref "' + c.ref + '": ' + bad);
        continue;
      }
      tests++;
      if (WALK_KINDS.has(c.kind)) walks++;
    }
    const covered = row.coverage === 'required' ? tests >= 1 && walks >= 1 : tests >= 1;
    const why = tests === 0 ? 'no test and no walk' : 'a test but no walk';
    verdicts.set(id, { covered, exempt: row.built !== 'BUILT', why });
  }
  for (const id of jIds) {
    if (!referencedJ.has(id)) errors.push('journey ' + id + ' in ' + JOURNEYS_REL + ' is referenced by no grid row (rule 5)');
  }

  let baseline = [];
  if (existsSync(at(BASELINE_REL))) baseline = readJson(at(BASELINE_REL));
  else errors.push(BASELINE_REL + ' not found');
  if (!Array.isArray(baseline)) {
    errors.push(BASELINE_REL + ' must be a JSON array of { id, reason } entries');
    baseline = [];
  }
  const inBase = new Set();
  for (const entry of baseline) {
    const id = entry && typeof entry === 'object' ? entry.id : entry;
    if (typeof id !== 'string' || !id) {
      errors.push('baseline entry ' + JSON.stringify(entry) + ' has no id');
      continue;
    }
    if (typeof entry !== 'object' || typeof entry.reason !== 'string' || !entry.reason.trim()) {
      errors.push('baseline id ' + id + ' carries no reason; write it as { "id": "' + id + '", "reason": "<which PR covers it, and why not now>" }');
    }
    if (inBase.has(id)) errors.push('baseline lists ' + id + ' twice');
    inBase.add(id);
    const v = verdicts.get(id);
    if (!v) errors.push('baseline id ' + id + ' is not a grid row; remove it');
    else if (v.covered) errors.push('baseline id ' + id + ' is now covered; remove it from the baseline (it may only shrink)');
  }
  const gaps = [];
  for (const [id, v] of verdicts) {
    if (v.covered) continue;
    gaps.push({ id, exempt: v.exempt, why: v.why });
    if (!v.exempt && !inBase.has(id)) errors.push('NEW uncovered row ' + id + ': needs a test and a walk (or, if it cannot be covered yet, an entry in ' + BASELINE_REL + ')');
  }
  const lines = errors.map((e) => 'FAIL: ' + e);
  lines.push(errors.length ? errors.length + ' violation(s).' : 'OK: ' + rows.length + ' rows, ' + gaps.length + ' known gap(s), baseline ' + baseline.length + '.');
  return { exit: errors.length ? 1 : 0, lines, gaps };
}

// ---------------------------------------------------------------- self-test
const FIXTURE_FULL = path.join(HERE, '__tests__', 'fixtures', 'journey-grid', 'full');

/** Copy the full-coverage fixture, apply a mutation, run the check. */
function runMutant(mutate, opts = {}) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'journey-grid-'));
  try {
    cpSync(FIXTURE_FULL, tmp, { recursive: true });
    const edit = (rel, fn) => writeFileSync(path.join(tmp, rel), fn(readFileSync(path.join(tmp, rel), 'utf8')));
    mutate({ tmp, edit, rm: (rel) => rmSync(path.join(tmp, rel), { recursive: true, force: true }) });
    return checkGrid({ root: tmp, ...opts });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const base = (...ids) => JSON.stringify(ids.map((id) => ({ id, reason: 'self-test' })));

const editGrid = (fn) => ({ edit }) => edit(GRID_REL, (s) => {
  const g = JSON.parse(s);
  fn(g);
  return JSON.stringify(g, null, 1);
});

export function selfTest() {
  const out = [];
  const fails = [];
  const expect = (name, got, want, needle) => {
    const ok = got.exit === want && (!needle || got.lines.join('\n').includes(needle));
    out.push((ok ? 'ok   ' : 'FAIL ') + name + ' (exit ' + got.exit + ', want ' + want + ')');
    if (!ok) fails.push(name + ': ' + got.lines.join(' | '));
  };
  expect('full-coverage fixture passes', checkGrid({ root: FIXTURE_FULL }), 0, 'OK:');
  // The exit code the CLI actually sets comes from main(); drive it, not just checkGrid.
  expect('main() on the full fixture returns 0', { exit: main(['--root', FIXTURE_FULL], true), lines: [] }, 0);
  expect('main() on a root with no grid returns 1', { exit: main(['--root', path.join(os.tmpdir(), 'journey-grid-no-such-root')], true), lines: [] }, 1);
  expect('dangling J ref fails', runMutant(editGrid((g) => { g.rows[0].covered_by[0].ref = 'no-such-journey'; })), 1, 'dangling J');
  expect('dangling R ref fails', runMutant(editGrid((g) => { g.rows[1].covered_by[0].ref = 'a title nobody wrote'; })), 1, 'dangling R');
  expect('template R title is expanded', runMutant(editGrid((g) => { g.rows[1].covered_by[0].ref = 'two-orgs: lists organisers first'; })), 0);
  expect('dangling U ref fails', runMutant(editGrid((g) => { g.rows[2].covered_by[0].ref = 'src/gone.test.ts'; })), 1, 'dangling U');
  expect('E spec not in test:e2e fails', runMutant(editGrid((g) => { g.rows[2].covered_by.push({ kind: 'E', ref: 'unlisted' }); })), 1, 'not listed');
  expect('uncovered row not in baseline fails', runMutant(editGrid((g) => { g.rows[1].covered_by = []; })), 1, 'NEW uncovered row');
  expect('required row with a test but no walk fails', runMutant(editGrid((g) => { g.rows[2].covered_by = [{ kind: 'U', ref: 'src/covered.test.ts' }]; g.rows[2].coverage = 'required'; })), 1, 'NEW uncovered row');
  expect('baseline id now covered fails', runMutant(({ edit }) => edit(BASELINE_REL, () => base('row.one'))), 1, 'is now covered');
  expect('baseline id unknown fails', runMutant(({ edit }) => edit(BASELINE_REL, () => base('row.ghost'))), 1, 'not a grid row');
  expect('uncovered row listed in baseline passes', runMutant((c) => { editGrid((g) => { g.rows[1].covered_by = []; })(c); c.edit(BASELINE_REL, () => base('row.two')); }), 0);
  expect('baseline entry as a bare id (no reason) fails', runMutant((c) => { editGrid((g) => { g.rows[1].covered_by = []; })(c); c.edit(BASELINE_REL, () => '["row.two"]'); }), 1, 'carries no reason');
  expect('baseline entry with an empty reason fails', runMutant((c) => { editGrid((g) => { g.rows[1].covered_by = []; })(c); c.edit(BASELINE_REL, () => '[{"id":"row.two","reason":" "}]'); }), 1, 'carries no reason');
  expect('unbuilt uncovered row is exempt', runMutant(editGrid((g) => { g.rows[1].covered_by = []; g.rows[1].built = 'PLANNED'; })), 0);
  expect('duplicate id fails', runMutant(editGrid((g) => { g.rows[1].id = g.rows[0].id; })), 1, 'duplicate id');
  expect('unknown entry fails', runMutant(editGrid((g) => { g.rows[0].entry = 'ZZ'; })), 1, 'unknown entry');
  expect('unknown kind fails', runMutant(editGrid((g) => { g.rows[0].covered_by[0].kind = 'Q'; })), 1, 'unknown kind');
  expect('undefined state fails', runMutant(editGrid((g) => { g.rows[0].state = 'S-MADE-UP'; })), 1, 'does not start with');
  expect('journey with no grid row fails (rule 5)', runMutant(({ edit }) => edit(JOURNEYS_REL, (s) => s + "\n  { id: 'orphan-journey' },\n")), 1, 'rule 5');
  expect('missing grid file fails, not 0', runMutant(({ rm }) => rm(GRID_REL)), 1, 'not found');
  // HARD LINK (integration): the old slice-1a skip is gone. A missing grid fails even when the retired flag is passed.
  expect('missing grid fails even with the retired --skip-if-absent flag', { exit: main(['--root', path.join(os.tmpdir(), 'journey-grid-no-such-root'), '--skip-if-absent'], true), lines: [] }, 1);
  expect('missing baseline fails', runMutant(({ rm }) => rm(BASELINE_REL)), 1, 'not found');
  const broken = (() => {
    try {
      return runMutant(({ edit }) => edit(GRID_REL, () => '{ not json'));
    } catch (err) {
      return { exit: err instanceof InfraError ? 2 : 1, lines: [String(err.message)] };
    }
  })();
  expect('unparseable grid is infrastructure (2)', broken, 2);
  return { exit: fails.length ? 1 : 0, lines: out.concat(fails.map((f) => 'detail: ' + f)) };
}

// --------------------------------------------------------------------- main
function main(argv = process.argv.slice(2), log = null) {
  const flag = (n) => argv.includes(n);
  const rootAt = argv.indexOf('--root');
  const root = rootAt >= 0 ? path.resolve(argv[rootAt + 1]) : REPO_ROOT;
  let result;
  try {
    if (flag('--self-test')) {
      result = selfTest();
    } else if (flag('--write-baseline')) {
      if (!existsSync(path.join(root, GRID_REL))) throw new InfraError(GRID_REL + ' is absent; nothing to baseline');
      const r = checkGrid({ root });
      // Keep a reason already written for an id; a new id gets the gap the check saw (edit it to name the PR).
      const old = new Map();
      const prev = existsSync(path.join(root, BASELINE_REL)) ? readJson(path.join(root, BASELINE_REL)) : [];
      for (const e of Array.isArray(prev) ? prev : []) if (e && typeof e === 'object' && e.reason) old.set(e.id, e.reason);
      const gaps = r.gaps.filter((g) => !g.exempt).sort((a, b) => (a.id < b.id ? -1 : 1))
        .map((g) => ({ id: g.id, reason: old.get(g.id) || 'BUILT, ' + g.why + ' (TODO: name the PR that covers it)' }));
      writeFileSync(path.join(root, BASELINE_REL), JSON.stringify(gaps, null, 2) + '\n');
      result = { exit: 0, lines: ['wrote ' + BASELINE_REL + ' with ' + gaps.length + ' id(s). Review the diff: the baseline may only shrink afterwards.'] };
    } else {
      result = checkGrid({ root });
    }
  } catch (err) {
    if (!(err instanceof InfraError)) throw err;
    result = { exit: 2, lines: ['INFRA: ' + err.message] };
  }
  if (!log) for (const l of result.lines) (result.exit === 0 ? console.log : console.error)(l);
  return result.exit;
}

if (isEntryPoint(import.meta.url)) process.exitCode = main();

export { main, REPO_ROOT };
