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

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { isEntryPoint } from '../lib/entry-point.mjs';

const HOOK_EVENT = 'PreToolUse';
const BACKSLASH = String.fromCharCode(92);

/**
 * Unquoted shell operators that end one command and begin another.
 *
 * The parentheses and braces are here for a reason measured in review: without
 * them `(cd sub && npx tsc --noEmit)` parsed argv[0] as the single token `(cd`,
 * the cd was never honoured, and the vacuous config in `sub` was never
 * consulted -- a silent miss whose bare spelling the canary pinned, so the gap
 * read as covered. Treating them as structure costs one thing worth stating:
 * `$(date)` now splits into `echo $` and `date`, so a command SUBSTITUTION is
 * screened as the command it is. That is the direction to err in for a guard.
 */
const SEPARATOR_CHARS = new Set([';', '|', '&', '(', ')', '{', '}']);

/**
 * Remove heredoc BODIES before anything is parsed as a command.
 *
 * A heredoc body is DATA. Vector 1 accepted flagging it as a known false
 * positive because `git grep -O` is vanishingly rare in prose; vector 2 could
 * not, and review measured why: this repo MANDATES heredoc transport for every
 * source write (safe-edit.py's PATCH heredoc, safe-write.py's WRITER heredoc),
 * a deny cannot be overridden by any allow, and the string `tsc --noEmit`
 * appears in this repo's own docs and memory files. Writing a note about the
 * typecheck would have failed the write that describes it.
 *
 * Line-based, and openers are consumed IN ORDER, because one command line may
 * open several (`cmd <<A <<B`) and their bodies arrive in the order opened.
 * `<<<` is a here-STRING, not a heredoc: the third `<` is not a quote or an
 * identifier start, so the tag pattern cannot match it.
 */
export function stripHeredocBodies(text) {
  const lines = String(text).split('\n');
  const kept = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    kept.push(line);
    i += 1;
    // (?<!<) and (?!<) fence off `<<<`, the here-STRING. Without them the
    // second and third angle brackets of `grep foo <<<"bar"` matched as an
    // opener with the tag "bar", and everything after that line was swallowed
    // as a heredoc body that never terminates -- the strip turning into a
    // blanket off switch for the rest of the command.
    const openers = [...line.matchAll(/(?<!<)<<(?!<)(-?)\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/g)].map(
      (m) => ({ dash: m[1] === '-', tag: m[2] ?? m[3] ?? m[4] }),
    );
    for (const { dash, tag } of openers) {
      // BUFFERED, so an unterminated heredoc can be UNDONE. The first version
      // dropped body lines as it went and let an unterminated one swallow the
      // rest of the input "exactly as the shell does" -- but this is not a
      // shell, it is a screen, and the two failure directions are not
      // symmetric. Over-detecting a heredoc is a FAIL-OPEN: both vectors stop
      // screening entirely. Under-detecting one is at worst the false positive
      // vector 1 lived with for months. Review measured the over-detection
      // twice: a `<<` inside a quoted string ("see docs << EOF for details")
      // opened a phantom heredoc that never terminates, and a CRLF payload
      // never matched its own terminator. Both turned the strip into a blanket
      // off switch. Now: no terminator, no strip.
      const body = [];
      let terminated = false;
      while (i < lines.length) {
        const raw = lines[i];
        i += 1;
        // Tolerate CRLF: this repo is Windows-primary and its own .gitattributes
        // forces CRLF, so a terminator carrying a trailing \r is the NORMAL
        // case, not an exotic one. `<<-` strips leading TABS (and only tabs).
        const candidate = (dash ? raw.replace(/^\t+/, '') : raw).replace(/\r$/, '');
        if (candidate === tag) {
          terminated = true;
          kept.push(raw);
          break;
        }
        body.push(raw);
      }
      if (!terminated) {
        // Put every line back and stop looking for further heredocs on this
        // command: whatever that `<<` was, it was not one.
        kept.push(...body);
        break;
      }
    }
  }
  return kept.join('\n');
}

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

  const chars = Array.from(stripHeredocBodies(text));
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

/**
 * Basename of argv[0], so /usr/bin/git and git.exe still read as `git`.
 *
 * The Windows shim extensions are stripped too: npm installs `tsc.cmd` beside
 * `tsc`, and an .exe-only strip missed `tsc.cmd --noEmit` entirely.
 */
