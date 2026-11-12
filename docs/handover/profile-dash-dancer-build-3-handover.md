# Handover: dancer dashboard build, continuation 3 (admin 1534) -- PARTIAL

Branch `claude/profile-dash-dancer-build`, PR #1577. No DB change.

## Done
1. `dancer-area-isolation` fixed: docs and walk screenshots moved to `docs/handover/` (allowed doc prefix).
2. Calm Home: HomeHero, Going tile, NumbersTiles, PartnerTile, LineupPeople removed from `HomeScreen.tsx`; tests rewritten as absence checks.
3. Switch sheet grouped Dancer / Organiser with a "Showing" tag (no DJ side exists in profileSides).
4. Walk re-run 8 of 8, screenshots refreshed. Lint 34/34, vitest 98 files pass, mojibake clean.

## Left
- Remote jobs `contract-check`, `build-smoke`, `bundle-budget` were red on 035c3cd; logs not read (the tails fetched were cleanup noise). Read the failing step, fix in branch files.
- `npm run pre-ship` did not finish its build in the sandbox.
- Real-phone QA.

tsc run on 035c3cd: 0 errors in branch files (one existing error in untouched signOutStorageRace.test.tsx).
