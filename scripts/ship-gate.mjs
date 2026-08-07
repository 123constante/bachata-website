/**
 * ship-gate.mjs -- the review-receipt decision table. THE predicate that answers
 * "has the risky part of this ship actually been reviewed?" Ported from the admin
 * repo's scripts/yume-gate.mjs; consulted at one chokepoint today
 * (.githooks/pre-push step 2) and exposed as `--json` so a skill or a future
 * chokepoint can inject the same verdict verbatim rather than re-deriving it.
 *
 * DECISION TABLE (exit codes mirror the admin gate -- 0/1/2 so a caller can never
 * read an infra failure as "clean"):
 *   exit 0  GREEN   nothing risky in scope, or every HARD-tier file/deletion is
 *                   covered by a fresh clean stamp, and no unresolved blocking
 *                   finding. Uncovered SOFT-tier files print as WARNINGS here.
 *   exit 1  RED     policy: an uncovered HARD-tier file or deletion / no stamp /
 *                   a present-but-corrupt stamp / stamp > 24h old / a blocking
 *                   finding with no resolving outcome. Findings block regardless
 *                   of tier and regardless of scope -- the defect may live
 *                   anywhere.
 *   exit 2  RED     infra: a git error, or an fs error READING the stamp. A
 *                   garbled stamp is NOT infra -- it is policy (see loadStamp):
 *                   otherwise a truncated write would downgrade a hard block to
 *                   a warning, making a corrupt stamp weaker than a missing one.
 *
 * THE WEBSITE CHANGE vs admin: TWO TIERS, different postures.
 *
 *   hard (scripts/ bin/ .githooks/ .github/ .claude/) -- the guard, CI and hook
 *     surface. If one of these is wrong, nothing downstream catches it: the
 *     broken thing IS the net. Unstamped -> exit 1, the push is blocked.
 *
 *   soft (src/ api/ server/) -- app code. Merging it deploys prod, so it is
 *     genuinely risky, but CI, the e2e suite and PR review all still sit
 *     underneath it. Unstamped -> loud warning, exit 0.
 *
 * WHY SOFT ONLY WARNS (for now). Blocking every src/ push would only be honest if
 * a receipt reliably appears when a review happens. On this repo the PostToolUse
 * ReportFindings mint is NEWLY wired and not yet observed firing, and a gate that
 * blocks work while the mint is unproven trains `--no-verify`, which disables the
 * hard tier too. So soft-tier starts advisory. Flip it with
 * SHIP_GATE_STRICT_SOFT=1 (or the STRICT_SOFT_DEFAULT constant) once mints are
 * observed -- tests pin BOTH postures, so the flip is a one-line change with a
 * proof already attached.
 *
 * DELETIONS. A risky file this ship DELETES has no bytes left to hash, so it can
 * never appear in the stamp's `hashes` map -- which left the highest-risk guard
 * edit there is (removing a workflow, a check script, a git hook) green by
 * construction. review-scope's deletedRiskyFiles() finds them and the stamp's
 * `deletions` array attests them by PATH. Same tier posture as edits.
 *
 * Content hashes (not commit SHAs) are the identity for files that still exist --
 * see scripts/lib/review-scope.mjs. Re-reporting findings with outcomes refreshes
 * the stamp, and because the refresh re-hashes files, "outcome: fixed" only goes
 * green if the fix was made BEFORE the re-report: honest ordering enforced for
 * free.
 *
 * WHAT THIS IS NOT. The receipt is a plain JSON file in a gitignored directory, so
 * it is a DISCIPLINE boundary, not a security one: anything that can write to the
 * repo can mint one, and `git push --no-verify` skips the hook outright. The value
 * is that the honest path (run the review, let the hook mint) is the easy one and
 * every dishonest path has to be chosen deliberately. Two consequences worth
 * stating plainly: the --manual TTY gate stops a NON-INTERACTIVE SHELL from
 * hand-minting, not a determined human; and its empty-scope refusal cannot be
 * exercised by an automated harness at all, because the TTY check runs first (by
 * design -- it refuses before stdin is read).
 *
 * And one asymmetry worth naming rather than pretending away: DELETING the receipt
 * erases recorded findings. loadStamp() works hard to stop a corrupt stamp being
 * weaker than a missing one, but nothing can make a MISSING stamp weaker than a
 * findings-carrying one -- with no file there is nothing to read. So on a soft-only
 * ship under the advisory posture, `rm .claude/.review-stamp.json` turns a red into
 * a green, and a fresh clone or anything that tidies .claude/ does it by accident.
 * A durable findings store is the only real fix and it is out of scope here; the
 * mitigation that exists is that HARD-tier scope reds on a missing stamp, so the
 * guard surface is never cleared this way.
 *
 * Never calls process.exit() mid-flight (Windows libuv/keep-alive quirk) -- sets
 * process.exitCode and returns.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  REPO_ROOT,
  enableScopeCache,
  resolveBaseRef,
  resolveShipBase,
  tieredScope,
  deletedRiskyFiles,
  renamePairs,
  riskTier,
  toPosix,
  hashFile,
  loadStamp,
  stampAgeMs,
  stampIsFresh,
  unresolvedConfirmedReasons,
  provenanceMismatch,
  describeMintHistory,
  readMintLog,
  STAMP_PATH,
} from "./lib/review-scope.mjs";

/** Soft-tier posture. false = warn and pass; true = block like hard. */
export const STRICT_SOFT_DEFAULT = false;
export const STRICT_SOFT_ENV = "SHIP_GATE_STRICT_SOFT";

