#!/usr/bin/env node
/**
 * check-workflow-log-secrets.mjs -- logs never echo secrets (contract 6.2(3), drill A22).
 *
 * findSecretLeaks(text) is a pure matcher for the known token shapes: GitHub (`ghp_`, `gho_`,
 * `ghs_` + 36, `github_pat_` + 82), Supabase (`sbp_` + 40 hex), Stripe (`sk_live_`, `sk_test_`,
 * `rk_live_` + 24 or more, `whsec_` + 32 or more). A hit reports the PREFIX, the line number and
 * the length -- never the value, so the report cannot itself become the leak. A value GitHub
 * masked (`***`) is not a hit, by construction.
 *
 * Modes:
 *   (default)       scan .github/workflows/*.yml for a literal secret-shaped value (offline;
 *                   this is the lint-chain link).
 *   --file <path>   scan one saved log file.
 *   --logs          the A22 runner: `gh run list --limit 20` then `gh run view <id> --log` for
 *                   each (needs GH_TOKEN with actions: read). NOT wired to a workflow in this
 *                   slice (docs/automation-foundations.md "next").
 *
 * Exit: 0 no hit, 1 a hit (contract violated), 2 could not measure (nothing read, a read or a
 * gh call failed).
 *
 *   node scripts/check-workflow-log-secrets.mjs [--file <log> | --logs]
 *   node scripts/check-workflow-log-secrets.mjs --self-test
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW_DIR = path.join(REPO_ROOT, '.github', 'workflows');
const B = '(?<![A-Za-z0-9_])';
export const SECRET_SHAPES = [
  { prefix: 'ghp_', re: new RegExp(B + 'ghp_[A-Za-z0-9]{36}(?![A-Za-z0-9])', 'g') },
  { prefix: 'gho_', re: new RegExp(B + 'gho_[A-Za-z0-9]{36}(?![A-Za-z0-9])', 'g') },
  { prefix: 'ghs_', re: new RegExp(B + 'ghs_[A-Za-z0-9]{36}(?![A-Za-z0-9])', 'g') },
  { prefix: 'github_pat_', re: new RegExp(B + 'github_pat_[A-Za-z0-9_]{82}(?![A-Za-z0-9_])', 'g') },
  { prefix: 'sbp_', re: new RegExp(B + 'sbp_[a-f0-9]{40}(?![a-f0-9])', 'g') },
  { prefix: 'sk_live_', re: new RegExp(B + 'sk_live_[A-Za-z0-9]{24,}', 'g') },
  { prefix: 'sk_test_', re: new RegExp(B + 'sk_test_[A-Za-z0-9]{24,}', 'g') },
  { prefix: 'rk_live_', re: new RegExp(B + 'rk_live_[A-Za-z0-9]{24,}', 'g') },
  { prefix: 'whsec_', re: new RegExp(B + 'whsec_[A-Za-z0-9+/=]{32,}', 'g') },
];

/** -> [{ prefix, line, length }], never the matched value. */
export function findSecretLeaks(text) {
  const hits = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const s of SECRET_SHAPES) {
      for (const m of lines[i].matchAll(s.re)) hits.push({ prefix: s.prefix, line: i + 1, length: m[0].length });
    }
  }
  return hits;
}

function defaultSources() {
  return readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f)).sort().map((f) => ({ label: '.github/workflows/' + f, read: () => readFileSync(path.join(WORKFLOW_DIR, f), 'utf8') }));
}

function ghRunSources(gh) {
  const list = JSON.parse(gh(['run', 'list', '--limit', '20', '--json', 'databaseId']));
  if (!Array.isArray(list) || list.length === 0) throw new Error('gh run list returned no runs');
  return list.map((r) => ({ label: 'run ' + r.databaseId, read: () => gh(['run', 'view', String(r.databaseId), '--log']) }));
}

