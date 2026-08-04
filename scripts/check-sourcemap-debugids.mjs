#!/usr/bin/env node
// Deterministic sourcemap-health gate (no error traffic needed).
//
// Fetches the LIVE production bundle, reads each chunk's embedded Sentry debug-id,
// and asks Sentry whether a matching sourcemap artifact exists (artifact-lookup).
// If a deployed chunk carries a debug-id but Sentry has no sourcemap for it, the
// upload is broken and EVERY error on this release would stay minified -- we fail.
//
// Why this beats check-sourcemaps-resolve.mjs: that one inspects recent ERROR
// events, so it can't validate a fresh release until something throws (and it
// can sit red/green on stale data). This validates the CURRENT deploy directly.
//
// THE DEFECT THIS FILE WAS REWRITTEN TO CLOSE (2026-08-04). The guard used to end:
//
//     if (checked === 0) { console.warn('No Sentry-tagged chunks ... skipping.'); process.exit(0) }
//
// "No chunk carries a debug-id" is not a reason to skip -- it IS the regression.
// Debug-ids are injected at build time by @sentry/vite-plugin; if the plugin is
// misconfigured, loses its auth token, or is dropped from vite.config.ts, the
// bundle ships with NO debug-ids at all, nothing is uploaded, and every prod
// stack trace stays minified. That deploy produced checked === 0 and the guard
// called it green. It inverted under precisely its own failure mode, and it is
// the debt row that motivated rule R1 in check-script-conventions.mjs (check #63).
//
// The cure is to stop conflating three different zero-states that the old
// `checked === 0` collapsed into one:
//
//   fetched === 0   we could not read a single chunk body. We measured NOTHING,
//                   so we know nothing -- infrastructure, exit 2 (R3's code for
//                   "could not measure"), never a green.
//   tagged === 0    we DID read chunks and not one carried a debug-id. This is
//                   a positive measurement of a broken build. FAIL (exit 1).
//   missing > 0     tagged chunks whose sourcemap never reached Sentry. FAIL,
//                   as before.
//
// Only the last of those three used to fail. The middle one -- the loudest
// possible evidence of a broken upload -- was the skip.
//
// Structure follows the same shape as the other rewritten guards this arc: the
// network I/O is in main(), the DECISION is the pure classify(), and the canary
// (--self-test) drives classify() over every state in BOTH directions. A guard
// with no proof it can fail is R4's violation, and this one is now its own
// counter-example rather than its worst offender.
//
// Usage: node scripts/check-sourcemap-debugids.mjs [--self-test]
// Env:   SENTRY_READ_TOKEN (or SENTRY_AUTH_TOKEN), project:read + event:read.
//        SITE_URL (default https://www.bachatacalendar.co.uk)
//        SOURCEMAP_CHECK_REQUIRE_TOKEN=1 -> fail (not skip) when no token.
// Exit:  0 = healthy ; 1 = broken upload / untagged bundle ; 2 = could not measure.

import { assertMeasured } from './lib/previewProbe.mjs'

const ORG = 'bachata-community'
const PROJECT = 'bachata-website'
const BASE = 'https://sentry.io/api/0'
const SITE = (process.env.SITE_URL || 'https://www.bachatacalendar.co.uk').replace(/\/$/, '')
const MAX_CHUNKS = 8

// A live production bundle always splits into several hashed chunks (vite.config.ts
// pins vendor-react / vendor-query / vendor-motion / vendor-supabase / vendor-ui on
// top of the entry). Finding exactly one is itself evidence the page we fetched is
// not the real app -- an error page, a login wall, a CDN placeholder.
const MIN_CHUNKS = 2

// ---------------------------------------------------------------------------
// the decision (pure -- no network, no process.exit, so the canary can drive it)
// ---------------------------------------------------------------------------

/**
 * Grade one bundle sample.
 *
 * Every message states the SAMPLE explicitly (`n of N discovered`), because
 * MAX_CHUNKS truncates hard: the live homepage referenced 73 chunks when this
 * was written and we read 8. A verdict phrased as if it covered the whole
 * deploy, having looked at 11% of it, is the same overclaim in a different
 * costume -- true of the pass direction as much as the fail one (finding 4).
 *
 * @param {{discovered:number, fetched:number, tagged:number, misses:string[],
 *          lookupErrors:number}} m
 *   discovered    hashed /assets/*.js paths referenced by the live homepage
 *   fetched       of those, how many bodies we actually read
 *   tagged        of those bodies, how many carried a sentry-dbid
 *   misses        tagged chunks Sentry ANSWERED for, with no artifact
 *   lookupErrors  tagged chunks Sentry did not answer for at all (non-2xx)
 * @returns {{code:0|1|2, reason:string, message:string}}
 */
