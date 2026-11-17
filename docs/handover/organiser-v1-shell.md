# Handover: organiser V1 shell (dispatch dt_3664d9145ae6)

Brief: `docs/briefs/BRIEF-organiser-v1-shell.md` (branch brief/organiser-v1-shell). Branch: `claude/organiser-v1-shell`.

## Done
- Flag `organiserShellV2` (`VITE_ENABLE_ORGANISER_SHELL_V2`, default off) in `src/lib/featureFlags.ts`; it is on only together with organiserP3 + organiserDash (`shellV2On` in `p3/shell/P3Routes.tsx`).
  Flag OFF: P3Routes renders `P3Shell` and the same routes as before (parity test).
- `src/modules/organiser/p3/v2/`:
  - `V2Shell.tsx`: the frame, the top bar (Back to Bachata Calendar + event switcher), the four tabs, and `EventChoiceProvider` / `useEventChoice`.
  - `eventChoice.ts`: the pure default and resolve rules (`?e=` + sessionStorage `p3v2-event`).
  - `V2Tabs.tsx`: Events + Team, Tickets (`TicketsEntry`), Guest list (`GuestListRow` / `GuestListSheet`), Raffle (`RaffleRow` / `RaffleSheet`).
  - `feedback.tsx`: `ConfirmSheet`, `V2Toast` (no Undo), `vibrate()`.
  - `v2.css`: the look tokens. The accent is #c2410c in light and #fb923c in dark.
- Tests: `p3/v2/__tests__/` (eventChoice, V2Shell.routes incl. flag-off parity, v2Theme.contrast, feedback).
- Walk: `tests/e2e/walk-v2-shell.spec.ts` (manual list in `scripts/check-e2e-spec-coverage.mjs`). The shots are in `docs/design/organiser-v1-shell/shots/`.
- Review: one round at medium. I fixed findings 1-3, 5-7, 9 and 10. I kept finding 8 on purpose, because the brief asks for the helpers.

## Left / next steps
- The You hub's pushed screens (Team, Switch page) still go back to "You". Under V2 that is the old You hub, shown under the Events tab. A V2 Team surface is a follow-up.
- `ConfirmSheet` and `V2Toast` have no caller yet. The next slice should adopt them (e.g. for the cancel-night flows when they move into V2).
- Walk the live guest list and raffle (flags ON) and the contributor seat under the V2 look; walk at 360x640.
- Owner phone test, with the flag on in a Vercel preview env.

## Bundle-budget fix (dispatch dt_a8abf8b52521, brief BRIEF-organiser-v1-bundle-fix)
- Cause 1 (/event/:id +1 file, +3.2 KB gz): `shellV2On(flags)` passed the WHOLE `flags` object to a function. Rollup then stops constant-folding every flag in the bundle, so flag-gated dead code comes back on every route (about +1.3 KB on all of them). One piece was the raffle board code, which became its own `useRaffleBoard` chunk in /event's first load. Fix: `v2Live()` in `P3Routes.tsx` reads each flag by name. `shellV2On` keeps its signature for the test.
- Cause 2 (/app/* chunk ratchet 49 vs 48): `src/lib/ticketBookingFee.ts` (one constant) was cut into its own chunk, because the V2 Tickets tab's static `ticketModel` import put its two importers in different chunks. Fix: it is now pinned in `LIB_EVENT_RULES_MODULES` (vite.chunks.ts), the same way as paymentMethods/paths.
- Tried, did not help: lazy-loading V2Shell/V2Tabs (dancer-app stayed at 49). It was reverted.
- Measured with the perf-budget.yml env on `npm run build` + `npm run check:bundle-budget`: every budgeted route is back to main fffedcc's local numbers (event 379.8 KB / 39 files, dancer-app 379.9 KB / 48, home 209.6 / 35). Every ratchet is green, and `perf-budgets.json` is unchanged.
- Lesson: never pass `flags` as a value. Read `flags.x` by name.
- tsc run on 8d72a20: 0 errors in branch files. Perf Budget job steps all exit 0 locally. Lint: only check:no-social-word is red (it is red on main too). Not verified: CI at the head (pending), and no browser re-walk (no UI change).
