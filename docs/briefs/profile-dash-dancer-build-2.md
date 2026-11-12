# Dancer dashboard build, continuation 2 (admin #1534)
Lane normal. Branch `claude/profile-dash-dancer-build` (already has the first worker's commit 5ef8a50). Read first: `docs/briefs/profile-dash-dancer-build-handover.md` and the original brief `docs/briefs/profile-dash-dancer-build.md` (git fetch origin brief/profile-dash-dancer-build; git show FETCH_HEAD:docs/briefs/profile-dash-dancer-build.md). Same rules: no DB change, no supabase/**, Supabase read-only.

## Do the "Left" list from the handover, in order
1. Switch sheet + role strip (top right), Add a profile sheet, Account sheet. One profile = button reads "Account", no Switch (SwitcherGate.tsx), per the original brief.
2. Edit screen journey: no hardcoded name/city; untouched Save sends nothing and says why it is off.
3. Component tests for HomeMainCard / ClaimYourPage rendering each claim status (linked, no_match, ambiguous, email_unproven, unavailable).
4. Walk at 390x844 on prod-shaped data (stub, unfinished, complete, unclaimed match, one profile, three profiles); screenshots into docs/design/profile-dash/; `docs/design/<pr>.md`; open the PR with the exact Verified on real data / Phone QA blocks; per-job CI table in the PR.
5. Run `npm run lint` and the CI jobs you can; list any not run under Not verified.

Final commit subject ends `[worker-done <ticket>]` (drop PARTIAL only if all 5 are done).