export function classify(m) {
  const { discovered = 0, fetched = 0, tagged = 0, misses = [], lookupErrors = 0 } = m
  const sample = `${fetched} of ${discovered} discovered chunk(s)`

  // Nothing to grade: the site did not serve us an app shell.
  if (discovered === 0) {
    return {
      code: 2,
      reason: 'no-chunks-discovered',
      message: `no /assets/*.js chunks found on ${SITE} -- is the site up?`,
    }
  }

  // We saw chunk URLs but could not read a single body. We measured nothing, so
  // we know nothing. NOT a pass, and not a build verdict either.
  if (fetched === 0) {
    return {
      code: 2,
      reason: 'no-chunks-fetched',
      message:
        `found ${discovered} chunk URL(s) on ${SITE} but could not fetch a single body ` +
        '-- cannot grade this deploy (network or CDN fault, not a build verdict).',
    }
  }

  // The sample floor, applied AHEAD of every build verdict rather than on the
  // green path only (finding 3). A real deploy splits into many hashed chunks;
  // a page referencing one .js is an error page, a login wall or a CDN
  // placeholder. Grading that as "the plugin did not tag this build" is a
  // confidently WRONG accusation, so it resolves as could-not-measure -- and it
  // must do so BEFORE tagged === 0 can claim it.
  if (fetched < MIN_CHUNKS) {
    return {
      code: 2,
      reason: 'sample-too-small',
      message:
        `read only ${sample} -- fewer than the ${MIN_CHUNKS} a real deploy always serves. ` +
        'Refusing to grade a build off a sample this size (almost certainly not the app shell).',
    }
  }

  // Sentry did not ANSWER for some chunks (401/403/429/5xx). "No artifact" and
  // "no answer" are different facts, and the old code conflated them: a
  // `lookup.ok ? json : []` turned an expired token into a positive accusation
  // that the sourcemap upload was broken (finding 1). An infrastructure fault
  // is exit 2 by this file's own taxonomy, never a build verdict.
  if (lookupErrors > 0) {
    return {
      code: 2,
      reason: 'lookup-unavailable',
      message:
        `Sentry did not answer the artifact lookup for ${lookupErrors} of ${tagged} tagged chunk(s) ` +
        '-- cannot grade this deploy (bad or expired token, missing scope, rate limit, or a Sentry ' +
        'outage). This is NOT evidence that the sourcemap upload is broken.',
    }
  }

  // THE INVERSION THIS REWRITE EXISTS TO FIX. Chunks are live and readable and
  // not one carries a debug-id: @sentry/vite-plugin did not run, or ran without
  // credentials. Every error on this release will stay minified. The old code
  // called this "skipping" and exited 0.
  if (tagged === 0) {
    return {
      code: 1,
      reason: 'no-tagged-chunks',
      message:
        `read ${sample} and NONE carries a Sentry debug-id ` +
        '-- @sentry/vite-plugin did not tag this build, so no sourcemap can ever resolve ' +
        'and every prod error on this release will stay minified.',
    }
  }

  // PARTIAL tagging is the realistic shape of this regression, and the first
  // cut of this rewrite graded it GREEN -- with a canary case that enshrined
  // the behaviour as intended and a comment claiming vendor chunks
  // "legitimately vary" (finding 2). Measured against the live bundle that
  // claim was simply false: 8 of 8 sampled chunks were tagged, vendor-react
  // included. The plugin tags the whole build or it is broken, so anything
  // strictly between none and all is a partial failure, and the OK message
  // ("all 1 tagged chunk has a sourcemap") was actively reassuring about it.
  if (tagged < fetched) {
    return {
      code: 1,
      reason: 'partially-tagged',
      message:
        `only ${tagged} of the ${fetched} chunk(s) read (sampled from ${discovered} discovered) ` +
        'carry a Sentry debug-id ' +
        '-- @sentry/vite-plugin tagged this build only partially, so errors landing in the ' +
        `${fetched - tagged} untagged chunk(s) will stay minified.`,
    }
  }

  if (misses.length > 0) {
    return {
      code: 1,
      reason: 'missing-artifacts',
      message:
        `${misses.length} of ${tagged} tagged chunk(s) (sampled from ${discovered} discovered) ` +
        'have a debug-id with NO matching sourcemap uploaded to Sentry ' +
        '-- prod errors on this release will stay minified.\n' +
        misses.map((s) => `    ${s}`).join('\n'),
    }
  }

  // The green message carries the sample too. "all 8 chunks have a sourcemap"
  // sounds like the deploy was cleared; it sampled 8 of 73 (finding 4), and the
  // pass direction is where an overclaim does the most damage, because nobody
  // goes looking for the caveat behind a green.
  return {
    code: 0,
    reason: 'ok',
    message:
      `all ${tagged} chunk(s) read carry a Sentry debug-id with a matching uploaded sourcemap ` +
      `(sampled ${sample}; MAX_CHUNKS=${MAX_CHUNKS} caps the sample, so this clears the sample, ` +
      'not every chunk on the deploy).',
  }
}

