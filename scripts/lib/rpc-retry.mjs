/**
 * Shared transient-RPC handling for the DB contract checks.
 *
 * WHY THIS EXISTS. Every check in db-contract-check.yml connects with the
 * publishable (anon) key, and prod pins `anon` to `statement_timeout=3s`
 * (`authenticated` gets 8s). Three seconds is a budget sized for a public page
 * query, not for an aggregate integrity scan against a cold instance. Measured
 * 2026-09-01: search_public_v5('bachata') executes in 143ms warm, and timed out
 * under anon in CI the same evening. So a 57014 from these scripts is almost
 * always "the instance was cold", not "the contract is broken".
 *
 * That distinction is the whole point. The repo's exit convention is 0 green /
 * 1 violated / 2 could-not-run, and a timeout is squarely a 2. Most of the
 * rpc-calling check scripts have no transient handling at all -- count them
 * with `grep -l 'rpc(' scripts/check-*.mjs`, do not trust a number written
 * here -- and check-surface-time-agreement.mjs actively mis-typed one: it caught
 * the RPC error and pushed the message into its `mismatches` array, so a cold
 * search RPC was reported as a reader DISAGREEING with canonical time and
 * exited 1. That is a contract violation that never happened.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not retry mutations, and it does
 * not decide anyone's exit code by itself:
 *
 *   - `rpcWithRetry` is for reads. Use it by default.
 *   - `rpcOnce` is for writes -- same classification, ZERO retries, because a
 *     timeout on a mutating RPC does not tell you whether the write landed.
 *     Retrying it can double-apply. check-per-date-program-sync-mutation.mjs is
 *     the live example.
 *   - Neither calls process.exit. They throw an error carrying `.transient`,
 *     and the caller decides. `exitTransient` is the one-liner most callers
 *     want, kept separate so a script with cleanup to do can still catch first.
 *
 * A retry that exhausts its attempts NEVER degrades to a pass. It throws with
 * `.transient = true` so the caller exits 2 -- "this guard could not run" is a
 * fact worth reporting, and recording an unknown as a green is the fail-open
 * trap this repo has been bitten by before.
 *
 * NOT MECHANICALLY ENFORCED. A conventions rule requiring this helper was
 * written and REVERTED at review on 2026-09-01: it read its opt-out marker from
 * raw source, so a mention in a string literal exempted a whole file -- and the
 * rule's own prose contained the marker, which left the guard permanently
 * exempt from itself. It also scanned only `.rpc(` while the same defect rides
 * on `.from(` in ten other checks. Adoption is therefore manual for now; see
 * the queued plan named in that revert for the shape a working rule needs.
 */

// Postgres SQLSTATEs that mean "try again", not "your query is wrong".
//   57014 query_canceled (this is the statement_timeout one)
//   40001 serialization_failure      40P01 deadlock_detected
//   08006 connection_failure         08003 connection_does_not_exist
//   53300 too_many_connections
export const TRANSIENT_CODES = new Set(['57014', '40001', '40P01', '08006', '08003', '53300']);

// Transport-level failures surface as fetch/undici messages with no SQLSTATE,
// so the message is the only signal available. Kept narrow on purpose: matching
// a bare 'error' or 'failed' here would classify genuine contract failures as
// infrastructure and turn this helper into the fail-open it exists to prevent.
// A bare 'network' used to sit in this list and was removed at review: it
// matches any message naming a *_network_* object, so `permission denied for
// table social_network_links` would have been read as infrastructure and
// exited 2 instead of 1. Every entry here must be a phrase that cannot occur
// inside an object name.
const TRANSIENT_TEXT = [
  'statement timeout',
  'canceling statement',
  'fetch failed',
  'network error',
  'econnreset',
  'econnrefused',
  'enotfound',
  'etimedout',
  'socket hang up',
];

/**
 * A PostgREST error is an object, not an Error. Supabase hands back
 * `{ code, message, details, hint }`; a transport failure throws a real Error
 * with no code. Both shapes reach here, so read both and never assume either.
 */