/** Read the strict-soft override. Only an explicit affirmative flips it, and an
 *  explicit negative can force lenient even after the default flips -- so both
 *  directions are reachable from the environment whichever way the default sits. */
export function strictSoftFromEnv(env = process.env) {
  const raw = env[STRICT_SOFT_ENV];
  if (raw === undefined || raw === null || String(raw).trim() === "") return STRICT_SOFT_DEFAULT;
  const v = String(raw).trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return STRICT_SOFT_DEFAULT;
}

function ageLabel(stamp, now) {
  const ms = stampAgeMs(stamp, now);
  return Number.isFinite(ms) ? (ms / 3600000).toFixed(1) + "h old" : "carrying no parseable timestamp";
}

/**
 * Pure decision given the tiered scope, the current hashes, and the stamp.
 * Unit-testable; `now` and `strictSoft` are injectable.
 *
 * @param {{hard:string[], soft:string[]}} scope   risky files still on disk
 * @param {{hard:string[], soft:string[]}} deleted risky files this ship removes
 * @param {Record<string,string|null>} currentHashes rel -> hash (null = unreadable)
 * @param {object|null} stamp  null means "no valid stamp"
 * @param {string} stampAbsentLabel  how to describe a null stamp (run() passes a
 *        different phrase for a present-but-corrupt one, so the operator is not
 *        told to run a review when the real problem is a truncated file)
 * @returns {{code:0|1|2, status:'green'|'policy'|'infra', reasons:string[],
 *           warnings:string[], scope:object, deleted:object, strictSoft:boolean}}
 */
