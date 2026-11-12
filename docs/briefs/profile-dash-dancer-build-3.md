# Dancer dashboard build, continuation 3 (admin #1534)
Lane normal. Branch `claude/profile-dash-dancer-build`, PR #1577 already open. Read first: `docs/briefs/profile-dash-dancer-build-2-handover.md`, `docs/briefs/profile-dash-dancer-build-handover.md`, original brief `docs/briefs/profile-dash-dancer-build.md` (git show origin/brief/profile-dash-dancer-build:...). No DB change, no supabase/**, Supabase read-only.

Do the "Left" list, in order:
1. Fix the failing PR check `dancer-area-isolation` (run its script locally, read why it fails, fix the cause in branch files only).
2. Calm first screen: remove HomeHero, Going tile, NumbersTiles, PartnerTile, LineupPeople from under the main card on Home (Going and Nights attended live per original brief fix list; no headline zero). Update the tests that pinned them (table-driven, screen x shape).
3. Switch sheet: group Dancer / DJ / Organiser, "Showing" tag on the current one (not only a tick), + Add a profile.
4. Re-walk 390x844 (stub, unfinished, complete, unclaimed match, one profile, three profiles), refresh screenshots in docs/design/profile-dash/walk/, update docs/design/profile-dash-dancer-build.md and the PR body (exact label lines; run both PR-body checks).
5. `npm run lint`, vitest affected dirs, `npm run pre-ship` if it runs; put a per-job CI table in the PR; list anything not run under Not verified.

Final commit subject ends `[worker-done <ticket>]`; keep PARTIAL only if something above is undone.
