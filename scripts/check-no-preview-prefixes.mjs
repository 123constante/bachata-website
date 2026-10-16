#!/usr/bin/env node
// scripts/check-no-preview-prefixes.mjs -- the no-preview branch prefixes have
// ONE source of truth: DIFF_RULE_PREFIXES + ALWAYS_SKIP_PREFIXES in
// scripts/vercel-ignore-build.sh (the Vercel ignoreCommand). A branch under
// them never gets a PR preview, so every PREVIEW JOB must exclude exactly that
// union in its `if:` with `!startsWith(github.head_ref, '<prefix>')`. Drift
// either way is a bug:
//   - a prefix the script skips but a job does not exclude -> that job polls
//     600 s for a preview that will never exist, then goes red;
//   - a prefix a job excludes but the script builds -> a preview is built and
//     paid for (Vercel Hobby: ~100 deploys / 24 h) and never checked.
// GitHub `if:` expressions are evaluated before checkout, so the workflows
// cannot read the list at runtime; this guard is what keeps the copies equal.
//
// A PREVIEW JOB is found by what it RUNS, not by its `if:` (a job that lost its
// exclusion entirely must still be found): any step whose `run:` names a
// PREVIEW SCRIPT, or an npm alias (package.json "scripts") whose command names
// one. The preview scripts are DERIVED, not listed: every scripts/**/*.mjs that
// IMPORTS resolvePreviewUrl, plus (to a fixpoint) every one that imports such
// a file, so a sixth preview check needs no edit here. Not covered: a job that
// reaches the probe through a reusable workflow (`uses:`), a .sh, or `node -e`.
// Every workflow is parsed as YAML, so `if: >-` and other multi-line forms are
// read like single-line ones. Jobs that are not preview jobs are ignored,
// whatever head_ref exclusions they carry.
//
// It also pins SKIP_PREVIEW_TAG: the literal in the ignore script must equal
// the one scripts/lib/previewProbe.mjs fails fast on. And it pins vercel.json
// `git.deploymentEnabled`: its `false` keys must equal ALWAYS_SKIP_PREFIXES,
// each plus `*` (an ignored build still counts toward the Hobby deployment
// limit, so those branches are turned off at the source; the script's list
// stays as defence in depth).
//
// Exit: 0 every list matches / 1 drift (or a required workflow has no preview
// job) / 2 cannot read or parse an input, or an unknown flag.
//
//   node scripts/check-no-preview-prefixes.mjs              # the check
//   node scripts/check-no-preview-prefixes.mjs --self-test  # canary
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { isEntryPoint } from './lib/entry-point.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = 'scripts/vercel-ignore-build.sh';
const PROBE_PATH = 'scripts/lib/previewProbe.mjs';
const WORKFLOW_DIR = '.github/workflows';
const VERCEL_PATH = 'vercel.json';
const PACKAGE_PATH = 'package.json';
const GUARD_PATH = 'scripts/check-no-preview-prefixes.mjs';

/**
 * The preview scripts and their npm aliases, derived from the sources: every
 * .mjs under scripts/ (test dirs skipped) that IMPORTS resolvePreviewUrl (the
 * probe excepted), closed over "imports one of them"; then every package.json
 * alias whose command names one of those files or runs another such alias.
 * This guard is excepted too (its canary holds such import lines as strings).
 * Returns { files, aliases }.
 */
const IMPORTS_PROBE = /import\s*\{[^}]*\bresolvePreviewUrl\b[^}]*\}\s*from/;
const SPECIFIERS = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
const base = (f) => f.slice(f.lastIndexOf('/') + 1);

