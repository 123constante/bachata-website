# p3-prefix-d-door: the door screen must never lie or go blank

Lane: normal (no database change). Model: Opus (door check-in is a permission and money-adjacent screen). One PR, branch claude/p3-prefix-d-door from main.

## Owner words
"All four must be fixed before the organiser rebuild goes on." Flags-on walk (docs/review/p3-flags-on-walk.md, branch claude/walk-p3-flags-on-audit):
- D1 (high): src/modules/organiser/p3/door/data.ts:53 maps every list answer that is not exactly `result:'ok'` (null, empty array, a new server shape, a partial answer) to `not_allowed`, so the owner sees "CANNOT CHECK TICKETS ... ask the event's organiser to add you". At the door that reads as a permissions problem when it is a load problem. Only an explicit `not_allowed` may show that card; everything else is an error with Try again.
- D2 (high): a failed lazy chunk on the door route gives a blank screen with no header and no way back (Suspense fallback={null}; door/camera.ts lazy import of jsqr). Wrap the P3 lazy routes in an error boundary with a clear message, Try again, and a back link.
- D4 (medium): tap targets under 44px in P3: sheet Close 38x44, Prices "It's free" switch 22x22, Organiser page "Edit city/year/category" 32x44, Team "Back to the team" 314x40. Fix with explicit px sizes (html font-size is about 13.5px on phones, rem is about 16% small).
Not in scope: ticketing flags stay OFF; this only makes the door safe for when they go on.

## Do
1. Fix D1, D2 and the D4 sizes. Keep the door camera and check-in logic unchanged; if you must touch the check-in call say so.
2. Table-driven test: list answer shape (ok, not_allowed, null, [], unknown, thrown) x screen state; plus a test that a rejected lazy import renders the boundary with a back link. Red first on main; show the red.
3. Add the missing OrganiserFake gaps only if needed for the test (ticket_door_list_v1, ticket_check_in_v1).

## Standing rules
Zero bytes to /app first load (bundle checks on main and branch; never edit perf-budgets.json or vite.config.ts). Overlay geometry rules for any sheet. One independent review, one fix round, then the orchestrator walk. Never merge or approve.
Finish under 35% context, early checkpoint push, PR body with Verified on real data and Phone QA sections. Marker [worker-done p3-prefix-d].