export function report(v, log = console) {
  const line = `[dbid] ${v.code === 0 ? 'OK' : 'FAIL'}: ${v.message}`
  if (v.code === 0) log.log(line)
  else log.error(line)
  return v.code
}

/** Swallows report()'s output so the canary can assert its RETURN value without
 *  spraying fake verdicts through the self-test transcript. */
const NULL_LOG = { log() {}, error() {} }

// ---------------------------------------------------------------------------
// canary (R4) -- every verdict proven in BOTH directions
// ---------------------------------------------------------------------------

/**
 * A guard only ever shown to fail is indistinguishable from one that always
 * fails, so each state is asserted to produce its code AND the neighbouring
 * states are asserted NOT to produce it.
 *
 * Per the rule earned on #189: this canary names its expectations EXPLICITLY
 * (literal codes and reasons) rather than deriving them from classify(). A spec
 * that derives its expectations from the code under test goes quiet at the same
 * moment the code does, and cannot fail.
 *
 * The first cut of this canary is itself a worked example of why that rule is
 * not enough. It passed 16 of 16 while ASSERTING the partial-tagging bug as
 * intended behaviour -- a case can only catch a defect the author did not
 * already believe in. What caught it was measuring the live bundle (8 of 8
 * chunks tagged) and finding the comment that justified the case to be false.
 * Every fixture below that encodes a claim about the real world says where the
 * number came from.
 */
