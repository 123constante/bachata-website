#!/usr/bin/env node
// scripts/check-required-jobs.mjs -- drill A17b (slice 2, docs/automation-foundations.md): the
// required-jobs file can never name a PHANTOM. Every name in .github/automation/required-jobs.json
// must resolve to something the workflows really produce:
//   - pr_head and conditional: a job CHECK-RUN name of a workflow that has a `pull_request` or
//     `pull_request_target` trigger (a PR-head job that only a push workflow makes never exists at
//     a PR head, so the lane would never merge);
//   - post_merge_audits: a workflow `name:` (these run on push to main, never at a PR head).
//
// THE CHECK-RUN NAME RULE (the one GitHub uses, and the one written in the doc):
//   - a job with `name:` -> that name, with every `${{ matrix.<key> }}` substituted per matrix leg;
//   - a job with no `name:` and no matrix -> the job id;
//   - a job with no `name:` and a matrix -> `<id> (<v1>, <v2>, ...)` per leg, the leg's values in
//     key order (axes in declared order, then keys an `include` entry adds).
//   Matrix legs are EXPANDED (axes product, `exclude` removed, `include` merged or appended). A
//   matrix whose values are an expression (`${{ fromJSON(...) }}`) cannot be expanded here: that
//   job then resolves any name of the form `<id> (...)` / its name template, and the check says so.
//
// Exit: 0 every name resolves / 1 a phantom (named) / 2 an input cannot be read or parsed, or an
// unknown flag.
//
//   node scripts/check-required-jobs.mjs              # the check
//   node scripts/check-required-jobs.mjs --self-test  # canary
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { isEntryPoint } from './lib/entry-point.mjs';
import { parseRequiredJobs, REQUIRED_JOBS_PATH } from './lib/required-jobs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_DIR = '.github/workflows';
const requireFromHere = createRequire(import.meta.url);
const parseYaml = (text) => requireFromHere('yaml').parse(text);
const EXPR = /\$\{\{/;

/** Matrix legs as ordered objects; null when a value is an expression we cannot expand. */
export function matrixLegs(matrix) {
  if (matrix == null) return [];
  if (typeof matrix !== 'object' || Array.isArray(matrix)) return null;
  const axes = Object.entries(matrix).filter(([k]) => k !== 'include' && k !== 'exclude');
  if (axes.some(([, v]) => !Array.isArray(v))) return null;
  let legs = [{}];
  for (const [k, vals] of axes) legs = legs.flatMap((leg) => vals.map((v) => ({ ...leg, [k]: v })));
  if (!axes.length) legs = [];
  const sub = (leg, part) => Object.entries(part).every(([k, v]) => leg[k] === v);
  if (matrix.exclude != null) {
    if (!Array.isArray(matrix.exclude)) return null;
    legs = legs.filter((leg) => !matrix.exclude.some((x) => x && sub(leg, x)));
  }
  if (matrix.include != null) {
    if (!Array.isArray(matrix.include)) return null;
    const axisKeys = new Set(axes.map(([k]) => k));
    for (const inc of matrix.include) {
      if (!inc || typeof inc !== 'object') return null;
      const shared = Object.fromEntries(Object.entries(inc).filter(([k]) => axisKeys.has(k)));
      const extendsSome = Object.keys(inc).some((k) => !axisKeys.has(k)) && legs.some((leg) => sub(leg, shared));
      const original = legs.filter((leg) => sub(leg, shared));
      if (axes.length && extendsSome && original.length) for (const leg of original) Object.assign(leg, inc);
      else legs.push({ ...inc });
    }
  }
  const vals = legs.flatMap((leg) => Object.values(leg));
  if (vals.some((v) => typeof v === 'object' || EXPR.test(String(v)))) return null;
  return legs;
}

/** Every check-run name one job produces. Strings may carry a trailing `*` (template, see header). */
export function jobCheckRunNames(id, job) {
  const j = job || {};
  const legs = matrixLegs(j.strategy && j.strategy.matrix);
  const named = typeof j.name === 'string' && j.name.trim() ? j.name : null;
  if (legs === null) return [named ? `${named.replace(/\$\{\{[^}]*\}\}/g, '*')}` : `${id} (*)`];
  if (!legs.length) return [named ?? String(id)];
  if (named) return legs.map((leg) => named.replace(/\$\{\{\s*matrix\.([\w-]+)\s*\}\}/g, (_m, k) => String(leg[k] ?? '')));
  return legs.map((leg) => `${id} (${Object.values(leg).map(String).join(', ')})`);
}

const triggers = (wf) => {
  const on = wf.on ?? wf[true];
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.map(String);
  return on && typeof on === 'object' ? Object.keys(on) : [];
};
const matchName = (pattern, name) => {
  if (!pattern.includes('*')) return pattern === name;
  const re = new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+')}$`);
  return re.test(name);
};

/** Pure: { phantoms: [name], checked, notes: [] } over parsed required jobs and { file: yamlText }. */
export function resolveRequiredJobs(required, workflows) {
  const prJobs = [];
  const anyJobs = [];
  const workflowNames = [];
  const notes = [];
  for (const [file, text] of Object.entries(workflows)) {
    let wf;
    try { wf = parseYaml(text); } catch (e) { throw new Error(`${file}: YAML will not parse (${e.message})`); }
    if (!wf || typeof wf !== 'object') throw new Error(`${file}: not a workflow`);
    if (typeof wf.name === 'string') workflowNames.push(wf.name);
    const onPr = triggers(wf).some((t) => t === 'pull_request' || t === 'pull_request_target');
    for (const [id, job] of Object.entries(wf.jobs || {})) {
      for (const n of jobCheckRunNames(id, job)) {
        if (n.includes('*')) notes.push(`${file} job ${id}: matrix not expandable, name template ${n}`);
        anyJobs.push(n);
        if (onPr) prJobs.push(n);
      }
    }
  }
  const phantoms = [];
  for (const n of [...required.pr_head, ...required.conditional.map((c) => c.name)]) {
    if (!prJobs.some((p) => matchName(p, n))) phantoms.push(n);
  }
  for (const n of required.post_merge_audits) if (!workflowNames.includes(n)) phantoms.push(n);
  return { phantoms, checked: required.pr_head.length + required.conditional.length + required.post_merge_audits.length, notes, jobs: anyJobs.length };
}

function readInputs() {
  const requiredText = readFileSync(join(ROOT, REQUIRED_JOBS_PATH), 'utf8');
  const workflows = {};
  for (const f of readdirSync(join(ROOT, WORKFLOW_DIR))) {
    if (/\.ya?ml$/.test(f)) workflows[f] = readFileSync(join(ROOT, WORKFLOW_DIR, f), 'utf8');
  }
  if (!Object.keys(workflows).length) throw new Error(`no workflow files under ${WORKFLOW_DIR}`);
  return { requiredText, workflows };
}

// --- canary -----------------------------------------------------------------
const WF_PR = "name: CI\non:\n  pull_request:\njobs:\n  lint:\n    runs-on: x\n  unit:\n    strategy:\n      matrix:\n        include:\n          - tz: A\n            scope: full\n          - tz: B\n            scope: part\n  named:\n    name: Build ${{ matrix.os }}\n    strategy:\n      matrix:\n        os: [l, w]\n";
const WF_PUSH = "name: Audit\non:\n  push:\n    branches: [main]\njobs:\n  audit:\n    runs-on: x\n";
const FILE = (o = {}) => JSON.stringify({ version: 1, pr_head: ['lint', 'unit (A, full)'], conditional: [{ name: 'Build w', when: 'paths' }], post_merge_audits: ['Audit'], ...o });
const input = (o = {}) => ({ requiredText: FILE(), workflows: { 'ci.yml': WF_PR, 'audit.yml': WF_PUSH }, ...o });

async function selfTest() {
  const drive = async (read, argv = []) => {
    const said = [];
    const code = await main(argv, { read, out: (l) => said.push(l), err: (l) => said.push(l) });
    return { code, said: said.join('\n') };
  };
  const cases = [
    ['every name resolves -> 0', () => drive(() => input()), 0, '4 name(s) checked, 0 phantom'],
    ['CANARY: a deliberately phantom pr_head job -> 1', () => drive(() => input({ requiredText: FILE({ pr_head: ['lint', 'ghost'] }) })), 1, 'phantom required job: ghost'],
    ['a matrix leg that does not exist -> 1', () => drive(() => input({ requiredText: FILE({ pr_head: ['unit (A, part)'] }) })), 1, 'phantom required job: unit (A, part)'],
    ['a pr_head job only a push workflow makes -> 1', () => drive(() => input({ requiredText: FILE({ pr_head: ['audit'] }) })), 1, 'phantom required job: audit'],
    ['a phantom conditional job -> 1', () => drive(() => input({ requiredText: FILE({ conditional: [{ name: 'Build mac', when: 'x' }] }) })), 1, 'phantom required job: Build mac'],
    ['a phantom post-merge workflow -> 1', () => drive(() => input({ requiredText: FILE({ post_merge_audits: ['Audit 2'] }) })), 1, 'phantom required job: Audit 2'],
    ['required file will not parse -> 2', () => drive(() => input({ requiredText: '{' })), 2, 'not JSON'],
    ['a workflow will not parse -> 2', () => drive(() => input({ workflows: { 'bad.yml': 'jobs: [\n' } })), 2, 'bad.yml: YAML will not parse'],
    ['inputs unreadable -> 2', () => drive(() => { throw new Error('ENOENT x'); }), 2, 'Cannot read inputs: ENOENT x'],
    ['unknown flag -> 2', () => drive(() => input(), ['--bogus']), 2, 'Unknown flag(s): --bogus'],
  ];
  let failed = 0;
  for (const [name, fn, want, says] of cases) {
    const { code, said } = await fn();
    const ok = code === want && said.includes(says);
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (got ${code})${ok ? '' : `\n     wanted output containing: ${says}\n     got: ${said}`}`);
  }
  if (failed) console.error(`FAIL self-test -- ${failed} of ${cases.length} case(s).`);
  else console.log(`PASS self-test -- ${cases.length} cases.`);
  return failed === 0;
}

/** CLI and the 0/1/2 exit contract; collaborators injected so the canary drives it. */
export async function main(argv = [], deps = {}) {
  const { read = readInputs, out = console.log, err = console.error } = deps;
  const unknown = argv.filter((a) => a !== '--self-test');
  if (unknown.length > 0) {
    err(`Unknown flag(s): ${unknown.join(', ')}. Known: --self-test`);
    return 2;
  }
  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1;
  let inputs;
  try {
    inputs = (read || readInputs)();
  } catch (error) {
    err(`Cannot read inputs: ${error.message}`);
    return 2;
  }
  let result;
  try {
    result = resolveRequiredJobs(parseRequiredJobs(inputs.requiredText), inputs.workflows);
  } catch (error) {
    err(`Cannot parse an input (exit 2: the guard could not run): ${error.message}`);
    return 2;
  }
  for (const n of result.notes) out(`note: ${n}`);
  for (const p of result.phantoms) err(`phantom required job: ${p}`);
  const line = `${REQUIRED_JOBS_PATH}: ${result.checked} name(s) checked, ${result.phantoms.length} phantom`;
  if (result.phantoms.length) {
    err(line);
    err('Fix: every pr_head/conditional name must be a check-run of a pull_request workflow job (job name, or id plus matrix leg); every post_merge_audits name must be a workflow name. See docs/automation-foundations.md.');
    return 1;
  }
  out(line);
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
