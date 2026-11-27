# team-visibility-cache (Website, BUILD-non-visual)

Brief-version: 2
Lane: Website. Model: Sonnet, medium. Queue: A. Branch: `claude/team-visibility-cache`.
Serves: `docs/scoping/queue-organiser-ticketing-2026-11-04.md` Q2.

## What main lacks
- After an organiser shows or hides someone on the page's public team, the public organiser page (and any cached read of it) can stay stale for up to the cache time. FLIP-READINESS 10-31 F-33 "Gap: `team/publicTeamApi.ts` (team visibility) does not invalidate". Still true: `grep -n invalidate src/modules/organiser/team/publicTeamApi.ts` is empty; `setShownOnPublicTeam` (`publicTeamApi.ts:36-41`) calls the RPC and returns. The other writers call `invalidatePublicEventCaches` (`shared/publicCache.ts:23`). -- `src/modules/organiser/team/publicTeamApi.ts`, `team/PublicToggle.tsx`, `shared/publicCache.ts`
- extends: FIRST find out which query actually shows the team on the public page (start from `src/pages/OrganiserProfile.tsx` and its hook; `publicTeamQueryKey` at `publicTeamApi.ts:12` is the organiser-side read). If the public page does not cache the team (SSR/no react-query), say so in the handover, add only the organiser-side invalidation, and stop. Do not invent a cache root. -- src/pages/OrganiserProfile.tsx

## Files
- `src/modules/organiser/shared/publicCache.ts` (add a root constant + `invalidatePublicOrganiserCaches(qc)` ONLY if a public query exists), `team/PublicToggle.tsx` (call it on success), tests in `src/modules/organiser/shared/__tests__/publicCache.test.tsx` (it has a grep-driven completeness case: extend it so a team writer without invalidation is red).

## Rules
No migration, no flag change, no UI change. Never skip a test. Tests red first against main.

## Tests red first
Toggle success -> the public query is invalidated (red on main). Toggle failure (`PUBLIC_TEAM_FULL`) -> nothing invalidated. `unchanged` status -> nothing invalidated.

## Phone QA
Docs/tests/non-visual: delete the whole `## Phone QA` section of the PR body if no `.tsx` UI path changes (a `PublicToggle.tsx` edit is `.tsx`: then write "Sizes checked: 390x844", walk the toggle once, "Not verified: ..." honestly). Shapes: team of 1, a team already at the 20 cap, owner vs manager.

## Done
Short handover; PR body per checker scripts.
