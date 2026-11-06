#!/usr/bin/env node
// Stop hook: a cloud worker may not end its turn with unpushed commits on a claude/* branch
// (owner decision 2026-11-05, Layer 1 of auto-push; Layer 2 is the [worker-done] marker).
//
// Reads the Stop payload on stdin, finds the current branch in payload.cwd, then:
//   - not on a claude/* branch (or detached)             -> allow (exit 0, silent)
//   - origin unreachable (ls-remote / fetch fails)       -> allow, WARNING on stderr. A network
//                                                           error must never trap a worker.
//   - remote branch missing                              -> every commit not on any origin ref
//                                                           counts as unpushed
//   - else `git fetch origin <branch>`, count `origin/<branch>..HEAD`
//   - nothing unpushed                                   -> allow (silent)
//   - unpushed, first stop                               -> BLOCK: exit 2, one line on stderr
//                                                           (Claude Code feeds it back to the model)
//   - unpushed, stop_hook_active (already blocked once)  -> allow, `PUSH-BLOCKED <branch> <n> commits`
//                                                           on stderr only, so a worker that cannot
//                                                           push never loops.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

// Three git calls at most (ls-remote, fetch, rev-list); 3 x 20s stays inside the 90s hook
// timeout in .claude/settings.json, so a slow network still reaches the WARNING path.
const TIMEOUT_MS = 20_000;

function readPayload() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

function git(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  return { code: r.status ?? -1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

/** @returns {{ code: number, message: string }} the exit code and the stderr line ('' = none). */
function decide(payload) {
  const cwd = (payload && typeof payload.cwd === 'string' && payload.cwd) || process.cwd();
  const head = git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  if (head.code !== 0) return { code: 0, message: '' }; // detached HEAD or not a repo
  const branch = head.out;
  if (!branch.startsWith('claude/')) return { code: 0, message: '' };

  const warn = (what) => ({
    code: 0,
    message: `push-or-block: WARNING could not reach origin for ${branch} (${what}); allowing stop, check the push by hand.`,
  });

  const ls = git(cwd, ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${branch}`]);
  let range;
  if (ls.code === 0) {
    const f = git(cwd, ['fetch', '--quiet', 'origin', `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
    if (f.code !== 0) return warn('fetch failed');
    range = [`refs/remotes/origin/${branch}..HEAD`];
  } else if (ls.code === 2) {
    // Remote branch missing: every commit on no OTHER origin ref is unpushed. The local
    // origin/<branch> tracking ref is stale here (branch deleted on origin) and must not count.
    range = ['HEAD', '--not', `--exclude=origin/${branch}`, '--remotes=origin'];
  } else {
    return warn('ls-remote failed');
  }

  const count = git(cwd, ['rev-list', '--count', ...range]);
  if (count.code !== 0) return warn('rev-list failed');
  const unpushed = Number(count.out) || 0;
  if (unpushed === 0) return { code: 0, message: '' };

  if (payload && payload.stop_hook_active === true) {
    return { code: 0, message: `PUSH-BLOCKED ${branch} ${unpushed} commits` };
  }
  return {
    code: 2,
    message: `Unpushed commits on ${branch}: push now (one push), end the final subject with your [worker-done <ticket>] marker, then stop.`,
  };
}

const { code, message } = decide(readPayload());
if (message) process.stderr.write(message + '\n');
process.exit(code);
