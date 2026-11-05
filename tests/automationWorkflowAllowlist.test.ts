import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ALLOWLIST_PATH,
  isLoopBranch,
  isLoopPr,
  loadAllowlist,
  main,
  normalisePath,
  violations,
} from '../scripts/check-automation-workflow-allowlist.mjs';
import { BOT_LOGIN } from '../scripts/lib/autopilot.mjs';

const quiet = { log() {}, error() {} };
const dir = mkdtempSync(path.join(tmpdir(), 'wf-allow-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const list = (name: string, body: string) => {
  const p = path.join(dir, name);
  writeFileSync(p, body);
  return p;
};
const LISTED = list('listed.json', JSON.stringify(['autopilot.yml']));
const EMPTY = list('empty.json', '[]');
const NOT_JSON = list('bad.json', '{ not json');
const NOT_ARRAY = list('obj.json', JSON.stringify({ files: ['autopilot.yml'] }));
const PATH_ENTRY = list('path.json', JSON.stringify(['.github/workflows/autopilot.yml']));
const MISSING = path.join(dir, 'does-not-exist.json');

const LOOP = 'claude/workflow-allowlist-1';
const HUMAN = 'ricky/fix-thing';
const OWNER = '123constante';
const LIST_REL = 'scripts/data/automation-workflow-allowlist.json';
const WF = '.github/workflows/autopilot.yml';
const OTHER = '.github/workflows/e2e-smoke.yml';

const run = (env: Record<string, string>) => main([], env, quiet);

describe('main: the brief table, exit code per row (branch only, no author)', () => {
  it.each([
    ['loop branch, no workflow change', LOOP, 'docs/a.md\nscripts/x.mjs', LISTED, 0],
    ['loop branch, listed workflow', LOOP, WF, LISTED, 0],
    ['loop branch, unlisted workflow fails', LOOP, '.github/workflows/architecture-guard.yml', LISTED, 1],
    ['loop branch, any workflow vs the EMPTY shipped shape fails', LOOP, WF, EMPTY, 1],
    ['ccr- loop branch, unlisted workflow fails', 'ccr-abc123', OTHER, EMPTY, 1],
    ['loop branch, listed + unlisted together fails', LOOP, WF + '\n' + OTHER, LISTED, 1],
    ['loop branch, nested file under workflows/ fails', LOOP, '.github/workflows/sub/autopilot.yml', LISTED, 1],
    ['loop branch editing the list itself fails', LOOP, LIST_REL + '\n' + WF, LISTED, 1],
    ['human branch editing the list passes', HUMAN, LIST_REL, EMPTY, 0],
    ['human branch, any workflow passes', HUMAN, '.github/workflows/architecture-guard.yml', EMPTY, 0],
    ['human branch, any workflow passes even with no list', HUMAN, '.github/workflows/architecture-guard.yml', MISSING, 0],
    ['missing list on a loop branch is infrastructure', LOOP, WF, MISSING, 2],
    ['unparseable list is infrastructure', LOOP, 'docs/a.md', NOT_JSON, 2],
    ['non-array list is infrastructure', LOOP, 'docs/a.md', NOT_ARRAY, 2],
    ['a path (not a bare name) in the list is infrastructure', LOOP, 'docs/a.md', PATH_ENTRY, 2],
  ])('%s', (_n, branch, files, listPath, want) => {
    expect(run({ HEAD_REF: branch, PR_FILES: files, AUTOMATION_WORKFLOW_ALLOWLIST: listPath })).toBe(want);
  });

  it('no branch name is infrastructure (2), never a pass', () => {
    expect(run({ PR_FILES: '.github/workflows/a.yml', AUTOMATION_WORKFLOW_ALLOWLIST: LISTED })).toBe(2);
  });
  it('an empty PR_FILES is infrastructure (2): a PR always changes a file', () => {
    expect(run({ HEAD_REF: LOOP, PR_FILES: '\n', AUTOMATION_WORKFLOW_ALLOWLIST: LISTED })).toBe(2);
  });
  it('--self-test passes', () => {
    expect(main(['--self-test'], {}, quiet)).toBe(0);
  });
});

// workflow-allowlist-2: author-aware, path variants, renames, deletes.
describe('main: author rule and path variants (workflow-allowlist-2)', () => {
  it.each([
    // [name, branch, author, files, list, want]
    ['listed workflow by the bot passes', LOOP, BOT_LOGIN, WF, LISTED, 0],
    ['unlisted workflow by the bot fails', LOOP, BOT_LOGIN, OTHER, LISTED, 1],
    ['list edited by a loop PR fails', LOOP, BOT_LOGIN, LIST_REL, LISTED, 1],
    ['list edited by a loop PR fails, case variant', LOOP, BOT_LOGIN, 'Scripts/Data/Automation-Workflow-Allowlist.json', LISTED, 1],
    ['list edited by a loop PR fails, backslash variant', LOOP, BOT_LOGIN, 'scripts\\data\\automation-workflow-allowlist.json', LISTED, 1],
    ['owner PR on a human branch edits a workflow and the list: unaffected', HUMAN, OWNER, OTHER + '\n' + LIST_REL, EMPTY, 0],
    ['owner PR never reads the list (missing list passes)', HUMAN, OWNER, OTHER, MISSING, 0],
    ['kiki-claude-bot on a NON-claude branch fails', 'feature/x', BOT_LOGIN, OTHER, EMPTY, 1],
    ['kiki-claude-bot on a non-claude branch, listed workflow passes', 'feature/x', BOT_LOGIN, WF, LISTED, 0],
    ['dependabot[bot] is not the loop: unaffected', 'dependabot/github_actions/x', 'dependabot[bot]', OTHER, EMPTY, 0],
    ['github-actions[bot] is not the loop: unaffected', 'types-drift-autoheal', 'github-actions[bot]', OTHER, EMPTY, 0],
    ['author compare is exact (case differs: not the bot)', 'feature/x', 'Kiki-Claude-Bot', OTHER, EMPTY, 0],
    ['author compare is exact (suffix: not the bot)', 'feature/x', BOT_LOGIN + '[bot]', OTHER, EMPTY, 0],
    ['docs-only loop PR passes', LOOP, BOT_LOGIN, 'docs/a.md\ndocs/b.md', EMPTY, 0],
    ['rename ONTO a workflow (old + new name) fails', LOOP, BOT_LOGIN, 'scripts/x.yml\n' + OTHER, LISTED, 1],
    ['rename OFF a workflow (old + new name) fails', LOOP, BOT_LOGIN, OTHER + '\ndocs/old-e2e.yml', LISTED, 1],
    ['rename listed -> unlisted fails on the new name', LOOP, BOT_LOGIN, WF + '\n' + OTHER, LISTED, 1],
    ['rename as a tab pair (old<TAB>new) is read both ways', LOOP, BOT_LOGIN, 'docs/x.yml\t' + OTHER, LISTED, 1],
    ['delete of an unlisted workflow fails', LOOP, BOT_LOGIN, OTHER, EMPTY, 1],
    ['delete of a listed workflow passes', LOOP, BOT_LOGIN, WF, LISTED, 0],
    ['case variant .GitHub/Workflows/x.yml fails', LOOP, BOT_LOGIN, '.GitHub/Workflows/x.yml', EMPTY, 1],
    ['case variant of a LISTED name is still not the listed path', LOOP, BOT_LOGIN, '.GitHub/Workflows/autopilot.yml', LISTED, 1],
    ['backslash variant .github\\workflows\\x.yml fails', LOOP, BOT_LOGIN, '.github\\workflows\\x.yml', EMPTY, 1],
    ['leading ./ variant fails', LOOP, BOT_LOGIN, './.github/workflows/x.yml', EMPTY, 1],
    ['leading ./ on a listed name passes', LOOP, BOT_LOGIN, './' + WF, LISTED, 0],
    ['nested .github/workflows/sub/x.yml fails', LOOP, BOT_LOGIN, '.github/workflows/sub/x.yml', LISTED, 1],
    ['doubled separator .github//workflows/x.yml fails', LOOP, BOT_LOGIN, '.github//workflows/x.yml', EMPTY, 1],
    ['inner-dot separator .github/./workflows/x.yml fails', LOOP, BOT_LOGIN, '.github/./workflows/x.yml', EMPTY, 1],
    ['combined case, backslash, inner-dot, doubled variant fails', LOOP, BOT_LOGIN, '.GitHub\\.\\workflows//x.yml', EMPTY, 1],
    ['doubled separator on a LISTED name passes', LOOP, BOT_LOGIN, '.github//workflows/autopilot.yml', LISTED, 0],
  ])('%s', (_n, branch, author, files, listPath, want) => {
    expect(run({ HEAD_REF: branch, PR_AUTHOR: author, PR_FILES: files, AUTOMATION_WORKFLOW_ALLOWLIST: listPath })).toBe(want);
  });

  it('a CI run with no PR_AUTHOR is infrastructure (2), never a silent pass', () => {
    expect(run({ GITHUB_ACTIONS: 'true', HEAD_REF: HUMAN, PR_FILES: OTHER, AUTOMATION_WORKFLOW_ALLOWLIST: EMPTY })).toBe(2);
    expect(run({ CI: 'true', HEAD_REF: HUMAN, PR_FILES: OTHER, AUTOMATION_WORKFLOW_ALLOWLIST: EMPTY })).toBe(2);
  });
  it('a CI run WITH PR_AUTHOR measures normally', () => {
    expect(run({ GITHUB_ACTIONS: 'true', HEAD_REF: HUMAN, PR_AUTHOR: OWNER, PR_FILES: OTHER, AUTOMATION_WORKFLOW_ALLOWLIST: EMPTY })).toBe(0);
  });
});

describe('isLoopBranch: the autopilot loop own prefixes', () => {
  it.each([
    ['claude/x', true],
    ['ccr-1', true],
    ['main', false],
    ['ricky/claude/x', false],
    ['', false],
  ])('%s -> %s', (ref, want) => {
    expect(isLoopBranch(ref)).toBe(want);
  });
});

describe('isLoopPr: loop branch OR the bot author', () => {
  it.each([
    ['claude/x', OWNER, true],
    ['feature/x', BOT_LOGIN, true],
    ['feature/x', OWNER, false],
    ['feature/x', 'dependabot[bot]', false],
    ['feature/x', 'github-actions[bot]', false],
    ['feature/x', '', false],
  ])('%s by %s -> %s', (ref, author, want) => {
    expect(isLoopPr(ref, author)).toBe(want);
  });
});

describe('normalisePath', () => {
  it.each([
    ['.github\\workflows\\x.yml', '.github/workflows/x.yml'],
    ['./.github/workflows/x.yml', '.github/workflows/x.yml'],
    ['././a.md', 'a.md'],
    ['.GitHub/Workflows/x.yml', '.GitHub/Workflows/x.yml'],
    ['.github//workflows/x.yml', '.github/workflows/x.yml'],
    ['.github/./workflows/x.yml', '.github/workflows/x.yml'],
    ['.GitHub\\.\\workflows//x.yml', '.GitHub/workflows/x.yml'],
  ])('%s -> %s', (raw, want) => {
    expect(normalisePath(raw)).toBe(want);
  });
});

describe('violations', () => {
  it('lists only unlisted workflow paths', () => {
    expect(
      violations(['.github/workflows/a.yml', '.github/workflows/b.yml', 'src/x.ts'], ['a.yml']),
    ).toEqual(['.github/workflows/b.yml']);
  });
  it('sees case, separator and ./ variants', () => {
    expect(
      violations(['.GitHub/Workflows/a.yml', '.github\\workflows\\b.yml', './.github/workflows/a.yml'], ['a.yml']),
    ).toEqual(['.GitHub/Workflows/a.yml', '.github/workflows/b.yml']);
  });
});

describe('the committed list', () => {
  it('ships EMPTY: nothing is allowed until the owner adds a name', () => {
    expect(loadAllowlist(ALLOWLIST_PATH)).toEqual({ ok: true, names: [] });
  });
});
