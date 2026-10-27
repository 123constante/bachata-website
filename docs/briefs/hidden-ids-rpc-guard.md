# Brief: GUARD-CI contract check for organiser_directory_hidden_ids_v1 (Website)

Lane: careful (workflow + scripts/** hard tier). Branch `claude/hidden-ids-rpc-guard`. Worker: Opus. Review: a different model (`--review-of`), ONE round (CI-guard rule). One slice = one branch = one push. No migration, no `supabase/**`, no prod write.
Owner click 2026-10-27: yes, queue and build. Plan: `~/.claude/plans/queued-hidden-ids-rpc-contract-guard.md`.

## Why
`organiser_directory_hidden_ids_v1()` (prod, 20270304210000, anon may execute, returns uuid[], never NULL) is the one source of rule D3. Three public reads call it through `src/lib/organiserDirectoryHiddenIds.ts` (`/organisers` list, sitemap, head count) and THROW on an RPC error. A rename or revoke would error `/organisers` and 500 the sitemap, and nothing in `db-contract-check.yml` would notice. D3 slice (draft `brief/d3-hidden-search-profile`) will add more callers.

## Build
1. `scripts/check-organiser-hidden-ids-contract.mjs`: call the RPC as ANON (same client setup and env as a neighbouring check, for example `scripts/check-added-session-room-contract.mjs`; copy its handling of 57014 statement timeouts and network blips as infra noise, not a defect: read the error body first). Assert: call succeeds; payload is an array (null or non-array = fail); every element is a uuid string; no duplicates. Empty array is GREEN (0 hidden is the normal state today). Print counts only, never ids.
2. Register as ONE step in `.github/workflows/db-contract-check.yml` (step name starts `Run `, prose-numbered like its neighbours; never pin the total in prose, count with the grep in CLAUDE.md). Add it to whatever list/ratchet the six rules in `docs/ci-guard-notes.md` and `scripts/check-script-conventions.mjs` require. READ those six rules first.
3. Self-test/canary per `docs/testing-doctrine.md`: a pure `check(payload)` core plus a `--self-test` with arms for null, non-array, non-uuid element, duplicate, empty (green), valid (green), and the exit-code convention. The canary must not touch the live DB.

## Verification (binding)
- Red first: show the self-test arms fail against a deliberately broken core, and a MUTATION run (revert each assertion in turn; every mutant must go red). A mutant with zero fail lines is the finding.
- Run the check once against prod (read-only) and paste the counts line.
- Run every step of every CI job that applies (read `.github/workflows`), per-job table in the PR body. Local Node 24 reds the unit gate: use Node 22 / the Dell (`remote-test.mjs`).
- Verified / Not verified block in the PR body. No UI change, so Design Gate does not apply (say so).

## Out of scope
The D3 search/profile slice, `useDirectoryCounts` (dead, leave), the sitemap `.limit(500)` ordering.
