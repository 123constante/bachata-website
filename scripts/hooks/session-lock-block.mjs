/**
 * session-lock-block.mjs - turns the session-lock WARNING into a BLOCK.
 *
 * PreToolUse hook. session-lock.mjs (same directory) stays the only writer and the only
 * owner of the lock format and the staleness rule; this file is a READER that refuses a
 * tool call when the call would change a checkout whose lock is held by ANOTHER live
 * session. No second lock, no second threshold: liveness is session-lock's own isStale()
 * against the stale_after_iso session-lock wrote.
 *
 * WHAT IS REFUSED (only when the target checkout's lock is foreign AND live):
 *   Edit / Write / MultiEdit / NotebookEdit   - a file inside that checkout
 *   Bash / PowerShell                         - a git command that moves the working
 *                                               tree, index or branch there (GIT_MUTATORS)
 *                                               and `gh pr checkout`
 *
 * WHAT STAYS ALLOWED, by construction rather than by list:
 *   - every read (Read/Grep/Glob are not matched; git status/log/diff/fetch/show and
 *     `git worktree add` are not in GIT_MUTATORS)
 *   - anything whose target is a DIFFERENT checkout. The checkout is found from the
 *     TARGET path (nearest ancestor holding `.git`), not from where the session started,
 *     so a session parked in the shared checkout can still work in its own worktree by
 *     absolute path or `git -C`, and a file outside any repo (scratchpad, ~/.claude) has
 *     no checkout and is never refused.
 *   - the lock holder itself (session_id match).
 *   - ANY subagent call (payload carries agent_id or agent_type), the same rule as
 *     session-lock.mjs guard-write. Nothing proves a subagent's payload carries its
 *     parent's session_id; if it does not, the holder's own subagents would be refused.
 *     THE COST: a FOREIGN session's subagent is not blocked either. Its parent still is.
 *
 * SESSION END. A lock is keyed by session_id, and /clear starts a new session_id in the
 * same window. SessionEnd (which fires with reason `clear` on /clear) runs
 * `session-lock.mjs release --hook`, which deletes the lock only when the payload's own
 * session_id holds it, so the window's next session finds no lock instead of being
 * "another session" for 90 minutes. A foreign live lock is never forced there.
 *
 * THE ESCAPE HATCH IS TIME, NOT A FLAG. A crashed or closed window stops heartbeating;
 * its lock passes stale_after_iso (90 minutes after its last prompt or turn end, the
 * hook-mode window in session-lock.mjs) and this hook allows again by itself. There is
 * deliberately no env var or flag that lifts the block: a bypass that exists gets used.
 *
 * OWN-LOCK REFRESH. session-lock heartbeats only on UserPromptSubmit and Stop, so one
 * autonomous turn longer than 90 minutes lets the holder's lock go stale mid-work; the
 * second session's next heartbeat then takes it over and the ORIGINAL holder becomes the
 * foreign one. Advisory, that was a wrong warning. As a block it would stop the session
 * that was there first. So when the caller IS the holder, this hook renews the lock
 * through session-lock's own writeLock() (throttled, see REFRESH_AFTER_MS).
 *
 * KNOWN GAPS, stated so nobody claims cover that is not there:
 *   - a file written by a shell command (redirect, sed -i, a node script) is not seen;
 *     only the Edit-family tools and the git verbs are.
 *   - a path this parser cannot resolve ($(...) or an unset variable in a `cd` or
 *     `git -C` argument) is ALLOWED with a line on stderr.
 *   - an IDLE holder (no prompt for 90 minutes) still loses the lock to the other
 *     session's heartbeat, and is then the one refused.
 *
 * FAILS OPEN. Any internal error, unreadable payload or missing session id allows the
 * call and says why on stderr. A hook that can wedge every Edit in every window on its
 * own bug is worse than the collision it guards.
 *
 * Output contract (PreToolUse): refuse = one JSON line on stdout with
 * permissionDecision "deny" + exit 0 (the shape apply-migration-tripwire.mjs uses);
 * allow = no stdout, exit 0.
 *
 * Usage:
 *   session-lock-block.mjs              # hook: payload JSON on stdin
 *   session-lock-block.mjs --self-test
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);

/** git subcommands that move the working tree, the index or the checked-out branch. */
const GIT_MUTATORS = new Set([
  "commit", "push", "checkout", "switch", // the four the decision named
  "add", "rm", "mv", "restore", "reset", "stash", "clean", // index / working tree
  "merge", "rebase", "pull", "cherry-pick", "revert", "am", "apply", // history onto this tree
]);
/** `git stash list` / `git stash show` only read. */
const STASH_READS = new Set(["list", "show"]);
/** git global options that take a separate value token. */
const GIT_VALUE_OPTS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);
const CD_VERBS = new Set(["cd", "pushd", "chdir", "set-location", "sl"]);
const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const SHELL_TOOLS = new Set(["Bash", "PowerShell"]);
/** Renew the holder's own lock once it is at least this old. Keeps writes to ~1 per 10 min. */
const REFRESH_AFTER_MS = 10 * 60_000;

