/**
 * session-lock.mjs - advisory lock for concurrent Claude Code sessions.
 *
 * IDENTICAL FILE IN BOTH REPOS (Website scripts/hooks/ and admin scripts/hooks/) - it
 * derives the repo name from the checkout, so keep the copies byte-equal; if one grows
 * a rule the other must follow, change BOTH.
 *
 * WHY. When two agent sessions edit the same repo simultaneously, in-flight writes can
 * be silently truncated (the 2026-04-26 corruption incident), and two sessions applying
 * migrations at once is how the 2026-07-26 prod collision happened. The lock is
 * ADVISORY: it never blocks a prompt, never fails a hook, never stops a write. It makes
 * the collision VISIBLE, by session and by branch, with the fix (a separate worktree)
 * spelled out.
 *
 * LIFECYCLE (operating-model-v2 Phase 6, revised after review):
 *   SessionStart      -> acquire --warn-only   (take the lock, or warn if held)
 *   UserPromptSubmit  -> heartbeat             (refresh; warn if a foreign lock is live)
 *   Stop              -> heartbeat             (Stop fires every TURN, not at session
 *                                               end - running `release` here was the
 *                                               original bug: the lock died after the
 *                                               first response)
 *   SessionEnd        -> release               (the actual end of the session)
 * Staleness (90 min) is the backstop for crashed sessions that never reach SessionEnd.
 *
 * IDENTITY comes from the hook payload's `session_id` on stdin - stable for a whole
 * session - never from the pid, because every hook invocation is a new process and a
 * pid-keyed lock cannot recognise its own session across turns.
 *
 * RELEASE IS GUARDED. A SessionEnd fires in every session, including one that never
 * owned the lock because a foreign session held it. Deleting the foreign owner's LIVE
 * lock at that moment would hand the next collision a free repo, so release refuses a
 * live foreign lock unless --force.
 *
 * Usage (every subcommand exits 0 except `check`, a refused bare `release` is still 0,
 * and an unknown subcommand):
 *   node scripts/hooks/session-lock.mjs acquire [--warn-only] [--stale-minutes N] [--id X]
 *   (--hook: read session_id from the hook payload on stdin; hook-chain use only)
 *   node scripts/hooks/session-lock.mjs heartbeat
 *   node scripts/hooks/session-lock.mjs release [--force]
 *   node scripts/hooks/session-lock.mjs check     # exit 1 if held by another live session
 *   node scripts/hooks/session-lock.mjs status
 *   node scripts/hooks/session-lock.mjs --self-test
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STALE_MINUTES = 90;

function git(args, cwd) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/** Everything the commands need, resolved once. Exported so the self-test can rebind it. */
function context({ repoRoot, sessionId, staleMinutes } = {}) {
  const root = repoRoot || git(["rev-parse", "--show-toplevel"], path.resolve(HERE, "..", "..")) || path.resolve(HERE, "..", "..");
  // Guard the window: a NaN or non-positive value would mint locks that are born stale
  // (stale_after <= now), silently disabling the lock. Fall back to the default instead.
  const mins = Number(staleMinutes);
  return {
    root,
    repoName: path.basename(root),
    lockPath: path.join(root, ".claude", ".session-lock.json"),
    sessionId: sessionId || "unknown",
    staleMinutes: Number.isFinite(mins) && mins > 0 ? mins : DEFAULT_STALE_MINUTES,
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"], root) || "unknown",
  };
}

function readLock(ctx) {
  try {
    return JSON.parse(fs.readFileSync(ctx.lockPath, "utf8"));
  } catch {
    return null;
  }
}

/** No lock, an unparseable lock, or a missing/expired stale_after_iso all count as stale. */
function isStale(lock, now = Date.now()) {
  if (!lock) return true;
  const raw = lock.stale_after_iso;
  if (!raw) return true;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return true;
  return now > t;
}

