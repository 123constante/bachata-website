/**
 * evidence -- shared vocabulary for "did this value come from a row?".
 *
 * The honest-claims arc (docs: ~/.claude/plans/you-need-to-find-jolly-lark.md,
 * P7) exists because the site kept asserting facts the data could not back:
 * `addressCountry: 'GB'` on every event, `'Bachata Artists'` as a performer no
 * table names, `availability: 'InStock'` with no ticket row behind it. The
 * pattern that stops it recurring is always the same shape -- try candidates in
 * order, reject anything that is not real evidence, return null/omit rather
 * than invent -- and `src/lib/publicName.ts` is the one place that shape
 * already shipped and is already covered by 16 regression tests (see
 * tests/publicName.test.ts's POSITIVE / NEGATIVE / FIDELITY header). This file
 * generalises it so the doctrine has one home instead of N reimplementations,
 * each free to drift.
 *
 * Three primitives:
 *   fromRow        -- pick the first evidenced candidate off a row, in order.
 *   omitIfUnknown  -- the "if (x) obj.field = x" idiom as a named function,
 *                     for the OMIT remedy class (buildEventJsonLd.ts and
 *                     buildEventListJsonLd.ts are full of the hand-rolled form).
 *   constantClaim  -- the ONE sanctioned escape hatch for a genuine constant
 *                     claim (not derived from any row), wrapped with a dated
 *                     source so it reads as a reviewed decision rather than an
 *                     anonymous literal. Pairs with src/lib/claims.ts (queued).
 *
 * NOT exported here: any UUID/id-rejection logic. That is publicName.ts's own
 * domain rule (an id is not a name), passed into fromRow as its `isInvalid`
 * predicate rather than baked into the generic primitive -- a resolver for
 * ticket prices or venue addresses has no id-shaped-value problem at all, and
 * a generic rule "reject UUID-shaped strings" would silently break the day a
 * legitimate value happens to look like one (same failure class this arc's P7
 * write-up rejects a lexical/shape guard for: it is defined by what the
 * author anticipated, so an unanticipated shape passes it unchanged).
 */

/** Trim, then treat whitespace-only as absent -- the one cleaning rule every
 *  candidate in this file shares. Exported so publicName.ts (and any other
 *  caller needing to pre-clean a value ahead of fromRow, e.g. before joining
 *  several fields into one candidate) shares this definition rather than
 *  hand-syncing a second copy. */
export const clean = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/**
 * Try each candidate extractor against `row`, in order. A candidate is a
 * function so the caller controls exactly what "the row" means (a single
 * column, a joined string, a nested path) rather than fromRow guessing at
 * property access. Each extracted value is cleaned (non-string -> null,
 * blank -> null) before being offered to `isInvalid` and returned.
 *
 * `isInvalid` is the caller's domain-specific rejection rule (e.g.
 * publicName.ts's "this candidate IS the row's own id"). It runs only on
 * already-clean, non-blank candidates -- fromRow itself never returns a
 * placeholder, so there is nothing for a domain rule to reject on that
 * axis.
 *
 * Falls THROUGH a rejected higher-precedence candidate to the next one,
 * never gives up on the first rejection -- this is the behaviour
 * tests/publicName.test.ts's "precedence" describe block pins.
 */
export function fromRow<T>(
  row: T,
  candidates: ReadonlyArray<(row: T) => unknown>,
  isInvalid: (candidate: string, row: T) => boolean = () => false,
): string | null {
  for (const extract of candidates) {
    const candidate = clean(extract(row));
    if (!candidate) continue;
    if (isInvalid(candidate, row)) continue;
    return candidate;
  }
  return null;
}

/**
 * The OMIT remedy as a named function: a present, evidenced value becomes a
 * one-key object to spread/assign into a JSON-LD node; an absent one becomes
 * `{}`, so the caller never has to hand-write `if (x) obj.field = x`.
 *
 * "Present" reuses `fromRow`'s own cleaning rule for strings (blank is
 * absent, matching every JSON-LD builder's existing convention), and treats
 * any other non-null/undefined value as present unchanged -- a `0`, `false`
 * or a populated array/object is real data, not a gap.
 */
export function omitIfUnknown<K extends string, V>(
  key: K,
  value: V | null | undefined,
): { [P in K]?: V } {
  if (value === null || value === undefined) return {};
  if (typeof value === "string" && clean(value) === null) return {};
  return { [key]: value } as { [P in K]?: V };
}

/** A constant claim's provenance: what it asserts, where that was verified,
 *  and when -- staleness is reported separately from provenance and never
 *  gates on its own (a stale date must not make the claim read as
 *  unevidenced -- staleness and provenance are different failure modes and
 *  conflating them would let a growing-but-stale registry silently disable
 *  the provenance check). */
export interface ClaimSource {
  /** Short name for what is being asserted, e.g. 'addressCountry'. */
  claim: string;
  /** Where this was verified -- a query, a doc section, a conversation. */
  source: string;
  /** ISO date this was last verified true. */
  verifiedOn: string;
  /** Free-text cadence for re-verification, e.g. '90d'. Informational only. */
  reviewEvery?: string;
}

/**
 * Wrap a genuine constant claim -- one that is NOT derived from any row and
 * is not going to become one -- with its dated provenance. Identity at
 * runtime (returns `value` unchanged); the wrapper's job is to give the
 * eventual P7 guard a structural marker to allow-list, so a hardcoded literal
 * sitting bare in a JSON-LD builder stays a violation while the same literal
 * declared here reads as a reviewed decision. See src/lib/claims.ts (queued)
 * for the registry this is meant to back.
 */
export function constantClaim<T>(value: T, _meta: ClaimSource): T {
  return value;
}