function commandName(token) {
  let base = String(token);
  const cut = Math.max(base.lastIndexOf('/'), base.lastIndexOf(BACKSLASH));
  if (cut >= 0) base = base.slice(cut + 1);
  return base.replace(/\.(exe|cmd|bat|ps1)$/i, '');
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

/* ------------------------------ vector 2: a typecheck that checks nothing */

/**
 * `tsc --noEmit` against a tsconfig whose `files` is EMPTY and whose real
 * content is `references` exits 0 having compiled nothing. tsc does not follow
 * project references without `--build`, so the command reads as a whole-repo
 * typecheck and is a no-op. It reported a false green TWICE in one session
 * here, against a real error count of TYPECHECK_BASELINE (91 at the time).
 *
 * SELF-DISABLING BY CONSTRUCTION, which is the whole design. The trigger is
 * not the command string: it is the command string AND the tsconfig that
 * command would actually load being vacuous, read from disk at decision time.
 * Populate `files`, or drop the `references`, and this stops firing by itself
 * with nobody remembering to remove it. A version that pattern-matched
 * `tsc --noEmit` alone would outlive the defect and become an obstacle nobody
 * can explain -- the failure mode of every guard that encodes a symptom.
 *
 * THE NOISE BUDGET, and where "could not determine" belongs. This hook runs on
 * every Bash call, so it says NOTHING about a command that is not a tsc
 * invocation: silence there is the ordinary case, not a suppressed error, and a
 * could-not-check line on every `ls` would train the reader to skim past the
 * one that mattered. Once a `tsc --noEmit` IS positively identified the posture
 * inverts -- a tsconfig that cannot be read or parsed is reported out loud (and
 * allowed), because inside that narrow class a silent pass is indistinguishable
 * from a checked one.
 */

/**
 * Runners that take a package name as their first non-flag argument.
 *
 * `npm` is in the list and is safe, because the verb decides: `npm run
 * typecheck` -- the remedy this guard points people at -- stops at the token
 * after `run`, which is not `tsc`. `npm exec tsc` is the spelling review
 * measured walking straight past an npm-less list.
 */
const TSC_RUNNERS = new Set(['npx', 'pnpx', 'pnpm', 'yarn', 'bunx', 'bun', 'npm']);
/** Runner verbs that precede the package name, not the package itself. */
const RUNNER_VERBS = new Set(['run', 'exec', 'dlx']);
/** Runner flags that CONSUME the next token: `npx -p typescript tsc`. */
const RUNNER_VALUE_FLAGS = new Set(['-p', '--package', '-c', '--call', '-w', '--workspace']);

/**
 * tsc lowercases option NAMES before looking them up, so `--noemit` is
 * `--noEmit`. Measured: `npx tsc --noemit -p tsconfig.app.json` runs and prints
 * real errors, while an exact-match guard returned null -- ALLOW, in silence,
 * for the precise false green this vector exists to stop. The same assumption
 * ran the other way on `--build`: `--Build` is a real build that an exact match
 * would have flagged as the defect.
 */
const isOption = (token, ...names) => {
  const lower = String(token).toLowerCase();
  return names.some((n) => lower === n.toLowerCase());
};
const PROJECT_FLAGS = ['-p', '--project'];

/** Name a thrown value without trusting it to be an Error. */
const why = (err) => (err && (err.code || err.message)) || String(err);

/**
 * The kill switch, read the same way ~/.claude/hooks/lib/ops-common.mjs reads
 * it -- and NOT as bare truthiness, because `CLAUDE_SKIP_OPS_HOOKS=0` is how
 * an operator spells "off" and a truthy test read it as "on".
 *
 * Duplicated rather than imported on purpose: this file ships in the repo and
 * must not depend on a user-level directory that may not exist. Kept to one
 * expression so the two copies are comparable at a glance.
 */
export const opsHooksOff = (env = process.env) => {
  const raw = env.CLAUDE_SKIP_OPS_HOOKS;
  return Boolean(raw) && raw !== '0' && String(raw).toLowerCase() !== 'false';
};

/**
 * The arguments of a `tsc` invocation, or null when this segment is not one.
 *
 * `npm run typecheck` is deliberately not matched: argv[0] is npm, and that
 * script is the CORRECT command this guard points people at. Matching npm here
 * would have the guard block its own remedy.
 */
export function tscArgs(argv) {
  if (!argv.length) return null;
  const head = commandName(argv[0]);
  if (head === 'tsc') return argv.slice(1);
  if (!TSC_RUNNERS.has(head)) return null;
  let i = 1;
  while (i < argv.length && argv[i].startsWith('-')) {
    // A valued runner flag consumes the NEXT token. Skipping only the flag left
    // `i` sitting on its VALUE -- `npx -p typescript tsc` stopped at
    // "typescript", concluded "not tsc", and allowed the run.
    i += RUNNER_VALUE_FLAGS.has(argv[i]) && !argv[i].includes('=') ? 2 : 1;
  }
  if (RUNNER_VERBS.has(argv[i])) i += 1;
  if (i >= argv.length || commandName(argv[i]) !== 'tsc') return null;
  return argv.slice(i + 1);
}

/**
 * Walk up for a tsconfig.json the way tsc itself does when no -p is given.
 *
 * The loop stops on a dirname FIXED POINT rather than on '/': on Windows
 * dirname('C:') is 'C:' forever, so a `!== '/'` guard alone spins at 100% CPU
 * with no timeout -- the same bug, and the same fix, as pre-write-block.sh's
 * repo-root walk and safe-write.py's find_repo_root.
 */
function findConfigUpward(from, exists) {
  let at = path.resolve(from);
  for (;;) {
    const candidate = path.join(at, 'tsconfig.json');
    if (exists(candidate)) return candidate;
    const parent = path.dirname(at);
    if (parent === at) return null;
    at = parent;
  }
}

/**
 * A tsconfig is JSONC, not JSON: comments and trailing commas are legal and
 * this repo's own tsconfig.app.json uses both. Parsing it with JSON.parse was
 * a bug in this guard, and the canary could not see it because the fixture was
 * a hand-written comment-free config -- the probe did not match the target.
 * Measured on the real tree: `tsc -p tsconfig.app.json --noEmit`, the CORRECT
 * command this guard points people at, printed a could-not-screen warning on
 * every single invocation.
 *
 * The strip is string-aware, because a blind regex removes the `//` inside
 * "https://..." and then nothing parses. Trailing commas are dropped in the
 * same scan rather than by a second regex pass, so a comma inside a string
 * literal is never mistaken for one.
 *
 * This reads only enough to answer "files empty, references present". The
 * authoritative reader is typescript's own parseConfigFileTextToJson, and it
 * is deliberately not used: importing typescript costs a few hundred ms of
 * module load on a hook that runs before EVERY Bash command.
 */
export function parseTsconfig(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === BACKSLASH) escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      out += '\n';
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }
    // Outside a string, so anything ending `out` here is structure: a comma
    // before a closing bracket is a trailing comma and nothing else.
    if (ch === '}' || ch === ']') out = out.replace(/,\s*$/, '');
    out += ch;
  }
  try {
    return { ok: true, value: JSON.parse(out) };
  } catch (err) {
    return { ok: false, detail: why(err) };
  }
}

/** Anything that puts source files into the program: a non-empty include or files. */
const compilesSomething = (c) =>
  (Array.isArray(c.include) && c.include.length > 0) || (Array.isArray(c.files) && c.files.length > 0);

/**
 * Empty `files`, at least one `references` entry, and no `include` to compile
 * instead. The `include` clause is load-bearing: `files: []` beside an
 * `include` is an ordinary config that compiles the included tree, and
 * blocking it would be a false positive on a shape nobody would think to test.
 */
export function isVacuousConfig(parsed) {
  return (
    Boolean(parsed) &&
    Array.isArray(parsed.files) &&
    parsed.files.length === 0 &&
    Array.isArray(parsed.references) &&
    parsed.references.length > 0 &&
    !compilesSomething(parsed)
  );
}