export function previewScripts(scriptFiles, packageText) {
  const own = Object.entries(scriptFiles).filter(
    ([f]) => f !== PROBE_PATH && f !== GUARD_PATH && !/(^|\/)__tests__\//.test(f),
  );
  const files = new Set(own.filter(([, text]) => IMPORTS_PROBE.test(text)).map(([f]) => f));
  for (let grew = true; grew; ) {
    grew = false;
    const bases = new Set([...files].map(base));
    for (const [f, text] of own) {
      if (files.has(f)) continue;
      if ([...text.matchAll(SPECIFIERS)].some((m) => bases.has(base(m[1])))) {
        files.add(f);
        grew = true;
      }
    }
  }
  let scripts;
  try {
    scripts = JSON.parse(packageText).scripts ?? {};
  } catch (error) {
    throw new Error(`${PACKAGE_PATH}: will not parse: ${error.message}`);
  }
  const fileRe = fileMatcher([...files]);
  const aliases = new Set();
  for (let grew = true; grew; ) {
    grew = false;
    const aliasRe = aliasMatcher([...aliases]);
    for (const [name, cmd] of Object.entries(scripts)) {
      if (aliases.has(name) || typeof cmd !== 'string') continue;
      if (fileRe.test(cmd) || aliasRe.test(cmd)) {
        aliases.add(name);
        grew = true;
      }
    }
  }
  return { files: [...files].sort(), aliases: [...aliases].sort() };
}

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NEVER = /(?!)/;
// A file by its basename (any directory, `./x.mjs` or `scripts/x.mjs` alike).
const fileMatcher = (files) =>
  files.length ? new RegExp(`(?<![\\w.-])(?:${files.map((f) => escapeRe(base(f))).join('|')})(?![\\w.-])`) : NEVER;
// `npm run [flags] <alias>` (e.g. `npm run -s x`, `npm run --silent x`), whole name only.
const aliasMatcher = (aliases) =>
  aliases.length
    ? new RegExp(`\\bnpm\\s+(?:run|run-script)\\s+(?:-{1,2}[\\w-]+\\s+)*(?:${aliases.map(escapeRe).join('|')})(?![\\w:.-])`)
    : NEVER;

/** A predicate over a step's `run:` text: does it run a preview script? */
export function previewRunMatcher({ files, aliases }) {
  const f = fileMatcher(files);
  const a = aliasMatcher(aliases);
  return (run) => f.test(run) || a.test(run);
}

// The floor (no silent green on an empty scan): each of these workflows has a
// preview job today. One where no preview job is found is drift, not "nothing
// to compare".
export const REQUIRED_WORKFLOWS = [
  'perf-budget.yml',
  'synthetic-ssr-monitor.yml',
  'seo-check.yml',
  'og-image-check.yml',
];

// Lazy, so a checkout without node_modules exits 2 ("could not run"), never 1.
const requireFromHere = createRequire(import.meta.url);
function parseYaml(text) {
  return requireFromHere('yaml').parse(text);
}

function shellVar(text, name, path) {
  const m = new RegExp(`^${name}='([^']*)'\\s*$`, 'm').exec(text);
  if (!m) throw new Error(`${path}: no ${name}='...' line`);
  return m[1];
}

/** One of the script's prefix lists, or throws when it is missing or empty. */
function scriptList(text, name) {
  const list = shellVar(text, name, SCRIPT_PATH).split(/\s+/).filter(Boolean);
  if (list.length === 0) throw new Error(`${SCRIPT_PATH}: ${name} is empty`);
  return list;
}

/** The union of the script's two prefix lists, or throws when either is missing. */
export function parseScriptPrefixes(text) {
  return [...scriptList(text, 'DIFF_RULE_PREFIXES'), ...scriptList(text, 'ALWAYS_SKIP_PREFIXES')];
}

const STARTS = /!startsWith\(\s*github\.head_ref\s*,\s*'([^']*)'\s*\)/g;

/** Every preview job in one parsed workflow: [{job, prefixes}]. */
export function previewJobs(doc, isPreviewRun) {
  const out = [];
  for (const [job, def] of Object.entries(doc?.jobs ?? {})) {
    const steps = Array.isArray(def?.steps) ? def.steps : [];
    if (!steps.some((s) => typeof s?.run === 'string' && isPreviewRun(s.run))) continue;
    const cond = typeof def.if === 'string' ? def.if : '';
    out.push({ job, prefixes: [...cond.matchAll(STARTS)].map((m) => m[1]) });
  }
  return out;
}

