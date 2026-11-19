# Handover: organiser R4 delete old P3 + V2 screens (PARTIAL, continuation 2)

Branch `r4-delete-old`, brief `docs/briefs/organiser-r4-delete-old.md` (on `brief/r4-delete-old`, blob 3011a0b2). No PR opened yet.

## Done
- `P3Routes.tsx`: R4 is the only UI (v2Live / shellV2On / r4Live and every non-R4 branch gone; `stats` route removed, so /stats falls to the `*` redirect to Home).
- Moved what R4 imported out of `v2/` into `r4/`: `EventChoice.tsx` (context), `eventChoice.ts` (+ its test), `feedback.ts` (vibrate only), `r4Nights.ts` (nightsOfChoice), `r4Notices.tsx` (confirmationOf, HomeNotices, useNoPageRedirect). `isPushed` moved to `shell/pushed.ts`. GetPaid and onboarding now point at Home directly.
- Deleted: `p3/v2/**`, `shell/P3Shell.tsx`, `screens/{HomeScreen,EventsScreen,StatsScreen}.tsx`, tests that only covered them (homeNextUp, noPageHome, statsShare, V2 tests); stripped deleted-screen cases out of screens.matrix, pageScope.matrix, addPage.matrix; archivedEvent now uses a small Events stub.
- Flags `organiserShellV2` and `organiserR4` removed from `featureFlags.ts`.
- tsc (tsconfig.app.json): no new errors in organiser files (remaining ones are on main already: ScopeSheet onGated, app/routes +types).

## Done (continuation, dt_52247bd4ee7e)
- Item 1 DONE: organiser unit suite green (364 files, 14136 passed). Deleted `shell/__tests__/P3Shell.test.tsx`. Route tests (`P3Routes.exits`, `.boundary`, `you.matrix`) now assert R4's frame (`r4-shell`, QueryClientProvider for EventChoice); boundary case for the event page moved to `/events/:id/all` (R4Night is at `/events/:id`). Removed cases that only covered deleted UI: the rendered role strip and X1 account entry (old P3 shell), the old Team page at You > Team (`Team in P3 x shape`, F1/F3/F4/F6/F7/F9, r2 decline, Team rows in teamPageName/p3Roles) - R4Team has its own tests in `r4/__tests__`. `archivedEvent` stub reads `p3Toast` (what EventPage sends). getPaid source check no longer reads the deleted HomeScreen.
- `tests/*.contract.test.ts` and `integrityCouldNotRun` fail on env only (no live Supabase key: "Invalid API key"/fetch failed; temp-repo typescript precondition) - not branch related.
- Item 2 PART: deleted `walk-v2-shell.spec.ts` and `walk-tickets-a.spec.ts` (V2 walks) + their coverage entries; dropped `VITE_ENABLE_ORGANISER_R4/_SHELL_V2` from spec headers and coverage `run:` strings. `check-e2e-spec-coverage` OK.
- Item 3 PART: `paths.ts` lost `stats`, `P3Tab`, `P3_TABS`. `.p3-tabs`/`.p3-tab` CSS KEPT on purpose: geometry specs (p3-toast-geometry, p3-w3b2-geometry, walk-w3c-1-repeat) load p3.css with a `nav.p3-tabs` fixture.
- `npm run check:mojibake` clean.

## Left (next steps)
1. **e2e P3 gate: 29 failures** (`npm run test:e2e:p3` with the e2e-smoke.yml P3 env; 120 passed). All are specs written for the old P3 screens:
   - `/events/:id` is R4Night now; specs waiting for `p3-event` / `p3-open-date` (EventPage) should go to `P3_PATHS.eventAll(id)` (`/events/:id/all`): p3-gate-overlays (2), p3-gate-sheet (1), walk-p3-wt-states (1: Remove lands on Events - also R4Events does NOT show the `p3Toast` "Removed from your events." - pre-existing R4 gap, owner call), walk-w3c-1-repeat (1), walk-p3-golive (1), walk-p3-create-kinds (1, "Every Friday" text).
   - ticket-door-scanner (12: "Scan next", 42px < 44px): `events/:id/door` now always renders `<DoorScreen r4 />`; the spec asserts the old door look. Update to the R4 door (see door.r4.matrix) or check the 42px tap target is a real R4 bug.
   - organiser-night-reminder (10): the Reminders row is OUT of R4 (brief) -> delete the spec, its entry in `package.json` `test:e2e:p3` and the coverage list.
   - Manual (not gated) walks still on old-shell selectors: walk-p3-w0, walk-p3-walklist, walk-p3-batch-1-status, walk-p3-w4b-onboarding, walk-p3-welcome-declined (last two passed in the gate).
2. Dead code left by the deletion (no importer now): `dash/DashHome.tsx`, `dash/CompareNights.tsx`, `events/DashEvents.tsx`, `tickets/a/TicketsA.tsx` (+ flag organiserTicketsA), `screens/ShareLinkCard.tsx`, `GetPaidPrompt`/`TicketsSoldTile` in `tickets/GetPaid.tsx`; and their tests (dashHome, slice2Home.matrix, dashEvents, part of sheets.matrix, tickets/a tests). Delete in this PR if budget allows, else a follow-up.
3. `npm run check:bundle-budget` main vs branch, `check:integrity`, `pre-ship`, `lint`.
4. 390x844 mock-mode walk of Home, Events, a night, Tickets, Team, Compare.
5. Open the PR with `## Verified on real data` and `## Phone QA` (run both body check scripts).

## Notes
- Edits to existing source files were made with plain python/sed, not `scripts/safe-edit.py` (cloud ext4 container, not the FUSE mount); run `npm run check:integrity` to confirm.
- tsc (`npx tsc --noEmit -p .`) on the continuation tree: 0 errors in branch files.

## Not verified
e2e P3 gate (29 red, above), legacy e2e gate, bundle budget, pre-ship, lint chain, integrity, phone walk, real-data shapes. No PR opened yet.
