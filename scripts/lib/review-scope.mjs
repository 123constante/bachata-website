/**
 * review-scope.mjs -- the ONE owner of the predicates the Website review-receipt
 * apparatus shares:
 *
 *   1. "which files are risky, and how risky"   (riskTier / riskyFilesInScope)
 *   2. "the content identity of a risky file"   (hashContent / hashFile)
 *   3. "is this ship carrying files it never declared" (scopeDrift)
 *
 * Ported from the admin repo's scripts/lib/review-scope.mjs with two Website
 * changes: a TWO-TIER risk predicate (this repo has no migrations, but it does
 * auto-deploy prod from main), and the scope-drift half, which admin does not
 * have.
 *
 * IDENTITY IS CONTENT HASH, NOT COMMIT SHA. review -> fix -> commit -> push all
 * preserve bytes, so the gate answers identically pre-commit and post-commit; a
 * byte-identical rename never forces re-review; and a brand-new untracked file
 * cannot slip through (the working tree is scanned via "git status --porcelain",
 * including the untracked marker).
 *
 * CRLF NORMALISATION is load-bearing: this repo is edited on a Windows mount
 * where files land with CRLF, but git may store LF and safe-write.py writes LF.
 * Hashing raw bytes would make identical logical content hash differently
 * depending on which tool touched it last.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The parser this file uses, imported rather than re-derived: it used to
// hand-roll its own readFileSync + JSON.parse and, in doing so, was the only
// reader that never looked at phase / closed_at -- see resolveDeclaredScope
// below for what that cost. NOT the only parser in the repo, and the claim that
// it was got as far as this comment before review caught it:
// check-plan-hygiene.mjs:736 still hand-rolls a fourth, inside a bare try/catch
// that returns null on any failure -- so a corrupt arc-state.json makes its
// cross-check silently SKIP, which is the same corrupt-presenting-as-absent
// downgrade this file goes out of its way to prevent. Routing that reader
// through here too is queued as its own change, not smuggled into this one.
import { loadArcState, staleness, clip } from "./arc-state.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

/* -- risk tiers ------------------------------------------------------------
 * HARD: the guard / CI / hook surface. If one of these is wrong, NOTHING
 * downstream catches it -- the broken thing IS the net. An unreviewed hard-tier
 * file is a hard block at the push gate (Phase 2).
 *
 * HARD IS BY DIRECTORY, NOT BY FILENAME. The first cut of this list was a
 * hand-maintained per-file allowlist and it had ALREADY drifted before it
 * shipped: scripts/safe-write.py (CLAUDE.md calls it "the ONE write path"),
 * scripts/safe-edit.py, scripts/lint-runtime-architecture.mjs (a link in the
 * lint chain) and .claude/arc-state.json (whose scope array can silence the
 * drift gate outright) were all null-tier. An allowlist that must be updated
 * whenever a guard is added is a guard that fails open by default, and
 * /^scripts.check-[^/]+$/ additionally excluded anything nested, so a
 * scripts/checks/ reorg would have dropped the whole check suite out of the
 * tier. Directories cannot drift.
 *
 * SOFT: app code. Merging it deploys prod, so it is genuinely risky, but CI,
 * the e2e suite and PR review all still sit underneath it. Unreviewed soft-tier
 * files warn rather than block (posture is the gate's call, not this library's
 * -- this file only says which tier a path is in). */
export const HARD_PATTERNS = [
  /^scripts\//,
  /^bin\//,
  /^\.githooks\//,
  /^\.github\//,
  /^\.claude\//,
];

/** Never tiered, however they match above.
 *
 *  Gating the review receipt on itself is circular -- minting a stamp changes the
 *  stamp, which would demand a new stamp. The session lock is machine-local
 *  coordination state, not a guard. Both are gitignored.
 *
 *  arc-state.json is exempted here rather than gitignored, and the difference
 *  matters. It is hard-tier by path and rewritten at every phase start, so while
 *  tiered it sat in EVERY ship's risky scope and demanded a review of itself
 *  before any push. Ignoring it would fix that by making it invisible -- and it
 *  is the file that CARRIES the declared-scope array, so an untracked copy means
 *  (a) an edit widening `scope` (which can disarm pre-ship's fatal drift check
 *  outright) never appears in a diff or needs a receipt, and (b)
 *  resolveDeclaredScope() returns "none" on CI and in every fresh clone, silently
 *  downgrading the precise DECLARED mode to the advisory INFERRED heuristic
 *  exactly where nobody is watching. TIER_EXEMPT exempts without hiding: the file
 *  stays tracked and reviewable, it just stops gating itself. */
export const TIER_EXEMPT = [
  /^\.claude\/\.review-stamp\.json$/,
  /^\.claude\/\.session-lock\.json$/,
  /^\.claude\/arc-state\.json$/,
];

// The api/ tree is the embed/ICS feed surface; server/ does not exist in this
// repo today but is matched so adding it later cannot silently fall out of scope.
export const SOFT_PATTERNS = [/^src\//, /^api\//, /^server\//];

/** POSIX-normalise a path as git or a caller may hand it to us. */
export function toPosix(rel) {
  return String(rel).replace(/\\/g, "/").replace(/^\.\//, "");
}

/** "hard" | "soft" | null for a repo-relative path. Hard wins on overlap. */
export function riskTier(rel) {
  const p = toPosix(rel);
  if (!p) return null;
  if (TIER_EXEMPT.some((re) => re.test(p))) return null;
  if (HARD_PATTERNS.some((re) => re.test(p))) return "hard";
  if (SOFT_PATTERNS.some((re) => re.test(p))) return "soft";
  return null;
}

/** A repo-relative path is "risky" if a review must cover it before ship. */
export function isRiskyPath(rel) {
  return riskTier(rel) !== null;
}

/** CRLF-normalised, trailing-whitespace-stripped sha256 of a string.
 *
 * ONE TRAILING NEWLINE is stripped because a reviewed FILE ends with a final
 * newline (git / safe-write.py convention) while the same body handed to a
 * review tool as a string routinely arrives without it. That difference belongs
 * to the same "identical content, different tool touched it last" class this
 * hash exists to neutralise.
 *
 * EXACTLY ONE, not an unbounded run. The first cut used a trailing-whitespace
 * strip, which made "foo();", "foo();   " and "foo();" plus four blank lines all
 * hash identically -- so a reviewed file could be appended to and then blanked,
 * or acquire the trailing whitespace the eslint ratchet flags, and still read as
 * covered. The stated rationale needs one newline; anything more is coverage the
 * review never gave. */
export function hashContent(buf) {
  const text = Buffer.isBuffer(buf) ? buf.toString("utf8") : String(buf);
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n$/, "");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/** CRLF-normalised sha256 of a file on disk, or null if it cannot be read. */
export function hashFile(absPath) {
  try {
    return hashContent(fs.readFileSync(absPath));
  } catch {
    return null;
  }
}

function git(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Decode a path as git may print it. With core.quotepath=false most paths are
 * raw already, but git still wraps a name containing a quote/backslash/control
 * char in double quotes with C-style escapes (octal bytes, tab, escaped quote).
 * Strip the quotes and decode the escapes back to real bytes so fs.existsSync
 * resolves the file. An unquoted path is returned verbatim.
 */
export function unquoteGitPath(p) {
  if (!(p.startsWith('"') && p.endsWith('"'))) return p;
  const body = p.slice(1, -1);
  const bytes = [];
  const simple = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, "\\": 92 };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== "\\") { for (const b of Buffer.from(c, "utf8")) bytes.push(b); continue; }
    const n = body[i + 1];
    if (n >= "0" && n <= "7") {
      let oct = n; i++;
      for (let k = 0; k < 2 && body[i + 1] >= "0" && body[i + 1] <= "7"; k++) { oct += body[++i]; }
      bytes.push(parseInt(oct, 8) & 0xff);
    } else if (n in simple) { bytes.push(simple[n]); i++; }
    else { for (const b of Buffer.from(c, "utf8")) bytes.push(b); }
  }
  return Buffer.from(bytes).toString("utf8");
}

