#!/usr/bin/env node
/**
 * GUARD: the P3 walk specs in the e2e gate must RUN in CI, not skip.
 *
 * WHY. Review of #1208 (docs/review/pr-1208-r1.md, F4) found that every P3 walk
 * spec in `npm run test:e2e` skipped itself in CI: the specs gate on
 * VITE_ENABLE_ORGANISER_P3 (and the door scanner on VITE_ENABLE_ORGANISER_TICKETING),
 * and e2e-smoke.yml set neither. A skipped test is a green test, so the gate
 * reported "passed" for seven specs it never ran. Measured on main ea16d47:
 * 7 P3 specs in the gate, 0 of them executed. They now run in their own step
 * (`npm run test:e2e:p3`) with the flags on: turning P3 on for the whole
 * `test:e2e` step broke the legacy organiser-* specs (P3 takes over /account/o).
 *
 * Two ways a spec skipped, and this guard closes both:
 *   A. ENV  -- the spec reads process.env.VITE_ENABLE_ORGANISER_* and the CI step
 *             running `npm run test:e2e` does not set that flag to 'true'.
 *   B. PROBE -- the spec skips on a RUNTIME probe (`test.skip(!mounted, ...)`,
 *             where `mounted` = "did /account/p3 render within 15s"). With the
 *             flag on, a regression that stops the page rendering is then also a
 *             skip, not a failure: the probe cannot tell "flag off" from "broken".
 *             So every skip in a P3 spec must be gated by the flag itself -- a
 *             top-level `&&` conjunct built ONLY from VITE_ENABLE_ORGANISER_*
 *             reads -- which is false whenever CI sets the flags.
 *
 * SCOPE. Every step of e2e-smoke.yml that runs `npm run test:e2e[:suffix]` is a
 * gate step; its specs are the ones that package.json script names. A "P3 spec"
 * is a gate spec whose source mentions VITE_ENABLE_ORGANISER_P3 or organiserP3,
 * and it is checked against the env of the step that runs it. Specs in no gate
 * script are not CI's business (they are local walks).
 *
 * EXIT CODES (repo convention, docs/testing-doctrine.md):
 *   0  every P3 spec in the gate runs with its flags set and has no ungated skip
 *   1  contract violated (listed)
 *   2  could not measure: unreadable package.json / workflow / spec, no
 *      workflow step running a test:e2e* script, a step naming a script that
 *      does not exist, or ZERO P3 specs found
 *      (an empty sample is not a pass -- if P3 specs are retired, retire this).
 *
 * Usage:
 *   node scripts/check-p3-specs-not-skipped.mjs
 *   node scripts/check-p3-specs-not-skipped.mjs --self-test
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { isEntryPoint } from './lib/entry-point.mjs';
import { stripCommentsAndStrings } from './lib/stripSource.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = '.github/workflows/e2e-smoke.yml';
const GATE_RUN_RE = /\bnpm run (test:e2e(?::[\w-]+)?)(?=\s|$)/g;
const FLAG_RE = /VITE_ENABLE_ORGANISER_[A-Z0-9_]+/g;
// Every skip spelling Playwright offers a spec body: test.skip / test.fixme (and the
// describe forms), testInfo.skip, test.info().skip, plus the it./describe. aliases.
// NOT seen (named gaps): an early `return` on a probe, and a skip inside an imported helper.
const SKIP_RE = /(?:\b(?:test(?:\.describe)?|describe|it|testInfo)|\btest\.info\(\s*\))\.(?:skip|fixme)\s*\(/g;
// A read of a flag: process.env.VITE_ENABLE_ORGANISER_X or process.env['VITE_ENABLE_ORGANISER_X'].
const FLAG_READ_RE = /process\.env(?:\.VITE_ENABLE_ORGANISER_[A-Z0-9_]+|\[\s*['"]VITE_ENABLE_ORGANISER_[A-Z0-9_]+['"]\s*\])/g;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Spec paths named in a package.json script, or null when there is no such script. */
export function scriptSpecs(pkg, name) {
  const cmd = pkg?.scripts?.[name];
  if (typeof cmd !== 'string') return null;
  return cmd.split(/\s+/).filter((t) => /\.spec\.[cm]?[jt]sx?$/.test(t));
}

