import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// pre-write-block.sh guards >2 KB source writes ONLY inside a checkout that
// ships scripts/safe-write.py. Outside one (~/.claude hooks, scratchpad) the
// recipe it prints cannot run, so it must let the write through.
const HOOK = path.resolve(__dirname, '../.claude/hooks/pre-write-block.sh');
const BIG = 'x'.repeat(3000);
let tmp = '';

function run(filePath: string): number {
  const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath, content: BIG } });
  const env = { ...process.env };
  delete env.SAFEWRITE_HOOK_BYPASS;
  const r = spawnSync('bash', [HOOK], { input: payload, encoding: 'utf8', env });
  return r.status ?? -1;
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pwb-'));
  // A checkout WITH the tooling (.git as a FILE, like a linked worktree).
  fs.mkdirSync(path.join(tmp, 'repo/scripts'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'repo/.git'), 'gitdir: elsewhere\n');
  fs.writeFileSync(path.join(tmp, 'repo/scripts/safe-write.py'), '');
  // A git checkout WITHOUT the tooling (like ~/.claude).
  fs.mkdirSync(path.join(tmp, 'other/.git'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'other/hooks'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'loose'), { recursive: true });
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('pre-write-block scope', () => {
  it('blocks a big source write inside a checkout with safe-write.py', () => {
    expect(run(path.join(tmp, 'repo/src/a.ts'))).toBe(2);
  });
  it('allows a big source write in a git checkout without safe-write.py', () => {
    expect(run(path.join(tmp, 'other/hooks/a.mjs'))).toBe(0);
  });
  it('allows a big source write with no git ancestor at all', () => {
    expect(run(path.join(tmp, 'loose/a.mjs'))).toBe(0);
  });
  it('still allows non-source extensions inside the checkout', () => {
    expect(run(path.join(tmp, 'repo/notes.md'))).toBe(0);
  });
});