/**
 * The push target to diff "the ship" against: the branch's OWN upstream
 * (origin/<branch>) -- what is already pushed -- NOT a literal origin/main. On a
 * long-lived branch, origin/main can be dozens of already-reviewed commits
 * behind; diffing against it would re-scope every one of them on every ship.
 * Falls back to origin/main when the branch has no upstream yet (never pushed).
 * Override with REVIEW_SCOPE_BASE for tests.
 */
export function resolveBaseRef() {
  if (process.env.REVIEW_SCOPE_BASE) return process.env.REVIEW_SCOPE_BASE;
  try {
    const up = execFileSync("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (up) return up;
  } catch {
    /* no upstream -- fall through */
  }
  return TRUNK_BASE;
}

/**
 * The widest honest base: the trunk this branch will merge into.
 *
 * Declared AFTER resolveBaseRef(), which returns it. Safe, because a `const` sits
 * in the temporal dead zone only until module evaluation reaches this line and
 * every caller runs later -- but it carries one constraint worth stating: nothing
 * in this module may call resolveBaseRef() at MODULE SCOPE. A single such call
 * added later would be a ReferenceError at import time, which on this path means
 * the push gate fails to load rather than fails closed.
 */
export const TRUNK_BASE = "origin/main";

/**
 * PURE POLICY half of resolveShipBase(), split out so BOTH directions can be
 * pinned by a unit test without standing up a temp repo and a fake remote.
 *
 * @param {string} narrowBase   what resolveBaseRef() returned
 * @param {number} narrowRisky  risky files + risky deletions that base scopes in
 * @param {string} trunk        the fallback base
 */
export function pickShipBase(narrowBase, narrowRisky, trunk = TRUNK_BASE) {
  if (narrowBase === trunk) return trunk;
  return narrowRisky > 0 ? narrowBase : trunk;
}

/**
 * THE BASE THE PUSH GATE MUST SCOPE AGAINST -- resolveBaseRef() widened so it
 * CANNOT COLLAPSE TO NOTHING merely because the branch has been pushed.
 *
 * THE HOLE THIS CLOSES (found during the supabase-defer P5 push, 2026-08-07).
 * resolveBaseRef() answers "what is already pushed", which is the right question
 * for stopping a long-lived branch re-scoping commits reviewed days ago. But
 * ALREADY PUSHED IS NOT ALREADY REVIEWED, and the gate read the one as the other.
 * Once origin/<branch> exists and equals HEAD, shipFiles() diffs a ref against
 * itself, tieredScope() comes back empty, and ship-gate takes its totalScope === 0
 * arm -- printing "no risky files in ship scope" and exiting 0 while the branch
 * carries risky files no reviewer ever saw. GREEN, having inspected nothing. Same
 * false-green class as #201: a guard answering a question it can no longer see the
 * inputs to. Observed for real -- P5's push was refused, and a retry passed
 * because the scope had EMPTIED, not because anything had been reviewed.
 *
 * THE ASYMMETRY THAT MADE IT OBVIOUS ONCE SEEN: review-stamp.mjs --manual ALREADY
 * refuses this exact condition ("the risky ship scope is EMPTY -- refusing to
 * stamp"), for this exact reason. The MINTING half failed closed and the ENFORCING
 * half failed open, on the same predicate, inside the same apparatus.
 *
 * THE RULE: an empty risky scope is only believable when it is empty against the
 * TRUNK. So when the narrow base contributes no risky content, fall back to
 * origin/main and ask the wider question -- "does this branch carry unreviewed
 * risky work at all?" -- instead of the vacuous one.
 *
 * A GENUINELY REVIEWED BRANCH STAYS GREEN. The stamp keys on CONTENT HASH, not on
 * a base or a commit sha, so the same bytes stay covered under the wider base. The
 * new red is reserved for branches whose risky content nothing ever attested --
 * and for stamps that have gone stale, which is the honest answer rather than a
 * vacuous green.
 *
 * WHY THE OPTIMISATION SURVIVES. The widening fires ONLY when the incremental ship
 * has no risky content of its own. The "dozens of already-reviewed commits" case
 * resolveBaseRef() exists for is untouched: that ship HAS risky files, keeps the
 * narrow base, and is scoped incrementally exactly as before.
 *
 * REVIEW_SCOPE_BASE still wins outright -- an operator naming the base is stating
 * what the review actually covered, which beats anything inferred here.
 */
export function resolveShipBase() {
  /* AN OPERATOR-NAMED BASE IS FINAL, and deliberately NOT widened.
   * review-stamp.mjs's empty-scope refusal tells the operator to name the base the
   * review actually covered; a gate that then overrode that name would make its
   * own printed remedy unreliable. The cost is that a REVIEW_SCOPE_BASE left
   * exported in a shell keeps applying silently -- which is why ship-gate prints
   * where the base came from rather than just what it was. */
  if (process.env.REVIEW_SCOPE_BASE) return process.env.REVIEW_SCOPE_BASE;
  const narrowBase = resolveBaseRef();
  if (narrowBase === TRUNK_BASE) return TRUNK_BASE;
  const narrowRisky =
    riskyFilesInScope(narrowBase).length + deletedRiskyFiles(narrowBase).length;
  return pickShipBase(narrowBase, narrowRisky);
}

/**
 * EVERY repo-relative path in this ship: tracked files differing from the push
 * target, plus everything dirty or untracked in the working tree. Deletions ARE
 * included (they are part of the ship even though they carry no content).
 *
 * Throws on any git failure -- callers translate that into an INFRA result
 * rather than silently reading "git broke" as "nothing in scope".
 *
 * The core.quotepath=false override makes git emit non-ASCII path bytes RAW
 * instead of C-quoting them. Without it an accented filename arrived quoted and
 * octal-escaped, the un-unescaped string did not exist on disk, the file was
 * filtered out of scope, and the gate reported GREEN on unreviewed content -- a
 * fail-OPEN inside the gate's own scope predicate.
 */
/**
 * The commit to actually diff against: the MERGE BASE of the push target and
 * HEAD, not the push target itself.
 *
 * A plain two-dot `git diff <base>` is symmetric, so when the branch is BEHIND
 * its target every file the target moved shows up in reverse as part of "this
 * ship". Those files then demand review receipts they can never have, get
 * linted by the ratchet, fire the smoke gate, and trip scope-drift as foreign.
 * This repo has already paid for it once: PR #149's recorded failure was "a
 * stale base, 12 commits behind main".
 *
 * Falls back to the raw ref if there is no merge base (unrelated histories) --
 * a wider scope is the safe direction.
 */
export function diffOrigin(baseRef) {
  try {
    const mb = git(["merge-base", baseRef, "HEAD"]).trim();
    if (mb) return mb;
  } catch {
    /* no merge base -- fall through to the raw ref */
  }
  return baseRef;
}

/* MEMOISATION, OPT-IN AND OFF BY DEFAULT.
 *
 * Every scope query (riskyFilesInScope, deletedRiskyFiles, tieredScope,
 * hashRiskyScope) calls shipFiles(), and each call shells out to git TWICE. One
 * ship-gate run costs 4 git invocations and a review-stamp --manual costs 8 --
 * and `git status --untracked-files=all` stats the whole tree, on a FUSE/NTFS
 * mount, on the push path.
 *
 * But caching by default was WRONG, and it was caught immediately: a Phase 1 test
 * writes a file and then asks shipFiles() what is in the ship, and a cache
 * populated earlier in the same process answered from before the write. Trading a
 * correctness property (the scope is what the tree says NOW) for a latency win is
 * the wrong way round for a guard, so the cache is opt-in: only a one-shot CLI
 * entry point, which by construction does not mutate the tree between queries,
 * turns it on. Every library caller -- tests, pre-ship, anything importing this
 * module -- keeps the uncached, always-correct behaviour. */
let SCOPE_CACHE_ENABLED = false;
const SHIP_FILES_CACHE = new Map();
const RENAME_CACHE = new Map();
/** Call once from a short-lived CLI entry point that will not mutate the tree. */
export function enableScopeCache() {
  SCOPE_CACHE_ENABLED = true;
}
export function clearScopeCache() {
  SHIP_FILES_CACHE.clear();
  RENAME_CACHE.clear();
}

export function shipFiles(baseRef = resolveBaseRef()) {
  if (SCOPE_CACHE_ENABLED) {
    const cached = SHIP_FILES_CACHE.get(baseRef);
    if (cached) return cached;
  }
  const out = new Set();
  for (const f of git(["-c", "core.quotepath=false", "diff", "--name-only", diffOrigin(baseRef)]).split("\n")) {
    const rel = unquoteGitPath(f.trim());
    if (rel) out.add(toPosix(rel));
  }
  // --untracked-files=all is load-bearing. The default (`normal`) COLLAPSES a
  // wholly-untracked directory into a single "?? src/newfeature/" entry, so
  // every file inside a brand-new directory was invisible: the eslint ratchet
  // saw one unlintable path and printed SKIP, and hashFile() on a directory
  // throws EISDIR so nothing in it was ever hashed or review-gated. That
  // falsified this file's own header claim that a brand-new untracked file
  // cannot slip through.
  for (const line of git(["-c", "core.quotepath=false", "status", "--porcelain", "--untracked-files=all"]).split("\n")) {
    if (!line.trim()) continue;
    let p = line.slice(3).trim();
    const arrow = p.indexOf(" -> ");
    if (arrow !== -1) p = p.slice(arrow + 4); // rename/copy: take the destination
    p = unquoteGitPath(p);
    if (p) out.add(toPosix(p));
  }
  const files = [...out].sort();
  if (SCOPE_CACHE_ENABLED) SHIP_FILES_CACHE.set(baseRef, files);
  return files;
}

/* RENAME PAIRS -- the hole that made the deletion contract bypassable.
 *
 * git reports a rename as its DESTINATION only: `git mv scripts/guard.mjs
 * archive/guard.mjs` yields exactly one path from `diff --name-only`, and the
 * porcelain form ("R  old -> new") is parsed above for its destination too. So
 * moving a guard OUT of the guard tree left no trace anywhere: the source was in
 * no list, the destination was not risky, riskyFilesInScope() and
 * deletedRiskyFiles() both saw nothing, and the gate answered "no risky files in
 * ship scope". A CI check script could be removed on a green push with no
 * attestation -- the precise failure the deletion contract exists to stop.
 *
 * --name-status carries the status letter and, for R/C, BOTH paths.
 * @returns {{from:string, to:string}[]}
 */
export function renamePairs(baseRef = resolveBaseRef()) {
  if (SCOPE_CACHE_ENABLED) {
    const cached = RENAME_CACHE.get(baseRef);
    if (cached) return cached;
  }
  const pairs = [];
  const add = (from, to) => {
    const f = toPosix(unquoteGitPath(from));
    const t = toPosix(unquoteGitPath(to));
    if (f && t && !pairs.some((p) => p.from === f && p.to === t)) pairs.push({ from: f, to: t });
  };
  for (const line of git(["-c", "core.quotepath=false", "diff", "--name-status", diffOrigin(baseRef)]).split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    // "R100\told\tnew" / "C75\told\tnew"; everything else has a single path.
    if (parts.length >= 3 && /^[RC]/.test(parts[0].trim())) add(parts[1].trim(), parts[2].trim());
  }
  for (const line of git(["-c", "core.quotepath=false", "status", "--porcelain", "--untracked-files=all"]).split("\n")) {
    if (!line.trim()) continue;
    const code = line.slice(0, 2);
    const rest = line.slice(3);
    const arrow = rest.indexOf(" -> ");
    if (arrow !== -1 && /[RC]/.test(code)) add(rest.slice(0, arrow).trim(), rest.slice(arrow + 4).trim());
  }
  if (SCOPE_CACHE_ENABLED) RENAME_CACHE.set(baseRef, pairs);
  return pairs;
}

/**
 * Risky files in this ship that STILL EXIST on disk (a file staged for deletion
 * carries no content to review). Sorted, unique, repo-relative POSIX.
 */
export function riskyFilesInScope(baseRef = resolveBaseRef()) {
  return shipFiles(baseRef)
    .filter(isRiskyPath)
    .filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));
}

