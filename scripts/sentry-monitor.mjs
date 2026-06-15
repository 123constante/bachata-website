#!/usr/bin/env node
// Sentry monitor — three modes, one shared noise classifier.
//
//   node scripts/sentry-monitor.mjs digest         (default)
//   node scripts/sentry-monitor.mjs tokens
//   node scripts/sentry-monitor.mjs resolve-noise [--dry-run]
//
// digest:        list ACTIONABLE open issues (known noise filtered out). Exits 1
//                if any actionable issue is NEW within DIGEST_NEW_DAYS — so the
//                daily workflow only "pings" (fails) on genuinely new problems.
// tokens:        verify the Sentry tokens still authenticate (catch expiry BEFORE
//                it silently breaks the next deploy's sourcemap upload).
// resolve-noise: resolve injected/third-party-script issues automatically.
//
// Tokens (env): SENTRY_READ_TOKEN  (read: digest + classify)
//               SENTRY_UPLOAD_TOKEN (org:ci: liveness of the sourcemap-upload token)
//               SENTRY_WRITE_TOKEN  (issue:write: resolve-noise)
// Knobs:        DIGEST_ACTIVE_DAYS=7  DIGEST_NEW_DAYS=2  DIGEST_MIN_HITS=3

const ORG = 'bachata-community'
const PROJECT = 'bachata-website'
const BASE = 'https://sentry.io/api/0'
const MODE = process.argv[2] || 'digest'
const DRY = process.argv.includes('--dry-run')

const READ = process.env.SENTRY_READ_TOKEN || process.env.SENTRY_AUTH_TOKEN
const ACTIVE_DAYS = Number(process.env.DIGEST_ACTIVE_DAYS || 7)
const NEW_DAYS = Number(process.env.DIGEST_NEW_DAYS || 2)
const MIN_HITS = Number(process.env.DIGEST_MIN_HITS || 3)