export function selfTest(log = console.log) {
  const cases = []
  let failed = 0
  const add = (name, actual, expected) => cases.push({ name, actual, expected })

  // A healthy sample: enough chunks to clear MIN_CHUNKS, all tagged, all found.
  const healthy = { discovered: 73, fetched: 8, tagged: 8, misses: [], lookupErrors: 0 }
  const untagged = { discovered: 73, fetched: 8, tagged: 0, misses: [], lookupErrors: 0 }
  const partial = { discovered: 73, fetched: 8, tagged: 3, misses: [], lookupErrors: 0 }
  const missing = { discovered: 73, fetched: 8, tagged: 8, misses: ['/assets/a.js debug_id=x'], lookupErrors: 0 }
  const lookupDown = { discovered: 73, fetched: 8, tagged: 8, misses: [], lookupErrors: 2 }

  // --- the regression that motivated this rewrite: a wholly untagged bundle ---
  add('untagged bundle FAILS (exit 1)', classify(untagged).code, 1)
  add('untagged bundle is diagnosed as such', classify(untagged).reason, 'no-tagged-chunks')
  add('untagged bundle never reports OK', /\bOK\b/.test(classify(untagged).message), false)

  // --- PARTIAL tagging (review finding 2): the realistic shape of the same bug.
  // The first cut graded this GREEN on the theory that vendor chunks vary. They
  // do not: the live bundle tagged 8 of 8, vendor-react included. ---
  add('a partially tagged bundle FAILS (exit 1)', classify(partial).code, 1)
  add('a partially tagged bundle is diagnosed as such', classify(partial).reason, 'partially-tagged')
  add('a partially tagged bundle is NOT graded ok', classify(partial).reason === 'ok', false)
  add('a single tagged chunk among many untagged FAILS', classify({ ...partial, tagged: 1 }).code, 1)
  add(
    'the partial verdict names how many are untagged',
    classify(partial).message.includes('5 untagged'),
    true,
  )
  // The boundary in both directions: all-tagged passes, one-short fails.
  add('all-tagged is not the partial verdict', classify(healthy).code, 0)
  add('one chunk short of all-tagged IS the partial verdict', classify({ ...healthy, tagged: 7 }).reason, 'partially-tagged')

  // --- missing artifacts: the original invariant, still enforced ---
  add('a missing artifact FAILS (exit 1)', classify(missing).code, 1)
  add('a missing artifact is diagnosed as such', classify(missing).reason, 'missing-artifacts')
  add('the miss detail reaches the message', classify(missing).message.includes('debug_id=x'), true)

  // --- Sentry not ANSWERING is not the same as Sentry saying "no artifact"
  // (review finding 1). An expired token must never read as a broken upload. ---
  add('an unanswered lookup exits 2', classify(lookupDown).code, 2)
  add('an unanswered lookup is diagnosed as such', classify(lookupDown).reason, 'lookup-unavailable')
  add('an unanswered lookup is NOT a missing-artifact accusation', classify(lookupDown).reason === 'missing-artifacts', false)
  add(
    'an unanswered lookup says it is not evidence of a broken upload',
    classify(lookupDown).message.includes('NOT evidence'),
    true,
  )

  // --- could-not-measure: exit 2, and NEVER 0 ---
  add('no chunks discovered exits 2', classify({ discovered: 0, fetched: 0, tagged: 0, misses: [] }).code, 2)
  add('no chunk bodies fetched exits 2', classify({ discovered: 73, fetched: 0, tagged: 0, misses: [] }).code, 2)
  add(
    'an unfetchable bundle is NOT graded as an untagged build',
    classify({ discovered: 73, fetched: 0, tagged: 0, misses: [] }).reason,
    'no-chunks-fetched',
  )
  // Review finding 3: a one-chunk sample is an error page or a CDN placeholder,
  // and must resolve as could-not-measure BEFORE any build verdict claims it.
  add('a below-floor sample exits 2', classify({ discovered: 1, fetched: 1, tagged: 0, misses: [] }).code, 2)
  add(
    'a below-floor sample is NOT a build accusation',
    classify({ discovered: 1, fetched: 1, tagged: 0, misses: [] }).reason,
    'sample-too-small',
  )
  add(
    'the floor outranks even a missing-artifact miss',
    classify({ discovered: 1, fetched: 1, tagged: 1, misses: ['/assets/a.js debug_id=x'] }).reason,
    'sample-too-small',
  )
  add(
    'no zero-measurement state reports success',
    [
      classify({ discovered: 0, fetched: 0, tagged: 0, misses: [] }).code,
      classify({ discovered: 73, fetched: 0, tagged: 0, misses: [] }).code,
      classify({ discovered: 1, fetched: 1, tagged: 0, misses: [] }).code,
      classify(untagged).code,
      classify(lookupDown).code,
    ].some((c) => c === 0),
    false,
  )

  // --- the healthy direction: the guard must be able to PASS ---
  add('a healthy bundle passes (exit 0)', classify(healthy).code, 0)
  add('a healthy bundle is diagnosed as such', classify(healthy).reason, 'ok')

  // --- the sample is never overclaimed (review finding 4). MAX_CHUNKS truncates
  // 73 live chunks to 8, so a verdict that omits the population reads as full
  // coverage of the deploy when it covered 11% of it. ---
  add('the healthy message names the full population', classify(healthy).message.includes('73'), true)
  add('the healthy message names what was actually read', classify(healthy).message.includes('8'), true)
  add('the untagged message names the full population', classify(untagged).message.includes('73'), true)
  add('the missing-artifact message names the full population', classify(missing).message.includes('73'), true)

  // --- report() maps code to stream and returns the code unchanged ---
  add('report returns the verdict code', report(classify(healthy), NULL_LOG), 0)
  add('report returns a failure code unchanged', report(classify(untagged), NULL_LOG), 1)
  add('report returns a could-not-measure code unchanged', report(classify(lookupDown), NULL_LOG), 2)

  // --- the measurement floor helper is real ---
  let threw = false
  try {
    assertMeasured(1, MIN_CHUNKS, 'deployed chunks')
  } catch {
    threw = true
  }
  add('the chunk floor throws below MIN_CHUNKS', threw, true)
  let threwOnEnough = false
  try {
    assertMeasured(MIN_CHUNKS, MIN_CHUNKS, 'deployed chunks')
  } catch {
    threwOnEnough = true
  }
  add('the chunk floor is silent at MIN_CHUNKS', threwOnEnough, false)

  for (const c of cases) {
    const ok = c.actual === c.expected
    if (!ok) failed++
    log(`${ok ? '  ok  ' : '  FAIL'} ${c.name}${ok ? '' : ` (got ${JSON.stringify(c.actual)}, want ${JSON.stringify(c.expected)})`}`)
  }
  log('')
  log(
    failed === 0
      ? `PASS self-test -- ${cases.length} cases, every verdict proven in both directions.`
      : `FAIL self-test -- ${failed} of ${cases.length} case(s).`,
  )
  return failed === 0
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function text(url, opts, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(url, opts)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

/** Exported so the PLUMBING (network -> counters -> classify) is drivable, not
 *  just the decision. Review finding 5: the Sentry-error path lives here, not in
 *  classify(), so a canary that only drove classify() could not reach the very
 *  branch finding 1 was about. `deps.fetch` is injectable for exactly that. */
export async function main(deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch
  const token = process.env.SENTRY_READ_TOKEN || process.env.SENTRY_AUTH_TOKEN
  if (!token) {
    if (process.env.SOURCEMAP_CHECK_REQUIRE_TOKEN) {
      console.error('[dbid] FAIL: SENTRY_READ_TOKEN required here but not set.')
      return 1
    }
    // Genuinely cannot measure: no token, no lookup. Exit 2, not 0 -- a green
    // here is the same lie the rest of this file exists to stop telling. The
    // workflow sets SOURCEMAP_CHECK_REQUIRE_TOKEN=1, so CI takes the branch above.
    console.error('[dbid] SKIP: no SENTRY_READ_TOKEN/SENTRY_AUTH_TOKEN -- cannot grade this deploy.')
    return 2
  }

  // Pull distinct hashed /assets/*.js chunk URLs referenced by the live homepage.
  let html
  try {
    html = await text(SITE + '/', undefined, fetchImpl)
  } catch (err) {
    console.error(`[dbid] FAIL: could not fetch ${SITE}/ -- ${err.message}`)
    return 2
  }
  // `discovered` is the FULL population, counted before MAX_CHUNKS truncates the
  // sample. Reporting the truncated length as the denominator understated the
  // deploy by an order of magnitude (73 chunks live, 8 read) and made a partial
  // sample read as full coverage -- see classify()'s docblock, finding 4.
  const allChunks = [...new Set(html.match(/\/assets\/[A-Za-z0-9_-]+\.js/g) || [])]
  const chunkPaths = allChunks.slice(0, MAX_CHUNKS)

  let fetched = 0
  let tagged = 0
  let lookupErrors = 0
  const misses = []

  for (const p of chunkPaths) {
    let js
    try {
      js = await text(SITE + p, undefined, fetchImpl)
    } catch {
      // One unreadable chunk is tolerable; ZERO readable chunks is not, and
      // classify() grades that as could-not-measure rather than as health.
      continue
    }
    fetched++
    // The Sentry debug-id is embedded as `sentry-dbid-<uuid>` (and as the bare uuid
    // assigned into window._sentryDebugIds). A chunk without one isn't Sentry-tagged.
    const m = js.match(/sentry-dbid-([0-9a-f-]{36})/)
    if (!m) continue
    const debugId = m[1]
    tagged++

    const lookup = await fetchImpl(
      `${BASE}/projects/${ORG}/${PROJECT}/artifact-lookup/?debug_id=${debugId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    // A non-2xx lookup is Sentry failing to ANSWER, which is not the same fact
    // as Sentry answering "no artifact". Counting it as a miss turned an expired
    // token into a false accusation that the upload was broken (finding 1).
    if (!lookup.ok) {
      lookupErrors++
      continue
    }
    let arr
    try {
      arr = await lookup.json()
    } catch {
      // A 200 whose body is not JSON is equally an un-answered lookup.
      lookupErrors++
      continue
    }
    if (!(Array.isArray(arr) && arr.length > 0)) misses.push(`${p}  debug_id=${debugId}`)
  }

  const verdict = classify({ discovered: allChunks.length, fetched, tagged, misses, lookupErrors })

  // The MIN_CHUNKS floor lives INSIDE classify() now, ahead of every build
  // verdict, so it applies to the red paths too and resolves as exit 2 rather
  // than as a wrong accusation (finding 3). assertMeasured stays as the
  // belt-and-braces backstop on the green path: if the floor above ever stops
  // firing, this throws -> caught below -> non-zero, so a too-small sample can
  // never be reported as health by either route.
  if (verdict.code === 0) assertMeasured(fetched, MIN_CHUNKS, 'deployed chunks')

  return report(verdict)
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith('check-sourcemap-debugids.mjs')

if (invokedDirectly) {
  const KNOWN_FLAGS = ['--self-test']
  const unknown = process.argv.slice(2).filter((a) => !KNOWN_FLAGS.includes(a))
  if (unknown.length) {
    console.error(`[dbid] FAIL: unknown flag(s): ${unknown.join(' ')} (known: ${KNOWN_FLAGS.join(' ')})`)
    process.exitCode = 1
  } else if (process.argv.includes('--self-test')) {
    process.exitCode = selfTest() ? 0 : 1
  } else {
    process.exitCode = await main().catch((err) => {
      console.error(`[dbid] FAIL: ${err.message}`)
      return 1
    })
  }
}
