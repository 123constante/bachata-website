import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  ALLOWLIST_PATH,
  isLoopBranch,
  loadAllowlist,
  main,
  violations,
} from '../scripts/check-automation-workflow-allowlist.mjs';

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

const run = (env: Record<string, string>) => main([], env, quiet);

describe('main: the brief’s table, exit code per row', () => {
  it.each([
    ['loop branch, no workflow change', LOOP, 'docs/a.md\nscripts/x.mjs', LISTED, 0],
    ['loop branch, listed workflow', LOOP, '.github/workflows/autopilot.yml', LISTED, 0],
    ['loop branch, unlisted workflow fails', LOOP, '.github/workflows/architecture-guard.yml', LISTED, 1],
    ['loop branch, any workflow vs the EMPTY shipped shape fails', LOOP, '.github/workflows/autopilot.yml', EMPTY, 1],
    ['ccr- loop branch, unlisted workflow fails', 'ccr-abc123', '.github/workflows/e2e-smoke.yml', EMPTY, 1],
    ['loop branch, listed + unlisted together fails', LOOP, '.github/workflows/autopilot.yml\n.github/workflows/e2e-smoke.yml', LISTED, 1],
    ['loop branch, nested file under workflows/ fails', LOOP, '.github/workflows/sub/autopilot.yml', LISTED, 1],
    ['loop branch editing the list itself fails', LOOP, 'scripts/data/automation-workflow-allowlist.json\n.github/workflows/autopilot.yml', LISTED, 1],
    ['human branch editing the list passes', HUMAN, 'scripts/data/automation-workflow-allowlist.json', EMPTY, 0],
    ['human branch, any workflow passes', HUMAN, '.github/workflows/architecture-guard.yml', EMPTY, 0],
    ['human branch, any workflow passes even with no list', HUMAN, '.github/workflows/architecture-guard.yml', MISSING, 0],
    ['missing list on a loop branch is infrastructure', LOOP, '.github/workflows/autopilot.yml', MISSING, 2],
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

describe('isLoopBranch: the autopilot loop’s own prefixes', () => {
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

describe('violations', () => {
  it('lists only unlisted workflow paths', () => {
    expect(
      violations(['.github/workflows/a.yml', '.github/workflows/b.yml', 'src/x.ts'], ['a.yml']),
    ).toEqual(['.github/workflows/b.yml']);
  });
});

describe('the committed list', () => {
  it('ships EMPTY: nothing is allowed until the owner adds a name', () => {
    expect(loadAllowlist(ALLOWLIST_PATH)).toEqual({ ok: true, names: [] });
  });
});
