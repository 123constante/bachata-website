/**
 * review-stamp.mjs -- the review RECEIPT writer for this repo.
 *
 * DEFAULT MODE (PostToolUse hook, matcher `ReportFindings`): whenever a
 * /code-review finishes and the reviewer reports through the ReportFindings
 * tool, this hook fires and writes .claude/.review-stamp.json:
 *   { version, timestamp, session_id, hashes: {rel -> CRLF-sha256},
 *     deletions: [rel], findings }
 *
 * Ported from the admin repo's scripts/hooks/review-stamp.mjs. Two Website
 * changes, both forced by things this repo has that admin does not:
 *
 *  1. The stamp attests BOTH risk tiers (hard = the guard/CI/hook surface, soft
 *     = app code that deploys prod on merge). Tier posture is the GATE's
 *     business -- scripts/ship-gate.mjs blocks on hard and warns on soft. The
 *     receipt deliberately makes no tier distinction: a narrower receipt could
 *     never be widened later without re-reviewing everything.
 *  2. DELETIONS are recorded. riskyFilesInScope() drops anything not on disk
 *     (a deletion carries no content to hash), which by construction left the
 *     highest-risk guard edit there is -- deleting a workflow, a check script or
 *     a git hook -- unattestable. Those paths go in `deletions`; see the
 *     mergeReviewStamp docblock for why path identity is the honest limit there.
 *
 * COVERAGE CONTRACT -- READ THIS. The stamp attests the risky files IN SHIP
 * SCOPE at review time (scripts/lib/review-scope.mjs owns that predicate), NOT a
 * per-file record of what the reviewer opened -- the ReportFindings payload
 * carries findings, not a reviewed-file set, so no finer signal exists. This is
 * SOUND only when the review covered the whole ship scope, which is exactly what
 * the default `/code-review` does (it diffs the entire branch + working tree). Do
 * NOT arg-narrow `/code-review` to a subset while risky files are pending: a
 * narrowed review would still mint a full-scope receipt. A clean review still
 * fires (empty findings array) -- zero findings is a valid GREEN stamp.
 *
 * FAIL-OPEN-LOUD: a writer crash must NEVER break the review. Any error is
 * logged to stderr and the hook exits 0. Downstream (ship-gate, .githooks/
 * pre-push) fails CLOSED on a missing/stale/corrupt stamp, so nothing is lost by
 * exiting soft here.
 *
 * --manual FALLBACK: if this harness never fires the PostToolUse hook, a human at
 * a real terminal can hand-stamp interactively: run
 * `node scripts/hooks/review-stamp.mjs --manual`, then type CONFIRM at the
 * prompt. It requires stdin to be an INTERACTIVE TTY -- a piped
 * `echo CONFIRM | ...` is a pipe, not a TTY, and is refused, so Claude's
 * non-interactive shell (and any agent piping the word) cannot self-mint the
 * receipt. A manual stamp records findings: [] (a human attestation that the
 * risky ship scope was reviewed clean).
 */

import fs from "node:fs";
import path from "node:path";
import { isEntryPoint } from "../lib/entry-point.mjs";
import {
  STAMP_PATH,
  recordMintAttempt,
  readStdin,
  enableScopeCache,
  resolveShipBase,
  shipScope,
  hashRiskyPaths,
  loadStamp,
  mergeReviewStamp,
  describeProvenance,
} from "../lib/review-scope.mjs";

