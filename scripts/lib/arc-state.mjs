/**
 * arc-state.mjs -- shared reader/comparator for <repo>/.claude/arc-state.json.
 * TWIN COPY: content-identical in Website and bachata-admin-11april (line endings
 * follow each repo's own convention). Edit both or neither -- the twin-parity
 * unit test enforces it whenever the sibling checkout is present.
 *
 * Single home for the parse/verdict logic that Phase 4's three consumers
 * (arc-checkpoint.mjs in both repos, scripts/statusline-arc.mjs) previously
 * re-derived. Review finding: the three copies had already diverged on their
 * preconditions before the first ship -- the hook demanded BOTH
 * required_model/required_effort while the statusline accepted either, so the
 * same arc-state produced a verdict in one comparator and silence in the other.
 */

import fs from "node:fs";

export const ARC_STALE_MS = 7 * 24 * 60 * 60 * 1000;
/** A set_at slightly in the future is clock skew between two machines, not an
 *  abandoned arc; beyond an hour it is nobody's clock and gets the stale note. */
export const FUTURE_SKEW_MS = 60 * 60 * 1000;

const BOM_RE = /^\uFEFF/;
const CTRL_RE = /[\u0000-\u001F]+/g;

function str(v) {
  return typeof v === "string" && v ? v : "";
}

/** Everything interpolated into prompt context or the statusline passes through
 *  here. arc-state.json arrives through branches and PRs, so an uncapped or
 *  newline-bearing field would become multi-line prompt content on every turn
 *  (review finding: the first ship interpolated four fields verbatim). Control
 *  characters collapse to a single space before the length cap applies. */
export function clip(value, max = 80) {
  const s = String(value).replace(CTRL_RE, " ");
  return s.length <= max ? s : s.slice(0, max - 2) + "..";
}

/**
 * status: 'missing' | 'corrupt' | 'closed' | 'inactive' | 'ok'.
 *
 * corrupt is deliberately DISTINCT from missing -- the rule review-scope.mjs
 * already applies to the review stamp: a malformed .claude JSON must never
 * silently downgrade to "absent", because this mount's live failure mode IS
 * silent corruption. Callers decide what corrupt renders as; none may render
 * it as nothing. A UTF-8 BOM (what PowerShell's Out-File emits) is stripped
 * before parsing rather than treated as corruption.
 *
 * inactive = parseable and open, but with neither required_model nor
 * required_effort -- nothing to enforce. ONE declared field is enforceable.
 */
export function loadArcState(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (err) {
    // Only a genuinely ABSENT file is "missing". A path that exists but cannot
    // be read (EISDIR, EACCES) is the same doctrine class as unparseable
    // content: it must speak up, not vanish (verify-workflow finding).
    if (err && err.code === "ENOENT") return { status: "missing", arc: null };
    return { status: "corrupt", arc: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.replace(BOM_RE, ""));
  } catch {
    return { status: "corrupt", arc: null };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { status: "corrupt", arc: null };
  }
  if (parsed.phase === "done" || parsed.closed_at) return { status: "closed", arc: parsed };
  if (!str(parsed.required_model) && !str(parsed.required_effort)) {
    return { status: "inactive", arc: parsed };
  }
  return { status: "ok", arc: parsed };
}

/** Website writes numeric phases (rendered "P4"); admin's arcs use slugs
 *  (rendered verbatim). Long slugs are clipped so the verdict -- the part worth
 *  reading -- survives a narrow terminal. */
export function arcLabel(arc, max = 60) {
  const name = str(arc && arc.arc) || "arc";
  const phase = arc ? arc.phase : undefined;
  let full = name;
  if (!(phase === undefined || phase === null || phase === "")) {
    const shown = /^[0-9]+(\.[0-9]+)?$/.test(String(phase)) ? "P" + phase : String(phase);
    full = name + " " + shown;
  }
  return clip(full, max);
}

/** stale on: no parseable set_at (nothing bounds the arc's lifetime, and the
 *  guard's invariant is "an abandoned arc-state must not keep demanding a model
 *  forever" -- so unbounded means stale, not fresh); a set_at further in the
 *  future than clock skew explains; or age past ARC_STALE_MS. */
export function staleness(arc, now = Date.now()) {
  const setAt = Date.parse(str(arc && arc.set_at));
  if (!Number.isFinite(setAt)) return { stale: true, reason: "no parseable set_at" };
  const age = now - setAt;
  if (age < -FUTURE_SKEW_MS) return { stale: true, reason: "set_at is in the future" };
  if (age > ARC_STALE_MS) return { stale: true, reason: Math.round(age / 86400000) + " days old" };
  return { stale: false, reason: "" };
}

/** "claude-opus-5[1m]" (context-ceiling variant) and "claude-opus-5-20260514"
 *  (dated form of the alias) are the SAME model as "claude-opus-5" for the
 *  doctrine's purposes. Exact string equality called the dated form a MODEL
 *  MISMATCH -- ordering the operator onto the model they were already on, on
 *  the loudest line these tools print. A comparator that cries wolf gets
 *  ignored, so normalisation is part of the contract, not a nicety. */
/** Splits a model id into the three things that decide equality. Handles every
 *  spelling in circulation: the canonical "claude-opus-5", the SHORT ALIAS the
 *  operator actually types and which lands in settings.json ("opus[1m]"), the
 *  dated form an API payload may carry ("claude-opus-5-20260514"), and any
 *  context-ceiling suffix.
 *
 *  A BARE FAMILY compares version-agnostically. That is deliberate and is the
 *  reason this is not an alias TABLE: hard-coding opus -> claude-opus-5 silently
 *  rots the day opus-6 ships, and the failure would be a permanent red on a
 *  correctly-configured session -- the cry-wolf class again, arriving by
 *  calendar rather than by bug. */
function parseModelId(id) {
  const raw = String(id);
  const ceilingMatch = raw.match(/\[([^\]]*)\]$/);
  const base = raw
    .replace(/\[[^\]]*\]$/, "")
    .replace(/-\d{8}$/, "")
    .replace(/^claude-/, "");
  const family = base.split("-")[0] || "";
  return {
    family,
    version: base.slice(family.length).replace(/^-/, ""),
    ceiling: ceilingMatch ? ceilingMatch[1] : "",
  };
}

/** 'match' | 'ceiling' (same tier, different context ceiling) | 'mismatch' |
 *  'unknown' (session model not observable -- NEVER escalated to mismatch). */
export function compareModel(sessionId, requiredId) {
  const session = str(sessionId);
  const required = str(requiredId);
  if (!required) return "match";
  if (!session) return "unknown";
  const a = parseModelId(session);
  const b = parseModelId(required);
  if (a.family !== b.family) return "mismatch";
  // Both sides versioned and disagreeing is a real mismatch; a bare family on
  // either side cannot contradict a version, so it matches the family.
  if (a.version && b.version && a.version !== b.version) return "mismatch";
  return a.ceiling === b.ceiling ? "match" : "ceiling";
}

/** Same contract for effort. The statusline payload frequently carries no
 *  effort field at all; comparing its "?" placeholder as a real value rendered
 *  a permanent red SWITCH on correctly-configured sessions (review finding). */
export function compareEffort(sessionEffort, requiredEffort) {
  const session = str(sessionEffort);
  const required = str(requiredEffort);
  if (!required) return "match";
  if (!session || session === "?") return "unknown";
  return session === required ? "match" : "mismatch";
}
