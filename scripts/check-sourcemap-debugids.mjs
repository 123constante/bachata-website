#!/usr/bin/env node
// Deterministic sourcemap-health gate (no error traffic needed).
//
// Fetches the LIVE production bundle, reads each chunk's embedded Sentry debug-id,
// and asks Sentry whether a matching sourcemap artifact exists (artifact-lookup).
// If a deployed chunk carries a debug-id but Sentry has no sourcemap for it, the
// upload is broken and EVERY error on this release would stay minified — we fail.
//
// Why this beats check-sourcemaps-resolve.mjs: that one inspects recent ERROR
// events, so it can't validate a fresh release until something throws (and it
// can sit red/green on stale data). This validates the CURRENT deploy directly.
//
// Usage: node scripts/check-sourcemap-debugids.mjs
// Env:   SENTRY_READ_TOKEN (or SENTRY_AUTH_TOKEN), project:read + event:read.
//        SITE_URL (default https://www.bachatacalendar.co.uk)
//        SOURCEMAP_CHECK_REQUIRE_TOKEN=1 -> fail (not skip) when no token.
// Exit:  0 = healthy/skip ; 1 = broken upload or missing-token-when-required.

const ORG = 'bachata-community'
const PROJECT = 'bachata-website'
const BASE = 'https://sentry.io/api/0'
const SITE = (process.env.SITE_URL || 'https://www.bachatacalendar.co.uk').replace(/\/$/, '')
const MAX_CHUNKS = 8

const token = process.env.SENTRY_READ_TOKEN || process.env.SENTRY_AUTH_TOKEN
if (!token) {
  if (process.env.SOURCEMAP_CHECK_REQUIRE_TOKEN) {
    console.error('[dbid] FAIL: SENTRY_READ_TOKEN required here but not set.')
    process.exit(1)
  }
  console.warn('[dbid] No SENTRY_READ_TOKEN/SENTRY_AUTH_TOKEN — skipping.')
  process.exit(0)
}

async function text(url, opts) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

// Pull distinct hashed /assets/*.js chunk URLs referenced by the live homepage.
const html = await text(SITE + '/')
const chunkPaths = [...new Set((html.match(/\/assets\/[A-Za-z0-9_-]+\.js/g) || []))].slice(0, MAX_CHUNKS)
if (!chunkPaths.length) {
  console.error(`[dbid] FAIL: no /assets/*.js chunks found on ${SITE} — is the site up?`)
  process.exit(1)
}

let checked = 0
let missing = 0
const misses = []

for (const p of chunkPaths) {
  let js
  try {
    js = await text(SITE + p)
  } catch {
    continue
  }
  // The Sentry debug-id is embedded as `sentry-dbid-<uuid>` (and as the bare uuid
  // assigned into window._sentryDebugIds). A chunk without one isn't Sentry-tagged.
  const m = js.match(/sentry-dbid-([0-9a-f-]{36})/)
  if (!m) continue
  const debugId = m[1]
  checked++

  const lookup = await fetch(
    `${BASE}/projects/${ORG}/${PROJECT}/artifact-lookup/?debug_id=${debugId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const arr = lookup.ok ? await lookup.json() : []
  const has = Array.isArray(arr) && arr.length > 0
  if (!has) {
    missing++
    misses.push(`${p}  debug_id=${debugId}`)
  }
}

if (checked === 0) {
  console.warn('[dbid] No Sentry-tagged chunks found in the live bundle — skipping.')
  process.exit(0)
}

if (missing > 0) {
  console.error(
    `[dbid] FAIL: ${missing}/${checked} deployed chunk(s) have a debug-id with NO matching ` +
      `sourcemap uploaded to Sentry — prod errors on this release will stay minified.\n` +
      misses.map((s) => `    ${s}`).join('\n'),
  )
  process.exit(1)
}

console.log(`[dbid] OK: all ${checked} Sentry-tagged chunk(s) have a matching uploaded sourcemap.`)
process.exit(0)
