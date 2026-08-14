/**
 * session-lock.mjs - advisory lock for concurrent Claude Code sessions.
 *
 * TWIN COPY in both repos (Website scripts/hooks/ and admin scripts/hooks/) - it derives
 * the repo name from the checkout, so keep the copies content-identical MODULO LINE
 * ENDINGS; if one grows a rule the other must follow, change BOTH. Its entry-point
 * dependency ../lib/entry-point.mjs is vendored into both repos on the same terms
 * and is in both parity lists.
 *
 * Compared MODULO LINE ENDINGS rather than by hash, because the working-tree bytes
 * differ by CHECKOUT AGE, not by repo. Both repos' .gitattributes carry
 * `* text=auto eol=crlf`, so git stores one normalised LF blob for this file in both
 * (measured 2026-08-13: the two repos' committed blobs for this path are the same
 * object), while a checkout predating that rule still has LF on disk and a fresh one
 * has CRLF. A byte-equality assert would therefore go red or green on when each
 * checkout was made -- a permanent, ignorable red rather than a drift signal.
 * The header said byte-equal anyway, and used that false claim to argue the Website's
 * tests/sessionLock.test.ts extended its proof here -- which it never did: that suite
 * runs selfTest() on the WEBSITE copy only, and (measured 2026-07-31) NO test in either
 * repo compared the two session-lock copies at all. Cover now: the admin repo's
 * tests/hookSelfTests.test.ts invokes --self-test on its copy AND asserts twin parity
 * modulo line endings; the Website's twin-parity list (tests/arcState.test.ts) includes
 * this file. Both parity tests skip when the sibling checkout is absent, so the proof
 * lives on dual-checkout machines, not CI -- stated so nobody re-claims CI cover.
 *
 * WHY. When two agent sessions edit the same repo simultaneously, in-flight writes can
 * be silently truncated (the 2026-04-26 corruption incident), and two sessions applying
 * migrations at once is how the 2026-07-26 prod collision happened. The lock is
 * ADVISORY: it never blocks a prompt, never fails a hook, never stops a write. It makes
 * the collision VISIBLE, by session and by branch, with the fix (a separate worktree)
 * spelled out.
 *
 * LIFECYCLE (operating-model-v2 Phase 6, revised across two review rounds):
 *   SessionStart      -> acquire --warn-only --hook   (take the lock, or warn if held)
 *   UserPromptSubmit  -> heartbeat --hook             (refresh; warn if foreign+live)
 *   Stop              -> heartbeat --hook --quiet     (refresh only - Stop fires every
 *                                                      TURN, and its stdout is not
 *                                                      injected, so repeating the
 *                                                      warning there is pure noise.
 *                                                      Running `release` here was the
 *                                                      original bug: the lock died
 *                                                      after the first response)
 *   SessionEnd        -> release --hook               (the actual end of the session)
 *
 * TWO MODES, TWO CONTRACTS. --hook marks an invocation from a hook chain: identity is
 * the payload's session_id (stable all session), staleness defaults to 90 minutes
 * (heartbeats refresh it constantly, so anything older is a crashed session), and
 * release is GUARDED - SessionEnd fires in every session, including one that never
 * owned the lock, and deleting the foreign owner's LIVE lock there would hand the next
 * collision a free repo. WITHOUT --hook (a human at a terminal): identity is best-effort
 * (env var or pid), staleness defaults to 8 HOURS (a manual acquire before a long
 * refactor never heartbeats - 90 minutes would get it silently stolen mid-refactor),
 * and release deletes UNCONDITIONALLY with a warning naming the owner - it is the
 * manual escape hatch, and a pid identity can never match the lock, so a guarded
 * manual release would refuse forever.
 *
 * Usage:
 *   session-lock.mjs acquire   [--warn-only] [--stale-minutes N] [--id X] [--hook]
 *   session-lock.mjs heartbeat [--quiet] [--hook]
 *   session-lock.mjs release   [--force] [--hook]
 *   session-lock.mjs check         # exit 1 if held by another live session
 *   session-lock.mjs status
 *   session-lock.mjs --self-test
 * Flags are position-independent. --stale-hours H is the shell-era spelling of
 * --stale-minutes (H*60). Exit codes: 0 everywhere except check (1 = foreign live
 * lock) and a usage error (1).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isEntryPoint } from "../lib/entry-point.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STALE_MINUTES_HOOK = 90; // refreshed per turn; older = crashed session
const STALE_MINUTES_MANUAL = 480; // a human refactor has no heartbeat (old shell default)

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

/**
 * The staleness window, resolved from flags + mode. Explicit minutes win, then the
 * shell-era hours spelling, then the per-mode default. A NaN or non-positive value
 * falls back to the mode default rather than minting locks that are born stale
 * (stale_after <= now), which would silently disable the lock.
 */
function resolveStaleMinutes({ staleMinutes, staleHours, hookMode }) {
  const fallback = hookMode ? STALE_MINUTES_HOOK : STALE_MINUTES_MANUAL;
  const explicit =
    staleMinutes != null ? Number(staleMinutes) : staleHours != null ? Number(staleHours) * 60 : NaN;
  return Number.isFinite(explicit) && explicit > 0 ? explicit : fallback;
}