/* ------------------------------------------------------------------ paths */

/** Nearest ancestor (or the path itself) that holds a `.git` entry; null when none. */
function checkoutRootOf(target) {
  let dir = path.resolve(target);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/**
 * A shell path argument -> an absolute OS path, or null when it cannot be known
 * (command substitution, or a variable this process cannot expand).
 */
function resolveShellPath(raw, base, env = process.env) {
  let p = String(raw || "");
  if (!p) return null;
  p = p.replace(/\$env:(\w+)|\$\{(\w+)(?::-[^}]*)?\}|\$(\w+)|%(\w+)%/g, (m, a, b, c, d) => {
    const v = env[a || b || c || d];
    return v ? v : m;
  });
  if (/[$`%]/.test(p)) return null;
  if (p === "~" || p.startsWith("~/") || p.startsWith("~\\")) p = path.join(os.homedir(), p.slice(1));
  if (process.platform === "win32") {
    // Git Bash (/c/dev/x) and WSL (/mnt/c/dev/x) spellings of a drive path.
    const m = /^\/(?:mnt\/)?([a-zA-Z])(\/.*)?$/.exec(p);
    if (m) p = `${m[1]}:${m[2] || "/"}`;
  }
  return path.resolve(base, p);
}

/* ---------------------------------------------------------------- command */

/**
 * Quote-aware split into words and separators. A quoted word is marked so that
 * `echo "git"` or a commit message containing "git push" is never read as a command.
 */
function tokenize(command) {
  const out = [];
  let cur = "";
  let quoted = false;
  let has = false;
  const flush = () => {
    if (has) out.push({ t: cur, quoted });
    cur = "";
    quoted = false;
    has = false;
  };
  const s = String(command || "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" || ch === '"') {
      const end = ch;
      quoted = true;
      has = true;
      for (i++; i < s.length && s[i] !== end; i++) {
        // Only \" and \` are escapes worth honouring. A general "skip the backslash"
        // ate every separator of a quoted Windows path ("C:\dev\x" -> "C:devx").
        if (end === '"' && s[i] === "\\" && (s[i + 1] === '"' || s[i + 1] === "`")) i++;
        cur += s[i];
      }
    } else if (ch === "\n" || ch === ";" || ch === "|" || ch === "&") {
      flush();
      out.push({ sep: true });
    } else if (/\s/.test(ch) || ch === "(" || ch === ")" || ch === "{" || ch === "}") {
      flush();
    } else {
      cur += ch;
      has = true;
    }
  }
  flush();
  return out;
}

/**
 * The directories a command would mutate with git. Returns { dirs, unknown } where
 * unknown lists arguments that could not be resolved to a path.
 */