// ADDITIVE: fold this review's coverage into the PRIOR stamp (mergeReviewStamp),
// instead of overwriting it, so a file reviewed clean earlier on the branch stays
// covered through a later merge. The merge is fail-safe (it only carries forward
// FRESH and CLEAN prior coverage) -- the contract and its both-direction tests
// live on mergeReviewStamp in review-scope.mjs.
//
// ONE BASE REF, and now ONE SNAPSHOT, for the whole mint. The two halves used to
// be separate defaulted calls, so a ref that moved in between (a concurrent
// fetch, an upstream being set) would stamp them against different definitions of
// "this ship". shipScope() resolves the whole question once.
//
// THE SAME SCOPE THE GATE ENFORCES. This is the half that has to move with
// scripts/ship-gate.mjs, not after it: a mint over a WIDER scope than the gate
// asks about attests files nobody proposed to change, and a mint over a NARROWER
// one leaves a red the operator has no way to clear. Both halves now derive from
// shipScope(), so the merge-from-main subtraction cannot apply to one and not the
// other. BOTH halves also now resolve their BASE the same way, via
// resolveShipBase() -- the same widen-when-the-narrow-scope-is-empty rule the
// gate applies. Before this, the mint defaulted to resolveBaseRef() (never
// widened), so a push whose narrow scope was empty but whose trunk-widened
// scope was not left the automatic hook mint attesting zero files while the
// gate demanded review of the widened one -- a review-then-red with no
// explanation. See runManual's empty-scope refusal below for the case where
// EVEN THE WIDENED scope is empty.
export function writeStamp({ sessionId, findings, baseRef = resolveShipBase() }) {
  const ship = shipScope(baseRef);
  const hashes = hashRiskyPaths(ship.risky);
  const deletions = ship.deleted;
  const { stamp: prev } = loadStamp(); // {status, stamp}; corrupt/missing -> null -> clean mint
  const stamp = mergeReviewStamp(prev, {
    sessionId: sessionId || null,
    hashes,
    deletions,
    findings,
    nowIso: new Date().toISOString(),
    now: Date.now(),
    // WHERE this receipt was minted. Computed HERE rather than defaulted inside
    // mergeReviewStamp so the merge stays a pure function -- see its docblock.
    provenance: describeProvenance(),
  });
  /* ATOMIC: stage to a sibling, then rename. A full-branch mint is well past the
   * ~2 KB threshold CLAUDE.md documents for silent truncation on this mount (the
   * first real receipt this apparatus wrote was 9 KB), and a torn write leaves a
   * syntactically invalid stamp -- which loadStamp() reports as "corrupt", reddening
   * the whole ship and forcing a re-review of work that HAD been reviewed. rename()
   * is atomic on NTFS and POSIX alike, so a reader (ship-gate running while the hook
   * writes) sees either the old receipt or the new one, never half of either.
   * The sibling lives in the same directory so the rename cannot cross a volume. */
  fs.mkdirSync(path.dirname(STAMP_PATH), { recursive: true });
  const tmpPath = STAMP_PATH + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(stamp, null, 2) + "\n");
  fs.renameSync(tmpPath, STAMP_PATH);
  return stamp;
}

/**
 * Did a human type CONFIRM?
 *
 * Line-based and control-character tolerant, because THE EOF KEYSTROKE LANDS IN
 * THE INPUT. On Windows, Ctrl-D is not EOF at all -- it arrives as a literal 0x04
 * -- and the real EOF, Ctrl-Z, arrives as 0x1a. A strict `raw.trim() ===
 * "CONFIRM"` therefore rejected a correctly-typed confirmation, twice, for the
 * one person this fallback exists for. `trim()` strips whitespace, not control
 * characters, so the mismatch was invisible in the echoed terminal output.
 *
 * This does NOT widen the gate. The TTY check in runManual() runs first and
 * refuses every piped stdin, so the only thing that reaches here is keystrokes at
 * a real interactive terminal -- there is no payload for a looser match to let
 * through.
 *
 * Filtering by char code rather than a regex range keeps the control characters
 * out of this file's own source, where they would be invisible to a reviewer.
 */
