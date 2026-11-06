#!/usr/bin/env node
// scripts/check-ruleset-vs-required-jobs.mjs -- slice 2 (docs/automation-foundations.md, contract
// section 9 item 3): the `main` ruleset's REQUIRED status-check contexts must equal the pr_head
// list of .github/automation/required-jobs.json.
//
// Why it matters: bot-automerge.yml and dependabot-automerge.yml only ARM GitHub auto-merge
// (`gh pr merge --auto`); GitHub merges later, when the RULESET's required checks pass. There is no
// merge-time code on those two paths, so for them the ruleset, not the code, is the required-checks
// gate, and a job in the file but not in the ruleset is NOT enforced there (the autopilot lane
// re-reads the full list itself). This check is what keeps the two lists equal.
//
// NOT WIRED to a scheduled job in this slice: reading a ruleset needs administration read, which
// GITHUB_TOKEN cannot have. The wiring is an owner-gated item (slice 2b). Run it by hand with a
// ruleset JSON saved from `GET /repos/{owner}/{repo}/rulesets/{id}` (or the array from
// `GET /repos/{owner}/{repo}/rules/branches/main`).
//
// Exit: 0 equal / 1 a difference (each named) / 2 no --ruleset-json, an unreadable or unparsable
// input, a ruleset with no required_status_checks rule, or an unknown flag.
//
//   node scripts/check-ruleset-vs-required-jobs.mjs --ruleset-json <file>
//   node scripts/check-ruleset-vs-required-jobs.mjs --self-test
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import { parseRequiredJobs, REQUIRED_JOBS_PATH } from './lib/required-jobs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The required status-check contexts of a ruleset object, or of a rules array. Throws when none. */
export function rulesetContexts(ruleset) {
  const rules = Array.isArray(ruleset) ? ruleset : ruleset && Array.isArray(ruleset.rules) ? ruleset.rules : null;
  if (!rules) throw new Error('ruleset has no rules list');
  const rsc = rules.filter((r) => r && r.type === 'required_status_checks');
  if (!rsc.length) throw new Error('ruleset has no required_status_checks rule (it would enforce no check at all)');
  const out = [];
  for (const r of rsc) {
    const list = r.parameters && r.parameters.required_status_checks;
    if (!Array.isArray(list)) throw new Error('required_status_checks rule without a list');
    for (const c of list) {
      if (!c || typeof c.context !== 'string' || !c.context) throw new Error('a required status check without a context');
      if (!out.includes(c.context)) out.push(c.context);
    }
  }
  return out;
}

/** Pure: { ok, notInRuleset: [pr_head names], notInFile: [ruleset contexts] }. */
export function compareRuleset(rulesetJson, requiredJobs) {
  const ctx = rulesetContexts(rulesetJson);
  const head = requiredJobs.pr_head;
  const notInRuleset = head.filter((n) => !ctx.includes(n));
  const notInFile = ctx.filter((c) => !head.includes(c));
  return Object.defineProperty({ ok: !notInRuleset.length && !notInFile.length, notInRuleset, notInFile }, 'contexts', { value: ctx.length, enumerable: false });
}

// --- canary -----------------------------------------------------------------
const REQ = JSON.stringify({ version: 1, pr_head: ['a', 'b (x, y)'], conditional: [], post_merge_audits: [] });
const RS = (contexts, extra = []) => JSON.stringify({ id: 1, rules: [{ type: 'deletion' }, { type: 'required_status_checks', parameters: { required_status_checks: contexts.map((context) => ({ context, integration_id: 15368 })) } }, ...extra] });

async function selfTest() {
  const drive = async (argv, files) => {
    const said = [];
    const code = await main(argv, { out: (l) => said.push(l), err: (l) => said.push(l), requiredText: REQ, readFile: (p) => { if (!(p in files)) throw new Error(`ENOENT ${p}`); return files[p]; } });
    return { code, said: said.join('\n') };
  };
  const cases = [
    ['equal lists -> 0', () => drive(['--ruleset-json', 'r'], { r: RS(['b (x, y)', 'a']) }), 0, '2 context(s), 0 difference'],
    ['rules array form -> 0', () => drive(['--ruleset-json', 'r'], { r: JSON.stringify(JSON.parse(RS(['a', 'b (x, y)'])).rules) }), 0, '0 difference'],
    ['CANARY: a file job missing from the ruleset -> 1', () => drive(['--ruleset-json', 'r'], { r: RS(['a']) }), 1, 'in required-jobs.json pr_head but NOT in the ruleset: b (x, y)'],
    ['a ruleset context missing from the file -> 1', () => drive(['--ruleset-json', 'r'], { r: RS(['a', 'b (x, y)', 'owner-approval']) }), 1, 'in the ruleset but NOT in required-jobs.json pr_head: owner-approval'],
    ['no required_status_checks rule -> 2', () => drive(['--ruleset-json', 'r'], { r: JSON.stringify({ rules: [{ type: 'deletion' }] }) }), 2, 'no required_status_checks rule'],
    ['ruleset will not parse -> 2', () => drive(['--ruleset-json', 'r'], { r: '{' }), 2, 'Cannot parse an input'],
    ['ruleset file unreadable -> 2', () => drive(['--ruleset-json', 'nope'], {}), 2, 'Cannot read inputs: ENOENT nope'],
    ['no --ruleset-json -> 2', () => drive([], {}), 2, 'need --ruleset-json <file>'],
    ['unknown flag -> 2', () => drive(['--bogus'], {}), 2, 'Unknown flag(s): --bogus'],
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
  const { out = console.log, err = console.error, readFile = (p) => readFileSync(p, 'utf8') } = deps;
  if (argv.includes('--self-test') && argv.length === 1) return (await selfTest()) ? 0 : 1;
  const i = argv.indexOf('--ruleset-json');
  const unknown = argv.filter((a, k) => !(a === '--ruleset-json' || (i >= 0 && k === i + 1)));
  if (unknown.length) {
    err(`Unknown flag(s): ${unknown.join(', ')}. Known: --ruleset-json <file>, --self-test`);
    return 2;
  }
  if (i < 0 || !argv[i + 1]) {
    err('need --ruleset-json <file> (a ruleset saved from the API; this check is not wired to a schedule, see the header)');
    return 2;
  }
  let rulesetText;
  let requiredText;
  try {
    rulesetText = readFile(argv[i + 1]);
    requiredText = deps.requiredText ?? readFile(join(ROOT, REQUIRED_JOBS_PATH));
  } catch (error) {
    err(`Cannot read inputs: ${error.message}`);
    return 2;
  }
  let result;
  try {
    result = compareRuleset(JSON.parse(rulesetText), parseRequiredJobs(requiredText));
  } catch (error) {
    err(`Cannot parse an input (exit 2: the guard could not run): ${error.message}`);
    return 2;
  }
  for (const n of result.notInRuleset) err(`in required-jobs.json pr_head but NOT in the ruleset: ${n}`);
  for (const n of result.notInFile) err(`in the ruleset but NOT in required-jobs.json pr_head: ${n}`);
  const diffs = result.notInRuleset.length + result.notInFile.length;
  const line = `ruleset vs ${REQUIRED_JOBS_PATH}: ${result.contexts} context(s), ${diffs} difference(s)`;
  if (!result.ok) {
    err(line);
    err('Fix: the owner edits the ruleset (or the file, through an owner-merged guard change) until the two lists are equal.');
    return 1;
  }
  out(line);
  return 0;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
