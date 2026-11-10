#!/usr/bin/env node
/**
 * check-automation-workflow-allowlist.mjs -- which .github/workflows/* files an
 * AUTOMATED change may touch (PRIORITY-QUEUE item 8, hard tier).
 *
 * The autopilot loop (scripts/autopilot-step.mjs, #1342, ships OFF) acts on PRs
 * whose head branch starts `claude/` or `ccr-` (isWorkerBranch in
 * scripts/lib/autopilot.mjs -- imported, not copied, so the two cannot drift).
 * Until this file the rule for which workflow files such a PR may change was
 * implied by hand review. It is now written down in ONE committed list:
 *
 *   scripts/data/automation-workflow-allowlist.json
 *
 * a JSON array of bare workflow file names (e.g. "autopilot.yml"). It is
 * owner-curated; currently `workflow-lint.yml`. Only listed names are allowed, and
 * only the owner may change it (owner Approve at head; docs/ci-guard-notes.md).
 *
 * A LOOP PR is one whose head branch is a worker branch (claude/ or ccr-) OR whose
 * author is exactly BOT_LOGIN (kiki-claude-bot, imported from scripts/lib/autopilot.mjs;
 * workflow-allowlist-2). dependabot[bot] and github-actions[bot] are not the loop.
 *
 * Rule: on a loop PR, every changed path under .github/workflows/ must be
 * `.github/workflows/<listed name>`; anything else (an unlisted name, a nested
 * path) fails, and so does changing the list itself. Every path is normalised first
 * (backslash -> slash, path.posix.normalize so `//` and `/./` collapse, leading ./
 * stripped) and the `.github/workflows/` prefix and the
 * list file are matched case-insensitively, so `.GitHub/Workflows/x.yml` is seen; only
 * the exact-case `.github/workflows/<name>` counts as listed. A NON-loop PR is never
 * affected -- the list is not even read, so a human PR cannot be blocked by a broken list.
 *
 * Inputs
 *   HEAD_REF (or GITHUB_HEAD_REF)  the PR head branch name. REQUIRED.
 *   PR_AUTHOR                      the PR author login. REQUIRED in CI (CI / GITHUB_ACTIONS
 *                                  set): a CI run without it is exit 2, never a pass.
 *   PR_FILES                       changed paths, one per line (old AND new name of a rename;
 *                                  a tab-separated `old<TAB>new` line counts both).
 *   --merge <sha>                  instead of PR_FILES: diff <sha>^1..<sha> (the PR merge
 *                                  commit; deepens the checkout like scripts/ci/docs-only.mjs).
 *   --local                        instead of both: branch from git, files from
 *                                  `git diff $(git merge-base origin/main HEAD)` -- committed
 *                                  AND uncommitted tracked edits (untracked files are not
 *                                  seen; fetch origin main first, a stale one moves the base).
 *   AUTOMATION_WORKFLOW_ALLOWLIST  override the list path (tests and the self-test only).
 *
 * Exit codes: 0 pass (or not a loop PR), 1 a loop PR changes an unlisted
 * workflow file or the list, 2 cannot measure: no branch name, no author in CI, no /
 * empty file list, git failed, or (on a loop PR) the list is missing, unparseable, not an array,
 * or holds anything but bare *.yml / *.yaml names.
 *
 *   HEAD_REF="$BRANCH" PR_AUTHOR="$LOGIN" PR_FILES="$FILES" node scripts/check-automation-workflow-allowlist.mjs
 *   node scripts/check-automation-workflow-allowlist.mjs --local
 *   node scripts/check-automation-workflow-allowlist.mjs --self-test
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import { BOT_LOGIN, isWorkerBranch } from './lib/autopilot.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ALLOWLIST_PATH = path.join(REPO_ROOT, 'scripts', 'data', 'automation-workflow-allowlist.json');
export const WORKFLOW_DIR = '.github/workflows/';
const NAME_RE = /^[A-Za-z0-9._-]+\.ya?ml$/;

/** The autopilot loop's branch kinds (claude/ or ccr-); one definition, imported. */
export { isWorkerBranch as isLoopBranch };
/** The list's own repo path: a loop branch may never change it (owner-only). */
export const ALLOWLIST_REL = 'scripts/data/automation-workflow-allowlist.json';

