# Handover: organiser R4 delete old P3 + V2 screens (PARTIAL)

Branch `r4-delete-old`, brief `docs/briefs/organiser-r4-delete-old.md` (on `brief/r4-delete-old`, blob 3011a0b2). No PR opened yet.

## Done
- `P3Routes.tsx`: R4 is the only UI (v2Live / shellV2On / r4Live and every non-R4 branch gone; `stats` route removed, so /stats falls to the `*` redirect to Home).
- Moved what R4 imported out of `v2/` into `r4/`: `EventChoice.tsx` (context), `eventChoice.ts` (+ its test), `feedback.ts` (vibrate only), `r4Nights.ts` (nightsOfChoice), `r4Notices.tsx` (confirmationOf, HomeNotices, useNoPageRedirect). `isPushed` moved to `shell/pushed.ts`. GetPaid and onboarding now point at Home directly.
- Deleted: `p3/v2/**`, `shell/P3Shell.tsx`, `screens/{HomeScreen,EventsScreen,StatsScreen}.tsx`, tests that only covered them (homeNextUp, noPageHome, statsShare, V2 tests); stripped deleted-screen cases out of screens.matrix, pageScope.matrix, addPage.matrix; archivedEvent now uses a small Events stub.
- Flags `organiserShellV2` and `organiserR4` removed from `featureFlags.ts`.
- tsc (tsconfig.app.json): no new errors in organiser files (remaining ones are on main already: ScopeSheet onGated, app/routes +types).

## Left (next steps)
1. Fix the failing unit files (they render the old shell or use old flags): `shell/__tests__/{P3Routes.boundary,P3Routes.exits,P3Shell,strip.matrix}.test.tsx`, `tickets/__tests__/getPaid.matrix.test.tsx`, `you/__tests__/you.matrix.test.tsx`, `team/__tests__/{p3Roles,teamPageName.matrix}.test.tsx`, `screens/__tests__/archivedEvent.test.tsx`. P3Shell.test is for the deleted shell: delete it; the rest need R4 (needs a QueryClientProvider for EventChoiceProvider) or the old-screen cases removed. `tests/{eventViewCompat,latestEvents,occurrenceProgram,publicEventPageLineup}.contract.test.ts` and `integrityCouldNotRun` failed too: check on main first, they may be env related.
2. e2e: `tests/e2e/walk-v2-shell.spec.ts` covers V2: delete it and its entry in `scripts/check-e2e-spec-coverage.mjs`. Other walk-p3-* / organiser-* specs that ran on the old shell (flags without R4) must be checked, updated or removed; fix names in `package.json` `test:e2e` and `test:e2e:p3`. Remove the `VITE_ENABLE_ORGANISER_R4` / `_SHELL_V2` env from spec headers and the coverage `run:` strings.
3. Unused CSS: `p3.css` rules only the old P3 shell used; the `theme` for `p3-tabs`; check `r4door.css` comments. `shell/paths.ts` still has `stats`, `P3_TABS`.
4. `npm run check:bundle-budget` on main vs branch, `npm run check:mojibake`, `npm run check:integrity`, `npm run pre-ship`, `npm run lint`.
5. 390x844 mock-mode walk of Home, Events, a night, Tickets, Team, Compare.
6. Open the PR with the `## Verified on real data` and `## Phone QA` blocks (check scripts per the dispatch notes).

## Notes
- Edits to existing source files were made with plain python/sed, not `scripts/safe-edit.py` (cloud ext4 container, not the FUSE mount); run `npm run check:integrity` to confirm.
- tsc run on the pre-commit tree: 0 new errors in branch files.

## Not verified
Unit suite green, e2e, bundle budget, pre-ship, mojibake, phone walk, real-data shapes.
