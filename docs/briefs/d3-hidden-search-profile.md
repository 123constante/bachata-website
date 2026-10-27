# Brief: D3 gap -- hidden organisers in site search and on /organisers/:id (Website)

Status: DRAFT 2026-10-27, not dispatched. Owner click 2026-10-27: do this in the NEXT organiser arc; draft now, dispatch later.
Lane: Normal (Website only, no migration, no `supabase/**`). One slice = one branch = one push.
Branch for the worker: `claude/d3-hidden-search-profile`. Worker model: Opus. Context cap: Normal lane (50%, nothing new at 45%).

## Why
Rule D3: a LIVE organiser page that was self-started and is not yet visible (no published event, not Trusted) is left out of every public directory read. F1 (#1061, df70ec8d) enforced it on three reads: the `/organisers` list, the head-only count, the sitemap. Two reads still leak it:
1. Site search returns hidden organisers.
2. `/organisers/:id` serves a hidden page 200 and indexable.

## The one rule source (reuse, do not copy)
`src/lib/organiserDirectoryHiddenIds.ts`: `fetchOrganiserDirectoryHiddenIds(client)`, `withoutHiddenOrganisers(rows, ids)`, `hiddenIdsNotFilter(ids)`. It wraps `organiser_directory_hidden_ids_v1()` (prod, applied as 20270304210000, anon may execute, returns uuid[], never NULL). An RPC error THROWS (fail closed). Call it ONCE per read, never per id. Do not add a second copy of the rule.

## Slice A -- search
CORRECTION to the F1 handover: it names `search_public_v2`; that is stale. Live search paths (read each, prove which run in prod by the flags in `src/lib/featureFlags.ts`):
- `src/hooks/useSearchResults.ts` -- `search_public_v7` / `v6` / `v5` / `v4` by flag (the /search page and the overlay).
- `src/lib/searchRpc.ts` -- `searchPublicV3` (used by `src/hooks/usePublicSearch.ts`) and the older `searchPublic`.
Find every place organiser rows come out of these, and subtract hidden ids in JS with the shared helper. Check how the v7 "one row per human" shape carries an organiser role (a person row can hold an organiser role; decide by reading, state it in the PR). Result counts and "no results" states must follow the filtered list, not the raw one. Do not change any RPC.

## Slice B -- /organisers/:id
`app/routes/organiser.tsx` (SSR loader) and `src/pages/OrganiserProfile.tsx`. A hidden id must not be served as a normal indexable page. Required: decide the response with the owner's rule in mind:
- The organiser's own team (owner/admin/team member) must STILL see their own page (they are the people who need to finish it). Find how `OrganiserProfile` already knows the viewer is on the team; do not invent a new check.
- Everyone else: not-found treatment, same as an unknown id (status 404 or the existing not-found view; pick what the route already does for a missing organiser and say which in the PR), plus `noindex`.
- Fail closed on RPC error for the anonymous path? NO for page loads: an RPC outage must not take every organiser page down. Decide and state it: on RPC error serve the page with `noindex` and log; document this as the one deliberate fail-open and why.
Open question for the orchestrator before the worker starts (owner click, one question): hidden page for a visitor = 404, or a soft "this page is not live yet" view? Default: 404.

## Real-data verification (binding, all five)
1. Survey on prod, read-only counts: hidden ids now (expected 0, meta rows 0), organiser rows live, by city. Because there are 0 hidden organisers today, the tests and the walk need a FIXTURE hidden id; say so plainly. Do NOT create a prod hidden organiser.
2. Table-driven consistency tests: every search path x {no hidden, one hidden, all results hidden, RPC error, null data}; profile route x {hidden + anon, hidden + team member, visible, unknown id, RPC error}. Red first on unfixed code.
3. Run every CI job step (read `.github/workflows`); put the per-job table in the PR body.
4. Walk at 390x844 on a Vercel-free path (preview is behind SSO): `laptop-walk.mjs --branch` on the Dell.
5. PR body carries a Verified / Not verified block.

## Hard limits
Supabase read-only. Never merge or approve. Never `--no-verify`. Bot-authored PR (branch `claude/**`). Plain git, no `gh api`. No shell variables or loops. Push early checkpoint, push + handover before stopping. No prod data write. No UI visual change (copy for the 404 view reuses the existing view), so the Design Gate does not apply; say so in the PR.

## Out of scope
`useDirectoryCounts` (dead code, owner: leave). Sitemap `.limit(500)` ordering. A `db-contract-check` step for the RPC (separate small GUARD-CI item, worth queueing).