export function isConfirmation(raw) {
  const printableOnly = (line) =>
    [...line]
      .filter((ch) => {
        const code = ch.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join("")
      .trim();
  return String(raw == null ? "" : raw)
    .split(/\r?\n/)
    .some((line) => printableOnly(line) === "CONFIRM");
}

/**
 * The EOF keystroke by platform. Printing the wrong one is not cosmetic: it is an
 * instruction the operator follows literally, and following it produced a refusal
 * with no hint as to why. Standing rule from arc phase 0.5 -- EXECUTE the text a
 * guard prints, do not just read it.
 */
export function eofHint(platform = process.platform) {
  return platform === "win32" ? "Enter, then Ctrl-Z and Enter" : "Enter, then Ctrl-D";
}

function runManual() {
  // An interactive TTY is the gate: a piped `echo CONFIRM | ...` (which any agent
  // can run non-interactively) is NOT a TTY and is refused here, before stdin is
  // read at all.
  if (!process.stdin.isTTY) {
    console.error("review-stamp --manual: stdin is not an interactive terminal -- refusing to stamp.");
    console.error("  Run it interactively in a real terminal and type CONFIRM at the prompt.");
    console.error("  (A piped CONFIRM is a pipe, not a TTY -- this is deliberate: it stops a");
    console.error("   non-interactive shell from self-minting a review receipt.)");
    process.exitCode = 1;
    return;
  }

  /* REFUSE AN EMPTY SCOPE, before prompting.
   *
   * Risky scope is "differs from the push target", and the push target is the
   * branch's own upstream. So stamping AFTER pushing resolves to an empty diff
   * and produces a stamp attesting NOTHING -- which the admin original then
   * reported as success ("MANUAL stamp written -- 0 risky file(s) attested").
   * Observed for real in the admin repo on 2026-07-24.
   *
   * It is not dangerous -- the gate fails closed on a hash it does not hold --
   * but it is the exact shape this apparatus exists to remove: a green-looking
   * artefact that means nothing. And it silently overwrote a valid stamp.
   *
   * The fix is to name the base explicitly, which is what REVIEW_SCOPE_BASE is
   * for. DELETIONS COUNT AS SCOPE: a ship whose only risky change is removing a
   * check script has an empty on-disk scope but is emphatically not empty. */
  const baseRef = resolveShipBase();
  const ship = shipScope(baseRef);
  const tiers = ship.tiers;
  const deletions = ship.deleted;
  const total = tiers.hard.length + tiers.soft.length + deletions.length;
  if (total === 0) {
    console.error("review-stamp --manual: the risky ship scope is EMPTY -- refusing to stamp.");
    console.error("  A stamp over no files attests nothing, and would overwrite a real one.");
    console.error("");
    console.error("  Usually this means the work is already pushed, so HEAD equals the upstream");
    console.error("  and the diff that defines 'this ship' is empty. Name the base instead:");
    console.error("");
    console.error("    REVIEW_SCOPE_BASE=<commit-before-the-reviewed-work> node scripts/hooks/review-stamp.mjs --manual");
    console.error("");
    console.error("  Pick the base the REVIEW actually covered -- not origin/main, which would");
    console.error("  attest every risky file on the branch, including ones no reviewer read.");
    process.exitCode = 1;
    return;
  }

  console.error("review-stamp --manual: " + total + " risky file(s) in scope (base " + baseRef + "):");
  for (const rel of tiers.hard) console.error("  [hard] " + rel);
  for (const rel of tiers.soft) console.error("  [soft] " + rel);
  for (const rel of deletions) console.error("  [del ] " + rel);
  process.stderr.write(
    "Type CONFIRM to attest the risky ship scope was reviewed clean, then " + eofHint() + ": "
  );
  if (!isConfirmation(readStdin())) {
    console.error("review-stamp --manual: no CONFIRM entered -- refusing to stamp.");
    console.error("  (Type CONFIRM on its own line, then " + eofHint() + ".)");
    process.exitCode = 1;
    return;
  }
  const stamp = writeStamp({ sessionId: "manual", findings: [], baseRef });
  console.log(
    "review-stamp: MANUAL stamp written -- " +
      Object.keys(stamp.hashes).length +
      " risky file(s) attested, " +
      stamp.deletions.length +
      " deletion(s)."
  );
}

/**
 * The PostToolUse (ReportFindings) hook body: read the hook payload from stdin
 * and mint a receipt over the current risky scope. Fail-open-loud -- never
 * throws, always exits soft.
 *
 * INJECTABLE SEAMS (readInput, write) exist ONLY so the both-direction guard
 * tests can drive runHook without touching fd 0 or the real .review-stamp.json --
 * production calls runHook() with the defaults (this mirrors ship-gate.decide()'s
 * injectable `now`).
 *
 * RETURNS {minted, code}; it does NOT touch process.exitCode. The soft exit is
 * applied by the isMain entry block below, exactly as ship-gate.mjs does it. The
 * first cut set process.exitCode = 0 in a finally here, which had two costs: the
 * unit test asserting "exits soft" was reading a value the function had just
 * written one statement earlier, so it could not fail and a control mutation
 * deleting the fail-open would still have passed it; and calling runHook()
 * in-process cleared whatever exit code the vitest worker had already set.
 */
export function runHook({
  readInput = readStdin,
  write = writeStamp,
  /* The journal seam. Every exit below records ONE line, so an absent journal
   * means the hook did not run at all -- which is what a text-only /code-review
   * leaves behind, and the only evidence that such a review ever happened.
   *
   * DEFAULTS TO A NO-OP, and the isMain block supplies the real writer. The
   * other seams here (readInput, write) exist so a unit test cannot touch fd 0
   * or the real receipt; a journal writer defaulted ON would punch straight
   * through that -- ten existing runHook specs would each append a GENUINE fire
   * to this tree's journal, and the gate would then reassure an operator that
   * the mint works on the strength of a test run. recordMintAttempt is covered
   * directly (against an injected path) and its wiring here is asserted, so
   * nothing production depends on goes unexercised. */
  record = () => {},
} = {}) {
  /* Swallow here as well as inside recordMintAttempt. An INJECTED record (tests,
   * any future caller) does not inherit that catch, and a throwing journal would
   * do two kinds of damage: break runHook's never-throws contract, and -- on the
   * success path, where the stamp is ALREADY written -- drop into the catch below
   * and report a minted receipt as a failure. The journal is a diagnostic; it
   * gets no say in what the hook returns. */
  const safeRecord = (entry) => {
    try {
      record(entry);
    } catch {
      /* nothing: a diagnostic that breaks a review is worse than no diagnostic */
    }
  };
  try {
    const raw = readInput();
    // SELF-MINT GUARD. A genuine PostToolUse `ReportFindings` fire always pipes a
    // JSON payload on stdin (even a clean review sends a findings-empty payload).
    // EMPTY stdin means this is NOT a real hook fire -- it is the documented
    // footgun where `node review-stamp.mjs <any-arg-that-is-not --manual>` falls
    // through to runHook() with nothing on fd 0 and, before this guard, wrote a
    // real 0-findings stamp over the current risky scope with no TTY and no
    // CONFIRM -- exactly what --manual is gated to stop. Refuse (fail-closed: no
    // write -> the gate stays shut, --manual is the way in). NON-empty stdin is
    // trusted: a real hook fire is indistinguishable from piped JSON, so this
    // guard closes only the empty-stdin hole -- the --manual TTY gate is the lock
    // against a non-interactive shell hand-minting a receipt.
    if (!raw || !raw.trim()) {
      console.error(
        "review-stamp: empty stdin -- not a ReportFindings hook fire. Refusing to self-mint a receipt."
      );
      console.error("  (To hand-stamp, run `node scripts/hooks/review-stamp.mjs --manual` at a real TTY.)");
      // genuine:false -- no payload, so this proves nothing about the wiring.
      safeRecord({ outcome: "refused-empty-stdin", genuine: false });
      return { minted: false, code: 0 };
    }
    let payload = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
    const sessionId = payload.session_id || payload.sessionId || null;
    const toolInput = payload.tool_input || payload.toolInput || {};
    const findings = Array.isArray(toolInput.findings) ? toolInput.findings : [];
    const stamp = write({ sessionId, findings });
    console.error(
      "review-stamp: wrote receipt for " +
        Object.keys(stamp.hashes).length +
        " risky file(s), " +
        (stamp.deletions || []).length +
        " deletion(s), " +
        findings.length +
        " finding(s)."
    );
    safeRecord({ outcome: "minted", genuine: true, sessionId });
    return { minted: true, code: 0 };
  } catch (err) {
    console.error(
      "review-stamp: WARN -- could not write receipt (" + (err.message || err) + "). Review not blocked."
    );
    /* A THROWN write still proves the hook fired: the payload arrived and the
     * failure was downstream of it. Recording it genuine keeps the gate from
     * blaming a missing tool for what was really a broken writer. */
    safeRecord({ outcome: "error: " + (err.message || err), genuine: true });
    return { minted: false, code: 0 };
  }
}

// Run only when executed as the entry script (not when imported by a test) --
// mirrors ship-gate.mjs. Without this guard, importing the module to unit-test
// runHook would fire the hook (read real fd 0, possibly mint a stamp) as an
// import side effect.
// Realpath-to-realpath (scripts/lib/entry-point.mjs). The string compare it
// replaces mispredicted through a junction or symlink, and this file is one of
// the two where that is worst: a receipt writer that silently does not run
// leaves the ship gate to judge an absent stamp.
if (isEntryPoint(import.meta.url)) {
  // Safe here for the same reason as in ship-gate.mjs: a one-shot CLI process that
  // does not mutate the tree between scope queries. --manual asks four times.
  enableScopeCache();
  if (process.argv.includes("--manual")) {
    runManual();
  } else {
    // ALWAYS SOFT: a receipt writer must never fail the review that triggered it.
    // The soft exit lives here, not inside runHook, so the function's fail-open is
    // observable by a test rather than self-asserting.
    // The real journal writer is supplied HERE, not defaulted inside runHook --
    // see the `record` seam. This is the only production caller.
    process.exitCode = runHook({ record: recordMintAttempt }).code;
  }
}