const api = (path, token, opts = {}) =>
  fetch(`${BASE}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } })

async function apiJson(path, token, opts) {
  const res = await api(path, token, opts)
  if (!res.ok) throw new Error(`Sentry ${res.status} ${path}: ${(await res.text()).slice(0, 160)}`)
  return res.json()
}

const daysAgo = (iso, nowMs) => (nowMs - Date.parse(iso)) / 86_400_000

// --- shared noise classifier --------------------------------------------------
// Mirrors src/lib/sentry.ts: an event whose every frame lacks a real source
// location is injected/third-party. Plus title-level network-abort / stale-chunk.
const JUNK = new Set(['', 'undefined', 'null', '<anonymous>', '[native code]', '?'])
const NETWORK_RE = /Load failed|Failed to fetch|NetworkError when attempting/i
const STALECHUNK_RE = /valid JavaScript MIME type|dynamically imported module|Importing a module script|Unable to preload CSS|Loading chunk \d+ failed/i

function framesAllJunk(event) {
  const vals = event?.entries?.find((e) => e.type === 'exception')?.data?.values ?? []
  let saw = false
  for (const v of vals) for (const f of v?.stacktrace?.frames ?? []) {
    saw = true
    const loc = (f.absPath || f.filename || '').trim()
    if (loc && !JUNK.has(loc)) return false
  }
  return saw
}

// Returns 'network' | 'stalechunk' | 'injected' | null(actionable). Fetches the
// latest event only when the title alone can't decide.
async function classify(issue) {
  const t = issue.title || ''
  if (NETWORK_RE.test(t)) return 'network'
  if (STALECHUNK_RE.test(t)) return 'stalechunk'
  try {
    const ev = await apiJson(`/organizations/${ORG}/issues/${issue.id}/events/latest/`, READ)
    if (framesAllJunk(ev)) return 'injected'
  } catch { /* if we can't fetch, treat as actionable */ }
  return null
}

function requireRead() {
  if (!READ) { console.error('[monitor] SENTRY_READ_TOKEN/SENTRY_AUTH_TOKEN required.'); process.exit(1) }
}

// --- mode: tokens -------------------------------------------------------------
async function tokens() {
  const checks = [
    ['SENTRY_READ_TOKEN', READ, `/organizations/${ORG}/issues/?query=is:unresolved&limit=1`],
    ['SENTRY_UPLOAD_TOKEN', process.env.SENTRY_UPLOAD_TOKEN, `/organizations/${ORG}/releases/?per_page=1`],
    ['SENTRY_WRITE_TOKEN', process.env.SENTRY_WRITE_TOKEN, `/organizations/${ORG}/issues/?query=is:unresolved&limit=1`],
  ]
  let bad = 0, tested = 0
  for (const [name, tok, probe] of checks) {
    if (!tok) { console.log(`  ${name.padEnd(20)} (not set — skipped)`); continue }
    tested++
    const res = await api(probe, tok).catch(() => ({ status: 0 }))
    const ok = res.status >= 200 && res.status < 400
    console.log(`  ${name.padEnd(20)} HTTP ${res.status}  ${ok ? 'OK' : 'FAIL'}`)
    if (!ok) bad++
  }
  if (tested === 0) { console.warn('[monitor] no tokens to test.'); process.exit(0) }
  if (bad) { console.error(`[monitor] tokens FAIL: ${bad} token(s) no longer authenticate — re-mint before the next deploy.`); process.exit(1) }
  console.log(`[monitor] tokens OK: ${tested} token(s) authenticate.`)
}

// --- mode: digest -------------------------------------------------------------
async function digest() {
  requireRead()
  const now = Date.now()
  const issues = await apiJson(`/organizations/${ORG}/issues/?query=${encodeURIComponent('is:unresolved')}&limit=25`, READ)
  const actionable = []
  for (const i of issues) {
    if (daysAgo(i.lastSeen, now) > ACTIVE_DAYS) continue
    if ((i.count ?? 0) < MIN_HITS) continue
    const kind = await classify(i)
    if (kind) continue // noise
    actionable.push({ ...i, isNew: daysAgo(i.firstSeen, now) <= NEW_DAYS })
  }
  actionable.sort((a, b) => (b.count ?? 0) - (a.count ?? 0))

  if (!actionable.length) {
    console.log(`[digest] No actionable issues (active ${ACTIVE_DAYS}d, ≥${MIN_HITS} hits, noise filtered). All quiet.`)
    return
  }
  console.log(`\n=== Sentry actionable digest — ${actionable.length} issue(s) ===`)
  for (const i of actionable) {
    console.log(`${i.isNew ? '🆕' : '  '} ${i.shortId}  ${i.count} hits  ${i.title.slice(0, 70)}`)
    console.log(`     ${i.culprit || ''}  https://${ORG}.sentry.io/issues/${i.id}/`)
  }
  const fresh = actionable.filter((i) => i.isNew)
  if (fresh.length) {
    console.error(`\n[digest] ${fresh.length} NEW actionable issue(s) in the last ${NEW_DAYS}d — needs a look.`)
    process.exit(1) // ping via workflow failure
  }
  console.log(`\n[digest] ${actionable.length} active, none new in ${NEW_DAYS}d.`)
}

// --- mode: resolve-noise ------------------------------------------------------
async function resolveNoise() {
  requireRead()
  const WRITE = process.env.SENTRY_WRITE_TOKEN
  if (!WRITE && !DRY) { console.warn('[resolve-noise] SENTRY_WRITE_TOKEN not set — skipping (use --dry-run to preview).'); process.exit(0) }
  const issues = await apiJson(`/organizations/${ORG}/issues/?query=${encodeURIComponent('is:unresolved')}&limit=25`, READ)
  let n = 0
  for (const i of issues) {
    if (await classify(i) !== 'injected') continue
    n++
    if (DRY) { console.log(`  [dry] would resolve ${i.shortId} — ${i.title.slice(0, 50)}`); continue }
    const res = await api(`/organizations/${ORG}/issues/${i.id}/`, WRITE, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }),
    })
    console.log(`  ${res.ok ? 'resolved' : 'FAILED(' + res.status + ')'} ${i.shortId} — ${i.title.slice(0, 50)}`)
  }
  console.log(`[resolve-noise] ${DRY ? 'would resolve' : 'resolved'} ${n} injected-noise issue(s).`)
}

const run = { digest, tokens, 'resolve-noise': resolveNoise }[MODE]
if (!run) { console.error(`[monitor] unknown mode "${MODE}" (digest|tokens|resolve-noise)`); process.exit(2) }
await run()
