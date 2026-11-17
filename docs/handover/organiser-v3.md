# Handover: organiser V3

## Done
- F1: with organiserShellV2 on, a signed-in user with zero organiser pages lands on Welcome (`P3_PATHS.start`) from the bare area URL (`V2Home`) and from the Events tab (`useNoPageRedirect` in `v2/V2Tabs.tsx`). A claim/create that just landed waits for the refetch, as HomeScreen does.
- F2: `V2Home` forwards `location.state`; `V2EventsTab` renders `HomeNotices` (claim/create line, ClaimNotice, GraceBanner), exported from `HomeScreen` and now used by Home itself (no copy).
- Door reach: Guest list tab shows a 44px "Scan tickets at the door" link to `events/:seriesId/door` when `flags.organiserTicketing` is on (same rule as the event page's Scan tickets row; the Door screen keeps its own access refusal).
- Tests: V2Shell.routes.test.tsx (zero pages x2, claim waits for refetch, state forwarded + confirmation shown). Flag-off parity tests still green.
- Walk (tests/e2e/walk-v2-shell.spec.ts, v3 block): Guest list, guest sheet, Raffle, raffle sheet, raffle confirm, contributor seat; light + dark at 390x844; shots in docs/design/organiser-v1-shell/shots/v3-*. `organiser_raffle_night_set_v1` is answered by a route that fails the walk if called; it was not called.

## Plain defaults picked
- Door link shown to every seat when the flag is on (as the event page does), not hidden by role.
- Zero-pages redirect on the Events tab too, not only the bare URL.

## Left
- N1 (`?e=` carried on event-page links and back): skipped, needs more than ~15 lines (P3 `toEvents`/`P3_PATHS.event` callers are shared with the flag-off shell).
- Flag organiserShellV2 stays default OFF.

## Not verified
- Real prod data shapes (no browser walk against prod; fake + route mocks only).
- Raffle and guest-list RPC responses are hand-made mocks of the documented shapes.
- docs/review/REVIEW-organiser-v1-shell-1731.md was not on main or the brief branch; F1/F2 were built from the brief text.