/** A loop PR: worker branch OR authored by BOT_LOGIN (exact compare). */
export function isLoopPr(branch, author) {
  return isWorkerBranch(branch) || author === BOT_LOGIN;
}

/**
 * Backslash -> slash, then path.posix.normalize (collapses `//` and inner `/./`, resolves
 * `a/../`), then strip any leading ./ (git and REST never emit these; a hand-fed list might).
 * So `.github//workflows/x.yml` and `.github/./workflows/x.yml` are seen as workflow paths.
 */
export function normalisePath(f) {
  let p = path.posix.normalize(String(f).replace(/\\/g, '/'));
  while (p.startsWith('./')) p = p.slice(2);
  return p;
}

const isWorkflowPath = (p) => p.toLowerCase().startsWith(WORKFLOW_DIR);
const isListFile = (p) => p.toLowerCase() === ALLOWLIST_REL;

/** Read and validate the list. Never throws: a broken list is a measurement failure. */
export function loadAllowlist(file = ALLOWLIST_PATH) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (e) {
    return { ok: false, reason: 'cannot read ' + file + ': ' + e.code };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { ok: false, reason: file + ' is not valid JSON: ' + e.message };
  }
  if (!Array.isArray(data)) return { ok: false, reason: file + ' must be a JSON array of workflow file names' };
  const bad = data.filter((n) => typeof n !== 'string' || !NAME_RE.test(n));
  if (bad.length) {
    return { ok: false, reason: file + ' holds entries that are not bare *.yml names: ' + JSON.stringify(bad) };
  }
  return { ok: true, names: data };
}

/**
 * Changed workflow paths NOT on the list, normalised (a nested path is never listed;
 * a case variant of the prefix is a workflow path but never the listed one).
 */
export function violations(files, names) {
  const allowed = new Set(names.map((n) => WORKFLOW_DIR + n));
  return files.map(normalisePath).filter((p) => isWorkflowPath(p) && !allowed.has(p));
}

