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
  return "origin/main";
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
 * @returns {{status:'none'|'ok'|'corrupt', scope: string[]|null}}
 */
export function resolveDeclaredScope() {
  const env = process.env.REVIEW_SCOPE_DECLARED;
  if (typeof env === "string") {
    const parts = env.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    // set but empty => an explicit "no declaration", not a corrupt one
    return parts.length ? { status: "ok", scope: parts } : { status: "none", scope: null };
  }
  const arcPath = path.join(REPO_ROOT, ".claude", "arc-state.json");
  let raw;
  try {
    if (!fs.existsSync(arcPath)) return { status: "none", scope: null };
    raw = fs.readFileSync(arcPath, "utf8");
  } catch {
    return { status: "corrupt", scope: null };
  }
  let arc;
  try {
    arc = JSON.parse(raw);
  } catch {
    return { status: "corrupt", scope: null };
  }
  if (!Array.isArray(arc && arc.scope)) return { status: "none", scope: null };
  const parts = arc.scope.map((s) => String(s).trim()).filter(Boolean);
  return parts.length ? { status: "ok", scope: parts } : { status: "none", scope: null };
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
 * lock are the same class of machine-written local state.
 */
export const DECLARED_ALWAYS_EXEMPT = [
  /^\.claude\/arc-state\.json$/,
  /^\.claude\/\.review-stamp\.json$/,
  /^\.claude\/\.session-lock\.json$/,
];

export function scopeDrift(files, { declared = null } = {}) {
  const paths = (files || []).map(toPosix).filter(Boolean);
  const counts = {};
  for (const p of paths) {
    const s = classifySurface(p);
    counts[s] = (counts[s] || 0) + 1;
  }

  if (declared && declared.length) {
    const foreign = paths
      .filter((p) => !DECLARED_ALWAYS_EXEMPT.some((re) => re.test(p)))
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
    hashes: { ...carried, ...hashes }, // union by rel; new content wins on drift
    deletions: mergedDeletions, // union by path; a deletion has no content to hash
    findings: Array.isArray(findings) ? findings : [],
  };
}