/**
 * THE GLOBAL REGISTRY -- the same lock, published where a cross-repo reader can
 * see it.
 *
 * The lock file above is PER REPO, and that is structurally blind to the
 * collision it was built for. On 2026-08-14 two sessions wrote the same
 * ~/.claude memory directory with nothing between them, because one was an
 * ADMIN session and the per-repo lock in the Website checkout could not know it
 * existed. Repo-scoped locks cannot see a repo-crossing conflict.
 *
 * So each session ALSO publishes itself to one file under ~/.claude, keyed by
 * session id and carrying its repo, branch and the SAME stale_after_iso the
 * lock uses. Not a second lock: a second VIEW of the one lock, written by the
 * same function on the same schedule. The user-level write guard reads it and
 * owns no threshold of its own -- staleness is a timestamp comparison against a
 * value this file computed, so the 90-minute backstop cannot drift between the
 * two the way two independently-configured numbers would.
 *
 * CONCURRENCY. Read-modify-write, so two sessions writing in the same
 * millisecond can lose one entry. That heals on the loser's next heartbeat --
 * every prompt -- and the failure mode of a lost entry is one missed advisory
 * warning, which is what the situation was before this existed. Locking a lock
 * registry would be the second lock system this design exists to avoid.
 */
const registryPathFor = (env = process.env) => {
  if (env.CLAUDE_SESSION_REGISTRY) return env.CLAUDE_SESSION_REGISTRY;
  // SESSION_LOCK_ROOT sandboxes the REGISTRY as well as the lock, and that is
  // not a convenience. tests/sessionLock.test.ts spawns this script with a
  // temp root to keep CLI-level cases off the real lock; the first version of
  // the registry ignored that and published fixture sessions "sess-A" and
  // "sess-B" straight into the operator's real ~/.claude registry, where the
  // write guard then reported them as live collisions for ninety minutes.
  // Measured, not imagined -- it happened on the first suite run after the
  // registry landed. A test that plants false evidence in the system under
  // test is worse than no test, so the one env var sandboxes the whole thing
  // and no future caller has to remember a second one.
  if (env.SESSION_LOCK_ROOT) return path.join(env.SESSION_LOCK_ROOT, ".claude", ".session-registry.json");
  return path.join(env.CLAUDE_HOME_DIR || path.join(os.homedir(), ".claude"), ".session-registry.json");
};

/** Everything the commands need, resolved once. The self-test rebinds this wholesale. */
function context({ repoRoot, sessionId, staleMinutes, identified } = {}) {
  const root = repoRoot || git(["rev-parse", "--show-toplevel"], path.resolve(HERE, "..", "..")) || path.resolve(HERE, "..", "..");
  const mins = Number(staleMinutes);
  return {
    root,
    repoName: path.basename(root),
    lockPath: path.join(root, ".claude", ".session-lock.json"),
    registryPath: registryPathFor(),
    // Whether sessionId names a SESSION or is a per-process stand-in. Only the
    // former may be published -- see publishPresence.
    identified: identified !== false,
    sessionId: sessionId || "unknown",
    staleMinutes: Number.isFinite(mins) && mins > 0 ? mins : STALE_MINUTES_HOOK,
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"], root) || "unknown",
  };
}

/**
 * The registry's sessions map, or a REASON there is none.
 *
 * The first version returned `{}` for every failure, and the docstring excused
 * it with "a corrupt file is reported by the READER". Review measured that
 * claim false, and it was false by construction: publishRegistry read `{}`,
 * added this session, and renamed a fresh two-key file over the corrupt one --
 * so the reader saw a clean file, said nothing, and every other live session's
 * presence was gone until each next heartbeat. The catch also folded in EACCES
 * and EISDIR, where overwriting is precisely wrong, on a mount this repo
 * documents for truncation and stale reads.
 *
 * So: ENOENT is "start fresh"; a parse failure or any other errno is
 * `unreadable`, and the caller must NOT overwrite. The corrupt file then
 * survives for the reader to report and for a human to delete.
 */
function readRegistry(ctx) {
  let raw;
  try {
    raw = fs.readFileSync(ctx.registryPath, "utf8");
  } catch (err) {
    if (err && err.code === "ENOENT") return { sessions: {} };
    return { unreadable: err.message || String(err) };
  }
  try {
    const parsed = JSON.parse(raw);
    // `typeof [] === "object"`, and an ARRAY passed that test: every published
    // entry was then assigned as a named property on an array and silently
    // dropped by JSON.stringify, with no unreadable warning. The file reported
    // as healthy while holding nothing, so the write guard said "you are alone"
    // for good. A plain object, or it is unreadable.
    const map = parsed && parsed.sessions;
    if (map && typeof map === "object" && !Array.isArray(map)) return { sessions: map };
    return { unreadable: "the sessions value is " + (Array.isArray(map) ? "an array" : "missing or not an object") };
  } catch (err) {
    return { unreadable: err.message || String(err) };
  }
}

/**
 * Publish (or withdraw) this session, pruning every entry whose own
 * stale_after_iso has passed. The prune is why no separate garbage collector is
 * needed: a crashed session's entry expires on the next write by anyone.
 */