/** Every step running a test:e2e* script, with the env it sees: workflow < job < step. */
export function gateSteps(workflowText) {
  const doc = YAML.parse(workflowText);
  const found = [];
  for (const [jobId, job] of Object.entries(doc?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      if (typeof step?.run !== 'string') continue;
      for (const m of step.run.matchAll(GATE_RUN_RE)) {
        found.push({
          script: m[1],
          where: jobId + ' / ' + (step.name ?? '(unnamed step)') + ' (npm run ' + m[1] + ')',
          env: { ...(doc.env ?? {}), ...(job.env ?? {}), ...(step.env ?? {}) },
        });
      }
    }
  }
  return found;
}

/**
 * [start, end) of the first argument of the call whose '(' is at openIdx, scanned on
 * the STRIPPED code (strings blanked, so a comma in a message cannot end it).
 */
function firstArgRange(code, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < code.length; i++) {
    const ch = code[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return [openIdx + 1, i];
    } else if (ch === ',' && depth === 1) return [openIdx + 1, i];
  }
  return [openIdx + 1, code.length];
}

/** Split on `&&` at paren depth 0. */
function topLevelConjuncts(expr) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && expr.startsWith('&&', i)) {
      parts.push(expr.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  parts.push(expr.slice(start));
  return parts.map((p) => p.trim());
}

/**
 * The value of `expr` with every flag read set to 'true' (as CI sets it), or undefined
 * when `expr` reads anything but flags / flag consts, operators and string literals.
 * Evaluating it -- not just checking it is "built from flags" -- is what rejects
 * `!mounted && P3_ON`: pure flag, but TRUE with the flags on, so the probe still decides.
 */
function valueWithFlagsOn(expr, flagConsts) {
  let sub = expr.replace(FLAG_READ_RE, " 'true' ");
  for (const [name, value] of Object.entries(flagConsts)) {
    sub = sub.replace(new RegExp('(?<![\\w$.])' + name.replace(/\$/g, '\\$') + '(?![\\w$])', 'g'), ' ' + JSON.stringify(value) + ' ');
  }
  if (sub === expr) return undefined; // no flag in it at all
  const residue = sub.replace(/'[^'\n]*'|"[^"\n]*"|\btrue\b|\bfalse\b/g, '').replace(/[!=()|&\s]/g, '');
  if (residue !== '') return undefined;
  // Safe: only literals and boolean/equality operators remain.
  return Boolean(new Function('return (' + sub + ');')());
}

/** Analyse one spec's source. */
export function analyseSpec(path, source) {
  const isP3 = /VITE_ENABLE_ORGANISER_P3|organiserP3/.test(source);
  if (!isP3) return { isP3: false };
  // Stripping blanks string CONTENT in place (same length), so offsets found on `code`
  // index the same text in `source`: scan the stripped form, read the real one.
  const code = stripCommentsAndStrings(source);
  if (code.length !== source.length) throw new Error('stripCommentsAndStrings changed the length of ' + path);
  const flags = [...new Set(source.match(FLAG_RE) ?? [])].sort();
  // `const X = <pure flag expression>` -- X may stand in for the flag (value with flags on).
  const flagConsts = {};
  for (const m of code.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
    const initStart = m.index + m[0].length - m[2].length;
    const value = valueWithFlagsOn(source.slice(initStart, initStart + m[2].length), flagConsts);
    if (value !== undefined) flagConsts[m[1]] = value;
  }
  const ungated = [];
  for (const m of code.matchAll(SKIP_RE)) {
    const [start, end] = firstArgRange(code, m.index + m[0].length - 1);
    const cond = source.slice(start, end).trim();
    const line = code.slice(0, m.index).split('\n').length;
    // test.skip() / test.skip('title', fn) -- no condition at all: unconditional skip.
    // Gated = some top-level && conjunct reads only flags AND is false with the flags on.
    const gated = cond !== '' && !/^['"`]/.test(cond)
      && topLevelConjuncts(cond).some((c) => valueWithFlagsOn(c, flagConsts) === false);
    if (!gated) ungated.push({ line, cond: cond.replace(/\s+/g, ' ') || '(none)' });
  }
  return { isP3: true, path, flags, ungated };
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/**
 * @returns {{ code: 0|1|2, lines: string[] }}
 */
export function runCheck({ readText }) {
  const lines = [];
  let pkg;
  let workflowText;
  try {
    pkg = JSON.parse(readText('package.json'));
    workflowText = readText(WORKFLOW);
  } catch (error) {
    return { code: 2, lines: ['Cannot read package.json / ' + WORKFLOW + ': ' + error.message] };
  }
  let steps;
  try {
    steps = gateSteps(workflowText);
  } catch (error) {
    return { code: 2, lines: ['Cannot parse ' + WORKFLOW + ': ' + error.message] };
  }
  if (steps.length === 0) {
    return { code: 2, lines: ['No step in ' + WORKFLOW + ' runs `npm run test:e2e*` -- nothing to measure.'] };
  }

  const violations = [];
  let p3Count = 0;
  for (const s of steps) {
    const specs = scriptSpecs(pkg, s.script);
    if (!specs) return { code: 2, lines: ['`' + s.where + '` runs a script package.json does not have -- nothing to measure.'] };
    for (const spec of specs) {
      let source;
      try {
        source = readText(spec);
      } catch (error) {
        return { code: 2, lines: ['Cannot read gate spec ' + spec + ': ' + error.message] };
      }
      const a = analyseSpec(spec, source);
      if (!a.isP3) continue;
      p3Count += 1;
      for (const flag of a.flags) {
        if (String(s.env[flag]) !== 'true') {
          violations.push(a.path + ': needs ' + flag + "='true' but `" + s.where + '` sets it to ' + JSON.stringify(s.env[flag] ?? null) + ' -- the spec skips in CI.');
        }
      }
      for (const u of a.ungated) {
        violations.push(a.path + ':' + u.line + ': skip condition `' + u.cond + '` is not gated by a VITE_ENABLE_ORGANISER_* flag -- with the flag on in CI a broken page skips instead of failing.');
      }
    }
  }
  if (p3Count === 0) {
    return {
      code: 2,
      lines: ['ZERO P3 specs in any gate step -- an empty sample is not a pass. If the P3 walks were retired, retire this guard too.'],
    };
  }
  lines.push('Measured ' + p3Count + ' P3 spec run(s) across ' + steps.length + ' gate step(s) of ' + WORKFLOW + '.');
  if (violations.length) {
    lines.push('FAIL -- ' + violations.length + ' violation(s):', ...violations.map((v) => '  ' + v));
    return { code: 1, lines };
  }
  lines.push('PASS -- every P3 spec in the gate runs in CI (flags set, every skip flag-gated).');
  return { code: 0, lines };
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

const FX_PKG = JSON.stringify({ scripts: {
  'test:e2e': 'playwright test tests/e2e/a.spec.ts --project=chromium',
  'test:e2e:p3': 'playwright test tests/e2e/p3.spec.ts --project=chromium',
} });
// The legacy step runs with SELF_SERVE only (as e2e-smoke.yml does); `env` is the P3 step's.
const FX_WF = (env) => [
  'name: E2E Smoke',
  'on: [pull_request]',
  'jobs:',
  '  e2e-smoke:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - name: Run E2E smoke suite',
  '        env:',
  "          VITE_ENABLE_ORGANISER_SELF_SERVE: 'true'",
  '        run: npm run test:e2e',
  '      - name: Run E2E P3 walk specs',
  ...(Object.keys(env).length ? ['        env:'] : []),
  ...Object.entries(env).map(([k, v]) => "          " + k + ": '" + v + "'"),
  '        run: npm run test:e2e:p3',
].join('\n');
// main ea16d47's shape: the P3 spec in test:e2e, one step, no P3 flag.
const FX_PKG_MAIN = JSON.stringify({ scripts: { 'test:e2e': 'playwright test tests/e2e/a.spec.ts tests/e2e/p3.spec.ts --project=chromium' } });
const FULL_ENV = { VITE_ENABLE_ORGANISER_SELF_SERVE: 'true', VITE_ENABLE_ORGANISER_P3: 'true' };
const SPEC_PLAIN = "test('a', async () => {});\n";
const SPEC_ENV_GATED = [
  "const P3_ON = process.env.VITE_ENABLE_ORGANISER_P3 === 'true';",
  "test('p', async () => { test.skip(!P3_ON, 'needs the flag, organiserP3'); });",
].join('\n');
const SPEC_PROBE_GATED = [
  '// VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true',
  "test('p', async () => { const mounted = await probe();",
  "  test.skip(!mounted && process.env.VITE_ENABLE_ORGANISER_P3 !== 'true', 'organiserP3 is off'); });",
].join('\n');
const SPEC_PROBE_ONLY = [
  '// VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_ORGANISER_P3=true',
  "test('p', async () => { const mounted = await probe(); test.skip(!mounted, 'organiserP3 is off'); });",
].join('\n');

function fx({ env = FULL_ENV, p3 = SPEC_ENV_GATED, pkg = FX_PKG, wf, missing = [] } = {}) {
  const files = {
    'package.json': pkg,
    [WORKFLOW]: wf ?? FX_WF(env),
    'tests/e2e/a.spec.ts': SPEC_PLAIN,
    'tests/e2e/p3.spec.ts': p3,
  };
  return (p) => {
    if (missing.includes(p) || !(p in files)) throw new Error('ENOENT ' + p);
    return files[p];
  };
}
const code = (opts) => runCheck({ readText: fx(opts) }).code;
const quiet = () => undefined;

async function selfTest() {
  const cases = [
    // Rules, both directions.
    { name: 'env-gated spec + flags set -> 0', run: () => code({}), expected: 0 },
    { name: 'probe skip gated by the flag -> 0', run: () => code({ p3: SPEC_PROBE_GATED }), expected: 0 },
    { name: 'MUTANT main-ea16d47: P3 spec in test:e2e, no P3 step, no flag -> 1',
      run: () => code({ pkg: FX_PKG_MAIN, wf: FX_WF({}).split('\n').slice(0, 10).join('\n') }), expected: 1 },
    { name: 'MUTANT P3 step loses VITE_ENABLE_ORGANISER_P3 -> 1',
      run: () => code({ env: { VITE_ENABLE_ORGANISER_SELF_SERVE: 'true' } }), expected: 1 },
    { name: 'P3 spec moved back into the flags-off test:e2e step (both steps kept) -> 1',
      run: () => code({ pkg: JSON.stringify({ scripts: { 'test:e2e': 'playwright test tests/e2e/a.spec.ts tests/e2e/p3.spec.ts', 'test:e2e:p3': 'playwright test tests/e2e/p3.spec.ts' } }) }), expected: 1 },
    { name: "flag set to 'false' -> 1", run: () => code({ env: { ...FULL_ENV, VITE_ENABLE_ORGANISER_P3: 'false' } }), expected: 1 },
    { name: 'MUTANT probe-only skip `test.skip(!mounted)` -> 1', run: () => code({ p3: SPEC_PROBE_ONLY }), expected: 1 },
    { name: 'probe OR flag `!mounted || !P3_ON` (skips when broken) -> 1',
      run: () => code({ p3: SPEC_ENV_GATED.replace('!P3_ON', '!mounted || !P3_ON') }), expected: 1 },
    { name: 'unconditional test.skip() in a P3 spec -> 1',
      run: () => code({ p3: SPEC_ENV_GATED + "\ntest('q', async () => { test.skip(); });" }), expected: 1 },
    { name: "test.skip('title', fn) in a P3 spec -> 1",
      run: () => code({ p3: SPEC_ENV_GATED + "\ntest.skip('q', async () => {});" }), expected: 1 },
    { name: 'flag only in a comment line still demands the env (SELF_SERVE missing) -> 1',
      run: () => code({ p3: SPEC_PROBE_GATED, env: { VITE_ENABLE_ORGANISER_P3: 'true' } }), expected: 1 },
    { name: 'MUTANT positive flag `!mounted && P3_ON` (true in CI: probe still decides) -> 1',
      run: () => code({ p3: SPEC_ENV_GATED.replace('!P3_ON', '!mounted && P3_ON') }), expected: 1 },
    { name: "MUTANT `!mounted && process.env.VITE_ENABLE_ORGANISER_P3 === 'true'` -> 1",
      run: () => code({ p3: SPEC_PROBE_GATED.replace("!== 'true'", "=== 'true'") }), expected: 1 },
    { name: "bracket form process.env['VITE_ENABLE_ORGANISER_P3'] !== 'true' gates -> 0",
      run: () => code({ p3: SPEC_PROBE_GATED.replace('process.env.VITE_ENABLE_ORGANISER_P3', "process.env['VITE_ENABLE_ORGANISER_P3']") }), expected: 0 },
    { name: 'testInfo.skip(!mounted) is seen -> 1',
      run: () => code({ p3: SPEC_PROBE_ONLY.replace('test.skip(', 'testInfo.skip(') }), expected: 1 },
    { name: 'test.info().skip(!mounted) is seen -> 1',
      run: () => code({ p3: SPEC_PROBE_ONLY.replace('test.skip(', 'test.info().skip(') }), expected: 1 },
    { name: 'flag const built with a probe is NOT a flag const -> 1',
      run: () => code({ p3: SPEC_ENV_GATED.replace("=== 'true';", "=== 'true' && mounted;") }), expected: 1 },
    { name: 'job-level env counts -> 0',
      run: () => code({ wf: FX_WF({}).replace('    runs-on: ubuntu-latest', "    runs-on: ubuntu-latest\n    env:\n      VITE_ENABLE_ORGANISER_P3: 'true'") }),
      expected: 0 },
    // Could-not-measure branches, each pinned by its message.
    { name: 'zero P3 specs -> 2 (empty sample)',
      run: () => { const r = runCheck({ readText: fx({ p3: SPEC_PLAIN }) }); return r.code + ':' + /ZERO P3/.test(r.lines[0]); }, expected: '2:true' },
    { name: 'no step runs the gate -> 2',
      run: () => { const r = runCheck({ readText: fx({ wf: FX_WF(FULL_ENV).replace(/npm run test:e2e(:p3)?/g, 'npm run lint') }) }); return r.code + ':' + /No step/.test(r.lines[0]); }, expected: '2:true' },
    { name: 'step names a script package.json lacks -> 2',
      run: () => { const r = runCheck({ readText: fx({ pkg: '{"scripts":{}}' }) }); return r.code + ':' + /does not have/.test(r.lines[0]); }, expected: '2:true' },
    { name: 'unreadable gate spec -> 2',
      run: () => { const r = runCheck({ readText: fx({ missing: ['tests/e2e/p3.spec.ts'] }) }); return r.code + ':' + /Cannot read gate spec/.test(r.lines[0]); }, expected: '2:true' },
    { name: 'unreadable workflow -> 2',
      run: () => { const r = runCheck({ readText: fx({ missing: [WORKFLOW] }) }); return r.code + ':' + /Cannot read package/.test(r.lines[0]); }, expected: '2:true' },
    // THE EXIT-CODE CONTRACT ITSELF: drive main(), the owner of process.exitCode.
    { name: 'main() pass -> 0', run: () => main([], { readText: fx(), out: quiet, err: quiet }), expected: 0 },
    { name: 'main() violation -> 1',
      run: () => main([], { readText: fx({ p3: SPEC_PROBE_ONLY }), out: quiet, err: quiet }), expected: 1 },
    { name: 'main() cannot measure -> 2',
      run: () => main([], { readText: fx({ missing: ['package.json'] }), out: quiet, err: quiet }), expected: 2 },
    { name: 'main() unknown flag -> 2', run: () => main(['--bogus'], { readText: fx(), out: quiet, err: quiet }), expected: 2 },
  ];
  let failed = 0;
  for (const c of cases) {
    let got;
    try {
      got = await c.run();
    } catch (error) {
      got = 'threw: ' + error.message;
    }
    const ok = got === c.expected;
    if (!ok) failed += 1;
    console.log((ok ? 'ok  ' : 'FAIL') + '  ' + c.name + (ok ? '' : '  (expected ' + JSON.stringify(c.expected) + ', got ' + JSON.stringify(got) + ')'));
  }
  if (failed) {
    console.error('\nFAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return false;
  }
  console.log('\nPASS self-test -- ' + cases.length + ' cases, every rule proven in both directions.');
  return true;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** Owns the 0/1/2 exit contract. Collaborators injectable so the canary drives it. */
export async function main(argv = [], deps = {}) {
  const {
    readText = (p) => readFileSync(resolve(ROOT, p), 'utf8'),
    out = console.log,
    err = console.error,
  } = deps;
  const KNOWN = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN.includes(a));
  if (unknown.length) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1;
  const result = runCheck({ readText });
  for (const line of result.lines) (result.code === 0 ? out : err)(line);
  return result.code;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