function gitTargets(command, cwd, env = process.env) {
  const toks = tokenize(command);
  const dirs = [];
  const unknown = [];
  let here = cwd;
  let atStart = true;
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (tok.sep) {
      atStart = true;
      continue;
    }
    const word = tok.t;
    const bare = path.basename(word.replace(/\\/g, "/")).toLowerCase().replace(/\.exe$/, "");
    if (atStart && !tok.quoted && CD_VERBS.has(bare)) {
      let j = i + 1;
      while (toks[j] && !toks[j].sep && /^-/.test(toks[j].t)) j++; // -Path, --, -LiteralPath
      if (toks[j] && !toks[j].sep) {
        const to = resolveShellPath(toks[j].t, here, env);
        if (to) here = to;
        else unknown.push(toks[j].t);
      }
    } else if (!tok.quoted && bare === "git") {
      let dir = here;
      let known = true;
      let j = i + 1;
      for (; toks[j] && !toks[j].sep && /^-/.test(toks[j].t); j++) {
        const opt = toks[j].t;
        if (!GIT_VALUE_OPTS.has(opt)) continue;
        const val = toks[j + 1] && !toks[j + 1].sep ? toks[j + 1].t : "";
        j++;
        if (opt !== "-C") continue;
        const to = resolveShellPath(val, dir, env);
        if (to) dir = to;
        else {
          known = false;
          unknown.push(val);
        }
      }
      const sub = toks[j] && !toks[j].sep ? toks[j].t.toLowerCase() : "";
      const next = toks[j + 1] && !toks[j + 1].sep ? toks[j + 1].t.toLowerCase() : "";
      const mutates = GIT_MUTATORS.has(sub) && !(sub === "stash" && STASH_READS.has(next));
      if (mutates && known) dirs.push({ dir, what: `git ${sub}` });
    } else if (!tok.quoted && bare === "gh") {
      const a = toks[i + 1] && !toks[i + 1].sep ? toks[i + 1].t : "";
      const b = toks[i + 2] && !toks[i + 2].sep ? toks[i + 2].t : "";
      if (a === "pr" && b === "checkout") dirs.push({ dir: here, what: "gh pr checkout" });
    }
    // An env assignment (GH_TOKEN=x git push) keeps the next word at command position.
    if (!(atStart && !tok.quoted && /^\w+=/.test(word))) atStart = false;
  }
  return { dirs, unknown };
}

/* --------------------------------------------------------------- decision */

function refusal({ root, lock, what, staleMinutes }) {
  const repo = path.basename(root);
  const lifts = new Date(Date.parse(lock.stale_after_iso));
  const hhmm = `${String(lifts.getHours()).padStart(2, "0")}:${String(lifts.getMinutes()).padStart(2, "0")}`;
  return (
    "STOPPED - another Claude window is already working in this folder.\n" +
    `  Folder       : ${root}\n` +
    `  Other window : branch ${lock.branch || "unknown"} (session ${lock.session_id || "unknown"})\n` +
    `  Stopped      : ${what}\n` +
    "Two windows in one folder overwrite each other's files, so this window may not change\n" +
    "files or branches here. Reading is still allowed.\n" +
    "Fix: give this window its own folder with one command, then do the work there:\n" +
    `    git worktree add ../${repo}-<arc> -b claude/<arc>-<topic>\n` +
    `If the other window was closed or crashed, this stops by itself at ${hhmm}\n` +
    `(${staleMinutes} minutes after its last activity). Do not delete the lock file.`
  );
}

/**
 * Pure decision over one payload. deps = the session-lock exports plus the
 * hook-mode staleness window, injected so the self-test drives the real ones.
 * Returns { deny: string|null, notes: string[] }.
 */
