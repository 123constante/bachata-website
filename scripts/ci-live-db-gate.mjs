#!/usr/bin/env node
/**
 * LIVE-DB GATE for pull_request CI -- decides whether a PR run may call the
 * PRODUCTION database.
 *
 * WHY THIS EXISTS. On 2026-10-04 prod Postgres (Micro compute) logged two
 * bursts of statement-timeout cancels (57014): 33 at 18:13-18:15Z and 35 at
 * 18:39-18:41Z. Each began the moment a full CI suite started -- main's
 * post-merge run for #517, then PR #520's run. db-contract-check fires dozens
 * of guard RPCs at once (lineup_health_* at 2-2.7s each, tracking health,
 * entry liveness, people public-read, ...) and the unit job's London leg runs
 * the live *.contract.test.ts suites on top. The DB saturated, cancelled the
 * public site's own SSR queries, and real visitors got HTTP 500 for ~3 minutes
 * each time. #520 changed ONE workflow file and could not have changed any DB
 * verdict: the sweep measured prod, not the PR.
 *
 * THE RULE. The live sweeps always run on push to main, on schedule and on
 * workflow_dispatch (this gate returns live=true for every event that is not
 * `pull_request`). On a pull_request they run only when the PR's diff touches
 * something DB-facing, by any of three rules below. Anything the gate cannot
 * decide (no merge commit, git error, empty diff) is live=true: the failure
 * direction of this gate is "one more sweep", never "one less".
 *
 * ONE LIST. db-contract-check.yml and unit-tests.yml both call this script;
 * the path list lives here and nowhere else.
 *
 * Usage
 *   CI:    node scripts/ci-live-db-gate.mjs
 *          (reads GITHUB_EVENT_NAME; on pull_request diffs the checked-out merge
 *          commit against its first parent, so checkout needs fetch-depth: 2;
 *          writes live/reason to GITHUB_OUTPUT and a table to
 *          GITHUB_STEP_SUMMARY)
 *   Dry:   node scripts/ci-live-db-gate.mjs --event pull_request --base <ref> --head <ref>
 *          node scripts/ci-live-db-gate.mjs --event pull_request --files a.md,b.ts
 *          node scripts/ci-live-db-gate.mjs --event push
 *   Proof: node scripts/ci-live-db-gate.mjs --self-test
 *
 * Exit: 0 when a decision was made (either way), 1 when --self-test fails,
 * 2 on bad arguments. A decision of "skip" is NOT a failure; the consuming
 * workflows read the `live` output.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * RULE 1 -- path globs that are DB-facing by definition. `**` crosses
 * directories, `*` does not.
 *
 * scripts/** and bin/** are wider than "the guard scripts", deliberately:
 * db-contract-check's contract-check job also runs two NO-DB steps
 * (check-migration-stamps.mjs reads supabase/, check-script-conventions.mjs
 * reads every .mjs/.js under scripts/ and bin/). Listing their whole input
 * corpus here means skipping that job can never hide a verdict either of them
 * would have changed.
 */
export const LIVE_DB_PATH_GLOBS = [
  'supabase/**',
  'src/integrations/supabase/**',
  'scripts/**',
  'bin/**',
  '**/*.contract.test.ts',
  '**/*.contract.test.tsx',
  'vitest.config.ts',
  'package.json',
  'package-lock.json',
  '.npmrc',
  '.nvmrc',
  '.github/workflows/db-contract-check.yml',
  '.github/workflows/unit-tests.yml',
];

/**
 * RULE 2 -- a changed CODE file whose content, before OR after the change,
 * calls the database. Derived by grep rather than guessed: on 2026-10-04 this
 * matched 137 of 629 files under src/ + app/. Reading the BASE side too means
 * a PR that deletes the last `.rpc(` from a file is still DB-facing.
 * `Buffer.from('..')` / `Array.from('..')` are excluded; any other `.from('`
 * is treated as a table read (conservative).
 */
