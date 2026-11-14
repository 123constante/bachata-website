/**
 * PGRST202 triage for the DB contract checks (admin issue #1684).
 *
 * PostgREST answers PGRST202 ("could not find the function ... in the schema
 * cache") both when the function really is absent AND when an admin migration
 * has just created it and PostgREST has not reloaded. The two need opposite
 * fixes, so a guard must say which one it is looking at.
 *
 * `resolveRpcNotFound` takes the failed call's error, a `retryCall` closure and
 * an optional `functionExists(fn)` probe over pg_proc (read-only), and returns:
 *
 *   { handled: false }                      not PGRST202 -- caller's own handling
 *   { handled: true, data, retries: 1 }     stale cache cleared on the one retry
 *   { handled: true, exitCode: 1, message } red, message names the cause
 *
 * At most ONE retry, after `delayMs` (default 5000). It never calls
 * process.exit and never degrades a failure to a pass.
 *
 * PROBE: no anon-callable pg_proc read exists in prod today (see the note in
 * check-origin-consumers.mjs). Without a probe the cause cannot be told apart,
 * so the helper still retries once (that clears a stale cache) and, if the call
 * still fails, goes red naming BOTH causes. Pass `functionExists` as soon as a
 * read path exists; nothing else changes.
 */

export const MSG_RETRYING =
  'schema cache stale (function exists, PostgREST has not reloaded): retrying once';
export const MSG_STALE =
  "STALE SCHEMA CACHE: run NOTIFY pgrst, 'reload schema' (admin apply step)";
export const MSG_MISSING = 'FUNCTION MISSING in prod: the migration is not applied';
export const MSG_UNKNOWN =
  'PGRST202 persisted after one retry and pg_proc could not be read: either ' +
  `${MSG_MISSING.replace('FUNCTION MISSING in prod: ', 'the function is missing (')}) ` +
  `or the schema cache is stale (${MSG_STALE.replace('STALE SCHEMA CACHE: ', '')})`;

export const isPgrst202 = (err) => String(err?.code ?? '') === 'PGRST202';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function resolveRpcNotFound(fn, error, opts = {}) {
  const { retryCall, functionExists, delayMs = 5000, sleep = wait, log = console.error } = opts;
  if (!isPgrst202(error)) return { handled: false };
  if (typeof retryCall !== 'function') throw new TypeError('resolveRpcNotFound: retryCall is required');

  let exists = null; // null = could not tell
  if (typeof functionExists === 'function') {
    try { exists = Boolean(await functionExists(fn)); } catch (e) {
      log(`${fn}: pg_proc probe failed (${e?.message ?? e}); treating cause as unknown`);
    }
  }
  if (exists === false) {
    return { handled: true, exitCode: 1, retries: 0, message: `${fn}: ${MSG_MISSING}` };
  }
  log(`${fn}: ${exists === true ? MSG_RETRYING : 'PGRST202, cause unknown (no pg_proc read): retrying once'}`);
  await sleep(delayMs);
  const { data, error: again } = await retryCall();
  if (!again) return { handled: true, data, retries: 1 };
  if (!isPgrst202(again)) return { handled: false, retries: 1, error: again };
  return {
    handled: true, exitCode: 1, retries: 1,
    message: `${fn}: ${exists === true ? MSG_STALE : MSG_UNKNOWN}`,
  };
}