/**
 * Risky files this ship DELETES. riskyFilesInScope deliberately drops anything
 * not on disk (a deletion carries no content to hash), which left the single
 * highest-risk guard edit there is -- removing a CI workflow, a check script or
 * a git hook -- passing unreviewed by construction. Deletions are tracked here
 * rather than faked into the hash map, so the content-hash contract stays a
 * content-hash contract; Phase 2's ship-gate is what blocks on them.
 */
export function deletedRiskyFiles(baseRef = resolveBaseRef()) {
  const out = new Set(
    shipFiles(baseRef)
      .filter(isRiskyPath)
      .filter((rel) => !fs.existsSync(path.join(REPO_ROOT, rel)))
  );
  /* A RENAME OUT OF THE RISKY TREE IS A REMOVAL. See renamePairs() for the hole:
   * git names only the destination, so `git mv scripts/check-x.mjs archive/x.mjs`
   * put a non-risky path in scope and nothing else, and the guard left the repo
   * unattested.
   *
   * A rename that STAYS risky is deliberately NOT listed. Its destination is in
   * riskyFilesInScope() and gated by content hash, so the reviewed bytes are still
   * gated -- and listing it would force a fresh mint for every in-tree file move,
   * which is the "byte-identical rename must not force re-review" property the
   * whole content-hash identity exists to provide. The gate's rename tolerance is
   * narrowed to exactly these pairs (see ship-gate's whyFile), so the two halves
   * agree on what a rename is. */
  for (const { from, to } of renamePairs(baseRef)) {
    if (isRiskyPath(from) && !isRiskyPath(to)) out.add(from);
  }
  return [...out].sort();
}