function publishRegistry(ctx, body) {
  // THE IDENTITY GATE LIVES HERE, not in publishPresence, because release()
  // calls this function directly. It used to be gated only on the publish
  // path, so a manual `session-lock.mjs release` -- no --hook, no --id, so no
  // stable identity -- still performed a read-modify-write over the shared
  // registry, pruning and rewriting every other session's entry from a process
  // that by this file's own rule has nothing to publish. One choke point.
  if (ctx.identified === false) return null;
  const read = readRegistry(ctx);
  if (read.unreadable !== undefined) {
    // Do NOT overwrite: the file may hold other sessions this process cannot
    // parse, and replacing it would both erase them and destroy the evidence
    // the reader needs. Say so once, per invocation, and leave it alone.
    process.stderr.write(
      `session-lock: the session registry at ${ctx.registryPath} is unreadable (${read.unreadable}); ` +
        "not publishing and NOT overwriting it. Delete the file to start a fresh one.\n"
    );
    return null;
  }
  const sessions = read.sessions;
  const now = Date.now();
  for (const [id, entry] of Object.entries(sessions)) {
    if (isStale(entry, now)) delete sessions[id];
  }
  if (body) {
    sessions[ctx.sessionId] = {
      session_id: ctx.sessionId,
      repo: ctx.repoName,
      root: ctx.root,
      branch: ctx.branch,
      host: body.host,
      pid: body.pid,
      started_at_iso: body.started_at_iso,
      stale_after_iso: body.stale_after_iso,
    };
  } else {
    delete sessions[ctx.sessionId];
  }
  const tmp = ctx.registryPath + `.tmp-${process.pid}`;
  try {
    fs.mkdirSync(path.dirname(ctx.registryPath), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify({ sessions }, null, 2) + "\n");
    fs.renameSync(tmp, ctx.registryPath);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    // LOUD, not swallowed. A registry that silently stops being written turns
    // the write guard into a hook that reports "you are alone" forever -- the
    // exact false-clean this machinery exists to prevent. It is still non-fatal:
    // the per-repo lock above is unaffected, so the session continues.
    process.stderr.write(`session-lock: could not publish to the session registry (${err.message || err})\n`);
  }
  return sessions;
}