/**
 * Every `tsc --noEmit` in the command, classified against the config it would
 * load. `cd` between segments is honoured because `cd sub && npx tsc --noEmit`
 * is an ordinary spelling and resolving its config against the wrong directory
 * would answer a question nobody asked.
 */
/**
 * A reason this command cannot be judged, or null.
 *
 * NARROW WHAT YOU WILL JUDGE. Three of this guard's worst defects came from the
 * same ambition -- emulating enough shell to know which directory a `tsc` runs
 * in. A flat `cd` variable with no scope stack judged
 * `(cd sub && echo hi); npx tsc --noEmit` against sub/'s config, which that
 * command never loads, and turned it into an unoverridable deny naming the
 * wrong file. The answer is not a fourth attempt at a shell: it is to price
 * only what can be read confidently and DECLINE the rest by name.
 *
 * Declining is not silence. The command still gets a line saying it was not
 * screened and why -- rule 2 -- and the deny is reserved for commands whose
 * working directory is not in question.
 */
export function commandAmbiguity(command) {
  const text = String(command);
  // Most specific first: `$(...)` also contains parentheses, and naming it a
  // "subshell or command group" would be true but less useful to the reader.
  if (/\$\(|`/.test(text)) return 'it contains a command substitution, which can expand to anything';
  if (text.includes('<<')) return 'it contains a heredoc, and this guard does not interpret heredoc bodies';
  if (/[(){}]/.test(text)) return 'it contains a subshell or command group, which can run tsc in another directory';
  for (const segment of segmentArgv(text)) {
    const argv = stripEnvAssignments(segment);
    if (argv.length && commandName(argv[0]) === 'cd') {
      return 'it changes directory, so the tsconfig tsc loads is not the one this working directory implies';
    }
  }
  return null;
}

export function typecheckHits(command, deps) {
  const { cwd, readFile, exists } = deps;
  const hits = [];
  // ALWAYS the shell's own working directory. Tracking `cd` was the third
  // parser failure in one review round -- see commandAmbiguity, which now
  // declines any command carrying one instead of guessing where it landed.
  const at = cwd;
  const ambiguity = commandAmbiguity(command);
  for (const segment of segmentArgv(command)) {
    const argv = stripEnvAssignments(segment);
    if (!argv.length) continue;
    const args = tscArgs(argv);
    if (args === null) continue;
    // --build / -b DOES follow project references, so it is the one spelling
    // of this command that checks what it claims to. Never flag it.
    if (args.some((t) => isOption(t, '--build', '-b'))) continue;
    if (!args.some((t) => isOption(t, '--noEmit'))) continue;
    if (ambiguity) {
      hits.push({ state: 'unjudgeable', configPath: null, detail: ambiguity });
      continue;
    }
    let configPath = null;
    for (let i = 0; i < args.length; i += 1) {
      const eq = /^(--project|-p)=(.+)$/i.exec(args[i]);
      if (eq) {
        configPath = path.resolve(at, eq[2]);
        break;
      }
      if (isOption(args[i], ...PROJECT_FLAGS) && i + 1 < args.length) {
        configPath = path.resolve(at, args[i + 1]);
        break;
      }
    }
    // tsc accepts a DIRECTORY after -p and looks for tsconfig.json inside it.
    if (configPath && exists(configPath) && !/[.]json$/i.test(configPath)) {
      configPath = path.join(configPath, 'tsconfig.json');
    }
    if (!configPath) configPath = findConfigUpward(at, exists);
    if (!configPath) {
      hits.push({ state: 'unknown', configPath: null, detail: 'no tsconfig.json found above ' + at });
      continue;
    }
    let raw;
    try {
      raw = readFile(configPath);
    } catch (err) {
      hits.push({ state: 'unknown', configPath, detail: why(err) });
      continue;
    }
    const parsed = parseTsconfig(raw);
    if (!parsed.ok) {
      hits.push({ state: 'unknown', configPath, detail: parsed.detail });
      continue;
    }
    // `extends` is REPORTED, not resolved. A child's own `files` replaces the
    // base's outright, so a config declaring either key is decidable from
    // itself; one declaring NEITHER while extending could be vacuous through
    // its base and this guard would be guessing to say otherwise. Resolving
    // that chain means handling package-name bases and cycles for a shape no
    // config in this repo uses -- unexercised complexity in a hook on the
    // critical path of every command. Naming the gap is the honest trade.
    const own = parsed.value || {};
    if (
      own.extends !== undefined &&
      own.files === undefined &&
      own.references === undefined &&
      !compilesSomething(own)
    ) {
      hits.push({
        state: 'unknown',
        configPath,
        detail:
          'declares no files, include or references of its own and extends ' +
          JSON.stringify(own.extends) +
          ', so its vacuity is decided by a base this guard does not resolve',
      });
      continue;
    }
    if (isVacuousConfig(own)) hits.push({ state: 'vacuous', configPath, detail: '' });
  }
  return hits;
}

/**
 * The baseline the remedy must be compared against, READ from the file that
 * owns it. Never copied: it moved 106 -> 95 -> 91 in recorded history and will
 * move again, and a number copied into a message has no writer maintaining it.
 */
export function typecheckBaseline(deps, fromDir) {
  // Walk up from the OFFENDING TSCONFIG, not from the hook's own cwd. The
  // remedy has to belong to the same project as the defect: resolving it
  // against the hook's directory quoted Website's baseline at a command run in
  // another checkout entirely, which is advice that does not apply there.
  const start = path.resolve(fromDir || deps.cwd);
  let at = start;
  for (;;) {
    const candidate = path.join(at, 'scripts', 'pre-ship.mjs');
    if (deps.exists(candidate)) {
      try {
        const found = /TYPECHECK_BASELINE\s*=\s*(\d+)/.exec(deps.readFile(candidate));
        return found
          ? { count: Number(found[1]), from: candidate }
          : { detail: 'no TYPECHECK_BASELINE assignment in ' + candidate };
      } catch (err) {
        return { detail: why(err) };
      }
    }
    const parent = path.dirname(at);
    if (parent === at) return { detail: 'no scripts/pre-ship.mjs above ' + start };
    at = parent;
  }
}

/** Real filesystem, real cwd. The canary substitutes all three. */
export function defaultDeps() {
  return {
    env: process.env,
    cwd: process.cwd(),
    readFile: (p) => readFileSync(p, 'utf8'),
    exists: (p) => existsSync(p),
  };
}

/**
 * The verdict. `deny` blocks and hands the reason to the agent; `systemMessage`
 * allows and says why nothing was screened. Two vectors, one decision point,
 * and the pager vector is tested first because it is an execution risk while
 * the other is a correctness one.
 */
export function decide(command, deps = defaultDeps()) {
  const hits = pagerExecHits(command);
  if (hits.length) {
    return {
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Blocked: ' +
        hits.join(', ') +
        ' makes git grep run its argument as a pager (arbitrary execution). ' +
        'Drop the -O, or run the program directly so the intent is visible.',
    };
  }

  // The kill switch scopes to THIS vector only. It used to sit at the top of
  // main(), where it also switched off the pager-execution block above -- an
  // arbitrary-execution guard disabled by a variable whose documented purpose
  // is quieting four advisory session hooks, and disabled in silence, since
  // the SessionStart digest that announces the switch never listed this file.
  if (opsHooksOff(deps.env)) return null;

  const typecheck = typecheckHits(command, deps);
  const vacuous = typecheck.find((h) => h.state === 'vacuous');
  if (vacuous) {
    const baseline = typecheckBaseline(deps, path.dirname(vacuous.configPath));
    // PROJECT-AGNOSTIC. The baseline PATH beside this was already resolved from
    // the offending project, but the advice still named `npm run typecheck` and
    // `tsconfig.app.json` -- Website's spelling, sent as an unoverridable deny
    // to a reader in a checkout that has neither. The fix was applied to the
    // number and not to the sentence around it.
    const remedy =
      baseline.count !== undefined
        ? "Point tsc at a config that actually has `files` or `include` -- this project's own typecheck " +
          'script is the one to run -- and diff the error count against the baseline of ' +
          baseline.count +
          ' in ' +
          baseline.from +
          ', never against 0.'
        : 'Point tsc at a config that actually has `files` or `include`, and compare the error count against ' +
          'the last known-good one rather than against 0 (no baseline was found here: ' +
          baseline.detail +
          ').';
    return {
      permissionDecision: 'deny',
      permissionDecisionReason:
        'Blocked: this typecheck checks NOTHING. ' +
        vacuous.configPath +
        ' has "files": [] and only project references, and tsc does not follow references ' +
        'without --build -- so this command exits 0 having compiled no files at all. ' +
        remedy +
        ' If you really did mean to build the referenced projects, add --build. ' +
        'This block reads the tsconfig at decision time: fix the tsconfig and it stops firing.',
    };
  }

  const unjudgeable = typecheck.find((h) => h.state === 'unjudgeable');
  if (unjudgeable) {
    return {
      systemMessage:
        'pre-exec-guard: this command runs `tsc --noEmit`, but it was NOT screened for the empty-files ' +
        'false green because ' +
        unjudgeable.detail +
        '. Allowing -- if it exits 0, check for yourself which tsconfig it loaded before believing that 0.',
    };
  }

  const unknown = typecheck.find((h) => h.state === 'unknown');
  if (unknown) {
    return {
      systemMessage:
        'pre-exec-guard: this is a `tsc --noEmit`, but the tsconfig it would load was NOT ' +
        'screened for the empty-files false green (' +
        (unknown.configPath || 'no config resolved') +
        ': ' +
        unknown.detail +
        '). Allowing, loudly -- if it exits 0, that 0 is unverified.',
    };
  }
  return null;
}

/** The hook payload this verdict becomes, or null for silence. */
export function respond(command, deps = defaultDeps()) {
  const verdict = decide(command, deps);
  if (!verdict) return null;
  if (verdict.systemMessage) return { systemMessage: verdict.systemMessage };
  return { hookSpecificOutput: { hookEventName: HOOK_EVENT, ...verdict } };
}

/**
 * Read the payload, screen the command, print the verdict.
 *
 * Both collaborators are injected so the canary can drive this whole path with
 * no filesystem and no stdin -- the seam check-ci-budget.mjs established, and
 * the reason case 13 can measure the function the hook chain really calls
 * rather than asserting it from the outside.
 */
export function main(deps = defaultDeps(), readPayload = () => readFileSync(0, 'utf8')) {
  let raw = '';
  try {
    raw = readPayload();
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

  // THE SHELL'S cwd, NOT THIS PROCESS'S. settings.json invokes this hook as
  // `cd "${CLAUDE_PROJECT_DIR:-.}" && node ...`, so process.cwd() is pinned to
  // the project directory while the Bash tool's own working directory persists
  // across calls and can be anywhere -- this session is configured for several
  // checkouts. The payload carries `cwd`; reading it and then discarding it
  // meant a `tsc --noEmit` run in the admin checkout got an unoverridable deny
  // naming a Website tsconfig it has no relation to, and a genuinely vacuous
  // config in the shell's real directory was judged against Website's and
  // allowed. Fall back to this process's cwd only when the payload omits it.
  const cwd = typeof payload.cwd === 'string' && payload.cwd.trim() ? payload.cwd : deps.cwd;

  const payloadOut = respond(command, { ...deps, cwd });
  if (!payloadOut) return;
  process.stdout.write(JSON.stringify(payloadOut));
}

/* --------------------------------------------------------------- self-test */

/**
 * Both directions for both vectors, driving respond() -- the function whose
 * return value IS this hook's stdout, which for a hook is what R5 calls the
 * exit owner -- and then main() itself over real payloads, so the read-parse-
 * print path is measured rather than asserted.
 *
 * Every case injects deps, so no case touches a real filesystem or this repo's
 * own tsconfig. That matters for more than speed: a canary that read the live
 * tsconfig.json would go green the day someone fixed it, which is the guard
 * silently switching off dressed as a pass.
 */
export function selfTest() {
  let failures = 0;
  const fail = (m) => {
    console.error('  FAIL ' + m);
    failures += 1;
  };
  const ROOT = path.resolve('/fixture-repo');
  const at = (...parts) => path.join(ROOT, ...parts);

  // `env: {}` by default, so no case can be steered by the REAL environment.
  // Without it a fixture reading deps.env fell through to process.env, and the
  // kill-switch cases had to mutate the live environment to say anything --
  // which review caught leaking, because the restore sat outside any finally
  // and this canary now runs inside a vitest worker.
  const depsWith = (files, cwd = ROOT, env = {}) => ({
    env,
    cwd,
    exists: (p) => Object.prototype.hasOwnProperty.call(files, path.resolve(p)),
    readFile: (p) => {
      const key = path.resolve(p);
      if (!Object.prototype.hasOwnProperty.call(files, key)) {
        const err = new Error('ENOENT: no such file, open ' + key);
        err.code = 'ENOENT';
        throw err;
      }
      return files[key];
    },
  });

  const VACUOUS = JSON.stringify({ files: [], references: [{ path: './tsconfig.app.json' }] });
  const REAL = JSON.stringify({ include: ['src'], compilerOptions: {} });
  const preShip = (n) => 'export const TYPECHECK_BASELINE = ' + n + ';';

  const vacuousRepo = depsWith({
    [at('tsconfig.json')]: VACUOUS,
    [at('tsconfig.app.json')]: REAL,
    [at('scripts', 'pre-ship.mjs')]: preShip(91),
  });

  // 1. THE DEFECT ITSELF: the vacuous root config blocks, and the message
  //    carries the baseline READ from pre-ship.mjs rather than a copy.
  const blocked = decide('npx tsc --noEmit', vacuousRepo);
  if (!blocked || blocked.permissionDecision !== 'deny') fail('a vacuous tsconfig did not block');
  else if (!/baseline of 91 in /.test(blocked.permissionDecisionReason))
    fail('the block did not quote the baseline from pre-ship.mjs');
  else if (!blocked.permissionDecisionReason.includes(at('scripts', 'pre-ship.mjs')))
    fail('the block did not name the file the baseline came from');

  // 2. THE BASELINE IS READ, NOT COPIED. Same command, a moved baseline: if the
  //    number were hardcoded this case would still say 91 and pass case 1.
  const moved = decide(
    'npx tsc --noEmit',
    depsWith({
      [at('tsconfig.json')]: VACUOUS,
      [at('scripts', 'pre-ship.mjs')]: preShip(42),
    }),
  );
  if (!/baseline of 42/.test(moved?.permissionDecisionReason || '')) fail('a moved TYPECHECK_BASELINE was not reflected');

  // 3. An unreadable pre-ship.mjs must still BLOCK -- the defect does not stop
  //    being a defect because the remedy's number is missing -- and must say so.
  const noBaseline = decide('tsc --noEmit', depsWith({ [at('tsconfig.json')]: VACUOUS }));
  if (noBaseline?.permissionDecision !== 'deny') fail('a missing baseline turned the block off');
  else if (!/no baseline was found here/.test(noBaseline.permissionDecisionReason))
    fail('a missing baseline was not reported');
  else if (!/no scripts\/pre-ship\.mjs above/.test(noBaseline.permissionDecisionReason))
    fail('a missing baseline did not say WHERE it looked');

  // 4. SELF-DISABLING. Populate files, or drop references, and the guard is
  //    silent -- with no edit to this file.
  const populated = JSON.stringify({ files: ['src/main.tsx'], references: [{ path: './x.json' }] });
  if (decide('tsc --noEmit', depsWith({ [at('tsconfig.json')]: populated })) !== null)
    fail('a populated files[] still blocked');
  if (decide('tsc --noEmit', depsWith({ [at('tsconfig.json')]: REAL })) !== null)
    fail('an ordinary tsconfig blocked');

  // 5. --build DOES follow references, so it is never the defect.
  if (decide('tsc --build --noEmit', vacuousRepo) !== null) fail('--build was blocked');
  if (decide('tsc -b --noEmit', vacuousRepo) !== null) fail('-b was blocked');

  // 6. The REMEDY must never be blocked, in either spelling.
  if (decide('npm run typecheck', vacuousRepo) !== null) fail('npm run typecheck was blocked');
  if (decide('react-router typegen && tsc -p tsconfig.app.json --noEmit', vacuousRepo) !== null)
    fail('the real typecheck command (-p tsconfig.app.json) was blocked');

  // 7. No --noEmit at all is out of scope, stated rather than assumed.
  if (decide('tsc -p tsconfig.json', vacuousRepo) !== null) fail('a bare tsc was blocked');

  // 8. A `cd` makes the target undecidable, so it is DECLINED rather than
  //    resolved against a directory this guard only thinks the shell is in.
  //    This case used to assert the opposite -- see group 17 for what that
  //    cost.
  const nested = depsWith({
    [at('sub', 'tsconfig.json')]: VACUOUS,
    [at('tsconfig.json')]: REAL,
    [at('scripts', 'pre-ship.mjs')]: preShip(7),
  });
  const cdHit = decide('cd sub && npx tsc --noEmit', nested);
  if (cdHit?.permissionDecision === 'deny') fail('a cd command was judged rather than declined');
  if (!/changes directory/.test(cdHit?.systemMessage || '')) fail('a cd command was not declined by name');

  // 9. The upward walk finds the root config from a subdirectory, and
  //    terminates on a path with no tsconfig anywhere above it.
  const upward = decide('tsc --noEmit', depsWith({ [at('tsconfig.json')]: VACUOUS }, at('src', 'deep')));
  if (upward?.permissionDecision !== 'deny') fail('the upward tsconfig walk did not reach the root config');
  const nowhere = decide('tsc --noEmit', depsWith({}, at('src')));
  if (!nowhere?.systemMessage || !/no tsconfig\.json found/.test(nowhere.systemMessage))
    fail('a missing tsconfig was not reported as unchecked');

  // 10. COULD-NOT-CHECK IS NOT A PASS. An unparseable tsconfig allows -- and
  //     says the 0 it is about to print is unverified. A silent null here would
  //     be this hook committing the exact defect it guards.
  const unparseable = decide('tsc --noEmit', depsWith({ [at('tsconfig.json')]: '{ // comment' }));
  if (unparseable?.permissionDecision === 'deny') fail('an unparseable tsconfig blocked (it must allow)');
  if (!/NOT screened/.test(unparseable?.systemMessage || '')) fail('an unparseable tsconfig passed in silence');

  // 10b. JSONC IS THE FORMAT, and this case is copied from the byte that broke
  //      it: tsconfig.app.json's `/* Bundler mode */`. The fixture above was
  //      hand-written comment-free JSON, so every rule passed while the real
  //      remedy command warned on every invocation. A `//` inside a string
  //      must survive the strip, a trailing comma must not break it, and a
  //      genuinely broken config must still report.
  const jsonc = [
    '{',
    '  // leading comment',
    '  "compilerOptions": {',
    '    /* Bundler mode */',
    '    "moduleResolution": "bundler",',
    '    "paths": { "@/*": ["./src/*"] },',
    '    "homepage": "https://example.com/x",',
    '  },',
    '  "include": ["src"],',
    '}',
  ].join('\n');
  const jsoncParsed = parseTsconfig(jsonc);
  if (!jsoncParsed.ok) fail('a real-shaped JSONC tsconfig did not parse: ' + jsoncParsed.detail);
  else if (jsoncParsed.value.compilerOptions.homepage !== 'https://example.com/x')
    fail('the comment strip ate a // inside a string literal');
  if (decide('tsc -p tsconfig.app.json --noEmit', depsWith({ [at('tsconfig.app.json')]: jsonc })) !== null)
    fail('an ordinary JSONC tsconfig was not read cleanly');
  if (parseTsconfig('{ "files": [] ').ok) fail('a genuinely truncated config parsed');

  // 10c. A vacuous config written as JSONC is still vacuous -- the strip must
  //      not be a way to smuggle the defect past the guard.
  const vacuousJsonc = '{\n  // root\n  "files": [],\n  "references": [{ "path": "./a.json" }],\n}';
  if (decide('tsc --noEmit', depsWith({ [at('tsconfig.json')]: vacuousJsonc }))?.permissionDecision !== 'deny')
    fail('a vacuous JSONC config slipped through the strip');

  // 10d. `extends` with no local files/references is UNDECIDABLE here, and says
  //      so rather than passing. A local declaration is decidable and does not.
  const inherits = decide(
    'tsc --noEmit',
    depsWith({ [at('tsconfig.json')]: '{ "extends": "./base.json" }' }),
  );
  if (!/extends/.test(inherits?.systemMessage || '')) fail('an extends-only config was silently passed');
  if (
    decide('tsc --noEmit', depsWith({ [at('tsconfig.json')]: '{ "extends": "./base.json", "include": ["src"] }' })) !==
    null
  )
    fail('an extending config that declares its own include was reported as undecidable');

  // 14. HEREDOC BODIES ARE DATA. This is the finding that mattered most: a
  //     deny cannot be overridden by any allow, and this repo MANDATES heredoc
  //     transport for every source write. Before the strip, writing a note
  //     whose text mentions this very command failed the write.
  const heredoc = (body) => ['cat > notes.md <<' + "'EOF'", body, 'EOF'].join('\n');
  if (decide(heredoc('npx tsc --noEmit is vacuous against the root config'), vacuousRepo) !== null)
    fail('a heredoc BODY line was screened as a command (this blocks safe-write)');
  if (decide(heredoc('git grep -O cat foo'), vacuousRepo) !== null)
    fail("vector 1's heredoc false positive was not retired by the strip");
  //     ...and the strip must not swallow what follows the TERMINATOR. Vector 2
  //     declines any command carrying a heredoc at all, so this property is
  //     asserted where it still bites: the execution vector, which does screen
  //     the rest of the command. Review measured two ways of losing it, both
  //     fail-OPEN for both vectors.
  const CR = String.fromCharCode(13);
  const afterTerminator = ['cat > f <<EOF', 'harmless', 'EOF', 'git grep -O cat foo'];
  if (pagerExecHits(afterTerminator.join('\n')).length !== 1)
    fail('the strip swallowed the command after the terminator');
  if (pagerExecHits(afterTerminator.join(CR + '\n')).length !== 1)
    fail('a CRLF payload never matched its own terminator, so the strip ate the whole command');
  //     ...and the CRLF case must still STRIP a real body. Mutation testing
  //     found this gap: with the fail-safe restore in place, breaking CRLF
  //     tolerance no longer swallows anything, so the assertion above passes
  //     while every heredoc on a CRLF payload silently stops being stripped --
  //     which on this repo, whose .gitattributes forces CRLF, is most of them.
  //     A regression that only shows up as the RETURN of a false positive
  //     needs a case that asserts the false positive is gone.
  //     The terminator must NOT be the last line: join() leaves no CR after the
  //     final element, so a terminator-last fixture matches even with CRLF
  //     tolerance removed and the case proves nothing. Two drafts of this
  //     assertion scored ZERO against a mutant before the fixture was right.
  if (pagerExecHits(['cat > f <<EOF', 'git grep -O cat foo', 'EOF', 'echo done'].join(CR + '\n')).length !== 0)
    fail('a CRLF heredoc body was screened as a command -- the strip did not fire');
  if (pagerExecHits('echo "see docs << EOF for details"\ngit grep -O cat foo').length !== 1)
    fail('a << inside a quoted string opened a phantom heredoc that swallowed the rest');
  if (pagerExecHits('grep -rn "x<<y" src\ngit grep -O cat foo').length !== 1)
    fail('a << inside a search pattern opened a phantom heredoc');
  //     An UNTERMINATED heredoc must put its lines back rather than eat them:
  //     over-detection is a fail-open, under-detection is a false positive, and
  //     only one of those stops the guard screening.
  if (pagerExecHits(['cat > f <<NOPE', 'git grep -O cat foo'].join('\n')).length !== 1)
    fail('an unterminated heredoc swallowed the rest of the command');
  //     Unquoted and tab-stripped terminators are the same mechanism.
  if (decide(['cat > f <<EOF', 'npx tsc --noEmit', 'EOF'].join('\n'), vacuousRepo) !== null)
    fail('an unquoted heredoc tag was not honoured');
  if (decide(['cat > f <<-EOF', 'npx tsc --noEmit', '\tEOF'].join('\n'), vacuousRepo) !== null)
    fail('a <<- heredoc with a tab-indented terminator was not honoured');
  //     A here-STRING is not a heredoc, and must not eat the rest of the input.
  //     Asserted on the execution vector for the same reason as above: vector 2
  //     declines anything containing `<<` without looking further.
  if (pagerExecHits('grep foo <<<"bar"\ngit grep -O cat foo').length !== 1)
    fail('a here-string was mistaken for a heredoc opener');

  // 15. CASE. tsc lowercases option names, so an exact match let the defect
  //     through on one keystroke and flagged a real build on another.
  if (decide('npx tsc --noemit', vacuousRepo)?.permissionDecision !== 'deny') fail('--noemit walked past the vector');
  if (decide('npx tsc --NOEMIT', vacuousRepo)?.permissionDecision !== 'deny') fail('--NOEMIT walked past the vector');
  if (decide('tsc --Build --noEmit', vacuousRepo) !== null) fail('--Build was flagged as the defect');
  if (decide('tsc -P tsconfig.app.json --noEmit', depsWith({ [at('tsconfig.app.json')]: REAL })) !== null)
    fail('-P was not read as the project flag');

  // 16. RUNNER SPELLINGS, every one of them measured walking past the guard.
  for (const spelling of [
    'npm exec tsc --noEmit',
    'npx -p typescript tsc --noEmit',
    'npx --package typescript tsc --noEmit',
    'pnpm dlx tsc --noEmit',
    'yarn dlx tsc --noEmit',
    'tsc.cmd --noEmit',
    './node_modules/.bin/tsc --noEmit',
  ]) {
    if (decide(spelling, vacuousRepo)?.permissionDecision !== 'deny') fail('this spelling was not screened: ' + spelling);
  }
  //     ...and the remedy is still never blocked, npm being in the runner list.
  if (decide('npm run typecheck', vacuousRepo) !== null) fail('npm run typecheck was blocked after npm joined the runners');
  if (decide('npm run build', vacuousRepo) !== null) fail('an unrelated npm script was screened');

  // 17. AMBIGUITY IS DECLINED, NOT GUESSED. Every spelling here was previously
  //     JUDGED by tracking `cd` in a flat variable with no scope stack -- and
  //     `(cd sub && echo hi); npx tsc --noEmit` was measured resolving to
  //     sub/'s config, which that command never loads, as an unoverridable
  //     deny naming the wrong file. Now each one is declined BY NAME.
  const nested2 = depsWith({
    [at('sub', 'tsconfig.json')]: VACUOUS,
    [at('tsconfig.json')]: REAL,
    [at('scripts', 'pre-ship.mjs')]: preShip(3),
  });
  const declines = [
    ['(cd sub && npx tsc --noEmit)', /subshell or command group/],
    ['cd sub && npx tsc --noEmit', /changes directory/],
    ['(cd sub && echo hi) ; npx tsc --noEmit', /subshell or command group/],
    ['cd sub | cat ; npx tsc --noEmit', /changes directory/],
    ['cd -P sub && npx tsc --noEmit', /changes directory/],
    ['npx tsc --noEmit $(cat flags.txt)', /command substitution/],
    [['cat > f <<EOF', 'x', 'EOF', 'npx tsc --noEmit'].join('\n'), /heredoc/],
  ];
  for (const [spelling, reason] of declines) {
    const verdict = decide(spelling, nested2);
    if (verdict?.permissionDecision === 'deny') fail('an ambiguous command was DENIED rather than declined: ' + spelling);
    else if (!reason.test(verdict?.systemMessage || '')) fail('the decline did not name its reason for: ' + spelling);
  }
  //     Declining is not silence, and it is not a pass either: the line says
  //     the 0 it is about to print is unverified.
  const declined = decide('cd sub && npx tsc --noEmit', nested2);
  if (!/NOT screened/.test(declined?.systemMessage || '')) fail('a declined command was passed quietly');

  //     A command with NO ambiguity is still judged, against the shell's own
  //     directory -- otherwise the narrowing would have switched the vector off.
  const plainHit = decide('npx tsc --noEmit', depsWith({
    [at('tsconfig.json')]: VACUOUS,
    [at('scripts', 'pre-ship.mjs')]: preShip(3),
  }));
  if (plainHit?.permissionDecision !== 'deny') fail('narrowing switched the vector off for an unambiguous command');
  if (!/baseline of 3/.test(plainHit.permissionDecisionReason)) fail('the baseline was not read for the judged command');
  if (!plainHit.permissionDecisionReason.includes(at('scripts', 'pre-ship.mjs')))
    fail('the block did not name the pre-ship.mjs it actually read');
  //     ...and its advice names no repo-specific script or config file.
  if (/npm run typecheck|tsconfig\.app\.json/.test(plainHit.permissionDecisionReason))
    fail('the deny gave repo-specific advice, which is wrong in every other checkout');

  // 11. Vector 1 is untouched, both directions.
  if (decide('git grep -O cat foo', vacuousRepo)?.permissionDecision !== 'deny') fail('the pager vector stopped blocking');
  if (decide('git status', vacuousRepo) !== null) fail('an ordinary command was flagged');

  // 12. respond() puts each verdict in the field the harness reads: a deny goes
  //     inside hookSpecificOutput, a warning is top-level systemMessage. Swap
  //     them and the block silently stops blocking while this file still says
  //     "deny" -- so the shape is asserted, not just the decision.
  const denyOut = respond('npx tsc --noEmit', vacuousRepo);
  if (denyOut?.hookSpecificOutput?.permissionDecision !== 'deny') fail('respond() lost the deny');
  if (denyOut?.hookSpecificOutput?.hookEventName !== HOOK_EVENT) fail('respond() lost the event name');
  const warnOut = respond('tsc --noEmit', depsWith({ [at('tsconfig.json')]: '{oops' }));
  if (!warnOut?.systemMessage) fail('respond() lost the systemMessage');
  if (warnOut?.hookSpecificOutput) fail('a warning was wrapped as a permission decision');
  if (respond('git status', vacuousRepo) !== null) fail('respond() spoke about an ordinary command');

  // 13. THE READ-PARSE-PRINT PATH, driven for real. Everything above proves the
  //     rules; this proves the function the hook chain actually invokes, which
  //     is the half R5 exists to insist on. stdout is captured the way
  //     session-lock's canary captures it.
  const realWrite = process.stdout.write.bind(process.stdout);
  let printed = '';
  const capture = (fn) => {
    printed = '';
    process.stdout.write = (s) => ((printed += s), true);
    try {
      fn();
    } finally {
      process.stdout.write = realWrite;
    }
    return printed;
  };
  const payloadOf = (command) => JSON.stringify({ tool_name: 'Bash', tool_input: { command } });

  const printedDeny = capture(() => main(vacuousRepo, () => payloadOf('npx tsc --noEmit')));
  if (!/"permissionDecision":"deny"/.test(printedDeny)) fail('main() did not print the deny payload');
  const printedNothing = capture(() => main(vacuousRepo, () => payloadOf('git status')));
  if (printedNothing !== '') fail('main() printed something about an ordinary command');
  const printedGarbage = capture(() => main(vacuousRepo, () => 'not json'));
  if (!/NOT screened/.test(printedGarbage)) fail('a malformed payload was swallowed in silence');
  const printedUnread = capture(() =>
    main(vacuousRepo, () => {
      throw new Error('stdin closed');
    }),
  );
  if (!/NOT screened/.test(printedUnread)) fail('an unreadable payload was swallowed in silence');

  //     THE PAYLOAD'S cwd GOVERNS. settings.json pins this process's cwd to the
  //     project directory, so a command run in another checkout was judged
  //     against the wrong tsconfig entirely -- denied for a file it never
  //     touches, or allowed while its own config was vacuous.
  const elsewhere = path.resolve('/other-checkout');
  const twoTrees = depsWith({
    [at('tsconfig.json')]: REAL,
    [path.join(elsewhere, 'tsconfig.json')]: VACUOUS,
    [path.join(elsewhere, 'scripts', 'pre-ship.mjs')]: preShip(5),
  });
  const printedElsewhere = capture(() =>
    main(twoTrees, () => JSON.stringify({ tool_name: 'Bash', cwd: elsewhere, tool_input: { command: 'npx tsc --noEmit' } })),
  );
  if (!/"permissionDecision":"deny"/.test(printedElsewhere))
    fail("a vacuous config in the payload's cwd was not screened");
  if (!printedElsewhere.includes('baseline of 5')) fail('the baseline came from the wrong project');
  const printedHere = capture(() => main(twoTrees, () => payloadOf('npx tsc --noEmit')));
  if (printedHere !== '') fail("the hook's own cwd was judged when the payload named another");

  //     THE KILL SWITCH, and the half review found missing: it must NOT switch
  //     off the arbitrary-execution block. It is silent for the typecheck
  //     vector by design -- this hook fires on every Bash call, so a
  //     per-command reminder would be the noise nobody reads.
  const off = depsWith({ [at('tsconfig.json')]: VACUOUS }, ROOT, { CLAUDE_SKIP_OPS_HOOKS: '1' });
  if (decide('npx tsc --noEmit', off) !== null) fail('CLAUDE_SKIP_OPS_HOOKS did not disable the typecheck vector');
  if (decide('git grep -O cat foo', off)?.permissionDecision !== 'deny')
    fail('the kill switch disabled the ARBITRARY EXECUTION block -- it must never reach vector 1');
  //     "0" and "false" are how an operator spells off; bare truthiness read
  //     them as on.
  for (const spelling of ['0', 'false', 'FALSE', '']) {
    const stillOn = depsWith({ [at('tsconfig.json')]: VACUOUS }, ROOT, { CLAUDE_SKIP_OPS_HOOKS: spelling });
    if (decide('npx tsc --noEmit', stillOn)?.permissionDecision !== 'deny')
      fail('CLAUDE_SKIP_OPS_HOOKS=' + JSON.stringify(spelling) + ' was read as ON');
  }

  if (failures) {
    console.error('pre-exec-guard --self-test: ' + failures + ' FAILURE(S)');
    return 1;
  }
  // No group count in this line. It said "13 groups" while four more had been
  // added beside it, which is the same defect CLAUDE.md removed from its own
  // guard count: a number copied into prose has no writer maintaining it.
  console.log('pre-exec-guard --self-test: OK (both vectors, both directions)');
  return 0;
}

// REALPATH TO REALPATH -- see scripts/lib/entry-point.mjs. The suffix test that
// stood here was junction-SAFE but failed open in the mirror direction: any
// importing process whose own argv[1] ended in this basename fired the whole
// hook as an import side effect. isEntryPoint() answers the question once, and
// says so on stderr when it cannot.
if (isEntryPoint(import.meta.url)) {
  if (process.argv.includes('--self-test')) {
    process.exitCode = selfTest();
  } else if (process.argv.includes('--hook') && !process.stdin.isTTY) {
    // BOTH conditions, the way the sibling session-lock.mjs has them. A
    // non-TTY stdin is not evidence of a payload: any invocation that inherits
    // an open pipe satisfies it, and readFileSync(0) then blocks until that
    // pipe closes. Measured: `sleep 30 | node scripts/hooks/pre-exec-guard.mjs`
    // hung until it was killed. A hook always passes --hook (see
    // .claude/settings.json); a human at a terminal would otherwise sit
    // waiting for Ctrl+D.
  main();
  } else if (!process.stdin.isTTY) {
    // Loud rather than silent: a guard that quietly screens nothing is the
    // whole defect class this repo keeps finding. If this fires in a hook
    // chain, the settings entry lost its --hook.
    process.stderr.write(
      'pre-exec-guard: invoked without --hook, so NOTHING was screened. ' +
        'The hook entry in .claude/settings.json must pass --hook.\n',
    );
  }
}