const sameSet = (a, b) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');

/** Pure verdict over already-read inputs. Returns { code, lines }; throws on a parse failure. */
export function runCheck({ scriptText, probeText, workflows, vercelText, packageText, scriptFiles }) {
  const lines = [];
  const want = parseScriptPrefixes(scriptText);
  lines.push(`source of truth (${SCRIPT_PATH}): ${want.join(' ')}`);
  let drift = 0;

  // vercel.json git.deploymentEnabled: false keys == ALWAYS_SKIP_PREFIXES + '*'.
  let vercel;
  try {
    vercel = JSON.parse(vercelText);
  } catch (error) {
    throw new Error(`${VERCEL_PATH}: will not parse: ${error.message}`);
  }
  // Vercel's `*` does not cross `/`: `claude/review-a/b` still deploys (the
  // script then skips its build). Keep these branch names slash-free after the prefix.
  const wantOff = scriptList(scriptText, 'ALWAYS_SKIP_PREFIXES').map((p) => `${p}*`);
  const enabled = vercel?.git?.deploymentEnabled;
  const off = enabled && typeof enabled === 'object' ? Object.keys(enabled).filter((k) => enabled[k] === false) : [];
  if (!sameSet(off, wantOff)) {
    const missing = wantOff.filter((k) => !off.includes(k));
    const extra = off.filter((k) => !wantOff.includes(k));
    lines.push(`DRIFT ${VERCEL_PATH} git.deploymentEnabled false keys: missing [${missing.join(' ')}] extra [${extra.join(' ')}]`);
    drift += 1;
  }

  const scripts = previewScripts(scriptFiles, packageText);
  lines.push(`preview scripts: ${scripts.files.join(' ')}; npm aliases: ${scripts.aliases.join(' ')}`);
  const isPreviewRun = previewRunMatcher(scripts);

  const tag = shellVar(scriptText, 'SKIP_PREVIEW_TAG', SCRIPT_PATH);
  const probeTag = /export const SKIP_PREVIEW_TAG = '([^']*)';/.exec(probeText)?.[1];
  if (probeTag === undefined) throw new Error(`${PROBE_PATH}: no SKIP_PREVIEW_TAG export`);
  if (probeTag !== tag) {
    lines.push(`DRIFT SKIP_PREVIEW_TAG: ${SCRIPT_PATH} '${tag}' vs ${PROBE_PATH} '${probeTag}'`);
    drift += 1;
  }

  let compared = 0;
  for (const [file, text] of Object.entries(workflows)) {
    let doc;
    try {
      doc = parseYaml(text);
    } catch (error) {
      throw new Error(`${WORKFLOW_DIR}/${file}: YAML will not parse: ${error.message}`);
    }
    const jobs = previewJobs(doc, isPreviewRun);
    if (jobs.length === 0 && REQUIRED_WORKFLOWS.includes(file)) {
      lines.push(`DRIFT ${file}: no preview job found (nothing runs a preview script)`);
      drift += 1;
    }
    for (const { job, prefixes } of jobs) {
      compared += 1;
      if (sameSet(prefixes, want)) continue;
      const missing = want.filter((p) => !prefixes.includes(p));
      const extra = prefixes.filter((p) => !want.includes(p));
      lines.push(`DRIFT ${WORKFLOW_DIR}/${file} job ${job}: missing [${missing.join(' ')}] extra [${extra.join(' ')}]`);
      drift += 1;
    }
  }
  for (const req of REQUIRED_WORKFLOWS) {
    if (!(req in workflows)) {
      lines.push(`DRIFT ${req}: required workflow not found`);
      drift += 1;
    }
  }
  lines.push(`${compared} preview job(s) compared, ${drift} drift(s)`);
  return { code: drift === 0 ? 0 : 1, lines };
}

