/**
 * PreToolUse guard for Bash / PowerShell.
 *
 * Scope: ONE vector -- `git grep -O<cmd>` / `--open-files-in-pager=<cmd>`, which
 * makes git run its argument as a pager, i.e. arbitrary execution.
 *
 * Why a hook and not a permission rule. A `deny` rule matches a command PREFIX
 * against a glob, which is both too weak and too strong here:
 *   - too weak: `git grep -inOcat` contains no ` -O` token, so every literal
 *     prefix misses it (verified against real git -- it runs, exit 0);
 *   - too strong: a mid-position `Bash(git * -O*)` also swallows `git clone -o`
 *     and `git push -o`, and `deny` cannot be overridden by any allow.
 * A hook can require that argv[0] really is `git` and the subcommand really is
 * `grep`, which is precisely the distinction a glob cannot draw.
 *
 * What this deliberately does NOT do. An earlier draft also flagged destructive
 * `gh` verbs reached through an interpreter (`python3 -c`, `xargs -I {}`). That
 * arm was removed: it fired on ordinary work (`grep -rn "gh pr merge" .claude/`)
 * while `python3 -c "os.system('true && gh pr merge 1')"` walked straight past
 * it, and a command built at runtime from "g" + "h" defeats any static check.
 * Guarding `gh` belongs in permissions.ask (PR #227), which sees the real
 * invocation. Treat this file as a speed-bump against ACCIDENTS, not a security
 * boundary against a determined bypass.
 *
 * Two limits are accepted on purpose, both pinned as tests:
 *   - `git -c core.pager=<cmd>` has the same effect but is an everyday idiom
 *     (`git -c core.pager=cat log`). An unoverridable deny there would cost far
 *     more than it protects -- the over-block that killed the deny-rule attempt.
 *   - a heredoc BODY line beginning with `git grep -O` is flagged, because
 *     telling a heredoc body from a command needs a real shell parser.
 * Command substitution, `bash -c "..."` and dynamically built argv are out of
 * scope by the same reasoning as the removed `gh` arm.
 *
 * Failure posture: a malformed payload allows, but says so via `systemMessage`.
 * Failing closed would brick every shell call on a hook bug.
 *
 * NOTE: contains no doubled backslash on purpose -- the Cowork mount collapses
 * one of a pair written through a heredoc, which twice turned a regex literal
 * into a syntax error while drafting this file. Use BACKSLASH instead.
 */

import { readFileSync } from 'node:fs';

const HOOK_EVENT = 'PreToolUse';
const BACKSLASH = String.fromCharCode(92);

/** Unquoted shell operators that end one command and begin another. */
const SEPARATOR_CHARS = new Set([';', '|', '&']);

/** git's global options that consume the following token as their value. */
const GIT_GLOBAL_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--exec-path',
]);

/**
 * Split a command line into segments of argv tokens, honouring quotes.
 *
 * Quote-awareness is the whole point: a quote-blind split lets `git grep
 * 'foo|bar' -Ocat` break at the pipe INSIDE the search pattern, which discards
 * the git/grep context and lets the flag through. Surrounding quotes are
 * stripped, because the shell strips them before git ever sees the argument --
 * so `git grep "-O" cat` must be read as the flag it becomes.
 */
export function segmentArgv(text) {
  const segments = [];
  let current = [];
  let token = '';
  let started = false;
  let quote = null;

  const endToken = () => {
    if (started) {
      current.push(token);
      token = '';
      started = false;
    }
  };
  const endSegment = () => {
    endToken();
    if (current.length) segments.push(current);
    current = [];
  };

  const chars = Array.from(String(text));
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    // Single quotes are literal in the shell -- no escape processing inside.
    if (quote === "'") {
      if (ch === quote) quote = null;
      else token += ch;
      started = true;
      continue;
    }
    // A backslash escapes the next character, so `can\'t` must NOT be read as
    // opening a quote. Reading it that way swallowed the rest of the line and
    // let a pager flag through unseen.
    if (ch === BACKSLASH && i + 1 < chars.length) {
      token += chars[i + 1];
      i += 1;
      started = true;
      continue;
    }
    if (quote === '"') {
      if (ch === quote) quote = null;
      else token += ch;
      started = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
      continue;
    }
    // A newline separates commands just as ';' does; treating it as plain
    // whitespace let a multi-line script hide behind its own first line.
    if (ch === '\n' || SEPARATOR_CHARS.has(ch)) {
      endSegment();
      continue;
    }
    if (/\s/.test(ch)) {
      endToken();
      continue;
    }
    token += ch;
    started = true;
  }
  endSegment();
  return segments;
}