function decide(payload, deps, env = process.env) {
  const notes = [];
  const me = payload && payload.session_id;
  const tool = payload && payload.tool_name;
  const input = (payload && payload.tool_input) || {};
  if (!FILE_TOOLS.has(tool) && !SHELL_TOOLS.has(tool)) return { deny: null, notes };
  // Subagent: allowed, same rule as guard-write (see header for the cost).
  if (payload.agent_id || payload.agent_type) return { deny: null, notes };
  if (!me) {
    notes.push("the hook payload has no session_id, so this session cannot be told apart from the lock holder; allowing");
    return { deny: null, notes };
  }
  const cwd = payload.cwd || process.cwd();

  let targets = [];
  if (FILE_TOOLS.has(tool)) {
    const file = input.file_path || input.notebook_path;
    if (file) targets.push({ dir: path.resolve(cwd, String(file)), what: `${tool} ${file}` });
  } else {
    const found = gitTargets(input.command, cwd, env);
    targets = found.dirs;
    if (found.unknown.length)
      notes.push(`could not resolve the folder in '${found.unknown.join("', '")}'; that part of the command was not checked`);
  }

  for (const target of targets) {
    const root = checkoutRootOf(target.dir);
    if (!root) continue; // outside every repo: scratchpad, ~/.claude, temp
    const ctx = { lockPath: path.join(root, ".claude", ".session-lock.json") };
    const lock = deps.readLock(ctx);
    if (!lock || deps.isStale(lock)) continue; // free, or the holder is gone: the block has lifted
    if (lock.session_id === me) {
      // Holder: renew, so a long turn cannot hand the lock away (see header).
      const expires = Date.parse(lock.stale_after_iso);
      const age = deps.staleMinutes * 60_000 - (expires - Date.now());
      if (age >= REFRESH_AFTER_MS) {
        try {
          deps.writeLock(
            { ...ctx, sessionId: me, staleMinutes: deps.staleMinutes, branch: lock.branch || "unknown" },
            lock.started_at_iso
          );
        } catch (err) {
          notes.push(`could not renew this session's own lock (${err.message || err})`);
        }
      }
      continue;
    }
    return { deny: refusal({ root, lock, what: target.what, staleMinutes: deps.staleMinutes }), notes };
  }
  return { deny: null, notes };
}

async function loadDeps() {
  // Dynamic, inside the caller's try: a missing or broken session-lock.mjs must fail
  // OPEN with a reason, not crash the hook before it can say anything.
  const lock = await import("./session-lock.mjs");
  return {
    readLock: lock.readLock,
    isStale: lock.isStale,
    writeLock: lock.writeLock,
    release: lock.release, // self-test only: the SessionEnd path
    staleMinutes: lock.resolveStaleMinutes({ hookMode: true }),
  };
}

/* -------------------------------------------------------------- self-test */

