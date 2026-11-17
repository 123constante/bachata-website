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