export function decide({
  scope = { hard: [], soft: [] },
  deleted = { hard: [], soft: [] },
  currentHashes = {},
  stamp = null,
  now = Date.now(),
  strictSoft = STRICT_SOFT_DEFAULT,
  stampAbsentLabel = "no valid review stamp found -- run /code-review",
  renames = [],
  /* Why an EXISTING stamp may not speak for this tree (null when it does, or
   * when the stamp predates provenance). Injected rather than computed here so
   * decide() stays pure and the unit tests can drive both directions. */
  provenanceNote = null,
  mintNote = null,
}) {
  const hard = scope.hard || [];
  const soft = scope.soft || [];
  const delHard = deleted.hard || [];
  const delSoft = deleted.soft || [];

  // Findings block regardless of tier AND regardless of whether anything risky is
  // in scope: a CONFIRMED (or unverified -- see blocksTheShip) defect may live in
  // any file, including one this predicate never classifies as risky.
  const findingReasons = unresolvedConfirmedReasons(stamp).map(
    (s) => "blocking finding unresolved: " + s
  );

  const fresh = !!stamp && stampIsFresh(stamp, now);
  const stampedFor = (stamp && stamp.hashes) || {};
  const stampedDeletions = new Set(
    (Array.isArray(stamp && stamp.deletions) ? stamp.deletions : []).map(toPosix)
  );
  /** The hash this stamp holds FOR THIS PATH, or undefined if it holds none. */
  const stampedHashOf = (rel) =>
    Object.prototype.hasOwnProperty.call(stampedFor, rel) ? stampedFor[rel] : undefined;
  /** The path this one was renamed FROM in this ship, or undefined. */
  const renameSourceOf = (rel) => {
    const hit = (renames || []).find((p) => p && toPosix(p.to) === toPosix(rel));
    return hit ? toPosix(hit.from) : undefined;
  };

  /** Why is this on-disk file not covered? null when it IS covered. */
  const whyFile = (rel) => {
    const h = currentHashes[rel];
    // A null hash is NOT "covered by default". hashFile() returns null for an
    // unreadable path and for a directory (EISDIR), so treating it as covered
    // would fail OPEN on exactly the paths the gate cannot see.
    if (!h) return rel + " -- could not be hashed (unreadable, or a directory)";
    if (!stamp) return rel + " -- " + stampAbsentLabel;
    if (!fresh) return rel + " -- review stamp is " + ageLabel(stamp, now) + " (> 24h) -- re-review";
    const stamped = stampedHashOf(rel);
    if (stamped !== undefined) return stamped === h ? null : rel + " -- changed after review";
    /* THE PATH IS NOT IN THE STAMP AT ALL.
     *
     * Coverage used to be decided against a POOLED SET of every stamped hash
     * VALUE, with the rel keys thrown away -- so any risky path whose bytes
     * happened to equal ANY reviewed file's bytes read as reviewed. A brand-new
     * .github/workflows/deploy.yml byte-identical to a reviewed check script was
     * green, never having been read by anyone.
     *
     * Rename tolerance survives, narrowed to the renames git actually reports for
     * THIS ship: a path is covered by proxy only when it is the destination of a
     * rename whose SOURCE was stamped at exactly this hash. Same notion of "a
     * rename" that deletedRiskyFiles() uses, so the two halves cannot disagree. */
    const src = renameSourceOf(rel);
    if (src !== undefined && stampedHashOf(src) === h) return null;
    return rel + " -- was never reviewed (the stamp holds no entry for this path)";
  };

  /** Why is this deletion not covered? Path identity: a deletion has no bytes. */
  const whyDeletion = (rel) => {
    if (!stamp) return rel + " (DELETED) -- " + stampAbsentLabel;
    if (!fresh) return rel + " (DELETED) -- review stamp is " + ageLabel(stamp, now) + " (> 24h) -- re-review";
    if (!stampedDeletions.has(toPosix(rel))) {
      return rel + " (DELETED) -- the review stamp records no such deletion";
    }
    return null;
  };

  const hardReasons = [
    ...hard.map(whyFile),
    ...delHard.map(whyDeletion),
  ].filter(Boolean);
  const softReasons = [
    ...soft.map(whyFile),
    ...delSoft.map(whyDeletion),
  ].filter(Boolean);

  const totalScope = hard.length + soft.length + delHard.length + delSoft.length;
  const reasons = [...hardReasons];
  const warnings = [];
  const notes = [];
  if (strictSoft) reasons.push(...softReasons);
  else warnings.push(...softReasons);
  reasons.push(...findingReasons);

  /* EVERY entry in `warnings` is one uncovered file, and the green line below
   * counts on it: `covered = totalScope - fileWarnings`. Anything else appended
   * to that array silently under-reports coverage (a lone uncovered soft file
   * plus one note printed "-1 of 1 risky file(s) covered"), so diagnostics go
   * to `notes` instead and this count is taken before they could. */
  const fileWarnings = warnings.length;

  /* ONCE, at the end -- not per file. Every uncovered path on a mis-provenanced
   * ship carries the same explanation, and this list is what the operator reads
   * at the push: repeating one sentence across nine paths buries the nine paths
   * it was meant to explain. It also reaches the reasons the per-file variant
   * missed -- "changed after review" and both deletion reasons. Appended only
   * when something is ALREADY red (or already warned), so a diagnostic can
   * never be the thing that stops a ship. */
  /* Both notes funnel through one emitter so the "once, at the end" rule and the
   * "never counted as a file" rule are stated in a single place. */
  for (const note of [provenanceNote, mintNote].filter(Boolean)) {
    /* Asymmetric on purpose. On the RED path the note rides in `reasons`,
     * because that is the block an operator reads when a push is refused and a
     * separate section under it is the one thing they scroll past. On the green
     * path there is no such list to join, and `warnings` is off limits (it is
     * counted), so the note stands alone. */
    if (reasons.length) reasons.push("note: " + note);
    else if (fileWarnings) notes.push(note);
  }

  if (reasons.length) {
    return {
      code: 1,
      status: "policy",
      reasons,
      warnings,
      notes,
      scope,
      deleted,
      strictSoft,
    };
  }

  const covered = totalScope - fileWarnings;
  return {
    code: 0,
    status: "green",
    reasons: [
      totalScope === 0
        ? "no risky files in ship scope"
        : covered + " of " + totalScope + " risky file(s) covered by a fresh review stamp",
    ],
    warnings,
    notes,
    scope,
    deleted,
    strictSoft,
  };
}