function git(args) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** {files, branch} from argv/env, or {error}. git is injected so the self-test never shells out. */
export function readInputs(argv, env, deps = {}) {
  const run = deps.git ?? git;
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  let branch = env.HEAD_REF || env.GITHUB_HEAD_REF || '';
  let filesText = env.PR_FILES;
  try {
    if (argv.includes('--local')) {
      branch = run(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
      // A detached HEAD names no branch: that is a measurement gap, not "not a loop branch".
      if (branch === 'HEAD') return { error: 'detached HEAD: --local cannot tell the branch; set HEAD_REF and PR_FILES' };
      // Merge base to the WORKING TREE, so uncommitted edits count (untracked files do not).
      const base = run(['merge-base', 'origin/main', 'HEAD']).trim();
      filesText = run(['diff', '--name-only', '--no-renames', base]);
    } else if (opt('--merge')) {
      const sha = opt('--merge');
      run(['fetch', '--no-tags', '--depth=2', 'origin', sha]);
      filesText = run(['diff', '--name-only', '--no-renames', sha + '^1', sha]);
    }
  } catch (e) {
    return { error: 'git failed: ' + String(e.message).split('\n')[0] };
  }
  if (!branch) return { error: 'no branch name: set HEAD_REF (the PR head branch) or pass --local' };
  if (typeof filesText !== 'string') return { error: 'no changed files: set PR_FILES or pass --merge <sha> / --local' };
  const files = filesText.split('\n').flatMap((l) => l.split('\t')).map((f) => f.trim()).filter(Boolean)
    .map(normalisePath);
  if (files.length === 0) return { error: 'the changed-file list is empty: a PR always changes at least one file' };
  const author = env.PR_AUTHOR || '';
  if (!author && (env.CI || env.GITHUB_ACTIONS === 'true')) {
    return { error: 'no PR_AUTHOR in CI: cannot tell a kiki-claude-bot PR from an owner PR' };
  }
  return { branch, author, files };
}

export function main(argv, env = process.env, log = console, deps = {}) {
  if (argv.includes('--self-test')) return selfTest(log) ? 0 : 1;
  const input = readInputs(argv, env, deps);
  if (input.error) {
    log.error('automation-workflow-allowlist: CANNOT RUN -- ' + input.error);
    return 2;
  }
  const { branch, author, files } = input;
  if (!isLoopPr(branch, author)) {
    log.log('automation-workflow-allowlist: OK -- ' + branch + (author ? ' by ' + author : '')
      + ' is not an automation-loop PR (claude/ or ccr- branch, or ' + BOT_LOGIN + '); not affected.');
    return 0;
  }
  const list = loadAllowlist(env.AUTOMATION_WORKFLOW_ALLOWLIST || ALLOWLIST_PATH);
  if (!list.ok) {
    log.error('automation-workflow-allowlist: CANNOT RUN -- ' + list.reason);
    return 2;
  }
  if (files.some(isListFile)) {
    log.error('automation-workflow-allowlist: FAIL -- loop PR ' + branch + ' changes ' + ALLOWLIST_REL
      + ' itself. Only the owner edits the list, in a PR of its own (owner Approve).');
    return 1;
  }
  const bad = violations(files, list.names);
  const touched = files.filter(isWorkflowPath).length;
  if (bad.length === 0) {
    log.log('automation-workflow-allowlist: OK -- loop PR ' + branch + ', ' + files.length + ' files, '
      + touched + ' workflow file(s), all on the list (' + list.names.length + ' name(s)).');
    return 0;
  }
  log.error('automation-workflow-allowlist: FAIL -- loop PR ' + branch + ' changes workflow file(s) not on '
    + 'scripts/data/automation-workflow-allowlist.json:');
  for (const f of bad) log.error('  - ' + f);
  log.error('An automated change may only edit a listed workflow. Only the owner adds a name (owner Approve);'
    + ' see docs/ci-guard-notes.md#automation-workflow-allow-list.');
  return 1;
}

function selfTest(log) {
  const dir = mkdtempSync(path.join(tmpdir(), 'wf-allowlist-'));
  try {
    const write = (name, body) => { const p = path.join(dir, name); writeFileSync(p, body); return p; };
    const LISTED = write('listed.json', '["autopilot.yml"]');
    const EMPTY = write('empty.json', '[]');
    const BAD = write('bad.json', '{');
    const NESTED = write('nested.json', '["sub/x.yml"]');
    const MISSING = path.join(dir, 'missing.json');
    const quiet = { log() {}, error() {} };
    const LOOP = 'claude/x';
    const WF = '.github/workflows/autopilot.yml';
    const OTHER = '.github/workflows/e2e-smoke.yml';
    const LIST_REL = 'scripts/data/automation-workflow-allowlist.json';
    const m = (branch, files, list, argv = [], deps = {}) =>
      main(argv, { HEAD_REF: branch, PR_FILES: files, AUTOMATION_WORKFLOW_ALLOWLIST: list }, quiet, deps);
    const BOT = BOT_LOGIN;
    const a = (branch, author, files, list, extra = {}) =>
      main([], { HEAD_REF: branch, PR_AUTHOR: author, PR_FILES: files, AUTOMATION_WORKFLOW_ALLOWLIST: list, ...extra }, quiet);
    // Exit-code owner driven end to end, each branch pinned (R5).
    const cases = [
      ['loop, no workflow change (0)', m(LOOP, 'docs/a.md', LISTED), 0],
      ['loop, listed workflow (0)', m(LOOP, WF, LISTED), 0],
      ['loop, unlisted workflow (1)', m(LOOP, OTHER, LISTED), 1],
      ['loop, empty list, any workflow (1)', m(LOOP, WF, EMPTY), 1],
      ['ccr- loop, unlisted workflow (1)', m('ccr-1', OTHER, EMPTY), 1],
      ['loop, nested path never listed (1)', m(LOOP, '.github/workflows/x/autopilot.yml', LISTED), 1],
      ['loop, list edited in the same PR (1)', m(LOOP, LIST_REL + '\n' + WF, LISTED), 1],
      ['human, list edited (0)', m('ricky/x', LIST_REL, EMPTY), 0],
      ['--local detached HEAD (2)', main(['--local'], { AUTOMATION_WORKFLOW_ALLOWLIST: EMPTY }, quiet,
        { git: (a) => (a[0] === 'rev-parse' ? 'HEAD\n' : OTHER + '\n') }), 2],
      ['human, unlisted workflow (0)', m('ricky/x', OTHER, EMPTY), 0],
      ['human, missing list (0)', m('ricky/x', OTHER, MISSING), 0],
      ['loop, missing list (2)', m(LOOP, WF, MISSING), 2],
      ['loop, unparseable list (2)', m(LOOP, WF, BAD), 2],
      ['loop, path entry in list (2)', m(LOOP, WF, NESTED), 2],
      ['no branch (2)', main([], { PR_FILES: WF, AUTOMATION_WORKFLOW_ALLOWLIST: LISTED }, quiet), 2],
      ['no PR_FILES (2)', main([], { HEAD_REF: LOOP, AUTOMATION_WORKFLOW_ALLOWLIST: LISTED }, quiet), 2],
      ['empty PR_FILES (2)', m(LOOP, '\n', LISTED), 2],
      ['--merge diff drives the files (1)', m(LOOP, undefined, EMPTY, ['--merge', 'abc'],
        { git: (a) => (a[0] === 'diff' ? OTHER + '\n' : '') }), 1],
      ['git failure (2)', m(LOOP, undefined, EMPTY, ['--merge', 'abc'],
        { git: () => { throw new Error('fatal: bad object'); } }), 2],
      ['--local reads the branch from git (0 for main)', main(['--local'], { AUTOMATION_WORKFLOW_ALLOWLIST: EMPTY }, quiet,
        { git: (a) => (a[0] === 'rev-parse' ? 'main\n' : OTHER + '\n') }), 0],
      // workflow-allowlist-2: author rule, path variants, CI author requirement.
      ['bot on a non-loop branch, unlisted workflow (1)', a('feature/x', BOT, OTHER, EMPTY), 1],
      ['bot on a non-loop branch, listed workflow (0)', a('feature/x', BOT, WF, LISTED), 0],
      ['owner on a human branch, workflow + list, missing list (0)', a('ricky/x', '123constante', OTHER + '\n' + LIST_REL, MISSING), 0],
      ['dependabot[bot] unaffected (0)', a('dependabot/x', 'dependabot[bot]', OTHER, EMPTY), 0],
      ['github-actions[bot] unaffected (0)', a('autoheal', 'github-actions[bot]', OTHER, EMPTY), 0],
      ['case variant prefix (1)', a(LOOP, BOT, '.GitHub/Workflows/x.yml', EMPTY), 1],
      ['backslash variant (1)', a(LOOP, BOT, '.github\\workflows\\x.yml', EMPTY), 1],
      ['leading ./ variant (1)', a(LOOP, BOT, './.github/workflows/x.yml', EMPTY), 1],
      ['leading ./ on a listed name (0)', a(LOOP, BOT, './' + WF, LISTED), 0],
      ['doubled separator variant (1)', a(LOOP, BOT, '.github//workflows/x.yml', EMPTY), 1],
      ['inner-dot separator variant (1)', a(LOOP, BOT, '.github/./workflows/x.yml', EMPTY), 1],
      ['combined case/backslash/dot/doubled variant (1)', a(LOOP, BOT, '.GitHub\\.\\workflows//x.yml', EMPTY), 1],
      ['list file case variant (1)', a(LOOP, BOT, 'Scripts/Data/Automation-Workflow-Allowlist.json', LISTED), 1],
      ['rename tab pair onto a workflow (1)', a(LOOP, BOT, 'docs/x.yml\t' + OTHER, LISTED), 1],
      ['CI run with no PR_AUTHOR (2)', a('ricky/x', '', OTHER, EMPTY, { GITHUB_ACTIONS: 'true' }), 2],
      ['CI run with PR_AUTHOR, owner (0)', a('ricky/x', '123constante', OTHER, EMPTY, { GITHUB_ACTIONS: 'true' }), 0],
    ];
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
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (isEntryPoint(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