/** Basename of argv[0], so /usr/bin/git and git.exe still read as `git`. */
function commandName(token) {
  let base = String(token);
  const cut = Math.max(base.lastIndexOf('/'), base.lastIndexOf(BACKSLASH));
  if (cut >= 0) base = base.slice(cut + 1);
  return base.replace(/\.exe$/i, '');
}

/** Strip leading `VAR=value` assignments, which precede the real command. */
function stripEnvAssignments(argv) {
  let i = 0;
  while (i < argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[i])) i += 1;
  return argv.slice(i);
}

/** Index of the git subcommand, skipping git's own global options. */
function subcommandIndex(argv) {
  let i = 1;
  while (i < argv.length) {
    const token = argv[i];
    if (GIT_GLOBAL_WITH_VALUE.has(token)) {
      i += 2;
      continue;
    }
    if (token.startsWith('-')) {
      i += 1;
      continue;
    }
    return i;
  }
  return -1;
}

/**
 * Pager-exec flags, scoped to a real `git grep` invocation.
 *
 * `-O` is the only capital-O short option git grep takes, so `^-[A-Za-z]*O`
 * catches `-O`, `-nO` and the clustered `-inOcat` while leaving the lowercase
 * `-o` of `git clone` / `git push` -- and an unrelated `wget -O` -- alone.
 */
const LONG_PAGER_FLAG = '--open-files-in-pager';

/**
 * git accepts any unambiguous PREFIX of a long option, so `--op=cat` really is
 * `--open-files-in-pager=cat`. An exact startsWith check let those through.
 */
function isPagerFlag(token) {
  const name = token.split('=')[0];
  if (name.length >= 4 && LONG_PAGER_FLAG.startsWith(name)) return true;
  return /^-[A-Za-z]*O/.test(token);
}

export function pagerExecHits(command) {
  const hits = [];
  for (const segment of segmentArgv(command)) {
    const argv = stripEnvAssignments(segment);
    if (!argv.length || commandName(argv[0]) !== 'git') continue;
    const at = subcommandIndex(argv);
    if (at < 0 || argv[at] !== 'grep') continue;
    const rest = argv.slice(at + 1);
    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      // Everything after a bare `--` is a pathspec or a literal pattern rather
      // than a flag: `git grep -n -- "-O2"` is an ordinary search, and denying
      // it would be unoverridable.
      if (token === '--') break;
      // -e/-f consume the NEXT token as a pattern or a file, so it is never a flag.
      if (token === '-e' || token === '-f' || token === '--regexp' || token === '--file') {
        i += 1;
        continue;
      }
      if (isPagerFlag(token)) hits.push(token);
    }
  }
  return hits;
}

export function decide(command) {
  const hits = pagerExecHits(command);
  if (!hits.length) return null;
  return {
    permissionDecision: 'deny',
    permissionDecisionReason:
      'Blocked: ' +
      hits.join(', ') +
      ' makes git grep run its argument as a pager (arbitrary execution). ' +
      'Drop the -O, or run the program directly so the intent is visible.',
  };
}

function main() {
  // Without this, running the file by hand at a terminal blocks until Ctrl+D.
  // All three sibling hooks in this directory carry the same guard.
  if (process.stdin.isTTY) return;
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    process.stdout.write(
      JSON.stringify({
        systemMessage:
          'pre-exec-guard: could not read the hook payload, so this command was NOT screened. Allowing, loudly.',
      }),
    );
    return;
  }
  if (!raw.trim()) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(
      JSON.stringify({
        systemMessage:
          'pre-exec-guard: could not parse the hook payload, so this command was NOT screened. Allowing, loudly.',
      }),
    );
    return;
  }

  const command = payload && payload.tool_input && payload.tool_input.command;
  if (typeof command !== 'string' || !command.trim()) return;

  const verdict = decide(command);
  if (!verdict) return;

  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: HOOK_EVENT, ...verdict } }),
  );
}

const entry = (process.argv[1] || '').split(BACKSLASH).join('/');
if (/pre-exec-guard\.mjs$/.test(entry)) main();