export const DB_CALL_PATTERN =
  /\.rpc\(|\bcreateClient\b|(?<!\b(?:Buffer|Array|Uint8Array))\.from\(\s*['"`]|\/rest\/v1\/|integrations\/supabase/;
const CODE_FILE = /\.(?:ts|tsx|js|jsx|mjs|cjs|sql)$/;

/**
 * RULE 3 -- a changed src/ or app/ file that a live sweep reads by path. The
 * sweeps are scripts/check-*.mjs (+ scripts/lib) and the *.contract.test.ts
 * suites; e.g. check-tracking-rpc-contract.mjs parses
 * src/lib/eventLinkClicks.ts and check-day-rollover-consistency-v1.mjs parses
 * src/lib/programDayRollover.ts. Matched as the extension-less repo path and,
 * for src/, its `@/` alias. Transitive imports are not followed; a mapper two
 * imports deep is covered by its own no-network unit tests on the PR and by
 * the full live run on main.
 */
export function referenceKeys(file) {
  const bare = file.replace(/\.(?:ts|tsx|js|jsx|mjs|cjs)$/, '');
  const keys = [bare];
  if (bare.startsWith('src/')) keys.push(`@/${bare.slice(4)}`);
  return keys;
}

export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      i += 1;
      if (glob[i + 1] === '/') {
        i += 1;
        re += '(?:.*/)?';
      } else {
        re += '.*';
      }
    } else if (ch === '*') {
      re += '[^/]*';
    } else {
      re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

const GLOB_RES = LIVE_DB_PATH_GLOBS.map((g) => [g, globToRegExp(g)]);

/**
 * Classify a list of changed files. `readHead(file)` / `readBase(file)` return
 * the file's text or null (absent on that side); `sweepCorpus` is the
 * concatenated text of the sweep files for rule 3. Returns one hit per
 * DB-facing file, naming the rule that caught it.
 */
export function classify(files, { readHead, readBase, sweepCorpus }) {
  const hits = [];
  for (const file of files) {
    const glob = GLOB_RES.find(([, re]) => re.test(file));
    if (glob) {
      hits.push({ file, rule: `path ${glob[0]}` });
      continue;
    }
    if (CODE_FILE.test(file) && !file.startsWith('docs/')) {
      const head = readHead(file);
      const base = readBase(file);
      if ((head && DB_CALL_PATTERN.test(head)) || (base && DB_CALL_PATTERN.test(base))) {
        hits.push({ file, rule: 'calls the DB (.rpc / .from / createClient / supabase client)' });
        continue;
      }
    }
    if (/^(?:src|app)\//.test(file) && referenceKeys(file).some((k) => sweepCorpus.includes(k))) {
      hits.push({ file, rule: 'read by a live sweep script or contract test' });
    }
  }
  return hits;
}

/**
 * The decision. `files` is null when the diff could not be computed.
 */
export function decide({ event, files, io }) {
  if (event !== 'pull_request') {
    return { live: true, reason: `event "${event || 'unknown'}" always runs the live prod-DB sweeps`, hits: [], files };
  }
  if (files === null) {
    return { live: true, reason: 'could not compute the PR diff, so running the live sweeps (fail-safe)', hits: [], files };
  }
  if (files.length === 0) {
    return { live: true, reason: 'the PR diff is empty, which is unexpected, so running the live sweeps (fail-safe)', hits: [], files };
  }
  const hits = classify(files, io);
  if (hits.length > 0) {
    return { live: true, reason: `${hits.length} of ${files.length} changed file(s) are DB-facing`, hits, files };
  }
  return {
    live: false,
    reason: `none of the ${files.length} changed file(s) is DB-facing; the live prod-DB sweeps run on push to main, nightly and on dispatch`,
    hits,
    files,
  };
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function gitShow(ref, file) {
  try {
    return git(['show', `${ref}:${file}`]);
  } catch (error) {
    // Absent on that side of the diff (added or deleted file) is the normal
    // case; anything else is surfaced so a broken read is not a quiet "no".
    const msg = String(error && error.stderr ? error.stderr : error);
    if (/does not exist|exists on disk, but not in/.test(msg)) return null;
    throw error;
  }
}

function readSweepCorpus() {
  const parts = [];
  const scriptsDir = path.join(ROOT, 'scripts');
  for (const name of readdirSync(scriptsDir)) {
    if (/^check-.*\.mjs$/.test(name)) parts.push(readFileSync(path.join(scriptsDir, name), 'utf8'));
  }
  for (const name of readdirSync(path.join(scriptsDir, 'lib'))) {
    if (name.endsWith('.mjs')) parts.push(readFileSync(path.join(scriptsDir, 'lib', name), 'utf8'));
  }
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.contract\.test\.tsx?$/.test(entry.name)) parts.push(readFileSync(full, 'utf8'));
    }
  };
  for (const top of ['tests', 'src', 'app']) {
    try {
      walk(path.join(ROOT, top));
    } catch (error) {
      if (error && error.code !== 'ENOENT') throw error;
    }
  }
  return parts.join('\n');
}

/** Changed files of the checked-out pull_request merge commit, or null. */
function prMergeDiff() {
  const parents = git(['rev-list', '--parents', '-n', '1', 'HEAD']).trim().split(/\s+/);
  if (parents.length !== 3) return { files: null, base: null, head: 'HEAD' };
  return { files: diffNames('HEAD^1', 'HEAD'), base: 'HEAD^1', head: 'HEAD' };
}

function diffNames(base, head) {
  return git(['diff', '--name-only', '--no-renames', base, head]).split('\n').map((s) => s.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const args = { event: process.env.GITHUB_EVENT_NAME || '', files: null, base: null, head: null, selfTest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--self-test') args.selfTest = true;
    else if (a === '--event') args.event = argv[++i];
    else if (a === '--files') args.files = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--base') args.base = argv[++i];
    else if (a === '--head') args.head = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

function render(result) {
  const lines = [];
  const verdict = result.live ? 'RUN' : 'SKIP';
  lines.push(`### Live prod-DB sweeps: ${verdict}`);
  lines.push('');
  lines.push(`Reason: ${result.reason}.`);
  if (!result.live) {
    lines.push('');
    lines.push('Skipped on this PR: the db-contract-check `contract-check` job and the live `*.contract.test.ts` suites in the unit job (London leg runs the no-network set).');
    lines.push('Not skipped anywhere else: every one of them runs on push to main, nightly, and on workflow_dispatch.');
  }
  if (result.hits.length > 0) {
    lines.push('');
    lines.push('| DB-facing file | rule |');
    lines.push('|---|---|');
    for (const h of result.hits.slice(0, 30)) lines.push(`| \`${h.file}\` | ${h.rule} |`);
    if (result.hits.length > 30) lines.push(`| ... | ${result.hits.length - 30} more |`);
  } else if (result.files && result.files.length > 0) {
    lines.push('');
    lines.push(`Changed files checked (${result.files.length}): ${result.files.slice(0, 30).map((f) => `\`${f}\``).join(', ')}${result.files.length > 30 ? ', ...' : ''}`);
  }
  lines.push('');
  lines.push('Rules and path list: `scripts/ci-live-db-gate.mjs`.');
  return lines.join('\n');
}

export function main(argv, deps = {}) {
  const log = deps.log || ((s) => process.stdout.write(`${s}\n`));
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    log(`ci-live-db-gate: ${error.message}`);
    return 2;
  }
  if (args.selfTest) return selfTest(log);

  let result;
  try {
    let files = args.files;
    let base = args.base;
    let head = args.head;
    if (args.event === 'pull_request' && !files) {
      if (base && head) {
        files = diffNames(base, head);
      } else {
        ({ files, base, head } = prMergeDiff());
      }
    }
    const io = {
      readHead: (f) => (head ? gitShow(head, f) : readWorkingTree(f)),
      readBase: (f) => (base ? gitShow(base, f) : null),
      sweepCorpus: args.event === 'pull_request' ? readSweepCorpus() : '',
    };
    result = decide({ event: args.event, files, io });
  } catch (error) {
    result = {
      live: true,
      reason: `the gate hit an error (${String(error && error.message ? error.message : error).split('\n')[0]}), so running the live sweeps (fail-safe)`,
      hits: [],
      files: null,
    };
  }

  const summary = render(result);
  log(summary);
  if (process.env.GITHUB_OUTPUT && !deps.noOutput) {
    appendFileSync(process.env.GITHUB_OUTPUT, `live=${result.live}\nreason=${result.reason.replace(/\n/g, ' ')}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY && !deps.noOutput) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
  if (deps.onResult) deps.onResult(result);
  return 0;
}

function readWorkingTree(file) {
  try {
    return readFileSync(path.join(ROOT, file), 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Self-test: every rule proven in both directions, and main() driven so the
 * decision that reaches GITHUB_OUTPUT is the one under test.
 */
function selfTest(log) {
  const failures = [];
  const expect = (name, cond) => {
    if (!cond) failures.push(name);
    log(`${cond ? 'ok  ' : 'FAIL'} ${name}`);
  };
  const contents = {
    'src/pages/Foo.tsx': "const { data } = await supabase.rpc('get_x');",
    'src/pages/Bar.tsx': 'export const Bar = () => null;',
    'src/lib/buf.ts': "const b = Buffer.from('aGk=', 'base64'); const a = Array.from('xy');",
    'src/lib/table.ts': "await client.from('events').select('*');",
    'src/lib/programDayRollover.ts': 'export const rollover = 1;',
    'app/routes/home.tsx': "import { getHome } from '@/integrations/supabase/eventRpcs';",
    'docs/notes.ts': "supabase.rpc('x')",
  };
  const baseContents = { 'src/pages/Removed.tsx': "await supabase.rpc('old_rpc');" };
  const io = {
    readHead: (f) => contents[f] ?? null,
    readBase: (f) => baseContents[f] ?? null,
    sweepCorpus: "const SRC = 'src/lib/programDayRollover.ts';",
  };
  const run = (event, files) => decide({ event, files, io });

  // (a) docs / workflow-only diff -> SKIP
  expect('docs + unrelated workflow + plain component -> skip',
    run('pull_request', ['docs/x.md', 'CLAUDE.md', '.github/workflows/seo-check.yml', 'src/pages/Bar.tsx', 'docs/notes.ts']).live === false);
  // (b) diffs that touch DB-facing code -> RUN, one per rule
  expect('rule 2: an .rpc( caller -> run', run('pull_request', ['src/pages/Foo.tsx']).live === true);
  expect('rule 2: a .from(<table>) caller -> run', run('pull_request', ['src/lib/table.ts']).live === true);
  expect('rule 2: an importer of integrations/supabase -> run', run('pull_request', ['app/routes/home.tsx']).live === true);
  expect('rule 2: base side counts (last .rpc removed) -> run', run('pull_request', ['src/pages/Removed.tsx']).live === true);
  expect('rule 2 negative: Buffer.from / Array.from are not DB calls', run('pull_request', ['src/lib/buf.ts']).live === false);
  expect('rule 3: a file a sweep reads by path -> run', run('pull_request', ['src/lib/programDayRollover.ts']).live === true);
  expect('rule 1: guard script -> run', run('pull_request', ['scripts/check-latest-events.mjs']).live === true);
  expect('rule 1: live contract test -> run', run('pull_request', ['tests/latestEvents.contract.test.ts']).live === true);
  expect('rule 1: package-lock -> run', run('pull_request', ['package-lock.json']).live === true);
  expect('rule 1: the sweep workflow itself -> run', run('pull_request', ['.github/workflows/db-contract-check.yml']).live === true);
  expect('rule 1: supabase/ -> run', run('pull_request', ['supabase/migrations/1_x.sql']).live === true);
  expect('rule 1 negative: a lookalike name outside the list -> skip',
    run('pull_request', ['docs/package.json.md', 'tests/latestEvents.test.ts']).live === false);
  // (c) non-PR events -> RUN regardless of diff
  for (const ev of ['push', 'schedule', 'workflow_dispatch']) {
    expect(`${ev} -> run even with a docs-only diff`, run(ev, ['docs/x.md']).live === true);
  }
  // fail-safe directions
  expect('undecidable diff (null) -> run', run('pull_request', null).live === true);
  expect('empty diff -> run', run('pull_request', []).live === true);
  // glob engine
  expect('glob ** spans dirs', globToRegExp('supabase/**').test('supabase/a/b.sql'));
  expect('glob **/ matches root too', globToRegExp('**/*.contract.test.ts').test('x.contract.test.ts'));
  expect('glob * stays in one segment', !globToRegExp('scripts/*.mjs').test('scripts/lib/a.mjs'));

  // main() is the exit owner: drive it, and pin that the decision it acts on
  // is the one above (a dropped event check would flip these).
  let seen = null;
  const quiet = () => {};
  const codeSkip = main(['--event', 'pull_request', '--files', 'docs/x.md'], { log: quiet, noOutput: true, onResult: (r) => { seen = r; } });
  expect('main(): docs-only PR exits 0 with live=false', codeSkip === 0 && seen && seen.live === false);
  seen = null;
  const codeRun = main(['--event', 'push'], { log: quiet, noOutput: true, onResult: (r) => { seen = r; } });
  expect('main(): push exits 0 with live=true', codeRun === 0 && seen && seen.live === true);
  expect('main(): bad argument exits 2', main(['--bogus'], { log: quiet, noOutput: true }) === 2);

  log(failures.length === 0 ? 'ci-live-db-gate self-test: all cases passed' : `ci-live-db-gate self-test: ${failures.length} FAILED`);
  return failures.length === 0 ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
