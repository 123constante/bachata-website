#!/usr/bin/env node
// Sourcemap drift monitor: verify recent production Sentry events resolve to
// ORIGINAL source (e.g. EventMap.tsx:241) rather than minified chunks
// (/assets/index-*.js). Unresolved frames mean the sourcemap upload broke (missing
// Vercel credential, or a release-name mismatch between @sentry/vite-plugin and the
// runtime VITE_VERCEL_GIT_COMMIT_SHA) — which makes every prod error undebuggable.
//
// SCOPE: this inspects the most-recent unresolved prod issues, NOT a specific
// release — right after a deploy the new release usually has no errors yet, so it
// cannot prove "this exact build's maps resolve". It is a DRIFT MONITOR (the daily
// cron is its real value), not a per-deploy proof. It catches a broken upload
// within ~24h of the first error on the bad release.
//
// Usage: node scripts/check-sourcemaps-resolve.mjs
// Requires: SENTRY_READ_TOKEN (or SENTRY_AUTH_TOKEN) with project:read + event:read.
// Exit codes: 0 = resolved (or intentionally skipped); 1 = unresolved OR missing
// token when SOURCEMAP_CHECK_REQUIRE_TOKEN is set (trusted CI).

const ORG = 'bachata-community'
const PROJECT = 'bachata-website'
const BASE = 'https://sentry.io/api/0'

const token = process.env.SENTRY_READ_TOKEN || process.env.SENTRY_AUTH_TOKEN
if (!token) {
  // On trusted CI (base-repo schedule/deployment_status) the workflow sets
  // SOURCEMAP_CHECK_REQUIRE_TOKEN=1, so a forgotten/renamed secret FAILS loudly
  // instead of silently going green. Forks/local runs (no flag) just skip.
  if (process.env.SOURCEMAP_CHECK_REQUIRE_TOKEN) {
    console.error(
      '[sourcemaps] FAIL: SENTRY_READ_TOKEN is required here but not set — the guard ' +
        'cannot run. Add the SENTRY_READ_TOKEN repo secret (project:read + event:read).',
    )
    process.exit(1)
  }
  console.warn(
    '[sourcemaps] No SENTRY_READ_TOKEN/SENTRY_AUTH_TOKEN — skipping the resolve check.',
  )
  process.exit(0)
}

async function sentryFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Sentry API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return res.json()
}

// A frame is "resolved to original source" when its path points at a .ts/.tsx
// file rather than a built /assets/*.js chunk.
const isResolvedFrame = (f) => {
  const p = f?.absPath || f?.filename || ''
  return /\.tsx?(\?|$)/.test(p) && !p.includes('/assets/')
}

const inAppFrames = (event) => {
  const out = []
  for (const v of event?.entries?.find((e) => e.type === 'exception')?.data?.values ?? []) {
    for (const f of v?.stacktrace?.frames ?? []) if (f.inApp) out.push(f)
  }
  return out
}

// Pull recent PRODUCTION issues and inspect their latest event's in-app frames.
// We only assert on issues that HAVE in-app frames (skip pure third-party/injected
// noise, which legitimately has none). If every such issue is minified, the upload
// is broken.
const issues = await sentryFetch(
  `/projects/${ORG}/${PROJECT}/issues/?query=${encodeURIComponent(
    'is:unresolved environment:production',
  )}&limit=15`,
)

let inspected = 0
let resolved = 0
const minifiedSamples = []

for (const issue of issues) {
  let event
  try {
    event = await sentryFetch(
      `/organizations/${ORG}/issues/${issue.id}/events/latest/`,
    )
  } catch {
    continue
  }
  const frames = inAppFrames(event)
  if (!frames.length) continue // injected/third-party — no app frames to resolve
  inspected++
  if (frames.some(isResolvedFrame)) {
    resolved++
    break // one resolved issue is enough to prove maps work — stop the API calls
  }
  minifiedSamples.push(`${issue.shortId}: ${frames[0]?.absPath || frames[0]?.filename}`)
}

if (inspected === 0) {
  console.warn('[sourcemaps] No production issues with in-app frames to check — skipping.')
  process.exit(0)
}

if (resolved === 0) {
  console.error(
    `[sourcemaps] FAIL: ${inspected} production issue(s) inspected, NONE resolve to original source.\n` +
      `  Sourcemap upload is broken (missing Vercel credential or release-name mismatch).\n` +
      minifiedSamples.map((s) => `    ${s}`).join('\n'),
  )
  process.exit(1)
}

console.log(
  `[sourcemaps] OK: ${resolved}/${inspected} production issue(s) resolve to original .ts/.tsx source.`,
)
process.exit(0)
