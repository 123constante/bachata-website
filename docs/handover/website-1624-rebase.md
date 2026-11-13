# Website #1624 rebase handover

Head before this doc: fa2a1213 (origin/main f6bd1dbc is already an ancestor, via merge commit fa2a121 "Merge origin/main into guest list branch"). `git merge origin/main` reported "Already up to date", so no new merge was needed.

## Entries kept (verified in the tree, no conflict markers)
- `src/lib/featureFlags.ts`: `organiserGuestListLive` (this PR) and `ticketPriceStepsEditor` (#1625).
- `scripts/onboarding-write-doors.json` (`not_event_writes`): the five guest-list doors (`organiser_guest_list_set_night_v1`, `_add_v1`, `_remove_v1`, `_restore_v1`, `organiser_undo_check_in_guest_v1`) and main's `ticket_price_step_set_v1`. File parses as valid JSON.

## Verified
- `check-onboarding-write-doors.mjs`: 0 violations (1 expected-pending WARN, unchanged).
- vitest on `src/modules/organiser/p3/guestlist` and `src/lib`: 70 files, 1941 passed.

## Not verified / open
- Full `npm run test:unit` did not finish inside the 10 min tool limit; only the scoped run above was done.
- tsc (`tsc -p tsconfig.app.json --noEmit`) on fa2a121: 148 errors total. Three are in `src/modules/organiser/p3/guestlist/GuestListSheet.tsx` (lines 96, 111, 217: `Property 'reason' does not exist` on `Outcome`, `GuestRead`, `ScanOutcome`). These come from the PR's own code, not the merge. Left unfixed because the brief says change nothing else. Needs a follow-up fix.
- No browser walk (no UI change in this task).