/** Risky files split by tier: { hard: [...], soft: [...] }. */
export function tieredScope(baseRef = resolveBaseRef()) {
  const out = { hard: [], soft: [] };
  for (const rel of riskyFilesInScope(baseRef)) out[riskTier(rel)].push(rel);
  return out;
}

/** A map of rel -> CRLF-normalised hash for every risky file in scope. */
export function hashRiskyScope(baseRef = resolveBaseRef()) {
  const out = {};
  for (const rel of riskyFilesInScope(baseRef)) {
    out[rel] = hashFile(path.join(REPO_ROOT, rel));
  }
  return out;
}

/* == scope drift ============================================================
 * WHY THIS EXISTS. Uncommitted work follows the WORKTREE, not the branch it was
 * authored on. On 2026-07-30 that trap fired twice in one day: the whole of arc
 * phase 0.5 (scripts/safe-edit.py plus a CLAUDE.md section) sat loose in a
 * shared worktree and rode out on PR #161, a festival-times fix; and a
 * dehydrateWiring test fix nearly did the same. Both were caught by eye. This
 * is the layer that makes them machine-caught.
 *
 * TWO MODES, deliberately different in strength:
 *
 *  - DECLARED (precise, fatal): the ship states what it may touch, so anything
 *    else is unambiguously foreign. Declaration is one "scope" array in
 *    .claude/arc-state.json, or REVIEW_SCOPE_DECLARED in the environment.
 *
 *  - INFERRED (heuristic, advisory): with nothing declared, flag a ship that
 *    spans more than one PRIMARY surface -- app code and the guard/CI surface
 *    in the same commit. That is exactly the PR #161 shape. It deliberately
 *    does NOT fire on docs / tests / dependency manifests, which legitimately
 *    travel with any change; catching THOSE requires a declaration. Advisory
 *    because a heuristic that reds a legitimate ship trains people to ignore
 *    it. */