/** Split a flat list of risky paths into {hard, soft}. */
function byTier(rels) {
  const out = { hard: [], soft: [] };
  for (const rel of rels) {
    const tier = riskTier(rel);
    // riskTier can only be null here if the caller passed a non-risky path;
    // bucket it as hard rather than dropping it, so a predicate change upstream
    // can never make a file silently ungated.
    out[tier === "soft" ? "soft" : "hard"].push(rel);
  }
  return out;
}

/** Run the gate. Returns the verdict; never process.exit(). */
export function run({ now = Date.now(), strictSoft = strictSoftFromEnv() } = {}) {
  let scope;
  let deleted;
  let renames = [];
  let baseRef = null;
  let narrowBase = null;
  try {
    // ONE base ref for all three halves: tieredScope(), deletedRiskyFiles() and
    // renamePairs() each default to resolveBaseRef(), and a ref that moved between
    // the calls would scope them against different ships.
    //
    // resolveShipBase(), NOT resolveBaseRef(). The narrow base is the branch's own
    // upstream, which collapses to an EMPTY scope the moment the branch is pushed
    // -- and this gate then answered "no risky files in ship scope", exit 0, having
    // inspected nothing. resolveShipBase() falls back to the trunk exactly when the
    // narrow base carries no risky content, so the scope can no longer empty
    // BECAUSE A BRANCH GOT PUSHED. narrowBase is kept only to tell the operator
    // when that widening fired. See review-scope.mjs resolveShipBase().
    narrowBase = resolveBaseRef();
    baseRef = resolveShipBase();
    scope = tieredScope(baseRef);
    deleted = byTier(deletedRiskyFiles(baseRef));
    renames = renamePairs(baseRef);
  } catch (err) {
    return {
      code: 2,
      status: "infra",
      reasons: ["git scope failed: " + (err.message || err)],
      warnings: [],
      notes: [],
      scope: { hard: [], soft: [] },
      deleted: { hard: [], soft: [] },
      strictSoft,
    };
  }

  const { status, stamp } = loadStamp();
  // Only a genuine fs read error is infra. Missing OR corrupt => "no valid stamp"
  // (policy), so a truncated stamp can never be weaker than an absent one.
  if (status === "io") {
    return {
      code: 2,
      status: "infra",
      reasons: ["review stamp unreadable (fs error)"],
      warnings: [],
      notes: [],
      scope,
      deleted,
      strictSoft,
    };
  }

  const currentHashes = {};
  for (const rel of [...scope.hard, ...scope.soft]) {
    currentHashes[rel] = hashFile(path.join(REPO_ROOT, rel));
  }

  const verdict = decide({
    scope,
    deleted,
    currentHashes,
    stamp: status === "ok" ? stamp : null,
    now,
    strictSoft,
    renames,
    /* FRESH stamps only. A stale stamp covers NOTHING -- every path is red for
     * age alone -- so the branch note's "files it already stamped stay covered
     * by content hash" would be false exactly when it is read, telling the
     * operator to re-review only what is new when the whole ship needs it. */
    provenanceNote:
      status === "ok" && stampIsFresh(stamp, now) ? provenanceMismatch(stamp) : null,
    /* ONLY when there is no usable stamp. With one in hand the mint plainly
     * works, and repeating its history would be noise on a ship whose real
     * problem is elsewhere. */
    mintNote: status === "ok" ? null : describeMintHistory(readMintLog()),
    /* PRINT THE PATH -- this is the line that names the 2026-08-04 failure.
     * The receipt file follows the MODULE (STAMP_PATH derives from REPO_ROOT,
     * which derives from review-scope.mjs's own location), so a /code-review
     * that loaded another worktree's copy wrote a perfectly valid stamp -- over
     * there. HERE that presents as no stamp at all, and a bare "no valid review
     * stamp found" reads as "nobody reviewed this" when somebody did. The
     * absolute path is what tells those two apart, and it costs nothing exactly
     * when the stamp is absent. The provenance FIELDS cannot help on this
     * branch: there is no stamp to read them from. */
    stampAbsentLabel:
      status === "corrupt"
        ? "the review stamp at " +
          STAMP_PATH +
          " is present but CORRUPT (treated as missing) -- delete it and re-review"
        : "no valid review stamp found at " +
          STAMP_PATH +
          " -- run /code-review from THIS working tree",
  });

  /* The base is part of the VERDICT, not a debug aside: "0 risky file(s)" means
   * two completely different things depending on what it was measured against,
   * and the whole empty-scope bypass lived in that ambiguity. `widened` is true
   * when the branch's own upstream contributed nothing risky and the trunk was
   * used instead -- the case that used to print a vacuous green. */
  return { ...verdict, baseRef, widened: baseRef !== narrowBase };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  // A one-shot CLI process that does not mutate the tree between queries -- the
  // only situation where memoising the scope is safe. Library callers (tests,
  // pre-ship, anything importing this module) stay uncached and always correct.
  enableScopeCache();
  const asJson = process.argv.includes("--json");
  const verdict = run();
  if (asJson) {
    process.stdout.write(JSON.stringify(verdict));
  } else {
    const tag =
      verdict.status === "green"
        ? "GREEN (exit 0)"
        : verdict.status === "policy"
        ? "RED policy (exit 1)"
        : "RED infra (exit 2)";
    console.log("ship-gate: " + tag + (verdict.strictSoft ? "  [soft tier: STRICT]" : "  [soft tier: advisory]"));
    /* NAME THE BASE, ALWAYS. Every count this gate prints is relative to it, and
     * "0 risky file(s)" measured against an already-pushed branch used to mean
     * "nothing was checked" while reading as "nothing needs checking". */
    if (verdict.baseRef) {
      console.log(
        "  scope base: " +
          verdict.baseRef +
          (process.env.REVIEW_SCOPE_BASE
            ? "  (named by REVIEW_SCOPE_BASE in the environment -- taken as final." +
              " If you did not mean to set it, unset it and re-run)"
            : verdict.widened
            ? "  (WIDENED to the trunk -- the branch's own upstream carried no risky" +
              " content, which is the shape that used to print a vacuous green)"
            : "")
      );
    }
    for (const r of verdict.reasons) console.log("  - " + r);
    for (const w of verdict.warnings) console.log("  ! unreviewed app code (advisory): " + w);
    // Neutral label: a note EXPLAINS the lines above it. Printed under the
    // warnings banner it would announce a diagnostic as an unreviewed file.
    for (const n of verdict.notes || []) console.log("  note: " + n);
    if (verdict.code === 1) {
      console.log("");
      console.log("  Fix: type /code-review, fold every blocking finding into an edit, and let the");
      console.log("  ReportFindings hook mint the receipt. If no receipt appears (the mint is not");
      console.log("  yet observed on this repo), hand-stamp at a real terminal:");
      console.log("      node scripts/hooks/review-stamp.mjs --manual");
      console.log("  Bypass of last resort: git push --no-verify (it disables the guard tier too).");
    }
  }
  process.exitCode = verdict.code;
}