function readInputs() {
  const scriptText = readFileSync(join(ROOT, SCRIPT_PATH), 'utf8');
  const probeText = readFileSync(join(ROOT, PROBE_PATH), 'utf8');
  const workflows = {};
  for (const f of readdirSync(join(ROOT, WORKFLOW_DIR))) {
    if (/\.ya?ml$/.test(f)) workflows[f] = readFileSync(join(ROOT, WORKFLOW_DIR, f), 'utf8');
  }
  const vercelText = readFileSync(join(ROOT, VERCEL_PATH), 'utf8');
  const packageText = readFileSync(join(ROOT, PACKAGE_PATH), 'utf8');
  const scriptFiles = {};
  for (const e of readdirSync(join(ROOT, 'scripts'), { recursive: true })) {
    const rel = `scripts/${String(e).split('\\').join('/')}`;
    if (rel.endsWith('.mjs')) scriptFiles[rel] = readFileSync(join(ROOT, rel), 'utf8');
  }
  return { scriptText, probeText, workflows, vercelText, packageText, scriptFiles };
}

// --- canary -----------------------------------------------------------------
const S_OK =
  "x\nDIFF_RULE_PREFIXES='bot/ dependabot/'\nALWAYS_SKIP_PREFIXES='arc/briefs- claude/done- claude/review-'\n" +
  "SKIP_PREVIEW_TAG='[skip preview]'\n";
const P_OK = "export const SKIP_PREVIEW_TAG = '[skip preview]';\n";
const ALL = ['bot/', 'dependabot/', 'arc/briefs-', 'claude/done-', 'claude/review-'];
const cond = (ps) => ["github.event_name == 'pull_request'", ...ps.map((p) => `!startsWith(github.head_ref, '${p}')`)].join(' && ');
const WF = (ps, run = 'URL="$(node scripts/resolve-preview-url.mjs)"') =>
  `jobs:\n  a:\n    if: ${cond(ps)}\n    steps:\n      - run: echo hi\n      - run: ${JSON.stringify(run)}\n`;
const wfs = (override = {}) => ({
  ...Object.fromEntries(REQUIRED_WORKFLOWS.map((f) => [f, WF(ALL)])),
  'other.yml': "jobs:\n  b:\n    if: \"!startsWith(github.head_ref, 'dependabot/')\"\n    steps:\n      - run: npm test\n",
  ...override,
});
const V_OK = JSON.stringify({ git: { deploymentEnabled: { 'arc/briefs-*': false, 'claude/done-*': false, 'claude/review-*': false, 'x/*': true } } });
const vercel = (enabled) => JSON.stringify({ git: { deploymentEnabled: enabled } });
const SF_OK = {
  'scripts/resolve-preview-url.mjs': "import { resolvePreviewUrl } from './lib/previewProbe.mjs';\n",
  'scripts/check-lighthouse.mjs': "import { resolvePreviewUrl } from './lib/previewProbe.mjs';\n",
  'scripts/check-doc-weight.mjs': "import { resolvePreviewUrl } from './lib/previewProbe.mjs';\n",
  [PROBE_PATH]: 'export async function resolvePreviewUrl() {}\n',
  [GUARD_PATH]: '// resolvePreviewUrl\n',
  'scripts/mentions.mjs': '// calls resolvePreviewUrl? no: a comment. Also names check-lighthouse.mjs\n',
  'scripts/__tests__/fx.mjs': "import { resolvePreviewUrl } from '../lib/previewProbe.mjs';\n",
  'scripts/unrelated.mjs': 'export const x = 1;\n',
};
const PKG_OK = JSON.stringify({ scripts: { 'check:lighthouse': 'node scripts/check-lighthouse.mjs', 'check:doc-weight': 'node scripts/check-doc-weight.mjs', 'check:new': 'node scripts/new-preview-thing.mjs', test: 'vitest' } });
const input = (o = {}) => ({
  scriptText: S_OK, probeText: P_OK, workflows: wfs(), vercelText: V_OK, packageText: PKG_OK, scriptFiles: SF_OK, ...o,
});