function writeLock(ctx, startedAtIso, now = new Date()) {
  const body = {
    session_id: ctx.sessionId,
    started_at_iso: startedAtIso || now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    stale_after_iso: new Date(now.getTime() + ctx.staleMinutes * 60_000)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
    pid: process.pid,
    host: os.hostname(),
    branch: ctx.branch,
  };
  fs.mkdirSync(path.dirname(ctx.lockPath), { recursive: true });
  // Write-then-rename. The rename is atomic, so a concurrent reader sees either the old
  // lock or the new one, never a torn file. This matters more than it looks: a torn read
  // parses as "no lock / stale", which is exactly the state that lets another session
  // steal a LIVE lock - and with per-prompt heartbeats this file is rewritten constantly.
  const tmp = ctx.lockPath + `.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2) + "\n");
  fs.renameSync(tmp, ctx.lockPath);
  return body;
}

/**
 * The loud one. Names the other session's branch and a worktree command that actually
 * runs: a fresh directory + a NEW branch (adding a worktree for a branch that is already
 * checked out is an error, and a `/` in a branch name would nest the path).
 *
 * Streams: on an interactive terminal (stdout is a TTY) print ONCE, to stdout. Under a
 * hook (stdout captured), print to BOTH - stdout becomes injected context, stderr is
 * what the harness surfaces in the terminal - and no user ever sees it twice.
 */
function foreignWarning(ctx, lock) {
  const wtName = `${ctx.repoName}-wt`;
  const msg =
    "session-lock: WARNING - another Claude session is live in this repo.\n" +
    `  its branch : ${lock.branch || "unknown"}\n` +
    `  its session: ${lock.session_id || "unknown"} (started ${lock.started_at_iso || "unknown"})\n` +
    `  this session is on branch: ${ctx.branch}\n` +
    "  Concurrent multi-file edits lose work here (later write wins). Give this session\n" +
    "  its own checkout on a NEW branch:\n" +
    `      git worktree add ../${wtName} -b <new-branch-name>\n` +
    "  Then work there. Nothing is blocked - this is advisory.";
  process.stdout.write(msg + "\n");
  if (!process.stdout.isTTY) process.stderr.write(msg + "\n");
  return msg;
}

function acquire(ctx, { warnOnly = false } = {}) {
  const lock = readLock(ctx);
  if (lock && lock.session_id === ctx.sessionId) {
    // Refresh rather than no-op: "already held" should also renew the staleness window.
    writeLock(ctx, lock.started_at_iso);
    process.stdout.write(`session-lock: already held by this session (${ctx.sessionId})\n`);
    return 0;
  }
  if (lock && !isStale(lock)) {
    foreignWarning(ctx, lock);
    if (warnOnly) return 0;
    process.stderr.write("  (override with --warn-only to proceed anyway)\n");
    return 1;
  }
  if (lock) process.stderr.write(`session-lock: clearing stale lock from session ${lock.session_id}\n`);
  const written = writeLock(ctx);
  process.stdout.write(`session-lock: acquired (${ctx.sessionId}, expires ${written.stale_after_iso})\n`);
  return 0;
}

/**
 * Silent on the happy path. This runs on every prompt AND every turn end, so a line of
 * output per turn would be noise in the transcript and in the context window.
 */
function heartbeat(ctx) {
  const lock = readLock(ctx);
  if (!lock) {
    writeLock(ctx);
    return 0;
  }
  if (lock.session_id === ctx.sessionId) {
    writeLock(ctx, lock.started_at_iso);
    return 0;
  }
  if (isStale(lock)) {
    process.stderr.write(`session-lock: took over stale lock from session ${lock.session_id}\n`);
    writeLock(ctx);
    return 0;
  }
  // Live foreign lock: warn on EVERY prompt, deliberately. The failure mode being
  // guarded is a second session forgetting the first one exists.
  foreignWarning(ctx, lock);
  return 0;
}

/**
 * Guarded: SessionEnd fires in EVERY session, including one that never owned the lock
 * because a foreign session held it - deleting that owner's live lock would disarm the
 * warning for whoever collides next. Own lock or stale lock deletes; a live foreign
 * lock survives unless --force. Always exit 0 (SessionEnd is not a place to fail).
 */
function release(ctx, { force = false } = {}) {
  const lock = readLock(ctx);
  if (!lock) {
    process.stdout.write("session-lock: no lock to release\n");
    return 0;
  }
  const foreign = lock.session_id && lock.session_id !== ctx.sessionId;
  if (foreign && !isStale(lock) && !force) {
    process.stdout.write(
      `session-lock: NOT releasing - lock is held by live session '${lock.session_id}' ` +
        "(this session never owned it). Use --force to override.\n"
    );
    return 0;
  }
  if (foreign && force) {
    process.stderr.write(
      `session-lock: WARNING - force-releasing lock held by '${lock.session_id}' (asked: '${ctx.sessionId}')\n`
    );
  }
  fs.rmSync(ctx.lockPath, { force: true });
  process.stdout.write("session-lock: released\n");
  return 0;
}

function check(ctx) {
  const lock = readLock(ctx);
  if (!lock || isStale(lock) || lock.session_id === ctx.sessionId) return 0;
  process.stderr.write(`session-lock: held by '${lock.session_id}'\n`);
  return 1;
}

function status(ctx) {
  const lock = readLock(ctx);
  if (!lock) {
    process.stdout.write("session-lock: free\n");
    return 0;
  }
  process.stdout.write("session-lock: held\n" + JSON.stringify(lock, null, 2) + "\n");
  if (isStale(lock)) process.stdout.write("(stale - would be cleared on next acquire or heartbeat)\n");
  return 0;
}

/* ---------------------------------------------------------------- self-test */

function selfTest() {
  let failures = 0;
  const fail = (m) => {
    console.error(`  FAIL ${m}`);
    failures += 1;
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sesslock-"));
  const ctxFor = (id) => ({
    root: tmp,
    repoName: "fixture-repo",
    lockPath: path.join(tmp, ".claude", ".session-lock.json"),
    sessionId: id,
    staleMinutes: DEFAULT_STALE_MINUTES,
    branch: `branch-of-${id}`,
  });
  const A = ctxFor("A");
  const B = ctxFor("B");

  // Silence the loud path while asserting it still fires.
  let captured = "";
  const realOut = process.stdout.write.bind(process.stdout);
  const realErr = process.stderr.write.bind(process.stderr);
  const mute = () => {
    captured = "";
    process.stdout.write = (s) => ((captured += s), true);
    process.stderr.write = (s) => ((captured += s), true);
  };
  const unmute = () => {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
  };

  try {
    // 1. heartbeat on a free repo creates the lock, silently.
    mute();
    heartbeat(A);
    unmute();
    let lock = readLock(A);
    if (!lock || lock.session_id !== "A") fail("heartbeat did not create a lock for A");
    if (captured !== "") fail(`heartbeat on a free repo was not silent: ${captured.trim()}`);

    // 2. same session refreshes, preserves started_at, stays silent.
    const started = lock.started_at_iso;
    mute();
    heartbeat(A);
    unmute();
    lock = readLock(A);
    if (lock.started_at_iso !== started) fail("own-session heartbeat lost started_at_iso");
    if (captured !== "") fail("own-session heartbeat was not silent");

    // 3. LIVE foreign session warns, exits 0, and does NOT steal the lock.
    mute();
    const rc = heartbeat(B);
    unmute();
    if (rc !== 0) fail(`foreign heartbeat exited ${rc}, must always be 0`);
    if (!/another Claude session is live/.test(captured)) fail("foreign heartbeat did not warn");
    if (!/branch-of-A/.test(captured)) fail("warning did not name the other session's branch");
    if (!/git worktree add \.\.\/fixture-repo-wt -b/.test(captured))
      fail("warning did not give a runnable worktree command (new dir + new branch)");
    if (readLock(A).session_id !== "A") fail("foreign heartbeat stole a live lock");

    // 4. RELEASE GUARD: B's SessionEnd must not delete A's live lock; --force may.
    mute();
    const relRc = release(B);
    unmute();
    if (relRc !== 0) fail("guarded release did not exit 0");
    if (!readLock(A)) fail("release from a non-owner deleted a live foreign lock");
    if (!/NOT releasing/.test(captured)) fail("guarded release was silent about refusing");
    mute();
    release(B, { force: true });
    unmute();
    if (readLock(A)) fail("release --force did not delete");
    mute();
    heartbeat(A); // A re-establishes for the next cases
    unmute();

    // 5. STALE lock: the foreign session takes over on heartbeat, and release deletes it.
    const staleLock = readLock(A);
    staleLock.stale_after_iso = "2020-01-01T00:00:00Z";
    fs.writeFileSync(A.lockPath, JSON.stringify(staleLock));
    mute();
    heartbeat(B);
    unmute();
    if (readLock(B).session_id !== "B") fail("stale lock was not taken over");
    if (!/took over stale lock/.test(captured)) fail("stale takeover was silent");

    // 6. A lock with an EMPTY stale_after_iso (the shape of admin's April 2026 lock)
    //    counts as stale rather than blocking forever.
    if (!isStale({ session_id: "x", stale_after_iso: "" })) fail("empty stale_after_iso not treated as stale");
    if (!isStale({ session_id: "x", stale_after_iso: "not-a-date" })) fail("unparseable stale_after_iso not stale");
    if (isStale({ session_id: "x", stale_after_iso: new Date(Date.now() + 60_000).toISOString() }))
      fail("a future stale_after_iso was wrongly treated as stale");

    // 7. the window really is 90 minutes, and a garbage window falls back to it.
    fs.rmSync(B.lockPath, { force: true });
    mute();
    heartbeat(B);
    unmute();
    const l = readLock(B);
    const mins = Math.round((Date.parse(l.stale_after_iso) - Date.parse(l.started_at_iso)) / 60000);
    if (mins !== DEFAULT_STALE_MINUTES) fail(`window is ${mins} min, expected ${DEFAULT_STALE_MINUTES}`);
    const bad = context({ repoRoot: tmp, sessionId: "x", staleMinutes: "abc" });
    if (bad.staleMinutes !== DEFAULT_STALE_MINUTES) fail("NaN stale-minutes did not fall back to the default");
    const neg = context({ repoRoot: tmp, sessionId: "x", staleMinutes: -5 });
    if (neg.staleMinutes !== DEFAULT_STALE_MINUTES) fail("negative stale-minutes did not fall back");

    // 8. check(): 1 against a live foreign lock, 0 for the holder.
    mute();
    const foreignRc = check(A);
    const ownRc = check(B);
    unmute();
    if (foreignRc !== 1) fail("check did not report a live foreign lock");
    if (ownRc !== 0) fail("check reported the holder's own lock as foreign");

    // 9. acquire --warn-only never fails; bare acquire does; neither steals.
    mute();
    const warnRc = acquire(A, { warnOnly: true });
    const hardRc = acquire(A, { warnOnly: false });
    unmute();
    if (warnRc !== 0) fail("acquire --warn-only failed against a live foreign lock");
    if (hardRc !== 1) fail("bare acquire did not fail against a live foreign lock");
    if (readLock(B).session_id !== "B") fail("acquire stole a live foreign lock");
  } finally {
    unmute();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (failures) {
    console.error(`session-lock --self-test: ${failures} FAILURE(S)`);
    return 1;
  }
  console.log("session-lock --self-test: OK (9 groups, both directions)");
  return 0;
}

/* ---------------------------------------------------------------------- cli */

/**
 * Hook payloads arrive as JSON on stdin. Read ONLY under --hook: a hook invocation is
 * guaranteed a payload plus EOF, but a manual run with a non-TTY stdin (CI, agent Bash
 * tools) would block forever on readFileSync(0) waiting for input that never comes.
 */
function sessionIdFromStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return JSON.parse(raw).session_id || "";
  } catch {
    return "";
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const cmd = argv.find((a) => !a.startsWith("--")) || "status";
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? null : argv[i + 1];
  };

  if (argv.includes("--self-test")) {
    process.exit(selfTest());
  }

  const sessionId =
    flag("--id") ||
    (argv.includes("--hook") ? sessionIdFromStdin() : "") ||
    process.env.COWORK_SESSION_ID ||
    process.env.CLAUDE_SESSION_ID ||
    `pid-${process.pid}`;

  // --stale-hours is a compatibility spelling from the shell era; minutes win if both given.
  const staleMinutes =
    flag("--stale-minutes") != null
      ? Number(flag("--stale-minutes"))
      : flag("--stale-hours") != null
        ? Number(flag("--stale-hours")) * 60
        : DEFAULT_STALE_MINUTES;

  const ctx = context({ sessionId, staleMinutes });

  let code = 0;
  try {
    switch (cmd) {
      case "acquire":
        code = acquire(ctx, { warnOnly: argv.includes("--warn-only") });
        break;
      case "heartbeat":
        code = heartbeat(ctx);
        break;
      case "release":
        code = release(ctx, { force: argv.includes("--force") });
        break;
      case "check":
        code = check(ctx);
        break;
      case "status":
        code = status(ctx);
        break;
      default:
        process.stderr.write(
          `session-lock: unknown subcommand '${cmd}'\n` +
            "usage: node scripts/hooks/session-lock.mjs {acquire|heartbeat|release|check|status} " +
            "[--id X] [--stale-minutes N] [--warn-only] [--force] [--hook]\n"
        );
        code = 1;
    }
  } catch (err) {
    // An advisory lock must never take a session down with it.
    process.stderr.write(`session-lock: non-fatal error (${err.message || err})\n`);
    code = 0;
  }
  process.exit(code);
}

export { context, readLock, isStale, writeLock, acquire, heartbeat, release, check, status, selfTest };
