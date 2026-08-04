#!/usr/bin/env node
// Pull a Vercel deployment's BUILD LOG via the API — no browser/login needed.
// Prints the lines relevant to Sentry sourcemap upload (or all with --all).
//
// Setup (one-time): create a Vercel token at
//   https://vercel.com/account/settings/tokens  (scope: read is enough)
// then: export VERCEL_TOKEN=... (or add to admin .env.local)
//
// Usage:
//   node scripts/fetch-vercel-build-log.mjs              # latest prod deploy, sentry lines
//   node scripts/fetch-vercel-build-log.mjs --all        # full log
//   VERCEL_PROJECT=bachata-website node scripts/fetch-vercel-build-log.mjs

const TOKEN = process.env.VERCEL_TOKEN
if (!TOKEN) {
  console.error('[vercel-log] VERCEL_TOKEN not set. Create one at https://vercel.com/account/settings/tokens (read scope).')
  process.exit(1)
}
const PROJECT = process.env.VERCEL_PROJECT || 'bachata-website'
const TEAM = process.env.VERCEL_TEAM_ID ? `&teamId=${process.env.VERCEL_TEAM_ID}` : ''
const ALL = process.argv.includes('--all')
const API = 'https://api.vercel.com'
const h = { headers: { Authorization: `Bearer ${TOKEN}` } }

async function j(url) {
  const res = await fetch(url, h)
  if (!res.ok) throw new Error(`${res.status} ${url}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// 1) resolve project id
const proj = await j(`${API}/v9/projects/${PROJECT}?${TEAM.slice(1)}`).catch(() => null)
const projectId = proj?.id
if (!projectId) {
  console.error(`[vercel-log] couldn't resolve project "${PROJECT}". Check the name / token scope.`)
  process.exit(1)
}

// 2) latest production deployment
const deps = await j(`${API}/v6/deployments?projectId=${projectId}&target=production&limit=1${TEAM}`)
const dep = deps.deployments?.[0]
if (!dep) {
  console.error('[vercel-log] no production deployments found.')
  process.exit(1)
}
console.log(`[vercel-log] deployment ${dep.uid}  (${dep.url})  state=${dep.readyState || dep.state}  created=${new Date(dep.created).toISOString()}`)

// 3) build log events
const events = await j(`${API}/v3/deployments/${dep.uid}/events?builds=1&limit=5000${TEAM}`)
const lines = (Array.isArray(events) ? events : [])
  .map((e) => (e.text ?? e.payload?.text ?? '').replace(/\x1b\[[0-9;]*m/g, '').trimEnd())
  .filter(Boolean)

const RE = /sentry|debug.?id|source.?map|upload|artifact|bundled|warn|error|release/i
const out = ALL ? lines : lines.filter((l) => RE.test(l))
console.log(`[vercel-log] ${lines.length} log lines total; showing ${out.length}${ALL ? ' (all)' : ' (sentry-relevant)'}\n`)
console.log(out.join('\n'))