async function selfTest() {
  let failures = 0;
  const fail = (m) => {
    console.error(`  FAIL ${m}`);
    failures += 1;
  };
  const deps = await loadDeps();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sesslock-block-"));
  const shared = path.join(tmp, "shared-repo");
  const nested = path.join(shared, ".claude", "worktrees", "nested-wt");
  const other = path.join(tmp, "other-wt");
  const loose = path.join(tmp, "not-a-repo");
  try {
    for (const d of [path.join(shared, ".git"), path.join(shared, "src"), nested, other, loose])
      fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(nested, ".git"), "gitdir: elsewhere\n"); // a worktree's .git is a FILE
    fs.writeFileSync(path.join(other, ".git"), "gitdir: elsewhere\n");
    const lockCtx = (root, id) => ({
      lockPath: path.join(root, ".claude", ".session-lock.json"),
      sessionId: id,
      staleMinutes: deps.staleMinutes,
      branch: `branch-of-${id}`,
    });
    deps.writeLock(lockCtx(shared, "OTHER"));
    const lockFile = path.join(shared, ".claude", ".session-lock.json");
    const liveBytes = fs.readFileSync(lockFile, "utf8");

    const edit = (file, id = "ME", tool = "Edit") =>
      decide({ session_id: id, tool_name: tool, cwd: shared, tool_input: { file_path: file } }, deps);
    const sh = (command, cwd = shared, id = "ME", tool = "Bash") =>
      decide({ session_id: id, tool_name: tool, cwd, tool_input: { command } }, deps, { HOME_X: other });
    const denied = (r) => typeof r.deny === "string";

    // 1. The block: a second session may not write into the held checkout.
    const d1 = edit(path.join(shared, "src", "a.ts"));
    if (!denied(d1)) fail("an Edit into a checkout held by another live session was allowed");
    else {
      if (!d1.deny.includes("git worktree add ../shared-repo-<arc> -b claude/<arc>-<topic>"))
        fail("the refusal did not give the one worktree command");
      if (!d1.deny.includes("branch-of-OTHER")) fail("the refusal did not name the other window's branch");
      if (!d1.deny.includes(`${deps.staleMinutes} minutes`)) fail("the refusal did not state the self-lifting window");
    }
    if (!denied(edit(path.join(shared, "new-dir", "deep", "new.ts"), "ME", "Write")))
      fail("a Write to a NEW path under the held checkout was allowed");
    if (!denied(decide({ session_id: "ME", tool_name: "NotebookEdit", cwd: shared, tool_input: { notebook_path: "nb.ipynb" } }, deps)))
      fail("a NotebookEdit by relative path was allowed");

    // 2. What must stay allowed.
    if (denied(edit(path.join(shared, "src", "a.ts"), "OTHER"))) fail("the lock HOLDER was refused");
    if (denied(edit(path.join(other, "a.ts")))) fail("a write into a DIFFERENT worktree was refused");
    if (denied(edit(path.join(nested, "a.ts")))) fail("a write into a worktree NESTED in the held checkout was refused");
    if (denied(edit(path.join(loose, "a.txt")))) fail("a write outside every repo was refused");
    if (denied(decide({ session_id: "ME", tool_name: "Read", cwd: shared, tool_input: { file_path: path.join(shared, "a") } }, deps)))
      fail("a Read was refused");
    for (const ok of [
      "git status",
      "git fetch origin",
      "git log --oneline -5",
      "git diff main...HEAD",
      "git worktree add ../shared-repo-tickets -b claude/tickets-fix",
      "git stash list",
      "echo 'git commit' && echo \"git push\"",
      "git log --grep 'git checkout'",
      `git -C "${other}" commit -m "x"`,
      `cd "${other}" && git push origin HEAD`,
      "cd $HOME_X && git commit -m x",
      "npm run test:unit",
    ]) {
      if (denied(sh(ok))) fail(`allowed command was refused: ${ok}`);
    }

    // 3. The git verbs, in the spellings sessions actually use.
    for (const bad of [
      "git commit -m 'x'",
      "git push origin HEAD",
      "git checkout main",
      "git switch -c claude/x",
      "git add -A && git commit -m x",
      "git status; git stash",
      "GH_TOKEN=abc git push",
      "git -c user.name=t commit -m x",
      "git.exe reset --hard HEAD~1",
      "gh pr checkout 123",
      "git status\ngit pull --rebase",
    ]) {
      if (!denied(sh(bad))) fail(`mutating command was allowed: ${bad}`);
    }
    if (!denied(sh(`git -C "${shared}" checkout main`, other))) fail("git -C into the held checkout from elsewhere was allowed");
    if (!denied(sh(`cd "${shared}" && git commit -m x`, loose))) fail("cd into the held checkout then commit was allowed");
    if (!denied(sh("git commit -m x; if ($?) { git push }", shared, "ME", "PowerShell"))) fail("the PowerShell tool was not covered");
    if (denied(sh("git commit -m x", shared, "OTHER"))) fail("the holder's own commit was refused");

    // 3b. F1 SUBAGENTS: a payload carrying agent_id / agent_type is allowed even under a
    //     foreign live lock, whatever session_id it carries (same rule as guard-write).
    const sub = (extra) =>
      decide({ session_id: "SUB-OWN-ID", tool_name: "Edit", cwd: shared, tool_input: { file_path: path.join(shared, "a.ts") }, ...extra }, deps);
    if (denied(sub({ agent_id: "agent-1" }))) fail("a subagent call (agent_id) was refused under a foreign live lock");
    if (denied(sub({ agent_type: "Explore" }))) fail("a subagent call (agent_type) was refused under a foreign live lock");
    if (!denied(sub({}))) fail("the same call WITHOUT a subagent marker was allowed (the subagent probe is vacuous)");

    // 4. Unresolvable folder: allowed, and SAID.
    const unk = sh("git -C $(pwd)/x commit -m x", loose);
    if (denied(unk)) fail("an unresolvable -C path was refused instead of failing open");
    if (!unk.notes.length) fail("an unresolvable -C path was allowed silently");

    // 5. Fail-open inputs.
    const anon = decide({ tool_name: "Edit", cwd: shared, tool_input: { file_path: path.join(shared, "a") } }, deps);
    if (denied(anon) || !anon.notes.length) fail("a payload with no session_id did not fail open with a note");
    if (denied(decide({}, deps))) fail("an empty payload was refused");

    // 6. A refusal never touches the foreign lock.
    if (fs.readFileSync(lockFile, "utf8") !== liveBytes) fail("refusing rewrote the other session's lock");

    // 7. THE EXIT CONTRACT, driven through the real CLI: deny = JSON on stdout + exit 0.
    const run = (payload) =>
      spawnSync(process.execPath, [SELF], { input: JSON.stringify(payload), encoding: "utf8" });
    const cliDeny = run({ session_id: "ME", tool_name: "Edit", cwd: shared, tool_input: { file_path: path.join(shared, "a.ts") } });
    let parsed = null;
    try {
      parsed = JSON.parse(cliDeny.stdout);
    } catch {
      /* asserted below */
    }
    if (cliDeny.status !== 0) fail(`the CLI exited ${cliDeny.status} on a refusal`);
    if (parsed?.hookSpecificOutput?.permissionDecision !== "deny") fail("the CLI did not emit permissionDecision deny");
    if (parsed?.hookSpecificOutput?.hookEventName !== "PreToolUse") fail("the CLI did not name the PreToolUse event");
    if (!/STOPPED/.test(parsed?.hookSpecificOutput?.permissionDecisionReason || "")) fail("the CLI refusal carried no reason");
    const cliAllow = run({ session_id: "OTHER", tool_name: "Edit", cwd: shared, tool_input: { file_path: path.join(shared, "a.ts") } });
    if (cliAllow.status !== 0 || cliAllow.stdout !== "") fail("the CLI was not silent + exit 0 for the holder");
    const cliJunk = spawnSync(process.execPath, [SELF], { input: "{not json", encoding: "utf8" });
    if (cliJunk.status !== 0 || cliJunk.stdout !== "") fail("a junk payload did not fail open");
    if (!/allowing/.test(cliJunk.stderr)) fail("a junk payload failed open without saying why");

    // 8. Holder renewal: an old own lock is extended, a fresh one is left alone.
    const aged = JSON.parse(liveBytes);
    aged.stale_after_iso = new Date(Date.now() + 5 * 60_000).toISOString();
    aged.started_at_iso = "2020-01-02T03:04:05Z";
    fs.writeFileSync(lockFile, JSON.stringify(aged));
    edit(path.join(shared, "src", "a.ts"), "OTHER");
    const renewed = JSON.parse(fs.readFileSync(lockFile, "utf8"));
    if (Date.parse(renewed.stale_after_iso) - Date.now() < (deps.staleMinutes - 1) * 60_000)
      fail("the holder's ageing lock was not renewed");
    if (renewed.started_at_iso !== "2020-01-02T03:04:05Z") fail("renewal lost started_at_iso");
    if (renewed.session_id !== "OTHER") fail("renewal changed the holder");
    const freshBytes = fs.readFileSync(lockFile, "utf8");
    edit(path.join(shared, "src", "a.ts"), "OTHER");
    if (fs.readFileSync(lockFile, "utf8") !== freshBytes) fail("a fresh own lock was rewritten (throttle is not working)");

    // 8b. F3 SESSION END: the SessionEnd hook is `session-lock.mjs release --hook`
    //     (guarded). Driven through the real release(): it removes the lock when the
    //     ending session holds it, and leaves a FOREIGN live lock in place.
    const endCtx = (id) => ({
      root: shared,
      lockPath: lockFile,
      registryPath: path.join(tmp, "registry.json"),
      identified: false, // never touch the real shared registry from a test
      sessionId: id,
      staleMinutes: deps.staleMinutes,
    });
    const quietly = (fn) => {
      const [o, e] = [process.stdout.write, process.stderr.write];
      process.stdout.write = process.stderr.write = () => true;
      try {
        return fn();
      } finally {
        process.stdout.write = o;
        process.stderr.write = e;
      }
    };
    quietly(() => deps.release(endCtx("ENDER-OTHER")));
    if (!fs.existsSync(lockFile)) fail("SessionEnd of a DIFFERENT session removed a foreign live lock");
    quietly(() => deps.release(endCtx("OTHER")));
    if (fs.existsSync(lockFile)) fail("SessionEnd of the lock holder did not remove its own lock");
    fs.writeFileSync(lockFile, freshBytes);

    // 9. THE ESCAPE HATCH: a stale foreign lock no longer blocks. Last, it ends the fixture.
    const dead = JSON.parse(freshBytes);
    dead.stale_after_iso = "2020-01-01T00:00:00Z";
    fs.writeFileSync(lockFile, JSON.stringify(dead));
    if (denied(edit(path.join(shared, "src", "a.ts")))) fail("a STALE foreign lock still blocked an Edit");
    if (denied(sh("git commit -m x"))) fail("a STALE foreign lock still blocked a commit");
    fs.rmSync(lockFile);
    if (denied(edit(path.join(shared, "src", "a.ts")))) fail("a checkout with NO lock blocked an Edit");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failures) {
    console.error(`session-lock-block --self-test: ${failures} FAILURE(S)`);
    return 1;
  }
  console.log("session-lock-block --self-test: OK (both directions)");
  return 0;
}