function readLock(ctx) {
  try {
    return JSON.parse(fs.readFileSync(ctx.lockPath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * No lock, an unparseable lock, or a missing/expired stale_after_iso all count as stale.
 *
 * STALENESS IS TIMESTAMP-ONLY, AND MUST STAY THAT WAY. The lock body also carries `pid`
 * and `host`, and the obvious next idea - "same host + dead pid means the owner crashed,
 * reclaim it now instead of crying wolf for 90 minutes" - does not work here and must not
 * be added. The pid written is the pid of the process that WROTE the lock, and every
 * writer is either a short-lived hook invocation or a one-shot CLI run: it has already
 * exited by the time anyone reads the file. A pid-liveness check would therefore declare
 * EVERY lock dead the instant it was written, which is strictly worse than crying wolf.
 * The pid that would actually answer the question is the Claude session's own, and
 * nothing in the payload exposes it. So: `pid` is PROVENANCE, not liveness (it answers
 * "which process wrote this", useful when a stray tmp file needs tracing), and `host` is
 * reported in the foreign warning below so a cross-machine collision on a shared mount is
 * legible. Neither is an input to any decision.
 */
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
    // Provenance only - see the isStale() note. Never read as liveness evidence.
    pid: process.pid,
    host: os.hostname(),
    branch: ctx.branch,
  };
  fs.mkdirSync(path.dirname(ctx.lockPath), { recursive: true });
  // Write-then-rename. The rename is atomic, so a concurrent reader sees either the old
  // lock or the new one, never a torn file - a torn read parses as "no lock / stale",
  // which is exactly the state that lets another session steal a LIVE lock, and with
  // per-prompt heartbeats this file is rewritten constantly. On Windows the rename can
  // throw EPERM/EBUSY if a reader holds the destination open; clean the staging file up
  // before rethrowing so failures cannot litter .claude/ with orphans (the pattern is
  // also gitignored - belt and braces).
  const tmp = ctx.lockPath + `.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2) + "\n");
  try {
    fs.renameSync(tmp, ctx.lockPath);
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    throw err;
  }
  return body;
}

/**
 * Publish this session's PRESENCE, whether or not it holds the lock.
 *
 * The first version of this published from writeLock(), which looked tidier --
 * one write path, lock and registry always in step. Its own canary killed it in
 * the cross-session case: a session that does NOT hold the repo lock never
 * calls writeLock, so the second session in a repo was the one session the
 * registry could not see. That is precisely the session a writer needs warning
 * about. Presence is not ownership, so it is published from the per-turn entry
 * points instead, by every session, every turn.
 *
 * started_at_iso is carried over from this session's own lock when it holds it,
 * so "started" means the session, not the last heartbeat.
 */
function publishPresence(ctx, now = new Date()) {
  // NO STABLE IDENTITY, NO ENTRY -- enforced in publishRegistry, which every
  // path goes through. The CLI falls back to `pid-<n>` when the payload carries
  // no session_id and neither env var is set, and every hook invocation is a
  // NEW short-lived process, so that key changes every turn. The lock absorbed
  // it (one file, rewritten each time); a registry is a MAP, so it would
  // accumulate pid-1234, pid-1291, pid-1355..., each with its own 90-minute
  // window and none ever withdrawn, until the write guard reported dozens of
  // live sessions that were all one session. An honest gap beats a fabricated
  // crowd: the guard's own could-not-determine line covers it.
  const lock = readLock(ctx);
  const own = lock && lock.session_id === ctx.sessionId ? lock : null;
  const stamp = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  // A session that does NOT hold the lock has no started_at to inherit from it,
  // so the first version stamped `now` on every heartbeat and the second
  // session -- the one this registry exists to make visible -- was permanently
  // reported as having started seconds ago, however long it had been running.
  // Measured: two heartbeats 1.1s apart moved its started_at by a second while
  // the lock owner's stayed fixed. Carry it forward from its own registry entry.
  const priorEntry = readRegistry(ctx).sessions?.[ctx.sessionId];
  return publishRegistry(ctx, {
    host: os.hostname(),
    pid: process.pid,
    started_at_iso: own?.started_at_iso || priorEntry?.started_at_iso || stamp(now),
    stale_after_iso: stamp(new Date(now.getTime() + ctx.staleMinutes * 60_000)),
  });
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
  // `host` is reported (not decided on): on a shared mount the other session can be on
  // another machine entirely, where a worktree in THIS checkout is not the fix. Written
  // and never read was the previous state - see the isStale() note for why `pid` stays
  // unreported and undecided-on.
  const otherHost = lock.host && lock.host !== os.hostname() ? `${lock.host} (NOT this machine)` : lock.host || "unknown";
  const msg =
    "session-lock: WARNING - another Claude session is live in this repo.\n" +
    `  its branch : ${lock.branch || "unknown"}\n` +
    `  its session: ${lock.session_id || "unknown"} (started ${lock.started_at_iso || "unknown"})\n` +
    `  its host   : ${otherHost}\n` +
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
  publishPresence(ctx);
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
 * Silent on the happy path - this runs on every prompt AND every turn end, and a line
 * of output per turn would be noise in the transcript and the context window. A live
 * foreign lock warns on EVERY prompt, deliberately (the failure mode being guarded is
 * a second session forgetting the first one exists) - except under quiet, which the
 * Stop entry passes because its stdout is not injected anywhere and the prompt-side
 * copy already fired this turn.
 */
function heartbeat(ctx, { quiet = false } = {}) {
  publishPresence(ctx);
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
  if (!quiet) foreignWarning(ctx, lock);
  return 0;
}

/**
 * Two contracts (see header). guarded=true is the --hook path: own lock or stale lock
 * deletes; a live foreign lock survives unless force - SessionEnd fires in EVERY
 * session, including ones that never owned the lock. guarded=false is the manual
 * escape hatch: delete unconditionally, warning when the lock belonged to someone
 * else - a terminal run mints a throwaway identity that can never match, so a guarded
 * manual release would refuse forever and the documented one-word hatch would be a
 * silent no-op. Always exit 0.
 *
 * The foreign test is `!==`, NOT truthy-and-different: a lock with a BLANK session_id
 * (hand-edited, older tool) is still someone else's live lock, and a falsy short-circuit
 * would have let the guarded path delete exactly the lock whose owner is least
 * identifiable.
 */
function release(ctx, { force = false, guarded = true } = {}) {
  // WITHDRAW FIRST, ON EVERY PATH. release is the SessionEnd hook: this session
  // is over whether or not it owns the repo lock. The first version withdrew
  // only on the path that actually deletes a lock, so the two early returns
  // below -- "no lock to release", and the guarded refusal to delete a live
  // foreign lock -- left this session published as live for its full staleness
  // window. That refusal path is the ordinary SessionEnd of every session that
  // did NOT hold the lock, i.e. exactly the second session the registry exists
  // to make visible; the write guard then named an ended session as live,
  // which is the cry-wolf that gets an advisory warning muted for good.
  publishRegistry(ctx, null);
  const lock = readLock(ctx);
  if (!lock) {
    process.stdout.write("session-lock: no lock to release\n");
    return 0;
  }
  const foreign = lock.session_id !== ctx.sessionId;
  if (guarded && foreign && !isStale(lock) && !force) {
    process.stdout.write(
      `session-lock: NOT releasing - lock is held by live session '${lock.session_id}' ` +
        "(this session never owned it). Use --force to override.\n"
    );
    return 0;
  }
  if (foreign) {
    process.stderr.write(
      `session-lock: WARNING - releasing lock held by '${lock.session_id}' (asked: '${ctx.sessionId}')\n`
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
  // registryPath is INSIDE the fixture tree, and that is not tidiness: without
  // it every --self-test run would publish fixture sessions "A" and "B" into
  // the real ~/.claude registry, where the write guard would report them as
  // live collisions to whoever ran the canary. A test that plants false
  // evidence in the thing it tests is worse than no test.
  // The lockPath follows the REPO. It used to be one shared path for every
  // repo name, which made the "cross-repo" case two sessions contending for a
  // single lock file while wearing different labels -- the one shape the
  // per-repo lock already handles, dressed up as the shape it cannot see.
  // Groups 1-10 pass no repo, so A and B still share one repo and one lock,
  // which is what those groups are about.
  const ctxFor = (id, repo = "fixture-repo") => ({
    root: path.join(tmp, repo),
    repoName: repo,
    lockPath: path.join(tmp, repo, ".claude", ".session-lock.json"),
    registryPath: path.join(tmp, ".claude", ".session-registry.json"),
    identified: true,
    sessionId: id,
    staleMinutes: STALE_MINUTES_HOOK,
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

    // 3. LIVE foreign session warns, exits 0, does NOT steal - and --quiet suppresses
    //    the warning (Stop path) without touching the lock either.
    mute();
    const rc = heartbeat(B);
    unmute();
    if (rc !== 0) fail(`foreign heartbeat exited ${rc}, must always be 0`);
    if (!/another Claude session is live/.test(captured)) fail("foreign heartbeat did not warn");
    if (!/branch-of-A/.test(captured)) fail("warning did not name the other session's branch");
    if (!/git worktree add \.\.\/fixture-repo-wt -b/.test(captured))
      fail("warning did not give a runnable worktree command (new dir + new branch)");
    // includes(), not new RegExp(hostname): NetBIOS names legally carry regex
    // metacharacters - ( ) + { } - and an interpolated RegExp would false-fail
    // (or throw) on such a machine, a permanent machine-specific red.
    if (!captured.includes(`its host   : ${os.hostname()}`))
      fail("warning did not report the lock's host (it was written and never read)");
    // A lock from ANOTHER machine must say so - a worktree here is not that fix.
    // Snapshot the raw bytes and restore THEM, so later groups assert against the
    // true pre-patch lock rather than a hand-mirrored reconstruction.
    const rawBeforeCross = fs.readFileSync(A.lockPath);
    fs.writeFileSync(A.lockPath, JSON.stringify({ ...readLock(A), host: "some-other-box" }));
    mute();
    heartbeat(B);
    unmute();
    if (!captured.includes("its host   : some-other-box (NOT this machine)"))
      fail("a cross-machine lock was not flagged as such");
    fs.writeFileSync(A.lockPath, rawBeforeCross);
    if (readLock(A).session_id !== "A") fail("foreign heartbeat stole a live lock");
    mute();
    heartbeat(B, { quiet: true });
    unmute();
    if (captured !== "") fail("quiet foreign heartbeat was not silent");
    if (readLock(A).session_id !== "A") fail("quiet foreign heartbeat stole the lock");

    // 4. RELEASE, guarded (--hook): B cannot delete A's live lock; --force may;
    //    and a BLANK session_id is still foreign (the falsy-short-circuit trap).
    mute();
    const relRc = release(B, { guarded: true });
    unmute();
    if (relRc !== 0) fail("guarded release did not exit 0");
    if (!readLock(A)) fail("guarded release from a non-owner deleted a live foreign lock");
    if (!/NOT releasing/.test(captured)) fail("guarded release was silent about refusing");
    const blank = readLock(A);
    blank.session_id = "";
    fs.writeFileSync(A.lockPath, JSON.stringify(blank));
    mute();
    release(B, { guarded: true });
    unmute();
    if (!readLock(A)) fail("guarded release deleted a live BLANK-id lock");
    if (!/NOT releasing/.test(captured)) fail("blank-id refusal was silent");
    fs.writeFileSync(A.lockPath, JSON.stringify({ ...blank, session_id: "A" }));
    mute();
    release(B, { guarded: true, force: true });
    unmute();
    if (readLock(A)) fail("guarded release --force did not delete");
    if (!/WARNING - releasing lock held by 'A'/.test(captured)) fail("force release did not warn");

    // 5. RELEASE, manual (no --hook): deletes unconditionally with a warning naming
    //    the owner - the escape hatch must not be a silent no-op under a pid identity.
    mute();
    heartbeat(A);
    unmute();
    const manual = ctxFor("pid-99999");
    mute();
    release(manual, { guarded: false });
    unmute();
    if (readLock(A)) fail("manual release did not delete a live foreign lock");
    if (!/WARNING - releasing lock held by 'A'/.test(captured)) fail("manual release did not name the owner");

    // 6. STALE handling: takeover on heartbeat; empty/garbage stale_after_iso is stale.
    mute();
    heartbeat(A);
    unmute();
    const staleLock = readLock(A);
    staleLock.stale_after_iso = "2020-01-01T00:00:00Z";
    fs.writeFileSync(A.lockPath, JSON.stringify(staleLock));
    mute();
    heartbeat(B);
    unmute();
    if (readLock(B).session_id !== "B") fail("stale lock was not taken over");
    if (!/took over stale lock/.test(captured)) fail("stale takeover was silent");
    if (!isStale({ session_id: "x", stale_after_iso: "" })) fail("empty stale_after_iso not treated as stale");
    if (!isStale({ session_id: "x", stale_after_iso: "not-a-date" })) fail("unparseable stale_after_iso not stale");
    if (isStale({ session_id: "x", stale_after_iso: new Date(Date.now() + 60_000).toISOString() }))
      fail("a future stale_after_iso was wrongly treated as stale");

    // 7. staleness windows: hook 90 / manual 480, explicit flags win, garbage falls back.
    const r = resolveStaleMinutes;
    if (r({ hookMode: true }) !== STALE_MINUTES_HOOK) fail("hook default is not 90");
    if (r({ hookMode: false }) !== STALE_MINUTES_MANUAL) fail("manual default is not 480");
    if (r({ staleMinutes: "30", hookMode: false }) !== 30) fail("explicit minutes did not win");
    if (r({ staleHours: "2", hookMode: true }) !== 120) fail("stale-hours did not convert");
    if (r({ staleMinutes: "abc", hookMode: true }) !== STALE_MINUTES_HOOK) fail("NaN did not fall back (hook)");
    if (r({ staleMinutes: "-5", hookMode: false }) !== STALE_MINUTES_MANUAL) fail("negative did not fall back (manual)");
    const wl = readLock(B);
    const mins = Math.round((Date.parse(wl.stale_after_iso) - Date.parse(wl.started_at_iso)) / 60000);
    if (mins !== STALE_MINUTES_HOOK) fail(`written window is ${mins} min, expected ${STALE_MINUTES_HOOK}`);

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

    // 11. THE GLOBAL REGISTRY: a session publishes itself on every lock write,
    //     expired entries are pruned by whoever writes next, and a release
    //     withdraws only its own entry. This is the cross-repo view the
    //     per-repo lock is structurally blind to, so it is proven in the
    //     cross-repo shape: two sessions, two different repo names.
    mute();
    heartbeat(A);
    const B2 = ctxFor("B2", "other-repo");
    heartbeat(B2);
    unmute();
    let reg = JSON.parse(fs.readFileSync(A.registryPath, "utf8")).sessions;
    if (!reg.A || !reg.B2) fail("the registry did not carry both live sessions");
    if (reg.A.repo !== "fixture-repo" || reg.B2.repo !== "other-repo")
      fail("the registry did not record which repo each session is in");
    if (reg.A.branch !== "branch-of-A") fail("the registry did not record the branch");
    if (!reg.A.stale_after_iso || isStale(reg.A)) fail("a live session was published already stale");

    //     An expired entry is pruned by the NEXT writer -- no separate garbage
    //     collector, and a crashed session stops warning by itself.
    const withGhost = JSON.parse(fs.readFileSync(A.registryPath, "utf8"));
    withGhost.sessions.GHOST = { session_id: "GHOST", repo: "dead-repo", stale_after_iso: "2020-01-01T00:00:00Z" };
    fs.writeFileSync(A.registryPath, JSON.stringify(withGhost));
    mute();
    heartbeat(A);
    unmute();
    reg = JSON.parse(fs.readFileSync(A.registryPath, "utf8")).sessions;
    if (reg.GHOST) fail("an expired registry entry was not pruned");
    if (!reg.B2) fail("the prune took a LIVE entry with it");

    //     RELEASE WITHDRAWS ON EVERY PATH, because release IS SessionEnd. The
    //     first version withdrew only where a lock was actually deleted, and
    //     this case drove only that one path -- so it passed 11/11 with the
    //     leak live. Each spelling below is a real SessionEnd:
    //
    //     (a) the session never held any lock -- "no lock to release";
    //         -- and the lock is REMOVED first, deliberately. heartbeat() on a
    //         free repo CREATES a lock, so releasing straight after it takes
    //         the ordinary owner path and the early return is never reached:
    //         the case would pass while proving nothing about it.
    const C = ctxFor("C", "third-repo");
    mute();
    heartbeat(C);
    fs.rmSync(C.lockPath, { force: true });
    const noLockRc = release(C, { guarded: true });
    unmute();
    reg = JSON.parse(fs.readFileSync(A.registryPath, "utf8")).sessions;
    if (noLockRc !== 0) fail("the no-lock release did not exit 0");
    if (!/no lock to release/.test(captured)) fail("the no-lock EARLY RETURN was not the path driven");
    if (reg.C) fail("a session with no lock stayed published after SessionEnd");

    //     (b) the ORDINARY second-session end: the guarded refusal to delete a
    //     live foreign lock. This is the path the whole registry exists for.
    const D = ctxFor("D");
    mute();
    heartbeat(D);
    const refused = release(D, { guarded: true });
    unmute();
    reg = JSON.parse(fs.readFileSync(A.registryPath, "utf8")).sessions;
    if (refused !== 0) fail("the guarded refusal did not exit 0");
    if (!fs.existsSync(A.lockPath)) fail("the guarded refusal deleted the live lock");
    if (reg.D) fail("a session that ended without owning the lock stayed published as LIVE");

    //     (c) the force path still withdraws only its OWN entry: it deletes
    //     ANOTHER session's LOCK, but that session is still running and must
    //     keep its presence -- removing it would tell the next writer they are
    //     alone.
    //
    //     E takes other-repo's lock FIRST, so B2 is genuinely a non-owner and
    //     `force` is load-bearing. Before this, B2 owned the lock it released:
    //     the case took the ordinary owner path, passed identically with
    //     `force` deleted, and proved nothing about the flag it was named for.
    //     A repo of its own, so the ownership is arranged rather than inherited
    //     from whatever the earlier groups happened to leave behind.
    const owner = ctxFor("OWNER", "force-repo");
    const nonOwner = ctxFor("NONOWNER", "force-repo");
    mute();
    heartbeat(owner);
    heartbeat(nonOwner);
    unmute();
    if (readLock(nonOwner)?.session_id !== "OWNER")
      fail("the fixture did not put a FOREIGN lock in front of the force path");
    mute();
    const forcedRc = release(nonOwner, { guarded: true, force: true });
    unmute();
    if (forcedRc !== 0) fail("the forced release did not exit 0");
    if (readLock(nonOwner)) fail("release --force did not delete the foreign lock");
    if (!/WARNING - releasing lock held by 'OWNER'/.test(captured))
      fail("the forced release did not name the lock's owner");
    reg = JSON.parse(fs.readFileSync(A.registryPath, "utf8")).sessions;
    if (!reg.OWNER) fail("forcing another session's LOCK also withdrew that session from the registry");
    if (reg.NONOWNER) fail("the forcing session did not withdraw itself");
    if (!reg.A) fail("a forced release withdrew an unrelated session from the registry");
    if (!reg.B2) fail("a forced release in one repo withdrew a session in ANOTHER repo");

    //     AN UNIDENTIFIED SESSION IS NOT PUBLISHED. A per-process pid identity
    //     would mint a new entry every turn and withdraw none.
    const anon = { ...ctxFor("pid-4242"), identified: false };
    mute();
    heartbeat(anon);
    unmute();
    reg = JSON.parse(fs.readFileSync(A.registryPath, "utf8")).sessions;
    if (reg["pid-4242"]) fail("a session with no stable identity was published to the registry");
    //         ...and it must not REWRITE the shared file either. release()
    //         calls publishRegistry directly, so gating only the publish path
    //         left a manual terminal release pruning and rewriting every live
    //         session's entry from a process that has nothing to publish --
    //         a lost-update window opened by the very check meant to close one.
    const beforeAnon = fs.readFileSync(A.registryPath, "utf8");
    mute();
    release(anon, { guarded: true });
    unmute();
    if (fs.readFileSync(A.registryPath, "utf8") !== beforeAnon)
      fail("an unidentified session rewrote the shared registry on release");

    //     A NON-OWNER'S started_at MUST NOT MOVE. The second session is the one
    //     the registry exists to reveal, and re-stamping `now` every heartbeat
    //     reported it as having just started however long it had been running.
    //     Time is not advanced by sleeping: the entry is BACKDATED to a value
    //     no clock in this run could produce, so "it was carried forward" and
    //     "the two stamps happened to be in the same second" cannot be
    //     confused. Without the backdate the case passes on a stopped clock.
    const F = ctxFor("F");
    mute();
    heartbeat(F);
    unmute();
    if (readLock(F)?.session_id === "F") fail("the fixture made F the lock OWNER, so this proves the wrong path");
    const backdated = "2020-01-02T03:04:05Z";
    const withBackdate = JSON.parse(fs.readFileSync(A.registryPath, "utf8"));
    withBackdate.sessions.F.started_at_iso = backdated;
    fs.writeFileSync(A.registryPath, JSON.stringify(withBackdate));
    mute();
    heartbeat(F);
    unmute();
    const laterSeen = JSON.parse(fs.readFileSync(A.registryPath, "utf8")).sessions.F.started_at_iso;
    if (laterSeen !== backdated)
      fail("a non-owner's started_at moved on heartbeat (" + backdated + " -> " + laterSeen + ")");

    //     A CORRUPT REGISTRY IS PRESERVED AND REPORTED, never overwritten --
    //     the reader is the only party that can act on it, and it cannot if the
    //     next writer has already replaced the evidence with a clean file.
    const corruptPath = A.registryPath;
    const goodBytes = fs.readFileSync(corruptPath);
    fs.writeFileSync(corruptPath, "{not json");
    mute();
    heartbeat(A);
    unmute();
    if (fs.readFileSync(corruptPath, "utf8") !== "{not json") fail("a corrupt registry was overwritten");
    if (!/unreadable/.test(captured)) fail("a corrupt registry was not reported");

    //         AN ARRAY IS NOT A MAP, and `typeof [] === "object"` said it was.
    //         Every published entry was then assigned as a named property on an
    //         array and dropped by JSON.stringify, with no warning: the file
    //         reported healthy while holding nothing, so the write guard said
    //         "you are alone" for good. Found by MUTATION -- the fix shipped
    //         with no case, and the mutant scored zero.
    fs.writeFileSync(corruptPath, JSON.stringify({ sessions: [] }));
    mute();
    heartbeat(A);
    unmute();
    if (!/unreadable/.test(captured)) fail("an ARRAY sessions map was accepted as healthy");
    if (!/an array/.test(captured)) fail("the array registry was not diagnosed as an array");
    const afterArray = JSON.parse(fs.readFileSync(corruptPath, "utf8"));
    if (!Array.isArray(afterArray.sessions)) fail("the array registry was overwritten rather than preserved");

    fs.writeFileSync(corruptPath, goodBytes);

    //     THE SANDBOX ITSELF. A CLI-level test points SESSION_LOCK_ROOT at a
    //     temp tree; the registry must follow it there. This asserts the
    //     RESOLVER rather than the absence of a write, because "it did not
    //     touch the real file" is only provable on a machine that has one.
    const sandboxed = registryPathFor({ SESSION_LOCK_ROOT: path.join(tmp, "sandbox") });
    if (!sandboxed.startsWith(path.join(tmp, "sandbox"))) fail("SESSION_LOCK_ROOT did not sandbox the registry path");
    if (registryPathFor({ SESSION_LOCK_ROOT: "/x", CLAUDE_SESSION_REGISTRY: "/explicit.json" }) !== "/explicit.json")
      fail("an explicit CLAUDE_SESSION_REGISTRY did not win");
    if (registryPathFor({ CLAUDE_HOME_DIR: path.join(tmp, "home") }) !== path.join(tmp, "home", ".session-registry.json"))
      fail("the default registry path did not follow CLAUDE_HOME_DIR");

    // 10. CLI argv parsing: flags are position-independent and values are never verbs.
    if (parseArgv(["--id", "abc", "release"]).cmd !== "release")
      fail("a flag VALUE was parsed as the subcommand");
    if (parseArgv(["--stale-minutes", "90", "acquire", "--warn-only"]).cmd !== "acquire")
      fail("verb after a valued flag was not found");
    if (parseArgv(["heartbeat", "--quiet"]).cmd !== "heartbeat" || !parseArgv(["heartbeat", "--quiet"]).quiet)
      fail("trailing bool flag not parsed");
    if (parseArgv([]).cmd !== "status") fail("bare invocation did not default to status");
    if (!parseArgv(["release", "--bogus"]).error) fail("unknown flag was not rejected");
    if (!parseArgv(["release", "extra"]).error) fail("second verb was not rejected");
    if (parseArgv(["--id", "x", "release"]).id !== "x") fail("flag value lost");
    // ba4de33 (Website round-3 review): a valued flag with NO payload must error, not
    // silently become undefined - `release --id` read as targeted but ran generic.
    const trailId = parseArgv(["release", "--id"]);
    if (!trailId.error || !/requires a value/.test(trailId.error)) fail("trailing --id with no value was not rejected");
    if (!parseArgv(["--stale-minutes"]).error) fail("a lone trailing valued flag was not rejected");
    // LAST-INDEX control: a valued flag whose payload IS the final token must still
    // parse - an off-by-one in the bounds check reds here instead of passing.
    const lastIdx = parseArgv(["release", "--id", "x"]);
    if (lastIdx.error || lastIdx.id !== "x") fail("a valued flag at last index was wrongly rejected");
    if (parseArgv(["--stale-hours", "2", "acquire"]).staleHours !== "2") fail("stale-hours payload lost after guard");
  } finally {
    unmute();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  if (failures) {
    console.error(`session-lock --self-test: ${failures} FAILURE(S)`);
    return 1;
  }
  // No group count. It read "10 groups" until a group was added ABOVE group 10
  // and the number was bumped by hand -- the same defect CLAUDE.md removed from
  // its own guard count and the twin file removed from this very line: a number
  // copied into prose has no writer maintaining it.
  console.log("session-lock --self-test: OK (both directions)");
  return 0;
}

/* ---------------------------------------------------------------------- cli */

/**
 * Hook payloads arrive as JSON on stdin. Read ONLY under --hook AND a non-TTY stdin:
 * a hook invocation is guaranteed a payload plus EOF, but a manual run with a non-TTY
 * stdin (CI, agent Bash tools) would block forever on readFileSync(0), and a human
 * typing --hook at a real terminal would sit waiting for Ctrl+D.
 */
function sessionIdFromStdin() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return JSON.parse(raw).session_id || "";
  } catch {
    return "";
  }
}

const BOOL_FLAGS = new Set(["--warn-only", "--force", "--quiet", "--hook", "--self-test"]);
const VALUE_FLAGS = new Set(["--id", "--stale-minutes", "--stale-hours"]);
const COMMANDS = new Set(["acquire", "heartbeat", "release", "check", "status"]);

/** Position-independent argv parse; a valued flag's payload is never mistaken for the verb. */
function parseArgv(argv) {
  const out = { cmd: null, error: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS.has(a)) {
      // A valued flag at the end of argv has no payload. Accepting it silently would
      // set the option to undefined and fall through to the default - so `release --id`
      // would run the GENERIC unguarded release while reading like a targeted one. This
      // parser already errors on unknown flags and stray verbs; a truncated flag is the
      // same class of operator typo and gets the same treatment.
      if (i + 1 >= argv.length) {
        out.error = `flag '${a}' requires a value`;
        return out;
      }
      out[a === "--id" ? "id" : a === "--stale-minutes" ? "staleMinutes" : "staleHours"] = argv[++i];
    } else if (BOOL_FLAGS.has(a)) {
      out[a.replace(/^--/, "").replace(/-(\w)/g, (_, c) => c.toUpperCase())] = true;
    } else if (a.startsWith("--")) {
      out.error = `unknown flag '${a}'`;
      return out;
    } else if (out.cmd === null) {
      out.cmd = a;
    } else {
      out.error = `unexpected argument '${a}'`;
      return out;
    }
  }
  out.cmd = out.cmd || "status";
  if (!out.selfTest && !COMMANDS.has(out.cmd)) out.error = `unknown subcommand '${out.cmd}'`;
  return out;
}

// REALPATH TO REALPATH -- see scripts/lib/entry-point.mjs. The raw
// `import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href` that
// stood here fails open: node realpaths one side and not the other, so through a
// junction or symlink this file exited 0 having done NOTHING. Measured 2026-08-13
// in BOTH repos: `--self-test` printed its OK line by the canonical path and 0
// bytes through a junction, and so did `status`. For an advisory lock that is the
// worst available silence -- the collision warning this file exists to raise never
// arrives, and the symptom of the collision it was watching for is lost work.
if (isEntryPoint(import.meta.url)) {
  const args = parseArgv(process.argv.slice(2));

  if (args.error) {
    // Checked before selfTest: a malformed invocation must fail loudly even
    // when --self-test was also passed, matching this dispatch's own
    // fail-loud intent - an argument-parse error is never worth silently
    // swallowing behind an unrelated flag.
    process.stderr.write(
      `session-lock: ${args.error}\n` +
        "usage: session-lock.mjs {acquire|heartbeat|release|check|status} " +
        "[--id X] [--stale-minutes N] [--stale-hours H] [--warn-only] [--force] [--quiet] [--hook]\n"
    );
    process.exitCode = 1;
  } else if (args.selfTest) {
    // exitCode, never process.exit(): on Windows a pending pipe write can be discarded
    // by an immediate exit (the libuv quirk pre-ship.mjs documents) - and this file's
    // whole job is a warning arriving.
    process.exitCode = selfTest();
  } else {
    const hookMode = Boolean(args.hook);
    const namedId =
      args.id ||
      (hookMode && !process.stdin.isTTY ? sessionIdFromStdin() : "") ||
      process.env.COWORK_SESSION_ID ||
      process.env.CLAUDE_SESSION_ID ||
      "";
    // The pid fallback still names the LOCK -- one file, rewritten every turn,
    // where a changing identity costs nothing. It must not name a REGISTRY
    // entry, so the distinction is carried explicitly rather than inferred
    // downstream from the string's shape.
    const sessionId = namedId || `pid-${process.pid}`;

    const ctx = context({
      // SESSION_LOCK_ROOT is a TEST-ONLY escape hatch: without it, a CLI-level test
      // would resolve the root from this script's own location and operate on the
      // real repo's lock - which is exactly how an early draft of the vitest suite
      // deleted the live session's lock mid-run. Hooks never set it.
      repoRoot: process.env.SESSION_LOCK_ROOT || undefined,
      sessionId,
      identified: Boolean(namedId),
      staleMinutes: resolveStaleMinutes({
        staleMinutes: args.staleMinutes,
        staleHours: args.staleHours,
        hookMode,
      }),
    });

    let code = 0;
    try {
      switch (args.cmd) {
        case "acquire":
          code = acquire(ctx, { warnOnly: Boolean(args.warnOnly) });
          break;
        case "heartbeat":
          code = heartbeat(ctx, { quiet: Boolean(args.quiet) });
          break;
        case "release":
          code = release(ctx, { force: Boolean(args.force), guarded: hookMode });
          break;
        case "check":
          code = check(ctx);
          break;
        default:
          code = status(ctx);
      }
    } catch (err) {
      // An advisory lock must never take a session down with it.
      process.stderr.write(`session-lock: non-fatal error (${err.message || err})\n`);
      code = 0;
    }
    process.exitCode = code;
  }
}

export {
  context,
  // Exported for ONE reason: ~/.claude/hooks/ops-self-test.mjs cross-checks
  // this resolver against the write guard's copy of the same precedence, so the
  // claim that the two halves cannot drift is measured rather than commented.
  registryPathFor,
  resolveStaleMinutes,
  readLock,
  isStale,
  writeLock,
  acquire,
  heartbeat,
  release,
  check,
  status,
  parseArgv,
  selfTest,
};