async function selfTest() {
  // Each case pins the code AND which branch produced it (a substring of what
  // main() printed): several branches share a code.
  const drive = async (read, argv = []) => {
    const said = [];
    const code = await main(argv, { read, out: (l) => said.push(l), err: (l) => said.push(l) });
    return { code, said: said.join('\n') };
  };
  const cases = [
    ['all lists equal -> 0', () => drive(() => input()), 0, '4 preview job(s) compared, 0 drift'],
    ['order differs, same set -> 0', () => drive(() => input({ workflows: wfs({ 'seo-check.yml': WF([...ALL].reverse()) }) })), 0, '0 drift'],
    ['multi-line `if: >-` is read -> 0', () => drive(() => input({ workflows: wfs({ 'seo-check.yml': `jobs:\n  a:\n    if: >-\n      ${cond(ALL)}\n    steps:\n      - run: npm run check:lighthouse\n` }) })), 0, '0 drift'],
    ['a non-preview job with a partial exclusion is ignored -> 0', () => drive(() => input()), 0, '4 preview job(s)'],
    ['one workflow drops a prefix -> 1', () => drive(() => input({ workflows: wfs({ 'seo-check.yml': WF(ALL.slice(1)) }) })), 1, 'seo-check.yml job a: missing [bot/]'],
    ['one workflow adds a prefix -> 1', () => drive(() => input({ workflows: wfs({ 'og-image-check.yml': WF([...ALL, 'x/']) }) })), 1, 'extra [x/]'],
    ['second preview job in a workflow loses its exclusion -> 1', () => drive(() => input({ workflows: wfs({ 'perf-budget.yml': WF(ALL, 'npm run check:lighthouse') + `  b:\n    if: github.event_name == 'pull_request'\n    steps:\n      - run: npm run check:doc-weight\n` }) })), 1, 'perf-budget.yml job b: missing [bot/ dependabot/'],
    ['a preview job in an unrequired workflow drifts -> 1', () => drive(() => input({ workflows: wfs({ 'new.yml': WF(['bot/']) }) })), 1, 'new.yml job a'],
    ['script adds a prefix no workflow has -> 1', () => drive(() => input({ scriptText: S_OK.replace("claude/review-'", "claude/review- y/'") })), 1, 'missing [y/]'],
    ['required workflow has no preview job -> 1', () => drive(() => input({ workflows: wfs({ 'perf-budget.yml': 'jobs: {}\n' }) })), 1, 'perf-budget.yml: no preview job found'],
    ['required workflow missing -> 1', () => drive(() => { const w = wfs(); delete w['seo-check.yml']; return input({ workflows: w }); }), 1, 'seo-check.yml: required workflow not found'],
    ['vercel.json lacks an always-skip key -> 1', () => drive(() => input({ vercelText: vercel({ 'arc/briefs-*': false, 'claude/done-*': false }) })), 1, 'false keys: missing [claude/review-*] extra []'],
    ['vercel.json turns off an extra branch -> 1', () => drive(() => input({ vercelText: vercel({ 'arc/briefs-*': false, 'claude/done-*': false, 'claude/review-*': false, 'bot/*': false }) })), 1, 'extra [bot/*]'],
    ['vercel.json key set to true, not false -> 1', () => drive(() => input({ vercelText: vercel({ 'arc/briefs-*': true, 'claude/done-*': false, 'claude/review-*': false }) })), 1, 'missing [arc/briefs-*]'],
    ['vercel.json has no git key -> 1', () => drive(() => input({ vercelText: '{}' })), 1, 'missing [arc/briefs-* claude/done-* claude/review-*]'],
    ['new npm alias to a NEW preview script, job has no exclusions -> 1 (S2)', () => drive(() => input({ scriptFiles: { ...SF_OK, 'scripts/new-preview-thing.mjs': "import { resolvePreviewUrl } from './lib/previewProbe.mjs';\n" }, workflows: wfs({ 'new.yml': "jobs:\n  n:\n    steps:\n      - run: npm run check:new\n" }) })), 1, 'new.yml job n: missing'],
    ['a script importing a preview script is one too (fixpoint) -> 1', () => drive(() => input({ scriptFiles: { ...SF_OK, 'scripts/wrap.mjs': "import './check-lighthouse.mjs';\n" }, workflows: wfs({ 'new.yml': "jobs:\n  n:\n    steps:\n      - run: node scripts/wrap.mjs\n" }) })), 1, 'new.yml job n: missing'],
    ['`npm run -s <alias>` is still a preview run -> 1', () => drive(() => input({ workflows: wfs({ 'new.yml': "jobs:\n  n:\n    steps:\n      - run: npm run -s check:doc-weight\n" }) })), 1, 'new.yml job n: missing'],
    ['the script by basename (other working dir) is a preview run -> 1', () => drive(() => input({ workflows: wfs({ 'new.yml': "jobs:\n  n:\n    steps:\n      - run: node check-lighthouse.mjs\n" }) })), 1, 'new.yml job n: missing'],
    ['an alias that runs a preview alias is one too -> 1', () => drive(() => input({ packageText: JSON.stringify({ scripts: { ...JSON.parse(PKG_OK).scripts, 'perf:preview': 'npm run check:lighthouse && echo' } }), workflows: wfs({ 'new.yml': "jobs:\n  n:\n    steps:\n      - run: npm run perf:preview\n" }) })), 1, 'new.yml job n: missing'],
    ['a comment naming resolvePreviewUrl or a preview file is no preview script -> 0', () => drive(() => input({ workflows: wfs({ 'new.yml': "jobs:\n  n:\n    steps:\n      - run: node scripts/mentions.mjs && node scripts/__tests__/fx.mjs\n" }) })), 0, '0 drift'],
    ['an alias to a non-preview script is not a preview job -> 0', () => drive(() => input({ workflows: wfs({ 'new.yml': "jobs:\n  n:\n    steps:\n      - run: npm run check:new\n" }) })), 0, '0 drift'],
    ['skip tag differs between script and probe -> 1', () => drive(() => input({ probeText: "export const SKIP_PREVIEW_TAG = '[no preview]';\n" })), 1, 'DRIFT SKIP_PREVIEW_TAG'],
    ['script list line missing -> 2 (parse branch)', () => drive(() => input({ scriptText: 'nothing\n' })), 2, 'no DIFF_RULE_PREFIXES'],
    ['probe tag export missing -> 2 (parse branch)', () => drive(() => input({ probeText: '' })), 2, 'no SKIP_PREVIEW_TAG export'],
    ['vercel.json will not parse -> 2 (parse branch)', () => drive(() => input({ vercelText: '{' })), 2, 'vercel.json: will not parse'],
    ['package.json will not parse -> 2 (parse branch)', () => drive(() => input({ packageText: '{' })), 2, 'package.json: will not parse'],
    ['a workflow will not parse -> 2 (parse branch)', () => drive(() => input({ workflows: wfs({ 'bad.yml': 'jobs: [\n' }) })), 2, 'bad.yml: YAML will not parse'],
    ['inputs unreadable -> 2 (read branch)', () => drive(() => { throw new Error('ENOENT x'); }), 2, 'Cannot read inputs: ENOENT x'],
    ['unknown flag -> 2 (flag branch; inputs would pass)', () => drive(() => input(), ['--bogus']), 2, 'Unknown flag(s): --bogus'],
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
    inputs = read();
  } catch (error) {
    err(`Cannot read inputs: ${error.message}`);
    return 2;
  }
  let result;
  try {
    result = runCheck(inputs);
  } catch (error) {
    err(`Cannot parse an input (exit 2: the guard could not run): ${error.message}`);
    return 2;
  }
  for (const l of result.lines) (result.code === 0 ? out : err)(l);
  if (result.code !== 0) {
    err(`Fix: make every preview job's if: exclude exactly the prefixes in ${SCRIPT_PATH}, and ${VERCEL_PATH} git.deploymentEnabled turn off exactly its ALWAYS_SKIP_PREFIXES (each plus *).`);
  }
  return result.code;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