/* -------------------------------------------------------------------- cli */

async function main() {
  const failOpen = (why) => process.stderr.write(`session-lock-block: could not check (${why}); allowing this call\n`);
  try {
    const payload = JSON.parse(fs.readFileSync(0, "utf8"));
    const deps = await loadDeps();
    const { deny, notes } = decide(payload, deps);
    for (const n of notes) process.stderr.write(`session-lock-block: ${n}\n`);
    if (deny) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: deny },
        }) + "\n"
      );
    }
  } catch (err) {
    failOpen(err && err.message ? err.message : String(err));
  }
  // exitCode, never process.exit(): an immediate exit can drop a pending pipe write on
  // Windows, and the refusal IS the pipe write.
  process.exitCode = 0;
}

// Entry check through the shared realpath-to-realpath helper, loaded dynamically so a
// missing helper fails open with a reason instead of dying at import.
let run = false;
try {
  const { isEntryPoint } = await import("../lib/entry-point.mjs");
  run = isEntryPoint(import.meta.url);
} catch (err) {
  process.stderr.write(`session-lock-block: could not load ../lib/entry-point.mjs (${err.message || err}); allowing this call\n`);
}
if (run) {
  if (process.argv.includes("--self-test")) process.exitCode = await selfTest();
  else await main();
}

export { decide, gitTargets, tokenize, checkoutRootOf, resolveShellPath, GIT_MUTATORS, selfTest };