export async function main(argv = [], env = process.env, log = console, deps = {}) {
  if (argv.includes('--self-test')) return (await selfTest(log)) ? 0 : 1;
  const gh = deps.gh || ((args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }));
  let sources;
  try {
    const fi = argv.indexOf('--file');
    if (fi >= 0) {
      const p = argv[fi + 1];
      if (!p) throw new Error('--file needs a path');
      const readText = deps.readText || ((q) => readFileSync(q, 'utf8'));
      sources = [{ label: p, read: () => readText(p) }];
    } else if (argv.includes('--logs')) {
      sources = ghRunSources(gh);
    } else {
      sources = deps.sources || defaultSources();
    }
  } catch (e) {
    log.error('workflow-log-secrets: CANNOT RUN -- ' + String(e.message).split('\n')[0]);
    return 2;
  }
  if (!sources.length) {
    log.error('workflow-log-secrets: CANNOT RUN -- nothing to scan');
    return 2;
  }
  let total = 0;
  for (const src of sources) {
    let text;
    try {
      text = src.read();
    } catch (e) {
      log.error('workflow-log-secrets: CANNOT RUN -- reading ' + src.label + ' failed: ' + String(e.message).split('\n')[0]);
      return 2;
    }
    for (const h of findSecretLeaks(text)) {
      total++;
      log.error(`workflow-log-secrets: LEAK -- ${src.label} line ${h.line}: a ${h.prefix} value (${h.length} chars) appears unmasked`);
    }
  }
  if (total) {
    log.error(`workflow-log-secrets: FAIL -- ${total} secret-shaped value(s). Rotate the credential, then remove the echo.`);
    return 1;
  }
  log.log(`workflow-log-secrets: OK -- ${sources.length} source(s) scanned, no secret-shaped value.`);
  return 0;
}

async function selfTest(log) {
  const quiet = { log() {}, error() {} };
  // Built by concatenation: no secret-shaped literal sits in this source.
  const dummy = 'gh' + 'p_' + 'X7'.repeat(18);
  const src = (t) => ({ sources: [{ label: 'fixture', read: () => t }] });
  // Exit-code owner (main) driven end to end, each branch pinned (R5).
  const cases = [
    ['clean text (0)', await main([], {}, quiet, src('echo ok\ntoken=***')), 0],
    ['dummy echo caught (1)', await main([], {}, quiet, src('echo ' + dummy)), 1],
    ['--file leak (1)', await main(['--file', 'x.log'], {}, quiet, { readText: () => 'a\n' + dummy }), 1],
    ['--file unreadable (2)', await main(['--file', 'x.log'], {}, quiet, { readText: () => { throw new Error('ENOENT'); } }), 2],
    ['--file without a path (2)', await main(['--file'], {}, quiet), 2],
    ['--logs gh failure (2)', await main(['--logs'], {}, quiet, { gh: () => { throw new Error('gh: not authenticated'); } }), 2],
    ['--logs no runs (2)', await main(['--logs'], {}, quiet, { gh: () => '[]' }), 2],
    ['--logs leak in a run log (1)', await main(['--logs'], {}, quiet, { gh: (a) => (a[1] === 'list' ? '[{"databaseId":1}]' : 'x ' + dummy) }), 1],
    ['nothing to scan (2)', await main([], {}, quiet, { sources: [] }), 2],
  ];
  cases.push(['hit carries no value', JSON.stringify(findSecretLeaks(dummy)).includes(dummy), false]);
  cases.push(['short tail is not a hit', findSecretLeaks('gh' + 'p_abc').length, 0]);
  let failed = 0;
  for (const [name, got, want] of cases) {
    if (got !== want) {
      failed++;
      log.error('FAIL ' + name + ': expected ' + want + ', got ' + got);
    }
  }
  if (failed) {
    log.error('FAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return false;
  }
  log.log('PASS self-test -- ' + cases.length + ' cases, every exit code proven.');
  return true;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