export function isTransient(err) {
  if (!err) return false;
  const code = String(err.code ?? '');
  if (TRANSIENT_CODES.has(code)) return true;
  const msg = String(err.message ?? err ?? '').toLowerCase();
  return TRANSIENT_TEXT.some((t) => msg.includes(t));
}

export class RpcError extends Error {
  constructor(fn, cause, { transient, attempts }) {
    super(`${fn}: ${cause?.message ?? cause}`);
    this.name = 'RpcError';
    this.fn = fn;
    this.cause = cause;
    this.code = cause?.code ?? null;
    this.transient = transient;
    this.attempts = attempts;
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Call a READ rpc, retrying only transient failures.
 *
 * Defaults: 3 attempts, 750ms backing off x2 (750 / 1500). That is ~2.3s of
 * added wait PER CALL, and the budget is per call only -- there is no run-level
 * cap. An earlier version of this comment claimed "~2.3s to a failing step",
 * which is false for any caller in a loop: check-surface-time-agreement.mjs
 * makes 81 calls, and calls that time out once and then RECOVER never reach
 * exitTransient, so a bad minute there can add minutes rather than seconds.
 * There is also no jitter, so concurrent retries hit a cold instance in
 * lockstep. A run-level budget is queued debt, not solved here.
 *
 * `sleep` is injectable so the tests can prove the retry path without
 * spending wall clock.
 */
export async function rpcWithRetry(sb, fn, args, opts = {}) {
  const { attempts = 3, baseDelayMs = 750, sleep = wait } = opts;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new TypeError(`rpcWithRetry: attempts must be a positive integer, got ${attempts}`);
  }
  let last;
  for (let i = 1; i <= attempts; i++) {
    const { data, error } = await sb.rpc(fn, args);
    if (!error) return data;
    last = error;
    // A non-transient error is the answer, not a flake. Returning here rather
    // than burning the remaining attempts keeps a genuine contract failure fast
    // and keeps its message unmangled by retry bookkeeping.
    if (!isTransient(error)) throw new RpcError(fn, error, { transient: false, attempts: i });
    if (i < attempts) await sleep(baseDelayMs * 2 ** (i - 1));
  }
  throw new RpcError(fn, last, { transient: true, attempts });
}

/**
 * Call a MUTATING rpc. Same classification, no retry -- a timeout on a write
 * leaves you unable to say whether it landed, so trying again risks applying it
 * twice. The transient flag still routes the caller to exit 2.
 */
export async function rpcOnce(sb, fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (!error) return data;
  throw new RpcError(fn, error, { transient: isTransient(error), attempts: 1 });
}

/**
 * The standard tail: a transient failure is exit 2 (guard could not run).
 *
 * A NON-transient error RETURNS, so the caller's own handling runs next. That
 * matters: several of these checks distinguish a missing RPC (PGRST202 ->
 * exit 1, "the contract is broken") from an ordinary transport failure, and an
 * earlier draft of this function THREW here instead -- which made every one of
 * those branches unreachable and turned a genuine missing-RPC finding into an
 * unhandled rejection.
 *
 * The contract that buys: every caller must still handle the non-transient
 * case itself. Each one currently ends in an explicit process.exit, so nothing
 * can run on with undefined data.
 */
export function exitTransient(err, label = 'contract check') {
  // Fall back to classifying the RAW error. Without this, the natural retrofit
  // -- `catch (error) { exitTransient(error); ... }` where `error` is a
  // PostgREST object that never passed through rpcWithRetry -- compiles, reads
  // correct, and silently does nothing. That is the fail-open this module
  // exists to prevent, and it was found at review.
  //
  // `??` not `||`: an RpcError we already classified as NON-transient keeps its
  // false rather than being re-judged by the text heuristic.
  const transient = err?.transient ?? isTransient(err);
  if (!transient) return;
  console.error(
    `${label}: ${err.message ?? err} (after ${err.attempts ?? 1} attempt(s)). ` +
    'Transient infrastructure failure, not a contract violation -- exiting 2.',
  );
  process.exit(2);
}