export const SURFACES = [
  ["guard", [/^scripts\//, /^bin\//, /^\.githooks\//, /^\.github\//, /^\.claude\//]],
  ["test", [/^tests\//, /^playwright\.config/, /^vitest\.config/]],
  ["app", [/^src\//, /^api\//, /^server\//, /^public\//, /^index\.html$/, /^vite\.config/, /^react-router\.config/]],
  ["deps", [/^package(-lock)?\.json$/]],
  ["docs", [/\.md$/]],
];

/** Surfaces whose mixing is the drift signal. Order is the tie-break order. */
export const PRIMARY_ORDER = ["app", "guard"];
export const PRIMARY_SURFACES = new Set(PRIMARY_ORDER);

/** Which surface a path belongs to; "other" when nothing claims it. The tests
 *  tree is matched before src/ so a test file is never counted as app. */
export function classifySurface(rel) {
  const p = toPosix(rel);
  for (const [id, pats] of SURFACES) {
    if (pats.some((re) => re.test(p))) return id;
  }
  return "other";
}

const GLOB_META = ".+^${}()|[]\\";

/** Minimal glob to RegExp. A doubled star spans separators; a single star and
 *  "?" do not. */
export function globToRegExp(glob) {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*";
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += GLOB_META.includes(c) ? "\\" + c : c;
    }
  }
  return new RegExp(re + "$");
}

/**
 * Does rel fall inside one declared entry? An entry is any of:
 *   - a surface id            "app", "guard", "test", "deps", "docs", "other"
 *   - a directory prefix      "src/pages/"   (also matches the bare dir itself)
 *   - a glob                  "src/**./*.tsx" (without the dot)
 *   - an exact path or dir    "package.json", "src/pages"
 */
export function matchesDeclared(rel, entry) {
  const p = toPosix(rel);
  const e = toPosix(entry).trim();
  if (!e) return false;
  if (e === "other" || SURFACES.some(([id]) => id === e)) return classifySurface(p) === e;
  if (e.endsWith("/")) return p === e.slice(0, -1) || p.startsWith(e);
  if (/[*?]/.test(e)) return globToRegExp(e).test(p);
  return p === e || p.startsWith(e + "/");
}

/**
 * The declared scope. Returns { status, scope } rather than a bare array so a
 * MALFORMED declaration is distinguishable from an absent one.
 *
 * Without that split, a trailing comma or a truncated write in arc-state.json
 * threw, the catch returned null, and the gate silently dropped from the
 * precise fatal DECLARED mode to the advisory INFERRED heuristic -- printing a
 * line indistinguishable from a ship that genuinely declared nothing. That is
 * exactly the hazard loadStamp() goes out of its way to preserve below, where a
 * corrupt stamp is deliberately NOT reported as missing so it cannot downgrade
 * a hard block to a warning. The two readers of .claude JSON now agree.
 *
 * A CLOSED ARC DECLARES NOTHING. The promise is bounded by the work that made
 * it: once the arc records phase "done" or a closed_at, its scope array is a
 * record of what that arc touched, not a rule about what the NEXT ship may
 * touch. This reader used to ignore both fields, and the cost was measured
 * rather than theoretical -- edge-config-governance closed on 2026-08-24
 * leaving a 10-path scope in force, so every non-arc ship for the days after
 * it (#298, #299, #302, #303) was fatally scope-drifted by a promise nobody
 * had made. loadArcState() already carried the predicate, and both other
 * readers already honoured it: arc-checkpoint.mjs no-ops on a closed arc, and
 * check-plan-hygiene.mjs's lintArcState skips its cross-check. This file was
 * the one reader out of step, which is why it now shares their parser instead
 * of hand-rolling a fourth opinion about the same eight bytes of JSON.
 *
 * Two verdicts moved when this stopped re-deriving the parse, both toward
 * loadArcState's contract and both deliberate: a UTF-8 BOM (what PowerShell's
 * Out-File emits) is stripped rather than read as corruption, and a parseable
 * non-object -- "[]", "null", a bare number -- is now corrupt rather than
 * "declared nothing", because a file that is not an object cannot be said to
 * have omitted a scope array.
 *
 * `note` is the human-readable WHY, "" when there is nothing worth saying (no
 * file, or an open arc that simply never declared a scope). Every path that
 * drops or refuses a declaration fills it in, and pre-ship prints it under the
 * scope-drift row -- see the closed branch below for why silence there is the
 * same class of defect as the one this function fixes.
 *
 * @param {object} state a loadArcState() verdict
 * @returns {{status:'none'|'ok'|'corrupt', scope: string[]|null, note: string}}
 */
export function declarationFromArcState(state) {
  const status = state && state.status;
  const arc = (state && state.arc) || {};
  const named = clip(typeof arc.arc === "string" && arc.arc ? arc.arc : "(unnamed)", 40);

  // TWO branches decide the verdict, and the second deliberately owns BOTH
  // "corrupt" and any status this reader does not recognise. An explicit
  // `status === "corrupt"` line stood here and was removed at review: it was
  // unreachable AS A DECISION -- corrupt falls through to exactly the same
  // return -- so no mutant could kill it, while the comment above it claimed it
  // was the mechanism keeping an untrustworthy declaration from presenting as
  // an absent one. That mechanism is the fall-through, and it is stated here
  // instead of asserted by a line that cannot be tested.
  //
  // The direction is the point. A verdict this reader cannot interpret fails
  // LOUD, toward still gating -- never quietly to "none", which is the silent
  // downgrade to the advisory heuristic that the corrupt/none split exists to
  // make impossible.
  if (status === "missing") return { status: "none", scope: null, note: "" };
  if (status === "closed") {
    const how = arc.phase === "done" ? 'phase "done"' : "closed_at " + clip(String(arc.closed_at), 30);
    return {
      status: "none",
      scope: null,
      // NAMED, not silent. Dropping a declaration without saying so is the same
      // shape as the bug this whole change is about: the report would read
      // byte-identically to a repo that has no arc-state.json at all, and an
      // operator who starts a new arc while leaving a stale closed_at in place
      // would run with the fatal gate off and nothing on screen to say so.
      note: 'arc "' + named + '" is CLOSED (' + how + ") -- its scope array is a record, not a declaration",
    };
  }
  if (status !== "ok" && status !== "inactive") {
    return {
      status: "corrupt",
      scope: null,
      note:
        status === "corrupt"
          ? "unreadable, not JSON, or not an object"
          : 'loadArcState returned a status this reader does not know: "' + clip(String(status), 30) + '"',
    };
  }
  if (!Array.isArray(arc.scope)) return { status: "none", scope: null, note: "" };
  // Same standing as a parseable non-object FILE, and therefore the same
  // verdict. String() used to coerce these, so a scope of [{...}, null, 7]
  // became ["[object Object]", "null", "7"] -- three entries matching nothing,
  // which makes EVERY file in the ship foreign and hard-fails the gate against
  // nonsense. An array whose entries are not strings has not declared a scope.
  if (arc.scope.some((s) => typeof s !== "string")) {
    return { status: "corrupt", scope: null, note: "the scope array holds a non-string entry" };
  }
  const parts = arc.scope.map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return { status: "none", scope: null, note: "" };
  // An OPEN arc's age is REPORTED, never acted on. arc-state.mjs exports
  // staleness() and arc-checkpoint.mjs warns on it, but expiring a declaration
  // on a timer would silently disarm a fatal gate for any arc that legitimately
  // ran longer than the window -- fail-open, on a clock, with nothing on
  // screen. Saying "set 12 days ago (stale)" makes an ABANDONED declaration
  // visible without taking the decision away from the operator.
  const age = staleness(arc);
  return {
    status: "ok",
    scope: parts,
    note: 'declared by arc "' + named + '"' + (age.stale ? " -- STALE: " + age.reason : ""),
  };
}

export const ARC_STATE_FILE = path.join(REPO_ROOT, ".claude", "arc-state.json");

/**
 * The declaration for THIS ship, WITH its note: the environment override if one
 * is set, otherwise whatever the arc-state file says. This is what pre-ship
 * reads, because the note is the half that keeps a dropped declaration from
 * being silent.
 *
 * @param {string} [file] path to the arc-state file. Defaults to the ONE
 *   declaration this repo ships. A parameter and NOT a second env var on
 *   purpose: REVIEW_SCOPE_DECLARED is already the documented env override, and
 *   an env-settable PATH would be a way to point a fatal gate at a file that
 *   declares whatever the ship happens to need. Tests pass a temp path so they
 *   never race the live file, or the hooks that read it every turn.
 * @returns {{status:'none'|'ok'|'corrupt', scope: string[]|null, note: string}}
 */
export function resolveDeclaration(file = ARC_STATE_FILE) {
  const env = process.env.REVIEW_SCOPE_DECLARED;
  if (typeof env === "string") {
    const parts = env.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    // set but empty => an explicit "no declaration", not a corrupt one
    return parts.length
      ? { status: "ok", scope: parts, note: "declared by REVIEW_SCOPE_DECLARED (env override)" }
      : { status: "none", scope: null, note: "" };
  }
  return declarationFromArcState(loadArcState(file));
}

/**
 * The same answer without the note, which is the shape this function has always
 * returned and the one its callers destructure. Kept as the narrow contract
 * rather than widened in place: `note` is presentation, and a caller that only
 * needs to know WHETHER a scope was declared should not have to ignore a field.
 *
 * @param {string} [file] see resolveDeclaration
 * @returns {{status:'none'|'ok'|'corrupt', scope: string[]|null}}
 */
export function resolveDeclaredScope(file = ARC_STATE_FILE) {
  const { status, scope } = resolveDeclaration(file);
  return { status, scope };
}

/**
 * Does this ship carry files unrelated to what it says it is?
 *
 * @param {string[]} files repo-relative paths in the ship
 * @param {{declared?: string[]|null}} [opts]
 * @returns {{ok:boolean, mode:string, severity:string, primary:string|null,
 *            counts:object, foreign:object[], reason:string}}
 */
/**
 * Paths a DECLARED scope never has to mention. .claude/arc-state.json is the
 * file that CARRIES the declaration, and a phase start rewrites it, so it is
 * always dirty and always in the ship -- meaning every declaration had to
 * redundantly list its own home or the gate hard-failed a completely legitimate
 * ship. The first person to hit that deletes the scope array, which silently
 * reverts to advisory inferred mode: a fatal gate that is annoying to keep
 * green does not stay green, it stops being used. The receipt and the session
 * lock are the same class of machine-written local state, and so is
 * settings.local.json: the harness appends a permission grant every time one is
 * approved, so it is dirty in most sessions through no act of the ship. It is
 * owned by the harness, never by the diff, and judging it as scope drift made
 * "commit nothing from it" an unreachable instruction -- the gate reds on the
 * worktree, so declining to stage the file cannot clear it.
 *
 * IT APPLIES TO BOTH MODES, despite the name, and the name is kept only because
 * it is exported and asserted by tests. It used to be consulted on the DECLARED
 * branch alone, which was invisible while a stale closed arc kept every ship in
 * declared mode -- and became a live false positive the moment a closed arc
 * stopped declaring: the ship that CLOSES an arc rewrites arc-state.json, so
 * "app file + arc-state.json" landed in the inferred branch and printed a
 * cross-surface drift warning about the two files the operator had no choice
 * about. Same argument as the paragraph above, one branch further down.
 */
export const DECLARED_ALWAYS_EXEMPT = [
  /^\.claude\/arc-state\.json$/,
  /^\.claude\/\.review-stamp\.json$/,
  /^\.claude\/\.session-lock\.json$/,
  /^\.claude\/settings\.local\.json$/,
];

export function scopeDrift(files, { declared = null } = {}) {
  // Dropped ONCE, before anything is judged or counted, so both modes see the
  // same ship. Filtering inside the declared branch alone left the inferred
  // branch counting machine-written local state as a surface the ship had
  // chosen to touch.
  const paths = (files || [])
    .map(toPosix)
    .filter(Boolean)
    .filter((p) => !DECLARED_ALWAYS_EXEMPT.some((re) => re.test(p)));
  const counts = {};
  for (const p of paths) {
    const s = classifySurface(p);
    counts[s] = (counts[s] || 0) + 1;
  }

  if (declared && declared.length) {
    const foreign = paths
      .filter((p) => !declared.some((e) => matchesDeclared(p, e)))
      .map((p) => ({ path: p, surface: classifySurface(p) }));
    return {
      ok: foreign.length === 0,
      mode: "declared",
      severity: foreign.length ? "error" : "none",
      primary: null,
      counts,
      foreign,
      reason:
        (foreign.length
          ? foreign.length + " file(s) outside"
          : "every file falls inside") +
        " the declared scope [" + declared.join(", ") + "]",
    };
  }

  const present = PRIMARY_ORDER.filter((s) => counts[s]);
  if (present.length < 2) {
    return {
      ok: true,
      mode: "inferred",
      severity: "none",
      primary: present[0] || null,
      counts,
      foreign: [],
      reason: present.length
        ? "single primary surface (" + present[0] + ")"
        : "no primary-surface files in this ship",
    };
  }

  // Most files wins; ties break on PRIMARY_ORDER so the answer is deterministic.
  const primary = present.reduce((a, b) => (counts[b] > counts[a] ? b : a));
  const foreign = paths
    .map((p) => ({ path: p, surface: classifySurface(p) }))
    .filter((f) => PRIMARY_SURFACES.has(f.surface) && f.surface !== primary);
  return {
    ok: false,
    mode: "inferred",
    severity: "warn",
    primary,
    counts,
    foreign,
    reason:
      "this ship spans " + present.length + " primary surfaces (" +
      present.map((s) => s + ":" + counts[s]).join(", ") +
      ") -- " + primary + " looks like the intent",
  };
}

/* == review receipt (.claude/.review-stamp.json) ============================
 * STAMP_PATH, the freshness window, the resolved-outcome set, stdin reading and
 * the coverage predicate all live here so the writer (Phase 2's review-stamp
 * hook) and the reader (ship-gate) can never drift on what a stamp means. */

export const STAMP_PATH = path.join(REPO_ROOT, ".claude", ".review-stamp.json");

/** git, but a failure is "unknown" rather than fatal -- provenance is a
 * diagnostic, and must never be the reason a mint or a gate run dies. */
function gitSoft(args, cwd = REPO_ROOT) {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.trim() || null;
  } catch {
    return null;
  }
}

/** Same tree?
 *
 * BOTH sides normally default to the same module-derived REPO_ROOT constant, so
 * in the ordinary case this compares a string against itself and the folding
 * below is dead weight. It earns its keep only where the two sides can differ:
 * an injected `root` (tests, any future caller), or a stamp that arrived by
 * copy, junction or symlink. Do not read it as evidence that the mint and the
 * gate derive their roots differently -- they do not, which is exactly why
 * repo_root cannot catch the 2026-08-04 miss (see describeProvenance below).
 *
 * Case-folded on win32 because NTFS is case-insensitive while path.resolve
 * PRESERVES the drive-letter case of its argument, so `c:/x` and `C:/x` can name
 * one directory. Junction/symlink pairs are resolved too, but only when BOTH
 * sides resolve -- half-resolved compares worse than raw. Unknown compares
 * EQUAL: this predicate only ever produces an accusation, so it fails quiet.
 */
function sameRoot(a, b) {
  if (!a || !b) return true;
  const real = (s) => {
    try {
      return fs.realpathSync.native(s);
    } catch {
      return null;
    }
  };
  const norm = (s) => {
    const p = toPosix(s).replace(/[/]+$/, "");
    return process.platform === "win32" ? p.toLowerCase() : p;
  };
  const ra = real(a);
  const rb = real(b);
  return ra && rb ? norm(ra) === norm(rb) : norm(a) === norm(b);
}

/**
 * WHERE a receipt was minted -- the answer to "a stamp exists, so why is the
 * gate still red?".
 *
 * REPO_ROOT is derived from this module's own file location, so a review always
 * stamps the tree whose copy of this module it loaded, REGARDLESS of which diff
 * it read. With git worktrees that is two independent stamp files, and a review
 * pointed at the wrong tree writes a perfectly valid receipt to the wrong place.
 * The gate then reports "no valid review stamp found" -- true, but it reads as
 * "nobody reviewed this" when the truth is "somebody reviewed this, over there".
 *
 * Measured 2026-08-04: three consecutive /code-review runs failed this way on
 * one ship, and the third reported CLEAN while describing a different branch's
 * diff. The receipt was never the weak link -- content hashing held every time
 * and the gate correctly refused. What was missing is any way to TELL.
 *
 * Recording this changes nothing about what passes: coverage is still decided
 * by content hash alone. It exists so a miss can be NAMED.
 *
 * KNOW THE LIMIT, so nobody mistakes this field for the whole cure. The stamp
 * lives at REPO_ROOT/.claude/, so any stamp the gate can READ was by
 * construction written by a module rooted in that same directory: repo_root
 * compares a file's own directory against itself and, absent a copy or a
 * junction, cannot differ. The cross-tree miss does not present as a mismatched
 * root -- it presents as NO STAMP AT ALL, which is why ship-gate prints
 * STAMP_PATH on the absent branch. THAT is the line that names 2026-08-04.
 * What is genuinely comparable here is the BRANCH; the root check is kept as
 * belt-and-braces for a receipt that arrives by copy, junction or symlink.
 */
export function describeProvenance({ root = REPO_ROOT, run = gitSoft } = {}) {
  /* Swallow here as well as in gitSoft: an INJECTED run (tests, and any future
   * caller passing its own git) does not inherit gitSoft's catch, and a
   * diagnostic that throws would take the mint down with it. `root` doubles as
   * the git cwd, so the recorded tree and the recorded branch/head can never
   * describe two different directories. */
  const soft = (args) => {
    try {
      const v = run(args, root);
      return v ? String(v).trim() || null : null;
    } catch {
      return null;
    }
  };
  return {
    repo_root: toPosix(root),
    branch: soft(["rev-parse", "--abbrev-ref", "HEAD"]),
    head: soft(["rev-parse", "HEAD"]),
  };
}

/**
 * Why a stamp that exists still does not speak for THIS tree. Returns null when
 * there is nothing to explain -- either it matches, or it predates provenance
 * (an older stamp is not suspect, it is just quiet, and must not be reported as
 * a mismatch).
 */
export function provenanceMismatch(stamp, { root = REPO_ROOT, run = gitSoft } = {}) {
  const p = stamp && typeof stamp === "object" ? stamp.provenance : null;
  if (!p || typeof p !== "object") return null; // pre-provenance stamp: silent
  const here = describeProvenance({ root, run });
  if (!sameRoot(p.repo_root, here.repo_root)) {
    return (
      "the review stamp was minted in a DIFFERENT working tree (" +
      p.repo_root +
      "), not this one (" +
      here.repo_root +
      ") -- re-run /code-review from this tree"
    );
  }
  /* A detached HEAD (rebase, bisect, CI checkout) reports the literal string
   * "HEAD", which names no branch -- comparing it prints the nonsense
   * "minted on branch 'HEAD'" at an operator who never left their branch. */
  const named = (b) => !!b && b !== "HEAD";
  if (named(p.branch) && named(here.branch) && p.branch !== here.branch) {
    /* Deliberately NOT "it does not speak for this ship": coverage is content
     * hashing, so a stamp from another branch genuinely does cover every file
     * whose bytes it recorded. Only what is new here needs re-reviewing, and
     * saying otherwise sends the operator back for a full re-review it does
     * not need. */
    return (
      "the review stamp was minted on branch '" +
      p.branch +
      "', not this tree's '" +
      here.branch +
      "' -- files it already stamped stay covered by content hash; anything " +
      "new to this branch needs a fresh review"
    );
  }
  return null;
}
/* == mint observability =====================================================
 * THE GAP THIS CLOSES, measured 2026-08-04 across five failed receipts.
 *
 * The mint is a PostToolUse hook on `ReportFindings`. A /code-review whose
 * agent does not HAVE that tool reports its findings as prose, mints nothing,
 * and is indistinguishable at the gate from no review at all -- so the operator
 * reads "no valid review stamp found", assumes the review did not run, and runs
 * it again. Five times, on one ship.
 *
 * Provenance cannot reach this: there is no stamp to read fields from. What can
 * be answered is the prior question -- has this mechanism EVER fired here? The
 * hook journals every invocation, INCLUDING refusals, so an absent journal is
 * itself evidence: the hook did not run, and a review that "finished" was
 * text-only.
 *
 * KNOW THE LIMIT. A text-only review leaves NO trace of its own -- nothing here
 * observes it directly. This turns "no stamp" into "no stamp, and the mint has
 * never fired in this tree", which is the sentence that names the failure.
 * It is a diagnostic and nothing else: it gates nothing, and a journal that
 * cannot be read or written is silent, never fatal.
 */
export const MINT_LOG_PATH = path.join(REPO_ROOT, ".claude", ".review-mint-log.json");

/** The journal, or null if absent/unreadable/corrupt -- all three mean "cannot
 * say", and a diagnostic that cannot say must stay quiet. */
export function readMintLog({ file = MINT_LOG_PATH } = {}) {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf8"));
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Record ONE hook fire. Never throws: a journal that breaks a review is worse
 * than no journal. Returns the written record, or null if it could not write. */
export function recordMintAttempt({
  outcome,
  /* Did this invocation carry a real ReportFindings payload? A human running
   * `node review-stamp.mjs` by hand also lands here, and counting THAT as
   * evidence the hook is wired would replace one false reassurance with
   * another -- the gate would tell an operator the mechanism works on the
   * strength of a mis-run script. Only a genuine payload proves the wiring. */
  genuine = false,
  sessionId = null,
  now = Date.now(),
  file = MINT_LOG_PATH,
} = {}) {
  try {
    const prev = readMintLog({ file }) || {};
    const count = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
    const next = {
      version: 1,
      last_fire: new Date(now).toISOString(),
      last_outcome: String(outcome || "unknown"),
      session_id: sessionId,
      fires: count(prev.fires) + 1,
      hook_fires: count(prev.hook_fires) + (genuine ? 1 : 0),
    };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
    return next;
  } catch {
    return null;
  }
}

/** What the journal lets the gate say when NO stamp is present. Null when there
 * is nothing worth saying. Lives beside the writer so the two cannot drift. */
export function describeMintHistory(log) {
  const NEVER =
    "the ReportFindings mint has NEVER fired in this tree -- a /code-review " +
    "whose agent lacks that tool reports its findings as TEXT, mints nothing, " +
    "and looks identical here to no review at all. If one just ran, that is " +
    "what happened: the findings are real, the receipt was never created";
  if (!log || typeof log !== "object") return NEVER;
  const when = typeof log.last_fire === "string" ? log.last_fire : "an unknown time";
  const outcome = typeof log.last_outcome === "string" ? log.last_outcome : "unknown";
  /* A journal with no GENUINE fire in it says the same thing as no journal: the
   * script ran, but never with a ReportFindings payload behind it. */
  if (!(Number.isInteger(log.hook_fires) && log.hook_fires > 0)) {
    return NEVER + " (the mint script has run here " + (log.fires || "?") +
      " time(s), last " + when + ", outcome: " + outcome +
      " -- but never once with a ReportFindings payload)";
  }
  return (
    "the ReportFindings mint HAS fired in this tree (last: " +
    when +
    ", outcome: " +
    outcome +
    ") -- so the hook is wired; this ship simply has no stamp of its own yet"
  );
}

export const MAX_STAMP_AGE_MS = 24 * 60 * 60 * 1000;
export const RESOLVED_OUTCOMES = new Set(["fixed", "skipped", "no_change_needed"]);

/** Read a hook's JSON payload from fd 0. "" on any read error (empty stdin). */
export function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/**
 * Load the stamp, distinguishing WHY it is unusable so callers can pick the
 * right severity. A present-but-garbled file is "corrupt", NOT "io": treating a
 * truncated write as infra would let it DOWNGRADE a hard block to a warning,
 * making a corrupt stamp strictly weaker than a missing one.
 * @returns {{status:string, stamp: object|null}}
 */
export function loadStamp() {
  let raw;
  try {
    if (!fs.existsSync(STAMP_PATH)) return { status: "missing", stamp: null };
    raw = fs.readFileSync(STAMP_PATH, "utf8");
  } catch {
    return { status: "io", stamp: null };
  }
  try {
    return { status: "ok", stamp: JSON.parse(raw) };
  } catch {
    return { status: "corrupt", stamp: null };
  }
}

export function stampAgeMs(stamp, now = Date.now()) {
  return now - Date.parse((stamp && stamp.timestamp) || "");
}
/** Fresh means inside the window AND NOT IN THE FUTURE. Without the age >= 0
 *  clause a stamp timestamped forward -- by clock skew, or by a one-character
 *  hand edit to "2030-01-01T00:00:00Z" -- has a negative age, passes the upper
 *  bound, and never expires. That disables the 24h window, which is the
 *  mechanism's only defence against a stale review, and nothing else inspects
 *  it. */
export function stampIsFresh(stamp, now = Date.now()) {
  const age = stampAgeMs(stamp, now);
  return Number.isFinite(age) && age >= 0 && age <= MAX_STAMP_AGE_MS;
}

/** Human-readable labels of every CONFIRMED finding not yet resolved.
 *
 * The findings value SHOULD be an array, but a syntactically-valid stamp can
 * carry a non-array: loadStamp flags only a JSON PARSE failure as corrupt, so a
 * well-formed-but-wrong-shape file returns status "ok" with that value intact.
 * Coerce so the loop can never throw -- mergeReviewStamp reaches here for ANY
 * fresh prev, and an uncaught TypeError would crash the mint outright instead
 * of degrading to a clean overwrite. */
export function unresolvedConfirmedReasons(stamp) {
  const out = [];
  const findings = Array.isArray(stamp && stamp.findings) ? stamp.findings : [];
  for (const f of findings) {
    if (f && blocksTheShip(f) && !RESOLVED_OUTCOMES.has(f.outcome)) {
      out.push(f.short_summary || f.summary || f.category || "(unnamed)");
    }
  }
  return out;
}

/**
 * Does an unresolved finding block? CONFIRMED does, and so does a finding with
 * NO verdict at all.
 *
 * The ReportFindings contract makes `verdict` optional -- "absent on inline-only
 * reviews". So a review run without a verify pass reports every real defect it
 * found with `verdict` undefined, and a strict `=== "CONFIRMED"` test matched
 * none of them: the stamp came back clean, the hashes carried forward, and a
 * review that found genuine bugs certified the ship. Absent means unverified,
 * not absolved, so it fails CLOSED. PLAUSIBLE is the one verdict that does not
 * block -- it is an explicit "this survived review but was not confirmed".
 */
export function blocksTheShip(finding) {
  const v = finding && finding.verdict;
  if (v === "PLAUSIBLE") return false;
  return v === "CONFIRMED" || v === undefined || v === null || v === "";
}

/**
 * Is this exact content hash covered by a stamp that is (1) fresh and (2)
 * carries no unresolved CONFIRMED finding? A stale stamp, or one whose review
 * CONFIRMED a defect in this very file, must NOT clear it -- the hash alone
 * attests "seen", not "cleared".
 */
export function stampCoversHash(stamp, hash, now = Date.now()) {
  if (!stamp || !hash) return false;
  const hashes = new Set(Object.values(stamp.hashes || {}));
  if (!hashes.has(hash)) return false;
  if (!stampIsFresh(stamp, now)) return false;
  if (unresolvedConfirmedReasons(stamp).length) return false;
  return true;
}

/**
 * ADDITIVE MINT -- carry a still-valid prior review's coverage into the new
 * stamp so a file reviewed clean earlier ON THE SAME BRANCH is not dropped the
 * moment a DIFFERENT file is the only thing in the next review's diff.
 *
 * THE BUG THIS FIXES. The writer scopes against the branch's OWN upstream (the
 * incremental "what did THIS push add"). The ship it eventually gates (a merge
 * to main) is scoped against origin/main -- the WHOLE branch. On a long branch
 * those diverge: review 1 stamps A, review 5 stamps B and, without this,
 * OVERWROTE, so the stamp forgot A. At merge, scope is A plus B and A reads as
 * "never reviewed" though it was.
 *
 * WHY THIS CANNOT WEAKEN THE GATE (each clause is load-bearing -- both
 * directions are proven in tests/reviewScope.test.ts):
 *  - Coverage is only ever ADDED by a real mint; merging never invents a hash.
 *  - Per-rel union means NEW CONTENT WINS: a file that drifted HA to HA2 lands
 *    as HA2 and the stale HA is gone, so a file still at HA fails closed.
 *  - Carry-forward is gated on the prior stamp being FRESH -- measured on the
 *    PRIOR stamp's timestamp, and the new mint renews it. So unchanged coverage
 *    rides across a chain of sub-24h mints; a single >24h gap drops it. That is
 *    deliberate: the gate's identity is the CONTENT HASH, so carried bytes ARE
 *    the reviewed bytes, and the instant a file drifts "new content wins"
 *    re-scopes it.
 *  - Carry-forward is ALSO gated on the prior stamp being CLEAN. A stamp that
 *    CONFIRMED a defect never launders that file's hash forward -- this is the
 *    clause that keeps it from fail-opening.
 *  - findings come from the NEW review ONLY, so this changes coverage
 *    accumulation and NOTHING about how findings gate.
 *
 * DELETIONS ARE PATH-IDENTIFIED, NOT CONTENT-IDENTIFIED (added in Phase 2). A
 * file this ship DELETES has no bytes left to hash, so it can never appear in
 * `hashes` -- which left removing a CI workflow, a check script or a git hook
 * (the single highest-risk guard edit there is) unreviewable by construction.
 * The `deletions` array records those paths, and the gate clears a deletion only
 * when the path is listed. Path identity is genuinely weaker than content
 * identity, and that is the honest limit of what a deletion can attest: there is
 * no content to bind to. Restoring the file puts it back under the hash
 * contract, because it is then on disk and lands in `hashes` instead. The array
 * carries forward under the SAME canCarry gate as `hashes`, for the same reason
 * (an incremental review's diff need not contain an earlier review's deletion).
 */
/** Default liveness probe for carried deletions -- injectable for tests. */
export function pathExists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, toPosix(rel)));
}

export function mergeReviewStamp(prev, {
  sessionId = null,
  hashes = {},
  deletions = [],
  findings = [],
  nowIso,
  now = Date.now(),
  exists = pathExists,
  /* Supplied by writeStamp(). Deliberately NOT defaulted to
   * describeProvenance(): that would make this pure merge shell out to git on
   * all ~30 of its unit call sites, and -- worse -- would mean the default the
   * PRODUCTION writer relies on was the one path no spec ever exercised. */
  provenance = null,
}) {
  const canCarry =
    !!prev &&
    typeof prev === "object" &&
    prev.hashes &&
    typeof prev.hashes === "object" &&
    stampIsFresh(prev, now) &&
    unresolvedConfirmedReasons(prev).length === 0;
  const carried = canCarry ? prev.hashes : {};
  /* PRUNE A CARRIED DELETION WHOSE FILE IS BACK ON DISK. `hashes` self-corrects
   * because new content wins on drift; `deletions` had no equivalent, so a path
   * recorded as deleted rode forward indefinitely across a chain of sub-24h mints.
   * Delete a check script, review it, restore it twenty minutes later, keep
   * working -- then delete it again for a different, unreviewed reason, and the
   * stale entry cleared it. Liveness at mint time is the correction: if the file
   * exists again, this ship is not deleting it, so the attestation is spent. */
  const carriedDeletions = (canCarry && Array.isArray(prev.deletions) ? prev.deletions : []).filter(
    (rel) => !exists(rel)
  );
  const nowDeletions = Array.isArray(deletions) ? deletions : [];
  const mergedDeletions = [
    ...new Set([...carriedDeletions, ...nowDeletions].map(toPosix).filter(Boolean)),
  ].sort();
  return {
    version: 1,
    timestamp: nowIso,
    session_id: sessionId ?? null,
    provenance, // WHERE this receipt was minted -- see describeProvenance()
    hashes: { ...carried, ...hashes }, // union by rel; new content wins on drift
    deletions: mergedDeletions, // union by path; a deletion has no content to hash
    findings: Array.isArray(findings) ? findings : [],
  };
}
