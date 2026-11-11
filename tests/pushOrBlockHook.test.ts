import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// scripts/hooks/push-or-block.mjs: the Stop hook that refuses to let a cloud worker end its turn
// with unpushed commits on a claude/* branch. Spawned as a process, exactly as Claude Code runs
// it, against a temp clone of a temp bare remote.
const ROOT = path.resolve(__dirname, '..');
const HOOK = path.join(ROOT, 'scripts', 'hooks', 'push-or-block.mjs');
let dir: string;
let n = 0;

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

/** A fresh bare remote plus a clone with one pushed commit on main. */
function repo() {
  n += 1;
  const bare = path.join(dir, `remote-${n}.git`);
  const work = path.join(dir, `work-${n}`);
  git(dir, 'init', '-q', '--bare', '-b', 'main', bare);
  git(dir, 'init', '-q', '-b', 'main', work);
  for (const [k, v] of [['user.email', 't@example.com'], ['user.name', 't'], ['commit.gpgsign', 'false']]) git(work, 'config', k, v);
  git(work, 'remote', 'add', 'origin', bare);
  commit(work, 'base');
  git(work, 'push', '-q', 'origin', 'main');
  return work;
}

function commit(work: string, msg: string) {
  fs.writeFileSync(path.join(work, `${msg}.txt`), msg);
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', msg);
}

function run(cwd: string, payload: Record<string, unknown> = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd,
    input: JSON.stringify({ session_id: 's', hook_event_name: 'Stop', cwd, ...payload }),
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return { code: r.status, err: r.stderr };
}

beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pushorblock-')); });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

type Case = {
  name: string;
  setup: (work: string) => void;
  payload?: Record<string, unknown>;
  code: number;
  err: RegExp | null; // null = stderr must be empty
};

const BLOCK_LINE = /^Unpushed commits on claude\/w: push now \(one push\), end the final subject with your \[worker-done <ticket>\] marker, then stop\.\n?$/;

const CASES: Case[] = [
  {
    name: 'branch not claude/*, unpushed commits: allow',
    setup: (w) => { commit(w, 'local'); },
    code: 0, err: null,
  },
  {
    name: 'claude/* fully pushed: allow',
    setup: (w) => { git(w, 'checkout', '-q', '-b', 'claude/w'); commit(w, 'a'); git(w, 'push', '-q', 'origin', 'claude/w'); },
    code: 0, err: null,
  },
  {
    name: 'claude/* with an unpushed commit, first stop: BLOCK with the one line',
    setup: (w) => { git(w, 'checkout', '-q', '-b', 'claude/w'); commit(w, 'a'); git(w, 'push', '-q', 'origin', 'claude/w'); commit(w, 'b'); },
    code: 2, err: BLOCK_LINE,
  },
  {
    name: 'claude/* with unpushed commits, stop_hook_active (second stop): allow, PUSH-BLOCKED on stderr',
    setup: (w) => { git(w, 'checkout', '-q', '-b', 'claude/w'); commit(w, 'a'); git(w, 'push', '-q', 'origin', 'claude/w'); commit(w, 'b'); commit(w, 'c'); },
    payload: { stop_hook_active: true },
    code: 0, err: /^PUSH-BLOCKED claude\/w 2 commits\n?$/,
  },
  {
    name: 'remote branch missing: every branch commit counts as unpushed, BLOCK',
    setup: (w) => { git(w, 'checkout', '-q', '-b', 'claude/w'); commit(w, 'a'); commit(w, 'b'); },
    code: 2, err: BLOCK_LINE,
  },
  {
    name: 'remote branch missing + stop_hook_active: allow, counts the branch commits',
    setup: (w) => { git(w, 'checkout', '-q', '-b', 'claude/w'); commit(w, 'a'); commit(w, 'b'); commit(w, 'c'); },
    payload: { stop_hook_active: true },
    code: 0, err: /^PUSH-BLOCKED claude\/w 3 commits\n?$/,
  },
  {
    name: 'remote branch deleted after a push, stale origin/claude/w left behind: still BLOCK',
    setup: (w) => {
      git(w, 'checkout', '-q', '-b', 'claude/w'); commit(w, 'a'); git(w, 'push', '-q', 'origin', 'claude/w');
      git(w, 'push', '-q', 'origin', '--delete', 'claude/w');
      git(w, 'update-ref', 'refs/remotes/origin/claude/w', 'HEAD'); // the stale tracking ref
    },
    code: 2, err: BLOCK_LINE,
  },
  {
    name: 'remote branch is AHEAD of local (someone else pushed): nothing unpushed, allow',
    setup: (w) => {
      git(w, 'checkout', '-q', '-b', 'claude/w'); commit(w, 'a'); commit(w, 'b'); git(w, 'push', '-q', 'origin', 'claude/w');
      git(w, 'reset', '-q', '--hard', 'HEAD~1');
    },
    code: 0, err: null,
  },
  {
    name: 'fetch failure (remote unreachable) with unpushed commits: allow with a warning, never trap',
    setup: (w) => { git(w, 'checkout', '-q', '-b', 'claude/w'); commit(w, 'a'); git(w, 'remote', 'set-url', 'origin', path.join(dir, 'no-such-remote.git')); },
    code: 0, err: /^push-or-block: WARNING could not reach origin for claude\/w/,
  },
  {
    name: 'detached HEAD: allow',
    setup: (w) => { commit(w, 'a'); git(w, 'checkout', '-q', '--detach'); },
    code: 0, err: null,
  },
];

describe('push-or-block Stop hook', () => {
  it.each(CASES)('$name', (c) => {
    const work = repo();
    c.setup(work);
    const r = run(work, c.payload);
    expect(r.code).toBe(c.code);
    if (c.err === null) expect(r.err).toBe('');
    else expect(r.err).toMatch(c.err);
  });

  it('blocks once, then allows after the push (the throwaway proof, as a test)', () => {
    const work = repo();
    git(work, 'checkout', '-q', '-b', 'claude/w');
    commit(work, 'a');
    expect(run(work).code).toBe(2);
    git(work, 'push', '-q', 'origin', 'claude/w');
    expect(run(work)).toEqual({ code: 0, err: '' });
  });

  it('uses payload.cwd, not only the process cwd', () => {
    const work = repo();
    git(work, 'checkout', '-q', '-b', 'claude/w');
    commit(work, 'a');
    const r = spawnSync(process.execPath, [HOOK], {
      cwd: dir,
      input: JSON.stringify({ hook_event_name: 'Stop', cwd: work }),
      encoding: 'utf8',
    });
    expect(r.status).toBe(2);
  });

  it('is registered under hooks.Stop in .claude/settings.json, next to the existing hooks, at a real path', () => {
    const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
    const cmds: string[] = (settings.hooks.Stop as Array<{ hooks: Array<{ command: string }> }>)
      .flatMap((g) => g.hooks.map((h) => h.command));
    const mine = cmds.filter((c) => c.includes('push-or-block.mjs'));
    expect(mine).toHaveLength(1);
    const rel = mine[0].match(/node (\S+push-or-block\.mjs)/)?.[1];
    expect(rel).toBe('scripts/hooks/push-or-block.mjs');
    expect(fs.existsSync(path.join(ROOT, rel!))).toBe(true);
    expect(cmds.some((c) => c.includes('session-lock.mjs heartbeat'))).toBe(true);
  });
});
