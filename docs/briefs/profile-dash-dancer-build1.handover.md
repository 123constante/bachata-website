# Handover: dancer dashboard slice 1 (admin #1534), PARTIAL

Branch `claude/profile-dash-dancer-build1`. No DB change. No organiser files touched.

## Done
- `screens/home/homeModel.ts`: pure Home mapping (D1 new / D2 unfinished / D3 complete, Nights attended = `my_dancer_stats_v1.nights_went`, claim copy per status). Step words come from `api/nextStep.ts`.
- `screens/home/homeOptionA.tsx`: Option A view + `ClaimCard` (D4: the button re-runs the existing no-arg `claim_my_dancer_profile_v1()` and draws linked / already_linked / no_match / ambiguous / email_unproven / not_applicable / unavailable).
- `HomeScreen.tsx` now renders Option A (no-profile branch = ClaimCard + NoProfileWayOut). Critique fixes applied: 1 (no tappable numbers row), 2 (progress once), 3 (one CTA on D3 empty), 4 (preview row names what is missing), 6 (no "This is not me"/"Start fresh" control; claim status drawn), 7 (no "In beta" / "counts the day after" copy).
- `screens/home/__tests__/homeOptionA.test.tsx`: 77 table-driven tests (every DANCER_SHAPES profile x went null/0/12; every claim status).

## Left (why this is PARTIAL)
1. **109 existing tests fail** because they assert the OLD Home (hero night tile, strength ring tile, going tile, NumbersTiles strip, PartnerTile, LineupPeople). Counts by file: b1bAppScreens 16, b1bFinishFixes 13, emberRestyle 5, homeFixPass 11, journeyConsistency 10, homeAudit 16, tests/client/dancerAppHomeNights 19, dancerAppRealDataFixes 1, dancerAppReviewFixes 1, dancerAppReviewFixesScreens 17. Owner call needed: retire those tiles from Home (design says so) and rewrite/delete the assertions, or keep some (PartnerTile, LineupPeople, RateNudge is still rendered). `PartnerTile`, `LineupPeople`, `NumbersTiles`, `HomeHero` are now unused on Home (files left in place).
2. Edit screen (fix 5: follow the journey, only real controls, untouched Save sends nothing) NOT changed; existing EditScreen already has editModel tests, not re-audited.
3. Role strip / Switch sheet (one-profile accounts read "Account", fix 7) NOT changed; existing `SwitcherGate` shows Switch only with 2+ profiles.
4. Not done: shape survey SELECT (Supabase MCP not used), 390x844 screenshots (6 required), `docs/design/<pr>.md`, PR, per-job CI table, `npm run pre-ship`, `check:mojibake` full run.

## Next steps
Decide item 1, update the 10 test files, then edit/switch work, screenshots, PR with the Verified / Phone QA blocks.

Verified: new test file 77/77 passes. Not verified: everything under Left.
tsc run on the commit before this handover: 0 errors.
